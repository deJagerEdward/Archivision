import Anthropic from '@anthropic-ai/sdk';
import { withBackoff } from './retry.js';

export const MODEL = 'claude-opus-5-5';
export const MODEL_LABEL = 'Claude Opus 5.5';

// Opus 5.5 defaults to "medium" effort; set it explicitly. Raise to "high" for
// more careful drawings at the cost of slower, pricier runs.
const EFFORT = 'medium';

/** 429 rate limits, 529 overloaded, other 5xx, and network failures are worth retrying. */
function isRetryable(err) {
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.OverloadedError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError
  );
}

function retryAfterMs(err) {
  const v = err?.headers?.get?.('retry-after');
  const s = v ? Number(v) : NaN;
  return Number.isFinite(s) ? s * 1000 : null;
}

export function readableError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'The API key was rejected. Check it in the sidebar.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use this model.';
  if (err instanceof Anthropic.PaymentRequiredError) return 'Your Anthropic account is out of credit.';
  if (err instanceof Anthropic.RateLimitError) return 'Still rate limited after several retries. Wait a minute and regenerate.';
  if (err instanceof Anthropic.OverloadedError) return 'Claude is overloaded right now. Try this diagram again shortly.';
  if (err instanceof Anthropic.BadRequestError) return `Request rejected: ${err.message?.slice(0, 180)}`;
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check your connection.';
  return err?.message?.slice(0, 220) || 'Generation failed.';
}

const SYSTEM = `You are an expert architectural illustrator who draws competition-board diagrams as hand-authored SVG.
You read the architect's sketch or massing model carefully and translate it faithfully into precise vector drawings.
Reply with exactly one complete, standalone SVG document and nothing else: no prose, no markdown fences.`;

/** Pulls the <svg>…</svg> document out of the reply and makes sure it renders standalone. */
function extractSvg(text) {
  const m = text.match(/<svg[\s\S]*<\/svg>/i);
  if (!m) return null;
  let svg = m[0];
  if (!/xmlns=/.test(svg.slice(0, 300))) svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}

/**
 * Asks Claude to draw one diagram from the reference image.
 * Returns { dataUrl, mimeType, svg }. The SVG is shown through <img>, so any script in it never runs.
 */
export async function generateDiagram({ apiKey, image, prompt, signal, onRetry }) {
  // A user-supplied key used straight from the browser; it is never sent anywhere but api.anthropic.com.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });

  const message = await withBackoff(
    async () => {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 64000,
          thinking: { type: 'adaptive' },
          output_config: { effort: EFFORT },
          // If a safety classifier declines, the API reruns the request on a fallback model.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SYSTEM,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        },
        { signal },
      );
      return stream.finalMessage();
    },
    { signal, onRetry, isRetryable, retryAfterMs },
  );

  if (message.stop_reason === 'refusal') {
    throw new Error('Claude declined to draw this one. Try a cleaner sketch or regenerate.');
  }
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const svg = extractSvg(text);
  if (!svg) {
    throw new Error(
      message.stop_reason === 'max_tokens' ? 'The drawing ran too long and was cut off. Regenerate.' : 'Claude did not return an SVG drawing.',
    );
  }
  return {
    svg,
    mimeType: 'image/svg+xml',
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
}

/** Reads a File into { base64, mimeType, dataUrl }, downscaling large images (Claude works best ≤1568px). */
export async function fileToImage(file, maxSide = 1568) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not read that image.'));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  let outUrl = dataUrl;
  let mimeType = file.type || 'image/png';
  if (scale < 1 || !/^image\/(png|jpeg|webp|gif)$/.test(mimeType)) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    mimeType = 'image/jpeg';
    outUrl = canvas.toDataURL(mimeType, 0.92);
  }
  return { dataUrl: outUrl, base64: outUrl.split(',')[1], mimeType, width: img.width, height: img.height, name: file.name, size: file.size };
}
