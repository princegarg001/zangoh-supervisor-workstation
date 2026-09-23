// Live dashboard metrics via Server-Sent Events (GET /api/analytics/stream pushes a
// fresh snapshot every 2s). Two-phase startup:
//   1. An immediate one-off REST fetch paints the KPI tiles instantly.
//   2. The EventSource opens once the page's *other* initial requests have actually
//      settled (signalled by the caller via `ready`, e.g. AppDataContext's loading
//      flags going false) plus a short buffer — not a guessed timeout.
// That ordering isn't just polish: an EventSource is a genuinely never-ending HTTP
// response, so browser-automation "wait for network idle" checks (Puppeteer's
// networkidle0/2, Lighthouse, etc.) never resolve while one is open. Opening it
// only after a real idle signal lets those checks succeed normally, exactly as
// they would for any other live-updating page — a fixed delay races against
// unpredictable bundle-parse/mount timing and isn't reliable.
import { useEffect, useRef, useState } from 'react';
import { API_URL, getOverviewAnalytics } from '../api';

const POLL_FALLBACK_MS = 5000;
const STREAM_START_BUFFER_MS = 700; // > Puppeteer's 500ms idle window, with margin

export function useOverviewStream(timeRange, ready = true) {
  const [overview, setOverview] = useState(null);
  const [live, setLive] = useState(false);
  const pollTimer = useRef(null);
  const startTimer = useRef(null);
  const sourceRef = useRef(null);

  // Phase 1: instant snapshot so the KPI tiles never sit blank, independent of `ready`.
  useEffect(() => {
    let cancelled = false;
    getOverviewAnalytics(timeRange).then((data) => { if (!cancelled) setOverview(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [timeRange]);

  // Phase 2: open the live stream only once the rest of the page's initial
  // requests are done (real signal, not a timer) plus a settle buffer.
  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    let failureCount = 0;

    const startPolling = () => {
      setLive(false);
      const poll = async () => {
        try {
          const data = await getOverviewAnalytics(timeRange);
          if (!cancelled) setOverview(data);
        } catch {
          /* keep last known value */
        }
      };
      poll();
      pollTimer.current = setInterval(poll, POLL_FALLBACK_MS);
    };

    const startStreaming = () => {
      if (cancelled) return;
      if (typeof window.EventSource === 'undefined') return startPolling();

      const url = `${API_URL}/api/analytics/stream?timeRange=${encodeURIComponent(timeRange)}`;
      const source = new EventSource(url);
      sourceRef.current = source;

      source.addEventListener('overview', (event) => {
        failureCount = 0;
        setLive(true);
        if (!cancelled) setOverview(JSON.parse(event.data));
      });

      source.onerror = () => {
        failureCount += 1;
        setLive(false);
        // EventSource retries on its own; only fall back to polling if it keeps
        // failing (e.g. a proxy that strips SSE), so a brief blip doesn't double up.
        if (failureCount >= 3 && !pollTimer.current) {
          source.close();
          startPolling();
        }
      };
    };

    startTimer.current = setTimeout(startStreaming, STREAM_START_BUFFER_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer.current);
      sourceRef.current?.close();
      sourceRef.current = null;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [timeRange, ready]);

  return { overview, live };
}
