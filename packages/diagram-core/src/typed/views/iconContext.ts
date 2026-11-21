// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Icon resolution for typed views that draw AWS icons (workflow): the host app
// maps an icon ref to a URL. Provided by <TypedDiagramView iconUrl>.
import { createContext } from 'react'

/** Maps an icon ref to a URL (null/undefined: no icon). */
export type TypedIconUrl = (ref: string) => string | null | undefined

export const TypedIconContext = createContext<TypedIconUrl | null>(null)
