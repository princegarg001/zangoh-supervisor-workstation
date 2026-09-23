// Lexicon-based sentiment scorer (mock of an LLM sentiment endpoint).
// Returns a 0..1 score where 0.5 is neutral.

const POSITIVE = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'helpful', 'thank', 'thanks',
  'appreciate', 'happy', 'pleased', 'love', 'like', 'perfect', 'awesome', 'resolved', 'quick',
]);
const NEGATIVE = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'disappointed', 'frustrating', 'frustrated', 'angry',
  'upset', 'annoyed', 'unhappy', 'hate', 'dislike', 'problem', 'issue', 'wrong', 'mistake', 'error',
  'delay', 'delayed', 'broken', 'failure', 'fail', 'unacceptable', 'ridiculous', 'useless', 'worst',
  'refund', 'still', 'never', 'damaged', 'late', 'waiting',
]);
const INTENSIFIERS = new Set(['very', 'extremely', 'incredibly', 'really', 'so', 'too', 'absolutely', 'completely']);

function analyzeSentiment(text = '') {
  const words = text.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z']/g, '')).filter(Boolean);
  let positive = 0;
  let negative = 0;
  let intensity = (text.match(/!/g) || []).length;
  const keywords = [];

  for (const word of words) {
    if (POSITIVE.has(word)) { positive += 1; keywords.push(word); }
    if (NEGATIVE.has(word)) { negative += 1; keywords.push(word); }
    if (INTENSIFIERS.has(word)) intensity += 1;
  }
  // Simple negation handling: "not helpful" flips positives.
  if (/\b(not|n't|no)\b/.test(text.toLowerCase()) && positive > 0) {
    const flipped = Math.min(positive, 2);
    positive -= flipped;
    negative += flipped;
  }

  const total = positive + negative;
  let score = total === 0 ? 0.5 : 0.5 + (0.5 * (positive - negative)) / total;
  if (score < 0.5) score = Math.max(0.05, score - intensity * 0.05);
  if (score > 0.5) score = Math.min(0.95, score + intensity * 0.03);

  let emotion = 'neutral';
  if (score < 0.3) emotion = 'angry';
  else if (score < 0.4) emotion = 'frustrated';
  else if (score < 0.45) emotion = 'disappointed';
  else if (score > 0.8) emotion = 'delighted';
  else if (score > 0.6) emotion = 'satisfied';

  return {
    score: Number(score.toFixed(2)),
    emotion,
    intensity: intensity === 0 ? 'low' : intensity === 1 ? 'medium' : 'high',
    keywords: [...new Set(keywords)].slice(0, 3),
  };
}

module.exports = { analyzeSentiment };
