// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Minimal typings for the slice of d3-shape the typed views use (line + two
// curves). The peer dep ships no types and @types/d3-shape is not installed;
// replace this file with that package if it is ever added.
declare module 'd3-shape' {
  /** Opaque curve factory (curveBasis, curveMonotoneX, …). */
  export interface CurveFactory { readonly __d3CurveFactory?: never }
  export interface Line<Datum> {
    (data: Iterable<Datum> | Datum[]): string | null
    x(x: (d: Datum, index: number, data: Datum[]) => number): this
    y(y: (d: Datum, index: number, data: Datum[]) => number): this
    defined(defined: (d: Datum, index: number, data: Datum[]) => boolean): this
    curve(curve: CurveFactory): this
  }
  export function line<Datum = [number, number]>(): Line<Datum>
  export const curveBasis: CurveFactory
  export const curveMonotoneX: CurveFactory
}
