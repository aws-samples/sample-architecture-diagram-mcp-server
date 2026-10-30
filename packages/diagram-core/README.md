# @aws-sample-live-diagram/core

The render layer shared by the [AWS Architecture Diagram MCP server](../../README.md)
and downstream apps (e.g. a slides deck). One source for the components, the
pure vocabulary and the design tokens, so a diagram reads the same in the MCP's
self-contained HTML and in any app that embeds it.

Install a pinned build from a GitHub Release (attached by the release workflow):

```bash
npm install https://github.com/aws-samples/sample-architecture-diagram-mcp-server/releases/download/v2.1.4/aws-sample-live-diagram-core-1.3.0.tgz
```

## Entry points

| Entry | What | Runtime deps |
|---|---|---|
| `@aws-sample-live-diagram/core` | Pure vocabulary: tones (`TONE_COLORS`, `DIAGRAM_TONES`, `PLAYER_TONES`, `STATUS_COLORS`, `AWS_ORANGE`), player theme tokens (`PLAYER_THEME`, `playerThemeCss`), group variants, membership, i18n (`tr`, `UI_STRINGS`, `makeUi`), geometry, diagram model, flow layout (`layoutFlow`, `flowFrame`) | none |
| `@aws-sample-live-diagram/core/layout-engine` | ELK / dagre compound layout (`layoutWithFallback`) | `elkjs`, `dagre` |
| `@aws-sample-live-diagram/core/react` | React components: `LiveDiagram` (architecture, walkthrough), `LiveDiagramEditor`, `FlowPlayer` (workflow / data-flow / lifecycle), `SequencePlayer` (UML sequence), `StepCard`, `DiagramCaption`, `cardKit`, `Icon`, node/edge/group components | `react`, `@xyflow/react`, `framer-motion` |

React, React Flow, framer-motion, ELK and dagre are peer dependencies (provided
by the host app). The pure vocabulary lives once, in `dist/index.js`; the other
entries import it from there.

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
