import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

const MODEL_ROOT = new URL('../proof/', import.meta.url).href;
const MODEL_ID = 'models';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = MODEL_ROOT;
env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);

/** @type {import('@huggingface/transformers').TokenClassificationPipeline | null} */
let classifier = null;

async function getClassifier(progress) {
  if (classifier) return classifier;
  classifier = await pipeline('token-classification', MODEL_ID, {
    dtype: 'q8',
    progress_callback: progress,
  });
  return classifier;
}

function splitChunks(text, maxLen = 180) {
  const chunks = [];
  const paragraphs = text.split('\n');
  let current = '';

  const flush = () => {
    if (current) {
      chunks.push(current);
      current = '';
    }
  };

  for (let p = 0; p < paragraphs.length; p += 1) {
    const para = paragraphs[p];
    if (!para) {
      flush();
      if (p < paragraphs.length - 1) chunks.push({ text: '\n', offset: 0, newline: true });
      continue;
    }

    const sentences = para.split(/(?<=[。！？!?])/);
    for (const sentence of sentences) {
      if (!sentence) continue;
      if ((current + sentence).length > maxLen && current) flush();
      if (sentence.length > maxLen) {
        flush();
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push({ text: sentence.slice(i, i + maxLen), offset: 0, newline: false });
        }
      } else {
        current += sentence;
      }
    }
    flush();
    if (p < paragraphs.length - 1) chunks.push({ text: '\n', offset: 0, newline: true });
  }

  let offset = 0;
  return chunks.map((chunk) => {
    const item = { ...chunk, offset };
    offset += chunk.text.length;
    return item;
  });
}

self.addEventListener('message', async (event) => {
  const { id, type, text } = event.data || {};

  try {
    if (type === 'load') {
      await getClassifier((data) => {
        self.postMessage({ id, type: 'progress', data });
      });
      self.postMessage({ id, type: 'ready' });
      return;
    }

    if (type === 'analyze') {
      const pipe = await getClassifier((data) => {
        self.postMessage({ id, type: 'progress', data });
      });

      const input = String(text || '');
      const parts = input.length > 200 ? splitChunks(input) : [{ text: input, offset: 0, newline: false }];
      const allTokens = [];

      for (const part of parts) {
        if (!part.text) continue;
        const tokens = await pipe(part.text, { aggregation_strategy: 'none' });
        for (const token of tokens) {
          allTokens.push({
            entity: token.entity,
            score: token.score,
            index: token.index + part.offset,
          });
        }
      }

      self.postMessage({ id, type: 'result', tokens: allTokens });
      return;
    }

    self.postMessage({ id, type: 'error', message: `Unknown message type: ${type}` });
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
