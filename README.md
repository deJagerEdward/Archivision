# Archivision — Architectural Concept Development Studio

Upload one sketch or massing model and Archivision has Claude (`claude-opus-5-5`) read it and draw a suite of seven competition-style analytical diagrams.

Claude can't paint raster images, so it draws each diagram as **SVG vector linework**. Expect crisp, editable, diagrammatic boards (clean lines, flat colour, legends, labels) rather than soft AI-rendered illustrations. The SVGs open directly in Illustrator, Affinity, Figma or Inkscape for touch-up.

| # | Diagram | Notes |
|---|---------|-------|
| 01 | Bird's-eye View | 45° top-down perspective |
| 02 | Program Diagram | Colour-coded 3D blocks with legend |
| 03 | Programmatic Exploded Axonometric | Separated volumes, circulation arrows |
| 04 | Urban Context | Monochrome isometric, building highlighted |
| 05 | Architectural Section | Technical cross-section with poché and levels |
| 06 | Floor Analysis | Vertical program distribution with annotations |
| 07 | Massing Diagram | 3 × 3 evolution grid, site → final form |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Paste an Anthropic API key into the sidebar (create one at https://console.anthropic.com/settings/keys), or copy `.env.example` to `.env.local` and set `VITE_ANTHROPIC_API_KEY`. The key is never hardcoded. "Remember on this device" stores it in the browser's localStorage only.

> This is a client-only app: the key is sent from the browser straight to api.anthropic.com (the SDK's `dangerouslyAllowBrowser` mode). Fine for personal or studio-internal use. For a public deployment, move the `generateDiagram` call behind a small server endpoint so the key stays server-side.

## Demo mode

With no API key saved, the app opens in **demo mode**: it loads a bundled sample sketch and, on Develop Concept, runs the same sequential pipeline with hand-built SVG stand-ins for the seven diagrams (2.5–4s each, plus one simulated 429 on the exploded axonometric on every other run, so the retry path is visible). No network calls are made. Toggle it off in the sidebar to use a real Anthropic key.

## Deploy

The build is fully static (`base: './'`), so `dist/` can go on any static host. `.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main` (enable Pages → Source: GitHub Actions in the repo settings). Vercel or Netlify also work with zero config: build command `npm run build`, output `dist`.

## How generation works

- Tasks run strictly in sequence, with a 2-second pause between each (`INTER_TASK_DELAY_MS` in `src/lib/retry.js`).
- Each call is wrapped in exponential backoff with jitter (2s, 4s, 8s… capped at 60s, up to 6 attempts) for `429` rate limits, `529` overloaded, other 5xx and network errors. A `retry-after` header is honoured.
- Requests stream (so long drawings don't time out), use adaptive thinking at `medium` effort (change `EFFORT` in `src/lib/claude.js` to `high` for more careful, slower drawings), and opt into server-side refusal fallbacks (`fallbacks: "default"`).
- Each run of seven diagrams is roughly 7 Opus calls with an image in and up to ~60 KB of SVG out each; expect a few minutes per full run.
- A failed diagram doesn't stop the run; retry it from its card. Any finished diagram can be regenerated individually.
- The stop button cancels the run mid-request.
- Project name, typology and design intent (optional) are injected into every prompt to steer labels and program names.

## Where to change things

- `src/lib/tasks.js` — the seven prompts, shared style rules ("architectural competition style", "clean linework", "no photorealism") plus SVG drawing rules and canvas sizes.
- `src/lib/claude.js` — model, effort, system prompt, SVG extraction, upload downscaling (max 1568px side).
- `src/lib/retry.js` — backoff policy and the 2s inter-task delay.
- `src/lib/demo.js` — the offline sample sketch and stand-in diagrams.
- `src/App.jsx` — layout: 450px sidebar + masonry results grid.
- `src/index.css` — palette tokens (`#F5F5F0` paper, `#141414` ink, `#5A5A40` olive), `card-shadow`, `micro-label` utilities.

Stack: React 19, Vite, Tailwind CSS v4, lucide-react, motion (`motion/react`), `@anthropic-ai/sdk`.
