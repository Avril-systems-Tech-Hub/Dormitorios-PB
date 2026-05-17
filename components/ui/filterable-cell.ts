import type { ReactNode } from "react";

/** A cell can be a plain ReactNode or an object with explicit filter text */
export type FilterableCell =
  | ReactNode
  | { __filterText: string; node: ReactNode };

/** Helper to create a cell with explicit filter text for ResponsiveTable */
export function ft(text: string, node: ReactNode): FilterableCell {
  return { __filterText: text, node };
}