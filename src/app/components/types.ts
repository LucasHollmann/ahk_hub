import type { ArgSource, ArgValues, FunctionMeta, HeaderParamDef, ParamValues } from "../functions/types";

export type VariableType = "text" | "number" | "boolean";
export type VariableScope = "local" | "global";

export type VariableAction =
  | { action: "set"; targetName: string; value: ArgSource }
  | { action: "increment"; targetName: string; amount: number }
  | { action: "toggle"; targetName: string }
  | {
      action: "create";
      targetName: string;
      varType: VariableType;
      initialValue: string | number | boolean;
      scope: VariableScope;
    };

export type SerializedStep =
  | { kind: "customFunction"; functionName: string; args: ArgValues }
  | { kind: "builtin"; functionId: string; args: ArgValues }
  | ({ kind: "variableAction" } & VariableAction);

export type FunctionEntry = {
  id: number;
  name: string;
  description: string;
  code: string;
  /** Header parameters this function accepts — only meaningful when `builder.mode === "steps"`, since hand-written code has no structured parameter list. */
  params: HeaderParamDef[];
  /** Present only when this function was assembled with the step-by-step builder — lets "Edit" reopen it in that same mode instead of as raw code. */
  builder?: { mode: "steps"; steps: SerializedStep[] };
};

export type RemappingDestination =
  | { kind: "builtin"; meta: FunctionMeta; params: ParamValues }
  | { kind: "customFunction"; name: string; args: ArgValues };

export type Remapping = {
  id: number;
  from: string;
  destination: RemappingDestination;
};

export type GlobalVariable = {
  id: number;
  name: string;
  type: VariableType;
  initialValue: string | number | boolean;
};

