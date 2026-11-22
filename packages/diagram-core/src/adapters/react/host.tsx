// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The ports the components reach the outside world through. A host (or a test)
// mounts <CoreHostProvider ports={…}> to replace any of them; without a provider
// every component uses the browser adapters and the production layout engines,
// so existing consumers keep working unchanged.
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { browserClipboard, browserEnvironment, browserFileSaver, browserUrlState } from "#core/adapters/browser/index.ts";
import { elkLayoutEngine } from "#core/adapters/layout/elk.ts";
import { dagreLayeredEngine } from "#core/adapters/layout/dagre.ts";
import { createCompoundLayout } from "#core/application/layout.ts";
import type { CompoundLayout } from "#core/application/layout.ts";
import type { Clipboard, Environment, FileSaver, UrlState } from "#core/ports/host.ts";
import type { LayeredLayoutEngine, LayoutEngine } from "#core/ports/layoutEngine.ts";

/** Every port a component may use. */
export interface CoreHostPorts {
  urlState: UrlState;
  clipboard: Clipboard;
  fileSaver: FileSaver;
  environment: Environment;
  /** The compound layout engine of the architecture canvas (ELK). */
  layoutEngine: LayoutEngine;
  /** The layered engine: the canvas's fallback and the ER/class views (dagre). */
  layeredLayout: LayeredLayoutEngine;
}

/** The defaults: browser adapters + the production layout engines. */
export const DEFAULT_CORE_HOST_PORTS: CoreHostPorts = Object.freeze({
  urlState: browserUrlState,
  clipboard: browserClipboard,
  fileSaver: browserFileSaver,
  environment: browserEnvironment,
  layoutEngine: elkLayoutEngine,
  layeredLayout: dagreLayeredEngine,
});

const CoreHostContext = createContext<CoreHostPorts>(DEFAULT_CORE_HOST_PORTS);

export interface CoreHostProviderProps {
  /** The ports to replace; the others keep the enclosing provider's (or the defaults). */
  ports: Partial<CoreHostPorts>;
  children?: ReactNode;
}

/** Inject ports into every core component below. */
export function CoreHostProvider({ ports, children }: CoreHostProviderProps) {
  const parent = useContext(CoreHostContext);
  const { urlState, clipboard, fileSaver, environment, layoutEngine, layeredLayout } = ports;
  const value = useMemo((): CoreHostPorts => ({
    urlState: urlState ?? parent.urlState,
    clipboard: clipboard ?? parent.clipboard,
    fileSaver: fileSaver ?? parent.fileSaver,
    environment: environment ?? parent.environment,
    layoutEngine: layoutEngine ?? parent.layoutEngine,
    layeredLayout: layeredLayout ?? parent.layeredLayout,
  }), [parent, urlState, clipboard, fileSaver, environment, layoutEngine, layeredLayout]);
  return <CoreHostContext.Provider value={value}>{children}</CoreHostContext.Provider>;
}

/** The ports in effect (the defaults when no provider is mounted). */
export function useCoreHost(): CoreHostPorts {
  return useContext(CoreHostContext);
}

/** The compound layout over the ports' engines (stable while the engines are). */
export function useCompoundLayout(): CompoundLayout {
  const { layoutEngine, layeredLayout } = useCoreHost();
  return useMemo(() => createCompoundLayout({ engine: layoutEngine, fallback: layeredLayout }), [layoutEngine, layeredLayout]);
}
