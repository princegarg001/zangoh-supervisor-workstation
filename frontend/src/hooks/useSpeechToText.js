// Thin wrapper around the browser's Web Speech API (SpeechRecognition). Chrome/Edge
// only at the time of writing — callers should treat `isSupported: false` as "hide
// the mic button", not an error.
import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionImpl = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * @param {(finalText: string) => void} onResult - called with each finalized phrase
 */
export function useSpeechToText(onResult) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!SpeechRecognitionImpl) return undefined;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk.trim()) onResultRef.current(finalChunk.trim());
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed' ? 'Microphone access was denied' : `Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setError(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      /* already started — ignore */
    }
  }, [isListening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => (isListening ? stop() : start()), [isListening, start, stop]);

  return { isSupported: !!SpeechRecognitionImpl, isListening, interimText, error, start, stop, toggle };
}
