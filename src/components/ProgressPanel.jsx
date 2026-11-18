import { motion, AnimatePresence } from 'motion/react';
import { Check, Loader2, AlertTriangle, Clock, Circle } from 'lucide-react';
import { TASKS } from '../lib/tasks.js';

function StatusIcon({ status }) {
  if (status === 'done') return <Check className="size-3.5" strokeWidth={2.5} />;
  if (status === 'running') return <Loader2 className="size-3.5 animate-spin" />;
  if (status === 'retrying') return <Clock className="size-3.5" />;
  if (status === 'error') return <AlertTriangle className="size-3.5" />;
  return <Circle className="size-2" fill="currentColor" />;
}

const tone = {
  done: 'bg-olive text-paper',
  running: 'bg-ink text-paper',
  retrying: 'bg-[#B8862F] text-paper',
  error: 'bg-[#9A3B2E] text-paper',
  idle: 'bg-paper-deep text-stone',
  waiting: 'bg-paper-deep text-stone',
};

export default function ProgressPanel({ results, phase, statusLine, running }) {
  const done = TASKS.filter((t) => results[t.id]?.status === 'done').length;
  const settled = TASKS.filter((t) => ['done', 'error'].includes(results[t.id]?.status)).length;
  const pct = Math.round((settled / TASKS.length) * 100);

  return (
    <section className="rounded-[2rem] bg-white p-6 card-shadow">
      <div className="flex items-end justify-between">
        <div>
          <p className="micro-label">Generation</p>
          <p className="mt-1 text-[2.5rem] display tabular-nums">
            {done}
            <span className="text-stone/60">/{TASKS.length}</span>
          </p>
        </div>
        <p className="micro-label !text-ink tabular-nums">{pct}%</p>
      </div>

      <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-paper-deep">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-olive ${running ? 'shimmer overflow-hidden' : ''}`}
          initial={false}
          animate={{ width: `${Math.max(running ? 3 : 0, pct)}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>

      <div className="mt-4 min-h-[2.75rem]">
        <AnimatePresence mode="wait">
          <motion.p
            key={statusLine}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-sm leading-snug text-ink"
          >
            {statusLine}
          </motion.p>
        </AnimatePresence>
      </div>

      <ol className="mt-3 space-y-1.5">
        {TASKS.map((t) => {
          const r = results[t.id] ?? { status: 'idle' };
          const active = r.status === 'running' || r.status === 'retrying';
          return (
            <li
              key={t.id}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-1.5 transition-colors ${active ? 'bg-paper' : ''}`}
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${tone[r.status] ?? tone.idle}`}>
                <StatusIcon status={r.status} />
              </span>
              <span className="font-mono text-[0.7rem] text-stone">{t.index}</span>
              <span className={`flex-1 truncate text-sm ${active ? 'font-semibold' : r.status === 'done' ? 'text-ink' : 'text-ink/60'}`}>
                {t.title}
              </span>
              {r.status === 'retrying' && <span className="micro-label !text-[0.7rem] !text-[#B8862F]">retry {r.attempt}</span>}
              {r.status === 'error' && <span className="micro-label !text-[0.7rem] !text-[#9A3B2E]">failed</span>}
            </li>
          );
        })}
      </ol>
      {phase === 'cooldown' && (
        <p className="mt-3 micro-label !text-[0.72rem]">Pausing 2s between tasks to respect rate limits</p>
      )}
    </section>
  );
}
