// The seven diagram tasks Archivision runs, in order. Claude draws each one as SVG.
// Each prompt is built from a shared style preamble plus a task-specific brief,
// and receives the project context (name, brief, typology) the architect typed.

const SHARED_STYLE = `
You are producing a single board for an international architectural design competition, drawn as SVG.
Use the attached image (an architectural sketch, massing model or screenshot) as the ONLY design source:
preserve its overall footprint, proportions, number of storeys, roof form, major openings and massing logic.
Do not invent a different building. Interpret ambiguous sketch lines in the most plausible architectural way.
Before drawing, work out the building as simple volumes (boxes, wedges, extrusions) with real dimensions in metres,
then project them consistently. Every view must describe the SAME building.

GLOBAL STYLE RULES:
- Architectural competition style, in the manner of contemporary European practices' presentation boards.
- Clean, precise linework with a clear line-weight hierarchy: about 2.5px for cut and outline edges, 1.25px for secondary edges, 0.75px for hatching and guides.
- NO photorealism: flat fills or very subtle two-tone shading per face, generous off-white negative space, crisp edges.
- Restrained, sophisticated palette unless the task specifies otherwise. Ink #141414, paper #FBFBF7, accent olive #5A5A40.
- Use true axonometric/isometric or orthographic projection where specified (no perspective distortion in axonometric views).
- Draw faces back-to-front (painter's order) so nearer volumes correctly hide farther ones.
- Text must be minimal and correct: font-family "Inter, Helvetica, Arial, sans-serif", uppercase small labels with letter-spacing, 12-18px.

SVG RULES:
- One root <svg> with xmlns="http://www.w3.org/2000/svg", the exact width, height and viewBox given below, and a full-size background <rect> filled #FBFBF7.
- Only plain vector elements: rect, polygon, polyline, path, line, circle, ellipse, text, g, defs, pattern, linearGradient, marker, clipPath.
- No <image>, no <script>, no <foreignObject>, no external fonts, links or references, no CSS animations.
- Keep a 48px margin. Put a small caption at bottom-left with the diagram number and name in uppercase grey (#8A8A7A).
- Be economical: group repeated elements, round coordinates to one decimal, aim for under 60 KB of SVG.
`.trim();

const CANVAS = { '1:1': [1200, 1200], '4:3': [1280, 960], '3:4': [960, 1280], '16:9': [1600, 900] };

export const TASKS = [
  {
    id: 'birdseye',
    index: '01',
    title: "Bird's-eye View",
    short: 'Aerial',
    meta: '45° · Top-down perspective',
    aspect: '4:3',
    prompt: `
TASK: BIRD'S-EYE VIEW.
Produce a 45-degree top-down aerial perspective of the building as seen from above one corner of the site,
camera elevated roughly 45 degrees, showing both the roofscape and two facades.
Render as an illustrative competition aerial: soft matte massing in warm white and light stone tones,
fine dark outlines on every edge, subtle ambient-occlusion shading only at contact points, long soft shadows cast to one side.
Show the immediate site: landscape as simple flat planes of muted sage green, paths as thin pale lines,
abstract stylised trees as simple circles or lollipop forms in two tones of olive. Neighbouring plots as faint white blocks.
Clean, calm, diagrammatic. No photorealism, no photographic textures.
`.trim(),
  },
  {
    id: 'program',
    index: '02',
    title: 'Program Diagram',
    short: 'Program',
    meta: 'Colour-coded 3D blocks',
    aspect: '1:1',
    prompt: `
TASK: PROGRAM DIAGRAM (3D colour-coded blocks).
Rebuild the building as an axonometric (30°/60° or isometric) assembly of solid volumetric blocks,
where every block represents one spatial function. Fill each function with a distinct flat colour from a refined palette:
terracotta, ochre, sage green, dusty blue, warm grey, muted lilac. Keep circulation cores in charcoal.
Blocks keep the building's real massing and storeys but are subtly outlined with thin black edges and a slight gap between blocks.
Place a small clean legend in one corner listing each colour with a one- or two-word function name
(e.g. LOBBY, RESIDENTIAL, OFFICE, RETAIL, AMENITY, SERVICES, CORE) appropriate to the project type.
White background, no context, no shadows except a very faint ground shadow. Architectural competition style, clean linework, no photorealism.
`.trim(),
  },
  {
    id: 'exploded',
    index: '03',
    title: 'Programmatic Exploded Axonometric',
    short: 'Exploded Axo',
    meta: 'Separated volumes · Circulation',
    aspect: '3:4',
    prompt: `
TASK: PROGRAMMATIC EXPLODED AXONOMETRIC.
Draw the building as a vertically exploded axonometric: each floor plate or functional volume lifted apart along the vertical axis
with equal generous gaps, aligned on thin dashed vertical guide lines at the corners.
Each separated level is colour-coded by its main program (muted terracotta, ochre, sage, dusty blue, warm grey),
with simplified interior partitions drawn in fine linework on the floor plates.
Overlay bold, clean circulation arrows: vertical arrows through stair/lift cores in black,
horizontal flow arrows on key floors in olive green (#5A5A40), with small arrowheads.
Add tiny leader-line labels for each level's program in small caps.
White background, no context, no photorealism, crisp competition-board linework.
`.trim(),
  },
  {
    id: 'urban',
    index: '04',
    title: 'Urban Context',
    short: 'Context',
    meta: 'Monochrome isometric',
    aspect: '4:3',
    prompt: `
TASK: URBAN CONTEXT DIAGRAM.
Place the building into a plausible surrounding city block and show it as a monochrome isometric diagram.
The proposed building is highlighted in solid black (or very dark charcoal); all surrounding buildings are white or very light grey
volumes with thin grey outlines; streets are left as white negative space; green spaces as very light grey hatch.
Show how the building integrates with the city: thin dashed lines for key pedestrian routes and view axes,
small arrows for primary approach and access, a north arrow, and a simple scale bar.
Strictly monochrome (black, greys, white). Isometric projection, no perspective. Architectural competition style, clean linework, no photorealism.
`.trim(),
  },
  {
    id: 'section',
    index: '05',
    title: 'Architectural Section',
    short: 'Section',
    meta: 'Technical cross-section',
    aspect: '16:9',
    prompt: `
TASK: ARCHITECTURAL SECTION.
Produce a clean technical long section through the building, cut through the most informative part (atrium, stair core or double-height spaces).
Cut elements (slabs, walls, roof, ground) in solid black poché; elements beyond in fine light grey line.
Show the ground line with a hatched earth band below, floor-to-floor levels with small level markers (+0.00, +3.50, etc.) on one side,
and a few simple human scale figures as flat silhouettes. Indicate daylight with a few thin sun-ray lines and natural ventilation with thin curved arrows.
Small room labels in small caps inside spaces.
Orthographic elevation projection only. White background, technical drawing precision, competition-board style, no photorealism, no rendering.
`.trim(),
  },
  {
    id: 'floors',
    index: '06',
    title: 'Floor Analysis',
    short: 'Floors',
    meta: 'Vertical program distribution',
    aspect: '3:4',
    prompt: `
TASK: FLOOR ANALYSIS (vertical distribution of program).
Create an analytical diagram of the building's floors stacked vertically, as a clean axonometric stack or a stacked elevation,
showing how program is distributed level by level.
Each floor is drawn as a thin slab with colour-coded zones (terracotta, ochre, sage, dusty blue, warm grey), labelled on the right
with leader lines and short annotations: level number, main function and an approximate percentage or area (e.g. "L3 — OFFICE — 620 m²").
On the left, a slim vertical bar chart summarising the share of each program across the height.
Consistent typography in small caps, fine black linework, generous white space, competition-board graphic quality, no photorealism.
`.trim(),
  },
  {
    id: 'massing',
    index: '07',
    title: 'Massing Diagram',
    short: 'Massing',
    meta: '3 × 3 evolution grid',
    aspect: '1:1',
    wide: true,
    prompt: `
TASK: MASSING EVOLUTION DIAGRAM — 3 x 3 GRID.
Produce ONE image containing a precise 3 by 3 grid of nine equal square panels, separated by thin even white gutters,
read left-to-right, top-to-bottom, showing the step-by-step design evolution from empty site to the final form in the attached image.
Every panel uses the SAME isometric camera angle, the same scale and the same site plate.
Suggested sequence:
1. SITE — the empty site plate with boundary lines.
2. BUILDABLE VOLUME — maximum envelope as a translucent box.
3. EXTRUDE — base mass extruded to height.
4. SUBTRACT — carve out courtyard / setbacks.
5. SHIFT — offset volumes to respond to views or sun.
6. LIFT — raise or cantilever part of the mass.
7. PUNCTURE — open voids, atria or passages.
8. TERRACE / ROOF — refine roofscape and terraces.
9. FINAL FORM — the resolved building matching the attached image.
Each step highlights the newly changed part in olive green (#5A5A40) while unchanged mass is white with fine black outlines,
and small black arrows indicate the operation. Under each panel a tiny small-caps number and one-word caption.
White background, crisp clean linework, diagrammatic, architectural competition style, no photorealism.
`.trim(),
  },
];

export function buildPrompt(task, project) {
  const lines = [SHARED_STYLE, '', task.prompt];
  const ctx = [];
  if (project.name?.trim()) ctx.push(`Project name: ${project.name.trim()}.`);
  if (project.typology?.trim()) ctx.push(`Building type / program: ${project.typology.trim()}.`);
  if (project.brief?.trim()) ctx.push(`Architect's design intent: ${project.brief.trim()}`);
  if (ctx.length) lines.push('', 'PROJECT CONTEXT (use it to choose program names, labels and emphasis):', ...ctx);
  const [w, h] = CANVAS[task.aspect] ?? CANVAS['1:1'];
  lines.push('', `CANVAS: width="${w}" height="${h}" viewBox="0 0 ${w} ${h}".`);
  return lines.join('\n');
}
