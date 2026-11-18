import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Square, KeyRound, Eye, EyeOff, Download, Layers, ArrowUpRight, FlaskConical, PenLine } from 'lucide-react';
import { generateDemoDiagram, loadSampleSketch } from './lib/demo.js';
import UploadZone from './components/UploadZone.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import ResultCard, { downloadImage, extFor } from './components/ResultCard.jsx';
import Lightbox from './components/Lightbox.jsx';
import { TASKS, buildPrompt } from './lib/tasks.js';
import { MODEL, MODEL_LABEL, fileToImage, generateDiagram, readableError } from './lib/claude.js';
import { INTER_TASK_DELAY_MS, AbortedError, sleep } from './lib/retry.js';

const KEY_STORAGE = 'archivision.anthropicKey';

function loadKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  } catch {
    return import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  }
}

function slugify(s) {
  return (s || 'archivision').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'archivision';
}

export default function App() {
  const [apiKey, setApiKey] = useState(loadKey);
  const [rememberKey, setRememberKey] = useState(() => {
    try { return !!localStorage.getItem(KEY_STORAGE); } catch { return false; }
  });
  const [showKey, setShowKey] = useState(false);
  const [project, setProject] = useState({ name: '', typology: '', brief: '' });
  const [image, setImage] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [statusLine, setStatusLine] = useState('Upload a sketch to begin.');
  const [lightboxId, setLightboxId] = useState(null);
  const abortRef = useRef(null);
  const runIdRef = useRef(0);
  const [demoMode, setDemoMode] = useState(() => !loadKey());

  // In demo mode, start with the bundled sample sketch so the flow can be tried in one click.
  useEffect(() => {
    if (demoMode && !image) useSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function useSample() {
    try {
      const img = await loadSampleSketch();
      setImage(img);
      setResults({});
      setUploadError('');
      setStatusLine('Sample sketch loaded. Press Develop Concept.');
    } catch {
      setUploadError('Could not load the sample sketch.');
    }
  }

  const projectSlug = slugify(project.name);
  const canRun = !!image && (demoMode || !!apiKey.trim()) && !running;
  const hasRun = Object.keys(results).length > 0;
  const doneTasks = TASKS.filter((t) => results[t.id]?.status === 'done');

  const patch = useCallback((id, value) => {
    setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...value } }));
  }, []);

  function saveKey(value) {
    setApiKey(value);
    try {
      if (rememberKey) localStorage.setItem(KEY_STORAGE, value);
    } catch { /* storage unavailable */ }
  }

  function toggleRemember(next) {
    setRememberKey(next);
    try {
      if (next) localStorage.setItem(KEY_STORAGE, apiKey);
      else localStorage.removeItem(KEY_STORAGE);
    } catch { /* storage unavailable */ }
  }

  async function handleFile(file) {
    setUploadError('');
    try {
      const img = await fileToImage(file);
      setImage(img);
      setResults({});
      setStatusLine('Ready. Press Develop Concept to generate the suite.');
    } catch (e) {
      setUploadError(e.message);
    }
  }

  async function runTask(task, signal) {
    patch(task.id, { status: 'running', error: null, attempt: 0 });
    setStatusLine(`Generating ${task.title}…`);
    try {
      const onRetry = ({ attempt, delayMs }) => {
          patch(task.id, { status: 'retrying', attempt, delayMs });
          setStatusLine(`${task.title}: rate limited, retry ${attempt} in ${Math.round(delayMs / 1000)}s`);
          setTimeout(() => {
            setResults((prev) =>
              prev[task.id]?.status === 'retrying' && prev[task.id]?.attempt === attempt
                ? { ...prev, [task.id]: { ...prev[task.id], status: 'running' } }
                : prev,
            );
          }, delayMs);
      };
      const out = demoMode
        ? await generateDemoDiagram({ task, signal, onRetry, runId: runIdRef.current })
        : await generateDiagram({
            apiKey: apiKey.trim(),
            image,
            prompt: buildPrompt(task, project),
            signal,
            onRetry,
          });
      patch(task.id, { status: 'done', ...out, finishedAt: Date.now() });
      return true;
    } catch (e) {
      if (e instanceof AbortedError || signal.aborted) {
        patch(task.id, { status: 'idle' });
        throw new AbortedError();
      }
      console.error(`[Archivision] ${task.id} failed`, e);
      patch(task.id, { status: 'error', error: readableError(e) });
      return false;
    }
  }

  async function developConcept() {
    if (!canRun) return;
    runIdRef.current += 1;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResults(Object.fromEntries(TASKS.map((t) => [t.id, { status: 'waiting' }])));

    let ok = 0;
    try {
      for (let i = 0; i < TASKS.length; i++) {
        setPhase('generating');
        if (await runTask(TASKS[i], controller.signal)) ok++;
        if (i < TASKS.length - 1) {
          setPhase('cooldown');
          setStatusLine(`Pausing before ${TASKS[i + 1].title}…`);
          await sleep(INTER_TASK_DELAY_MS, controller.signal);
        }
      }
      setStatusLine(
        ok === TASKS.length
          ? 'Concept suite complete. All 7 diagrams generated.'
          : `Finished with ${ok} of ${TASKS.length} diagrams. Retry the failed ones from their cards.`,
      );
    } catch (e) {
      if (e instanceof AbortedError) {
        setResults((prev) =>
          Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v.status === 'done' ? v : { status: 'idle' }])),
        );
        setStatusLine('Generation stopped.');
      }
    } finally {
      setRunning(false);
      setPhase('idle');
      abortRef.current = null;
    }
  }

  async function regenerate(task) {
    if (!canRun) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setPhase('generating');
    try {
      const ok = await runTask(task, controller.signal);
      setStatusLine(ok ? `${task.title} regenerated.` : `${task.title} failed again.`);
    } catch {
      setStatusLine('Generation stopped.');
    } finally {
      setRunning(false);
      setPhase('idle');
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function downloadAll() {
    for (const t of doneTasks) {
      const r = results[t.id];
      downloadImage(r.dataUrl, `${projectSlug}-${t.index}-${t.id}.${extFor(r.mimeType)}`);
      await sleep(350);
    }
  }

  const lightboxItem = useMemo(() => {
    if (!lightboxId) return null;
    const task = TASKS.find((t) => t.id === lightboxId);
    return task && results[task.id]?.status === 'done' ? { task, result: results[task.id] } : null;
  }, [lightboxId, results]);

  const step = useCallback(
    (dir) => {
      const ids = doneTasks.map((t) => t.id);
      if (!ids.length) return;
      const i = ids.indexOf(lightboxId);
      setLightboxId(ids[(i + dir + ids.length) % ids.length]);
    },
    [doneTasks, lightboxId],
  );

  const gridTasks = TASKS.filter((t) => !t.wide);
  const wideTasks = TASKS.filter((t) => t.wide);

  return (
    <div className="min-h-full lg:flex">
      {/* ───────────── Sidebar ───────────── */}
      <aside className="quiet-scroll border-line lg:sticky lg:top-0 lg:h-screen lg:w-[450px] lg:shrink-0 lg:overflow-y-auto lg:border-r">
        <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
          <header className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-ink text-paper">
                  <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
                    <path d="M8 23 16 8l8 15M11.5 17h9" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="micro-label !text-ink">Concept Studio</span>
              </div>
              <h1 className="mt-5 text-[3.25rem] display">Archivision</h1>
              <p className="mt-3 max-w-[20rem] text-[0.95rem] leading-relaxed text-ink/70">
                One sketch in. A competition-ready suite of seven analytical diagrams out.
              </p>
            </div>
          </header>

          {/* API key */}
          <section className="rounded-[2rem] bg-white p-6 card-shadow">
            <div className="flex items-center justify-between">
              <label htmlFor="key" className="micro-label flex items-center gap-1.5">
                <KeyRound className="size-3.5" /> Anthropic API key
              </label>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="micro-label flex items-center gap-0.5 !text-olive hover:!text-ink"
              >
                Get a key <ArrowUpRight className="size-3" />
              </a>
            </div>
            <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-line bg-paper/60 px-3.5 focus-within:border-ink">
              <input
                id="key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => saveKey(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
                className="h-11 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-stone/60"
              />
              <button type="button" onClick={() => setShowKey((s) => !s)} className="text-stone hover:text-ink" title={showKey ? 'Hide' : 'Show'}>
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={demoMode}
              disabled={running}
              onClick={() => setDemoMode((d) => !d)}
              className={`mt-4 flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                demoMode ? 'border-olive/40 bg-olive/8' : 'border-line hover:bg-paper/60'
              } disabled:opacity-60`}
            >
              <FlaskConical className={`size-4 shrink-0 ${demoMode ? 'text-olive' : 'text-stone'}`} />
              <span className="flex-1">
                <span className="block text-sm font-semibold tracking-tight">Demo mode</span>
                <span className="block text-xs text-ink/60">Sample diagrams, no key or API calls</span>
              </span>
              <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${demoMode ? 'bg-olive' : 'bg-[#D2D0C4]'}`}>
                <motion.span
                  className="absolute top-1 size-4 rounded-full bg-white shadow"
                  initial={false}
                  animate={{ left: demoMode ? 20 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              </span>
            </button>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink/70">
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={(e) => toggleRemember(e.target.checked)}
                className="size-3.5 accent-[#5A5A40]"
              />
              Remember on this device
            </label>
          </section>

          {/* Project */}
          <section className="rounded-[2rem] bg-white p-6 card-shadow">
            <p className="micro-label">Project</p>
            <div className="mt-3 space-y-3">
              <Field label="Name" value={project.name} onChange={(v) => setProject((p) => ({ ...p, name: v }))} placeholder="Harbour Library" disabled={running} />
              <Field label="Typology" value={project.typology} onChange={(v) => setProject((p) => ({ ...p, typology: v }))} placeholder="Mixed-use · library, café, co-working" disabled={running} />
              <Field
                label="Design intent"
                value={project.brief}
                onChange={(v) => setProject((p) => ({ ...p, brief: v }))}
                placeholder="Stepped terraces opening to the waterfront, public ground floor…"
                multiline
                disabled={running}
              />
            </div>
          </section>

          {/* Upload */}
          <section>
            <p className="micro-label mb-3 px-1">Source · sketch or massing</p>
            <UploadZone image={image} onFile={handleFile} onClear={() => { setImage(null); setResults({}); setStatusLine('Upload a sketch to begin.'); }} disabled={running} />
            {uploadError && <p className="mt-2 px-1 text-sm text-[#9A3B2E]">{uploadError}</p>}
            {!running && (
              <button
                type="button"
                onClick={useSample}
                className="mt-3 flex items-center gap-1.5 px-1 text-xs font-semibold text-olive hover:text-ink"
              >
                <PenLine className="size-3.5" /> Use the sample sketch
              </button>
            )}
          </section>

          {/* Action */}
          <div className="flex gap-2">
            <motion.button
              type="button"
              whileTap={canRun ? { scale: 0.98 } : undefined}
              onClick={developConcept}
              disabled={!canRun}
              className="group flex h-14 flex-1 items-center justify-center gap-2.5 rounded-full bg-olive text-[0.95rem] font-semibold tracking-tight text-paper transition-colors hover:bg-olive-deep disabled:cursor-not-allowed disabled:bg-[#B9B8A6]"
            >
              <Sparkles className="size-4.5 transition-transform group-hover:rotate-12" />
              {running ? 'Developing…' : hasRun ? 'Develop Again' : 'Develop Concept'}
            </motion.button>
            <AnimatePresence>
              {running && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 56 }}
                  exit={{ opacity: 0, width: 0 }}
                  onClick={stop}
                  className="grid h-14 shrink-0 place-items-center rounded-full bg-ink text-paper"
                  title="Stop"
                >
                  <Square className="size-4" fill="currentColor" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          {!demoMode && !apiKey.trim() && <p className="-mt-3 px-1 text-xs text-stone">Add an Anthropic API key, or switch on demo mode.</p>}

          {/* Progress */}
          <AnimatePresence>
            {hasRun && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
                <ProgressPanel results={results} phase={phase} statusLine={statusLine} running={running} />
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="mt-auto flex items-center justify-between px-1 pt-2">
            <span className="micro-label !text-[0.72rem]" title={MODEL}>Model · {demoMode ? 'Demo (offline)' : MODEL_LABEL}</span>
            <span className="micro-label !text-[0.72rem]">v1.0</span>
          </footer>
        </div>
      </aside>

      {/* ───────────── Results ───────────── */}
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="micro-label flex items-center gap-2">
              Concept suite{project.name && ` · ${project.name}`}
              {demoMode && (
                <span className="rounded-full bg-olive px-2 py-0.5 text-[0.65rem] tracking-[0.14em] text-paper">Demo</span>
              )}
            </p>
            <h2 className="mt-1.5 text-[2.25rem] display sm:text-[2.75rem]">
              {hasRun ? 'Analytical Diagrams' : 'Seven views, one idea'}
            </h2>
          </div>
          {doneTasks.length > 0 && (
            <button
              type="button"
              onClick={downloadAll}
              className="flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-white px-5 text-sm font-semibold tracking-tight card-shadow hover:bg-ink hover:text-paper"
            >
              <Download className="size-4" /> Download {doneTasks.length === TASKS.length ? 'all' : `${doneTasks.length}`}
            </button>
          )}
        </div>

        <AnimatePresence>
          {running && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="sticky top-4 z-30 mb-6 flex items-center gap-4 rounded-full bg-ink py-2.5 pr-5 pl-2.5 text-paper card-shadow"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-olive">
                <Sparkles className="size-4 animate-pulse" />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{statusLine}</p>
              <span className="hidden font-mono text-xs text-paper/60 sm:block">
                {TASKS.filter((t) => ['done', 'error'].includes(results[t.id]?.status)).length}/{TASKS.length}
              </span>
              <div className="relative hidden h-1.5 w-40 overflow-hidden rounded-full bg-paper/15 sm:block">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-paper"
                  initial={false}
                  animate={{
                    width: `${Math.max(4, (TASKS.filter((t) => ['done', 'error'].includes(results[t.id]?.status)).length / TASKS.length) * 100)}%`,
                  }}
                  transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {hasRun ? (
          <>
            <div className="columns-1 gap-6 xl:columns-2 min-[1800px]:columns-3">
              {gridTasks.map((t, i) => (
                <ResultCard
                  key={t.id}
                  task={t}
                  order={i}
                  result={results[t.id]}
                  busy={running}
                  projectSlug={projectSlug}
                  onOpen={() => setLightboxId(t.id)}
                  onRegenerate={() => regenerate(t)}
                />
              ))}
            </div>
            {wideTasks.map((t) => (
              <div key={t.id} className="mx-auto max-w-4xl">
                <ResultCard
                  task={t}
                  order={gridTasks.length}
                  result={results[t.id]}
                  busy={running}
                  projectSlug={projectSlug}
                  onOpen={() => setLightboxId(t.id)}
                  onRegenerate={() => regenerate(t)}
                />
              </div>
            ))}
          </>
        ) : (
          <EmptyState hasImage={!!image} />
        )}
      </main>

      <Lightbox
        item={lightboxItem}
        projectSlug={projectSlug}
        onClose={() => setLightboxId(null)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline, disabled }) {
  const cls =
    'w-full rounded-2xl border border-line bg-paper/60 px-3.5 text-sm outline-none transition placeholder:text-stone/60 focus:border-ink disabled:opacity-60';
  return (
    <label className="block">
      <span className="micro-label !text-[0.75rem] mb-1 block">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} disabled={disabled} className={`${cls} resize-none py-2.5 leading-relaxed`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={`${cls} h-11`} />
      )}
    </label>
  );
}

function EmptyState({ hasImage }) {
  return (
    <div className="columns-1 gap-6 sm:columns-2 2xl:columns-3">
      {TASKS.map((t, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 break-inside-avoid rounded-[2rem] border border-line bg-white/50 p-6"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-stone">{t.index}</span>
            <Layers className="size-4 text-stone/60" strokeWidth={1.5} />
          </div>
          <div className={`blueprint-grid mt-4 rounded-[1.25rem] bg-paper ${t.aspect === '3:4' ? 'aspect-[3/4]' : t.aspect === '16:9' ? 'aspect-video' : t.aspect === '4:3' ? 'aspect-[4/3]' : 'aspect-square'}`}>
            <Glyph id={t.id} />
          </div>
          <p className="mt-4 text-lg font-bold tracking-[-0.03em]">{t.title}</p>
          <p className="micro-label mt-0.5">{t.meta}</p>
        </motion.div>
      ))}
      <p className="break-inside-avoid px-2 pt-2 text-sm text-stone">
        {hasImage ? 'Your sketch is loaded. Press Develop Concept.' : 'Upload a sketch in the sidebar to populate this board.'}
      </p>
    </div>
  );
}

/** Small line glyphs that hint at each diagram type in the empty state. */
function Glyph({ id }) {
  const s = { stroke: '#141414', strokeWidth: 1.2, fill: 'none', strokeLinejoin: 'round' };
  const iso = (x, y, w, d, h, fill) => {
    const p = (a, b, c) => `${100 + (a - b) * 0.866},${110 + (a + b) * 0.5 - c}`;
    return (
      <g>
        <polygon points={[p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h)].join(' ')} {...s} fill={fill ?? '#fff'} />
        <polygon points={[p(x, y + d, 0), p(x + w, y + d, 0), p(x + w, y + d, h), p(x, y + d, h)].join(' ')} {...s} fill={fill ? fill : '#F0EFE8'} opacity={0.95} />
        <polygon points={[p(x + w, y, 0), p(x + w, y + d, 0), p(x + w, y + d, h), p(x + w, y, h)].join(' ')} {...s} fill={fill ? fill : '#E4E2D8'} opacity={0.85} />
      </g>
    );
  };
  const g = {
    birdseye: <>{iso(-30, -30, 60, 40, 40)}{iso(30, -30, 20, 40, 18)}</>,
    program: <>{iso(-30, -20, 60, 40, 18, '#C9826B')}{iso(-30, -20, 60, 40, 36, '#C9B27A')}{iso(-30, -20, 30, 40, 54, '#9AA889')}</>,
    exploded: <>{iso(-25, -20, 50, 40, 10, '#C9826B')}<g transform="translate(0,-30)">{iso(-25, -20, 50, 40, 10, '#C9B27A')}</g><g transform="translate(0,-60)">{iso(-25, -20, 50, 40, 10, '#9AA889')}</g><line x1="100" y1="40" x2="100" y2="140" stroke="#5A5A40" strokeWidth="1.6" strokeDasharray="3 3" /></>,
    urban: <>{iso(-60, -60, 30, 30, 20)}{iso(20, -60, 30, 30, 30)}{iso(-60, 20, 30, 30, 14)}{iso(20, 20, 30, 30, 22)}{iso(-15, -15, 30, 30, 40, '#141414')}</>,
    section: <g {...s}><rect x="40" y="60" width="120" height="80" /><line x1="40" y1="100" x2="160" y2="100" /><polyline points="40,60 100,30 160,60" /><line x1="20" y1="140" x2="180" y2="140" strokeWidth="2.4" /><rect x="70" y="100" width="20" height="40" fill="#141414" /></g>,
    floors: <>{[0, 1, 2, 3].map((i) => <g key={i} transform={`translate(0,${-i * 22})`}>{iso(-30, -20, 60, 40, 4, ['#C9826B', '#C9B27A', '#9AA889', '#8FA3B5'][i])}</g>)}</>,
    massing: (
      <g {...s}>
        {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={46 + c * 38} y={30 + r * 38} width="32" height="32" rx="3" fill={r * 3 + c === 8 ? '#5A5A40' : '#fff'} />
        )))}
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 200 170" className="h-full w-full p-4 opacity-80">
      {g[id]}
    </svg>
  );
}
