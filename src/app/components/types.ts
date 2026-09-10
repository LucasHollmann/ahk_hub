import type {
  ArgSource,
  ArgValues,
  FunctionMeta,
  HeaderParamDef,
  ParamValues,
} from "../functions/types";

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

export type ConditionOperator = "=" | "!=" | ">" | "<" | ">=" | "<=";

/** A boolean expression used by flow-control steps (Loop/Conditional): a comparison against a known variable, raw AHK code, or one of the ready-made condition kinds (mouse position, active window, key state...). */
export type ConditionValue =
  | { kind: "variable"; targetName: string; operator: ConditionOperator; value: ArgSource }
  | { kind: "code"; code: string }
  | { kind: "builtin"; conditionId: string; params: ParamValues };

export type FlowControlType = "loop" | "conditional";

export type SerializedStep =
  | { kind: "customFunction"; functionName: string; args: ArgValues }
  | { kind: "builtin"; functionId: string; args: ArgValues }
  | ({ kind: "variableAction" } & VariableAction)
  | {
      kind: "flowControl";
      flowType: FlowControlType;
      condition: ConditionValue;
      /** Steps that run inside the loop / when the condition is true. */
      body: SerializedStep[];
      /** Conditional-only: steps that run when the condition is false. */
      elseBody?: SerializedStep[];
    };

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

