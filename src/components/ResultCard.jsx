import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, Maximize2, RotateCcw, AlertTriangle, Loader2, Clock } from 'lucide-react';

const aspectClass = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
  '16:9': 'aspect-video',
};

export function extFor(mimeType) {
  return mimeType === 'image/svg+xml' ? 'svg' : mimeType?.split('/')[1] ?? 'png';
}

function useElapsed(active) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return Math.max(0, Math.round((now - start) / 1000));
}

export function downloadImage(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function ResultCard({ task, result, onOpen, onRegenerate, busy, projectSlug, order }) {
  const status = result?.status ?? 'idle';
  const ext = extFor(result?.mimeType);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: order * 0.04 }}
      className="mb-6 break-inside-avoid overflow-hidden rounded-[2rem] bg-white card-shadow"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0">
          <p className="micro-label">
            <span className="font-mono normal-case tracking-normal">{task.index}</span> · {task.meta}
          </p>
          <h3 className="mt-1 text-xl font-bold tracking-[-0.03em] leading-tight">{task.title}</h3>
        </div>
        {status === 'done' && (
          <div className="flex shrink-0 gap-1.5">
            <IconBtn title="Regenerate" onClick={onRegenerate} disabled={busy}><RotateCcw className="size-4" /></IconBtn>
            <IconBtn title="Download" onClick={() => downloadImage(result.dataUrl, `${projectSlug}-${task.index}-${task.id}.${ext}`)}>
              <Download className="size-4" />
            </IconBtn>
            <IconBtn title="View full size" onClick={onOpen}><Maximize2 className="size-4" /></IconBtn>
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        {status === 'done' ? (
          <motion.button
            type="button"
            onClick={onOpen}
            initial={{ opacity: 0, filter: 'blur(12px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8 }}
            className="block w-full overflow-hidden rounded-[1.5rem] bg-paper cursor-zoom-in"
          >
            <img src={result.dataUrl} alt={task.title} className="block w-full transition-transform duration-700 hover:scale-[1.02]" />
          </motion.button>
        ) : (
          <div className={`relative overflow-hidden rounded-[1.5rem] bg-paper blueprint-grid ${aspectClass[task.aspect] ?? 'aspect-square'}`}>
            <Placeholder status={status} result={result} onRetry={onRegenerate} busy={busy} />
          </div>
        )}
      </div>
    </motion.article>
  );
}

function IconBtn({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="grid size-9 place-items-center rounded-full border border-line text-ink transition hover:bg-ink hover:text-paper hover:border-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
    >
      {children}
    </button>
  );
}

function Placeholder({ status, result, onRetry, busy }) {
  if (status === 'running' || status === 'retrying') return <Working status={status} result={result} />;
  if (status === 'error') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="size-6 text-[#9A3B2E]" />
        <p className="max-w-xs text-sm text-ink/80">{result?.error}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="mt-1 rounded-full bg-ink px-4 py-2 text-xs font-semibold tracking-wide text-paper disabled:opacity-40"
        >
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 grid place-items-center">
      <p className="micro-label">Queued</p>
    </div>
  );
}

function Working({ status, result }) {
  const elapsed = useElapsed(true);
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="shimmer absolute inset-0 overflow-hidden" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-ink text-paper">
          {status === 'retrying' ? <Clock className="size-5" /> : <Loader2 className="size-5 animate-spin" />}
        </span>
        <p className="micro-label !text-ink">
          {status === 'retrying'
            ? `Rate limited · retry ${result.attempt} in ${Math.round(result.delayMs / 1000)}s`
            : `Drafting · ${elapsed}s`}
        </p>
      </div>
    </div>
  );
}
