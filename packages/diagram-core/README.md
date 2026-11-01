# @aws-sample-live-diagram/core

The render layer shared by the [AWS Architecture Diagram MCP server](../../README.md)
and downstream apps (e.g. a slides deck). One source for the components, the
pure vocabulary and the design tokens, so a diagram reads the same in the MCP's
self-contained HTML and in any app that embeds it.

Install a pinned build from a GitHub Release (attached by the release workflow):

```bash
npm install https://github.com/aws-samples/sample-architecture-diagram-mcp-server/releases/download/v2.3.0/aws-sample-live-diagram-core-1.6.0.tgz
```

## Entry points

| Entry | What | Runtime deps |
|---|---|---|
| `@aws-sample-live-diagram/core` | Pure vocabulary: tones (`TONE_COLORS`, `DIAGRAM_TONES`, `PLAYER_TONES`, `STATUS_COLORS`, `AWS_ORANGE`), player theme tokens (`PLAYER_THEME`, `playerThemeCss`), group variants, membership, i18n (`tr`, `UI_STRINGS`, `makeUi`), geometry, diagram model, flow and sequence layouts (`layoutFlow`, `flowFrame`, `layoutSequence`), icon catalogs + resolver (`SERVICE_ICONS`, `SHAPE_ICONS`, `iconForService(name, files?)`, `iconForShape`, `withServiceIcon`, `iconFilterKind`), document schemas + validators (`diagramSchema`/`validateDiagram`, `sequenceDocSchema`/`validateSequence`), canvas theme (`DIAGRAM_THEME`, `diagramThemeCss`, `diagramBaseCss`), accessible summaries (`describeArchitecture`, `describeSequence`), inline mini-markdown (`parseInline`, `inlineHtml`, `safeHref`) | none |
| `@aws-sample-live-diagram/core/layout-engine` | ELK / dagre compound layout (`layoutWithFallback`) | `elkjs`, `dagre` |
| `@aws-sample-live-diagram/core/typed` | Typed diagrams — specs, validator and registry for 15 kinds (`er`, `gantt`, `swimlane`, `tree`, `timeline`, `kanban`, `journey`, `quadrant`, `venn`, `layers`, `fishbone`, `wardley`, `flywheel`, `class`, `workflow`): `DIAGRAM_TYPES`, `validateTypedDiagram`, `describeTypedDiagram`, `exportTypeContracts` (JSON for a server-side validator). See `src/typed/README.md` | none |
| `@aws-sample-live-diagram/core/typed-react` | Typed-diagram SVG views: `TypedDiagramView`, `DIAGRAM_VIEWS` | `react`, `dagre`, `d3-shape` |
| `@aws-sample-live-diagram/core/react` | React components: `LiveDiagram` (architecture, walkthrough), `LiveDiagramEditor`, `FlowPlayer` (workflow / data-flow / lifecycle), `SequencePlayer` (UML sequence), `StepCard`, `DiagramCaption`, `cardKit`, `Icon`, node/edge/group components | `react`, `@xyflow/react`, `framer-motion` |

React, React Flow, framer-motion, ELK, dagre and d3-shape are peer dependencies (provided
by the host app). The pure vocabulary lives once, in `dist/index.js`; the other
entries import it from there.

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
