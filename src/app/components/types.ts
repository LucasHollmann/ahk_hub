import type {
  ArgSource,
  ArgValues,
  FunctionMeta,
  HeaderParamDef,
  ParamValues,
} from "../functions/types";

export type VariableType = "text" | "number" | "boolean" | "array" | "coordinate";
export type VariableScope = "local" | "global";
/** A screen position held by a "coordinate" variable — stored in AHK as an `{x, y}` object. */
export type CoordinateLiteral = { x: number; y: number };
export type VariableInitialValue = string | number | boolean | string[] | CoordinateLiteral;

/**
 * The value a "definir variável" step assigns. A coordinate target takes an X/Y pair, each
 * half sourced independently (a typed-in number, a header param, another variable...), so
 * `{x: pos.x + 40, y: 12}` is expressible without an intermediate step.
 */
export type AssignedValue = ArgSource | { kind: "coordinate"; x: ArgSource; y: ArgSource };

export type VariableAction =
  | { action: "set"; targetName: string; value: AssignedValue }
  | { action: "increment"; targetName: string; amount: number }
  | { action: "toggle"; targetName: string }
  | {
      action: "create";
      targetName: string;
      varType: VariableType;
      initialValue: VariableInitialValue;
      scope: VariableScope;
    }
  /** Shows an InputBox and stores the text the user typed into a variable. */
  | { action: "promptInput"; targetName: string; prompt: string; title: string };

export type ConditionOperator = "=" | "!=" | ">" | "<" | ">=" | "<=";

/** A boolean expression used by flow-control steps (Loop/Conditional): a comparison against a known variable, raw AHK code, or one of the ready-made condition kinds (mouse position, active window, key state...). */
export type ConditionValue =
  | { kind: "variable"; targetName: string; operator: ConditionOperator; value: ArgSource }
  | { kind: "code"; code: string }
  | { kind: "builtin"; conditionId: string; args: ArgValues };

export type FlowControlType = "loop" | "conditional";

/** What a menu item calls when clicked — a plain function call, same shape as a customFunction/builtin step. */
export type SerializedMenuItemTarget =
  | { kind: "customFunction"; functionName: string; args: ArgValues }
  | { kind: "builtin"; functionId: string; args: ArgValues };

export type SerializedMenuItem = { label: string; target: SerializedMenuItemTarget };

/** A control added to a Gui created by a "createGui" step. */
export type SerializedGuiControl =
  /** color is a 6-digit hex string (no "#"/"0x"), applied as the text color — buttons don't support it (native Win32 buttons need owner-draw for that, which AHK doesn't expose here). */
  | { type: "text"; text: string; x?: number; y?: number; width?: number; color?: string }
  | {
      type: "button";
      text: string;
      /** What clicking the button calls — same shape as a menu item's target. */
      onClick: SerializedMenuItemTarget;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  | {
      type: "edit";
      initialValue: string;
      multiline: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      color?: string;
    }
  | { type: "checkbox"; label: string; checked: boolean; x?: number; y?: number; color?: string }
  | { type: "dropdown"; options: string[]; x?: number; y?: number; width?: number; color?: string }
  /** Raw AHK code inserted verbatim, for adding controls the structured item form doesn't cover. */
  | { type: "code"; code: string };

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
    }
  | { kind: "showMenu"; title: string; items: SerializedMenuItem[] }
  /** Creates a Gui() as a global variable and shows it immediately. */
  | {
      kind: "createGui";
      varName: string;
      title: string;
      resizable: boolean;
      alwaysOnTop: boolean;
      noCaption: boolean;
      toolWindow: boolean;
      initialState: GuiInitialState;
      /** Background color as a 6-digit hex string (no "#"/"0x" prefix), if customized. */
      color?: string;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
      /** 0 (invisible) to 255 (opaque), if customized. */
      opacity?: number;
      controls: SerializedGuiControl[];
    }
  /** Closes a Gui previously created by a "createGui" step. */
  | { kind: "closeGui"; targetVar: string };

/** How a Gui window is shown right after being created. */
export type GuiInitialState = "normal" | "maximized" | "minimized";

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

/** When the mapped action fires relative to the physical key: on press, on release, or on press while waiting for release before it can fire again. */
export type RemappingTrigger = "down" | "up" | "full";

export type Remapping = {
  id: number;
  from: string;
  destination: RemappingDestination;
  trigger: RemappingTrigger;
};

export type GlobalVariable = {
  id: number;
  name: string;
  type: VariableType;
  initialValue: VariableInitialValue;
};

