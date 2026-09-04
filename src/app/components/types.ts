import type { FunctionMeta, ParamValues } from "../functions/types";

export type FunctionEntry = {
  id: number;
  name: string;
  description: string;
};

export type RemappingDestination =
  | { kind: "key"; combo: string }
  | { kind: "builtin"; meta: FunctionMeta; params: ParamValues }
  | { kind: "customFunction"; name: string };

export type Remapping = {
  id: number;
  from: string;
  destination: RemappingDestination;
};
