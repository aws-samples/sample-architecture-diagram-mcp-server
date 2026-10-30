# Typed diagrams — contract

A **typed diagram** is a diagram document whose body has `kind: '<type>'` (e.g. `er`, `gantt`).
Architecture diagrams (no `kind`) and sequence diagrams (`kind: 'sequence'`) have their own modules.
Each type is exactly **two files** in `@aws-sample-live-diagram/core`. Everything else (the MCP's
`kind: 'typed'` tabs, and in a host app such as the slides Studio: editor, deck/blog block, gallery,
server-side validation, exports) is generic and driven by these files.

| File | What |
|---|---|
| `src/typed/<kind>.js` | **Spec** — pure JS, no imports except other pure files. Runs in browser, Node (MCP, codegen) and is exported as JSON to the Lambda. |
| `src/typed/views/<kind>.jsx` | **View** — React SVG renderer. |

Register the spec in `src/typed/index.js` and the view in `src/typed/views/index.jsx`.

Reference implementation: `quadrant.js` + `quadrant.jsx`.

## Spec (`<kind>.js`) — `export default { … }`

| Field | Required | Notes |
|---|---|---|
| `kind`, `label`, `description`, `category` | yes | `label`/`description` in **pt-BR** (UI language). `category`: `process`, `structure`, `planning`, `data`, `software`, `business`. |
| `schema` | yes | JSON Schema of the body **without** `kind`/`title`/`subtitle` (those are added automatically). Subset only: `type`, `properties`, `required`, `additionalProperties:false`, `items`, `enum`, `anyOf`, `minItems`, `maxItems`. Use `additionalProperties:false` on every object. Add a pt-BR `description` to fields — the editor shows it as help. |
| `unique` | yes | Paths whose values must be unique, e.g. `['entities[].id']`. |
| `refs` | yes | Referential integrity: `[{ from: 'relations[].from', to: 'entities[].id' }]`. Path syntax: `a.b`, `list[].field`, `list[].arr[]`. Validated identically in the browser, MCP and Lambda. |
| `steps(doc) → number` | yes | Reveal steps for decks/articles (0 = static). The view receives `step`: show elements with order index `< step`; `null` = everything. |
| `empty(title) → doc` | yes | Starter document for "Novo diagrama" — a **realistic, good-looking example** (AWS / GenAI / public-sector flavour, pt-BR). Must pass validation. |
| `describe(doc) → string` | yes | Plain-text summary for the SVG `<desc>` (accessibility). Mention the structure and the main items. |
| `samples` | optional | Array of extra example docs (without `kind`) shown in the dev gallery. |

Do **not** add a `check` function (the Lambda cannot mirror custom JS). Express rules with `schema` / `unique` / `refs`.

### Editor annotations (optional, inside `schema`)

The editor is generated from the schema. Hints:
- `'x-label': 'Entidades'` — section/field title (otherwise the key is used).
- `'x-item-title': 'label'` — which item field titles a row in an array list.
- `'x-ref': 'entities[].id'` — on a string (or array-of-strings items) field: render a select of existing ids.
- `'x-multiline': true` — textarea for long strings.

## View (`<kind>.jsx`) — `export default function XView({ doc, step = null, fit })`

- Render through **`<DiagramSvg width height title desc fit>`** (from `./DiagramSvg.jsx`) — this is the
  accessibility contract (role=img + title/desc, instance-unique ids). Pass
  `title={doc.title || spec.label}` and `desc={describeTypedDiagram(doc)}` (from `../index.js`).
- Colours: **only tokens** — CSS vars `var(--dg-bg|--dg-panel|--dg-ink|--dg-muted|--dg-line|--dg-grid|--dg-accent)`,
  `toneColor(tone)` for semantic tones, `paletteColor(i)` for categorical series. Never hardcode a light-only or
  dark-only colour: the same SVG must read in light and dark. Text on a strong colour fill: `#fff`.
- Layout must be **deterministic** (no DOM measuring): use `textW(s, size)` / `wrapText(s, maxW, size)`.
  Compute `width`/`height` from the content (viewBox grows with the data). `dagre` (sync) and `d3-shape`
  (no DOM) are available (peer dependencies); do not use `elkjs` (async).
- Defs (markers, gradients, clipPaths): ids via `useSvgIds()` — never a fixed id.
- Reveal: when `step != null`, elements with order index `>= step` get `opacity: 0` (class `dg-step` animates).
- Font sizes 11–18 in viewBox units; min stroke 1.2. Labels must not overlap or overflow their boxes for
  the starter document and samples.
- Respect `prefers-reduced-motion` (no custom animations beyond `dg-step`).

## Testing your type

In the slides Studio, serve the core from source (`npm run dev:core`) and use its gallery:

```bash
# validation of empty() + samples, and render errors, plus screenshots (light | dark side by side)
node scripts/shoot-diagram-types.mjs --kind <kind> --out /tmp/dt-<kind>
node scripts/shoot-diagram-types.mjs --kind <kind> --step 2 --out /tmp/dt-<kind>-s2
```

Then look at the PNGs and iterate until the diagram is clean in **both** themes. The printed line must say
`valid` and `render errors: []`.
