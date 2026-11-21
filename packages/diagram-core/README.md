# @aws-sample-live-diagram/core

The render layer shared by the [AWS Architecture Diagram MCP server](../../README.md)
and downstream apps (e.g. a slides deck). One source for the components, the
pure vocabulary and the design tokens, so a diagram reads the same in the MCP's
self-contained HTML and in any app that embeds it.

Install a pinned build from a GitHub Release (attached by the release workflow):

```bash
npm install https://github.com/aws-samples/sample-architecture-diagram-mcp-server/releases/download/v2.5.0/aws-sample-live-diagram-core-1.8.0.tgz
```

## Entry points

| Entry | What | Runtime deps |
|---|---|---|
| `@aws-sample-live-diagram/core` | Pure vocabulary: tones (`TONE_COLORS`, `DIAGRAM_TONES`, `PLAYER_TONES`, `STATUS_COLORS`, `AWS_ORANGE`), player theme tokens (`PLAYER_THEME`, `playerThemeCss`), group variants, membership, i18n (`tr`, `UI_STRINGS`, `makeUi`), geometry, diagram model, flow and sequence layouts (`layoutFlow`, `flowFrame`, `layoutSequence`), icon catalogs + resolver (`SERVICE_ICONS`, `SHAPE_ICONS`, `iconForService(name, files?)`, `iconForShape`, `withServiceIcon`, `iconFilterKind`), document schemas + validators (`diagramSchema`/`validateDiagram`, `sequenceDocSchema`/`validateSequence`), canvas theme (`DIAGRAM_THEME`, `diagramThemeCss`, `diagramBaseCss`), accessible summaries (`describeArchitecture`, `describeSequence`), inline mini-markdown (`parseInline`, `inlineHtml`, `safeHref`) | none |
| `@aws-sample-live-diagram/core/layout-engine` | ELK / dagre compound layout (`elkLayout`, `compoundLayout`, `layoutWithFallback`) and the engines behind it (`elkLayoutEngine`, `dagreLayeredEngine`, `dagreLayoutEngine`) | `elkjs`, `dagre` |
| `@aws-sample-live-diagram/core/typed` | Typed diagrams — specs, validator and registry for 15 kinds (`er`, `gantt`, `swimlane`, `tree`, `timeline`, `kanban`, `journey`, `quadrant`, `venn`, `layers`, `fishbone`, `wardley`, `flywheel`, `class`, `workflow`): `DIAGRAM_TYPES`, `validateTypedDiagram`, `describeTypedDiagram`, `exportTypeContracts` (JSON for a server-side validator). See `src/domain/typed/README.md` | none |
| `@aws-sample-live-diagram/core/typed-react` | Typed-diagram SVG views: `TypedDiagramView`, `DIAGRAM_VIEWS` | `react`, `d3-shape` (+ `dagre` through `/react`'s default layered engine) |
| `@aws-sample-live-diagram/core/react` | React components: `LiveDiagram` (architecture, walkthrough), `LiveDiagramEditor`, `FlowPlayer` (workflow / data-flow / lifecycle), `SequencePlayer` (UML sequence), `StepCard`, `DiagramCaption`, `cardKit`, `Icon`, node/edge/group components; `CoreHostProvider` / `useCoreHost` (the ports, below) and the browser adapters | `react`, `@xyflow/react`, `framer-motion` |

React, React Flow, framer-motion, ELK, dagre and d3-shape are peer dependencies (provided
by the host app). The pure vocabulary lives once, in `dist/index.js`; the other
entries import it from there.

The `.` entry also carries the use cases behind the components (pure, or over
the ports): `createCompoundLayout({ engine, fallback })`, the walkthrough step
machine (`initialWalkStep`, `reduceWalkStep`, `walkKey`), the cost-environment
and app-page deep links (`createCostEnvLink`, `createAppPageLink`), the export
payloads (`shareCardLayout`, `sequenceSvgStyle`, `EXPORT_FILES`), the editor ops
(`reparentOnDrop`, `reparentNode`, `alignBounds`, `distributeCoordinates`, …) and
the port types.

## Architecture (ports and adapters)

```
src/
  domain/            pure, deterministic: vocabulary, schemas, typed specs, diagram model, membership,
                     layout primitives, the compound-layout plan/read, flow + sequence layouts,
                     themes, inline grammar, icons, costs, a11y, i18n
  ports/             interfaces (types only): LayoutEngine, LayeredLayoutEngine, UrlState,
                     Clipboard, FileSaver, Environment
  application/       use cases over the ports: layout orchestration, walkthrough, deep links,
                     export payloads, editor ops, the component registry
  adapters/layout/   elk.ts, dagre.ts — the only modules importing elkjs / dagre
  adapters/browser/  the ports over window / document / navigator
  adapters/react/    the components, typed views and <CoreHostProvider>
  index.ts, layout-engine.ts, react.tsx, typed/index.ts, typed/views/index.tsx   the entries
```

Dependencies point inwards (`test/core-architecture.test.ts` in the repo
enforces it): the domain imports nothing else; ports only domain types; the
application the domain and the ports; adapters everything inward plus their
own libraries. Imports carry the real `.ts`/`.tsx` extension — `./x.ts` within a
directory, `#core/<layer>/…` across directories, never `../`.

### Host ports

The components reach the page only through ports. Mount `CoreHostProvider` to
replace any of them (e.g. in a host with its own router, or in tests); without a
provider they use the browser adapters and the production layout engines, so
nothing changes for existing hosts:

```tsx
import { CoreHostProvider, LiveDiagram } from '@aws-sample-live-diagram/core/react'

<CoreHostProvider ports={{ urlState: myRouterUrlState, clipboard: myClipboard }}>
  <LiveDiagram data={doc} chrome control="auto" />
</CoreHostProvider>
```

| Port | Used for | Default adapter |
|---|---|---|
| `urlState` | `#env=` (cost environment), `#<page>` (app shell) | `browserUrlState` (location + history.replaceState) |
| `clipboard` | copy buttons of code blocks | `browserClipboard` (navigator.clipboard; blocked = no-op) |
| `fileSaver` | PNG / share card / sequence SVG + PNG downloads | `browserFileSaver` (a temporary `<a download>`) |
| `environment` | reduced motion, presentation fullscreen | `browserEnvironment` (matchMedia, Fullscreen API) |
| `layoutEngine` | the architecture canvas's compound layout | `elkLayoutEngine` |
| `layeredLayout` | the canvas's fallback; the ER and class views | `dagreLayeredEngine` |

## Icons

A service, participant or flow node with `service` and no `icon` renders the
catalog icon in every component (`LiveDiagram`, `SequencePlayer`,
`FlowPlayer`), the same way the MCP resolves it. `iconForService` tries the exact
name, then the name without the Amazon/AWS prefix; pass the icon file names the
host serves as `files` to also match free text (every token of an icon's name
must appear in the query). The host still maps an icon file to a URL
(`iconUrl`).

## Document schemas

`diagramSchema` (architecture: services, connections, groups) and
`sequenceDocSchema` (UML sequence) are JSON Schemas of the documents the MCP's
`generate_html_diagram` and `generate_sequence_diagram` take; `validateDiagram`
and `validateSequence` check types and referential integrity (unknown ids,
duplicate ids, group parent cycles) and return `{ valid, errors }`. A test in
the MCP keeps them in step with its tool schemas.

## Players

Both players take the same document the MCP's `generate_*_diagram` tools take,
so a flow or sequence pasted from an MCP-generated HTML (its embedded JSON)
renders identically.

```jsx
import { FlowPlayer, SequencePlayer } from '@aws-sample-live-diagram/core/react'

<FlowPlayer flow={doc} activeStep={i} iconUrl={ref => `/icons/${ref}`} />
<SequencePlayer seq={doc} cur={i} onCur={setI} iconUrl={ref => `/icons/${ref}`} />
```

- **Controlled or not** — pass `activeStep` / `cur` to drive the walkthrough from
  the host (`null` = overview: everything shown, nothing dimmed); omit it and
  the player keeps its own step (the sequence player also its keys and autoplay).
- **Icons** — the host resolves an `icon` ref to a URL (`iconUrl`), optionally
  with a CSS filter (`iconFilter`).
- **Theme** — light by default; dark with `theme="dark"` or a `.dark` ancestor;
  a `.light` / `.force-light` island inside a dark page stays light.

## Build

```bash
npm run build:core   # from the repo root (tsup → dist/, not committed)
```
