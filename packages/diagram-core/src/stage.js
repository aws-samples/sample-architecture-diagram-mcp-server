// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// "Stage" bridge — the walkthrough driving a REAL shell, for a live demo or a
// screen recording. Opt-in: a diagram only gets this when it carries a `stage`
// block (see stageSchema), otherwise none of it is rendered or connected.
//
//   stage.terminal  URL of a browser terminal (ttyd & co) embedded in the card
//   stage.control   base URL of the stage server; "" = the page's own origin
//   stage.height    height (px) of the terminal panel inside the card
//
// The control server owns the cursor over the walkthrough, so the shell and the
// diagram can never disagree about which beat is on screen:
//
//   GET <control>/events        Server-Sent Events, one per move: { step, … }
//   GET <control>/step/<token>  move to next|prev|overview|same|<n>, and type
//                               that beat's code block on the live prompt
//
// That is what makes a click in the card land on the prompt un-executed: the
// presenter only ever presses Enter, and nothing is typed or pasted on camera.
// Intended for a loopback server on the presenter's own machine.
import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_MS = 2000;
const DEFAULT_HEIGHT = 220;

/** Normalize the control base: "" (same origin) or a URL without its trailing slash. */
export function stageBase(stage) {
  return String(stage?.control ?? "").replace(/\/+$/, "");
}

export function stageEnabled(stage) {
  return !!(stage && (stage.terminal || stage.control != null));
}

/** Token for a beat index: -1 is the overview, 0+ is the 1-based beat number. */
export function stageToken(index) {
  return index < 0 ? "overview" : String(index + 1);
}

/**
 * Subscribe to the stage's cursor and expose a way to move it.
 *
 * @param stage   the diagram's `stage` block (undefined = feature off)
 * @param onStep  called with a 0-based beat index (-1 = overview) on every
 *                server move, including the sync sent on connect
 * @returns { enabled, online, send, terminal, height }
 */
export function useStage(stage, { onStep } = {}) {
  const enabled = stageEnabled(stage);
  const base = stageBase(stage);
  const [online, setOnline] = useState(false);
  // Kept in a ref so reconnecting never depends on the callback's identity.
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") return;
    let es = null, retry = null, alive = true;
    const connect = () => {
      es = new EventSource(`${base}/events`);
      es.onmessage = (e) => {
        setOnline(true);
        try {
          const state = JSON.parse(e.data);
          onStepRef.current?.((state.step || 0) - 1);   // server steps are 1-based
        } catch { /* a malformed frame must never break the walkthrough */ }
      };
      es.onerror = () => {
        setOnline(false);
        es?.close();
        if (alive) retry = setTimeout(connect, RETRY_MS);   // the stage may be restarting
      };
    };
    connect();
    return () => { alive = false; if (retry) clearTimeout(retry); es?.close(); };
  }, [enabled, base]);

  // Ask the stage to move. The answer comes back over /events, so the diagram
  // stays in sync even when the move was made from the shell (Ctrl-]) instead.
  const send = useCallback((token) => {
    if (!enabled) return;
    fetch(`${base}/step/${token}`).then(() => setOnline(true), () => setOnline(false));
  }, [enabled, base]);

  return {
    enabled, online, send,
    terminal: stage?.terminal || null,
    height: Number(stage?.height) > 0 ? Number(stage.height) : DEFAULT_HEIGHT,
  };
}
