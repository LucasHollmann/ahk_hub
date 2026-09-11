import type {
  ConditionValue,
  FlowControlType,
  FunctionEntry,
  GlobalVariable,
  GuiInitialState,
  SerializedGuiControl,
  SerializedMenuItemTarget,
  SerializedStep,
  VariableAction,
  VariableType,
} from "../types";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import { BUILTIN_CONDITIONS } from "../../functions/conditions";
import {
  formatAhkArgLiteral,
  formatAhkCallArgs,
  quoteAhkString,
  toAhkLabel,
  toSystemFunctionName,
} from "../../functions/ahk";
import {
  areParamsFilled,
  expandHeaderParamsToCallParams,
  tFunctionName,
  type ArgSource,
  type ArgValues,
  type FunctionMeta,
  type HeaderParamDef,
  type ParamDef,
  type ParamValues,
  type Translate,
} from "../../functions/types";

export type StepVarActionKind = VariableAction["action"];

/** What a menu item calls when clicked — a plain function call, same shape as a customFunction/builtin step. */
export type MenuItemTarget =
  | { kind: "customFunction"; functionName: string; args: ArgValues }
  | { kind: "builtin"; meta: FunctionMeta; args: ArgValues };

export type MenuItem = { id: number; label: string; target: MenuItemTarget };

export type GuiControlType = "text" | "button" | "edit" | "checkbox" | "dropdown";

/** A control added to a Gui created by a "createGui" step. */
export type GuiControl =
  | { id: number; type: "text"; text: string; x?: number; y?: number; width?: number; color?: string }
  | {
      id: number;
      type: "button";
      text: string;
      onClick: MenuItemTarget;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  | {
      id: number;
      type: "edit";
      initialValue: string;
      multiline: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      color?: string;
    }
  | { id: number; type: "checkbox"; label: string; checked: boolean; x?: number; y?: number; color?: string }
  | { id: number; type: "dropdown"; options: string[]; x?: number; y?: number; width?: number; color?: string };

export type Step =
  | { id: number; kind: "customFunction"; functionName: string; args: ArgValues }
  | { id: number; kind: "builtin"; meta: FunctionMeta; args: ArgValues }
  | ({ id: number; kind: "variableAction" } & VariableAction)
  | {
      id: number;
      kind: "flowControl";
      flowType: FlowControlType;
      condition: ConditionValue;
      body: Step[];
      elseBody?: Step[];
    }
  | { id: number; kind: "showMenu"; title: string; items: MenuItem[] }
  | {
      id: number;
      kind: "createGui";
      varName: string;
      title: string;
      resizable: boolean;
      alwaysOnTop: boolean;
      noCaption: boolean;
      toolWindow: boolean;
      initialState: GuiInitialState;
      color?: string;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
      opacity?: number;
      controls: GuiControl[];
    }
  | { id: number; kind: "closeGui"; targetVar: string };

/** Legacy shape from before "send a key" became the KeyPress builtin — kept so old saved functions still load. */
export type LegacyKeyStep = { kind: "key"; combo: string };

export function isLegacyKeyStep(s: SerializedStep | LegacyKeyStep): s is LegacyKeyStep {
  return s.kind === "key";
}

/** Legacy shape from before "Fechar menu" became "Fechar Gui" — dropped on load since the Menu-based close mechanism no longer exists. */
export type LegacyCloseMenuStep = { kind: "closeMenu"; targetVar: string };

function isLegacyCloseMenuStep(
  s: SerializedStep | LegacyKeyStep | LegacyCloseMenuStep | LegacyShowGuiStep
): s is LegacyCloseMenuStep {
  return s.kind === "closeMenu";
}

/** Legacy shape from before "Criar Gui" started showing the window itself — dropped on load, folded into "createGui". */
export type LegacyShowGuiStep = { kind: "showGui"; targetVar: string };

function isLegacyShowGuiStep(
  s: SerializedStep | LegacyKeyStep | LegacyCloseMenuStep | LegacyShowGuiStep
): s is LegacyShowGuiStep {
  return s.kind === "showGui";
}

/** The global variable name a "Criar Gui" step generates for a given window title — normalized so it's a valid AHK identifier. */
export function guiVarNameFromTitle(title: string): string {
  return `gui_${toAhkLabel(title)}`;
}

export function hasHeaderRef(args: ArgValues): boolean {
  return Object.values(args).some((a) => a.kind !== "literal");
}

export function toLiteralParamValues(params: ParamDef[], args: ArgValues): ParamValues {
  const values: ParamValues = {};
  for (const p of params) {
    const arg = args[p.key];
    values[p.key] = arg?.kind === "literal" ? arg.value : p.type === "boolean" ? false : "";
  }
  return values;
}

export function argSourceText(arg: ArgSource): string | null {
  if (arg.kind === "literal") return arg.value === "" || arg.value === false ? null : String(arg.value);
  if (arg.kind === "headerParam") return arg.paramKey;
  return arg.variableName;
}

export function argSummary(params: ParamDef[], args: ArgValues): string {
  return params
    .map((p) => {
      const arg = args[p.key];
      return arg ? argSourceText(arg) : null;
    })
    .filter((v): v is string => v !== null)
    .join(", ");
}

/** Literal formatting for a free-typed "definir variável" value — auto-detects number/boolean keywords, quotes everything else. */
export function formatFreeLiteral(raw: string): string {
  if (raw === "") return '""';
  if (raw === "true" || raw === "false") return raw;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  return quoteAhkString(raw);
}

export function formatArgSourceForAssignment(value: ArgSource): string {
  if (value.kind === "literal") return formatFreeLiteral(String(value.value ?? ""));
  if (value.kind === "headerParam") return value.paramKey;
  return value.variableName;
}

export function conditionToAhkExpression(condition: ConditionValue): string {
  if (condition.kind === "code") return condition.code.trim() || "true";
  if (condition.kind === "builtin") {
    const meta = BUILTIN_CONDITIONS.find((c) => c.id === condition.conditionId);
    return meta?.toAhkCall ? meta.toAhkCall(condition.params) : "true";
  }
  return `${condition.targetName} ${condition.operator} ${formatArgSourceForAssignment(condition.value)}`;
}

export function isConditionReady(condition: ConditionValue): boolean {
  if (condition.kind === "code") return condition.code.trim() !== "";
  if (condition.kind === "builtin") {
    const meta = BUILTIN_CONDITIONS.find((c) => c.id === condition.conditionId);
    return Boolean(meta) && areParamsFilled(meta!, condition.params);
  }
  return (
    condition.targetName !== "" &&
    (condition.value.kind !== "literal" || String(condition.value.value ?? "").trim() !== "")
  );
}

export function stepLabel(t: Translate, step: Step, functions: FunctionEntry[]): string {
  if (step.kind === "customFunction") {
    const targetParams = expandHeaderParamsToCallParams(
      functions.find((f) => f.name === step.functionName)?.params ?? []
    );
    const summary = argSummary(targetParams, step.args);
    return summary ? `${step.functionName}(${summary})` : `${step.functionName}()`;
  }
  if (step.kind === "variableAction") {
    if (step.action === "set") return `${step.targetName} := ${argSourceText(step.value) ?? '""'}`;
    if (step.action === "increment") return `${step.targetName} += ${step.amount}`;
    if (step.action === "toggle") return `${step.targetName} := !${step.targetName}`;
    if (step.action === "promptInput") return `${step.targetName} := InputBox("${step.prompt}")`;
    const scopeLabel =
      step.scope === "global"
        ? t("functionsSection.varActionCreateGlobalTag", "global")
        : t("functionsSection.varActionCreateLocalTag", "local");
    return `${t("functionsSection.varActionCreateTag", "criar")} (${scopeLabel}) ${step.targetName} = ${String(step.initialValue)}`;
  }
  if (step.kind === "flowControl") {
    const expr = conditionToAhkExpression(step.condition);
    return step.flowType === "loop"
      ? t("functionsSection.flowLoopSummary", "Loop enquanto {{condition}}", { condition: expr })
      : t("functionsSection.flowConditionalSummary", "Se {{condition}}", { condition: expr });
  }
  if (step.kind === "showMenu") {
    return t("functionsSection.showMenuSummary", 'Menu "{{title}}" ({{count}} opções)', {
      title: step.title,
      count: step.items.length,
    });
  }
  if (step.kind === "createGui") {
    return t("functionsSection.createGuiSummary", 'Criar Gui "{{title}}" ({{name}})', {
      title: step.title,
      name: step.varName,
    });
  }
  if (step.kind === "closeGui") {
    return t("functionsSection.closeGuiSummary", "Fechar Gui {{name}}", { name: step.targetVar });
  }
  const summary = argSummary(step.meta.params, step.args);
  return summary ? `${tFunctionName(t, step.meta)}(${summary})` : `${tFunctionName(t, step.meta)}()`;
}

function collectStepGlobalNames(step: Step, globalVariables: GlobalVariable[], acc: Set<string>) {
  if (step.kind === "variableAction") {
    if (step.action === "create" && step.scope === "global") acc.add(step.targetName);
    else if (step.action === "set" && step.value.kind === "globalVariable") {
      acc.add(step.value.variableName);
    }
    if (
      (step.action === "set" ||
        step.action === "increment" ||
        step.action === "toggle" ||
        step.action === "promptInput") &&
      globalVariables.some((v) => v.name === step.targetName)
    ) {
      acc.add(step.targetName);
    }
  } else if (step.kind === "flowControl") {
    const condition = step.condition;
    if (condition.kind === "variable") {
      if (globalVariables.some((v) => v.name === condition.targetName)) acc.add(condition.targetName);
      if (condition.value.kind === "globalVariable") acc.add(condition.value.variableName);
    }
    for (const s of step.body) collectStepGlobalNames(s, globalVariables, acc);
    if (step.elseBody) for (const s of step.elseBody) collectStepGlobalNames(s, globalVariables, acc);
  } else if (step.kind === "showMenu") {
    for (const item of step.items) {
      for (const arg of Object.values(item.target.args)) {
        if (arg.kind === "globalVariable") acc.add(arg.variableName);
      }
    }
  } else if (step.kind === "createGui") {
    acc.add(step.varName);
    for (const control of step.controls) {
      if (control.type !== "button") continue;
      for (const arg of Object.values(control.onClick.args)) {
        if (arg.kind === "globalVariable") acc.add(arg.variableName);
      }
    }
  } else if (step.kind === "closeGui") {
    acc.add(step.targetVar);
  } else {
    for (const arg of Object.values(step.args)) {
      if (arg.kind === "globalVariable") acc.add(arg.variableName);
    }
  }
}

export function collectGlobalNames(steps: Step[], globalVariables: GlobalVariable[]): Set<string> {
  const acc = new Set<string>();
  for (const step of steps) collectStepGlobalNames(step, globalVariables, acc);
  return acc;
}

/** Every local variable created anywhere in this function's step tree — AHK locals are function-scoped, not block-scoped, so a variable created inside a loop/conditional body is visible everywhere else in the same function too. */
export function collectAllLocalVariableCreations(steps: Step[]): HeaderParamDef[] {
  const result: HeaderParamDef[] = [];
  function walk(list: Step[]) {
    for (const step of list) {
      if (step.kind === "variableAction" && step.action === "create" && step.scope === "local") {
        result.push({ key: step.targetName, label: step.targetName, type: step.varType });
      } else if (step.kind === "flowControl") {
        walk(step.body);
        if (step.elseBody) walk(step.elseBody);
      }
    }
  }
  walk(steps);
  return result;
}

/** Every Gui created by a "createGui" step anywhere in this function's step tree, for the "Mostrar/Fechar Gui" target pickers. */
export function collectAllGuiVariables(steps: Step[]): HeaderParamDef[] {
  const result: HeaderParamDef[] = [];
  function walk(list: Step[]) {
    for (const step of list) {
      if (step.kind === "createGui") {
        result.push({ key: step.varName, label: step.varName, type: "text" });
      } else if (step.kind === "flowControl") {
        walk(step.body);
        if (step.elseBody) walk(step.elseBody);
      }
    }
  }
  walk(steps);
  return result;
}

/** Every Gui created by a "createGui" step across all other saved functions — since Gui variables are global, they can be shown/closed from a different function than the one that created them. */
export function collectAllGuiVariablesAcrossFunctions(functions: FunctionEntry[]): HeaderParamDef[] {
  const result: HeaderParamDef[] = [];
  function walk(list: SerializedStep[]) {
    for (const step of list) {
      if (step.kind === "createGui") {
        result.push({ key: step.varName, label: step.varName, type: "text" });
      } else if (step.kind === "flowControl") {
        walk(step.body);
        if (step.elseBody) walk(step.elseBody);
      }
    }
  }
  for (const f of functions) {
    if (f.builder?.mode === "steps") walk(f.builder.steps);
  }
  return result;
}

/** Every "create global variable" action anywhere in the step tree, for auto-registering into the Variáveis globais tab. */
export function collectGlobalVariableCreations(
  steps: Step[]
): { name: string; type: VariableType; initialValue: string | number | boolean }[] {
  const result: { name: string; type: VariableType; initialValue: string | number | boolean }[] = [];
  function walk(list: Step[]) {
    for (const step of list) {
      if (step.kind === "variableAction" && step.action === "create" && step.scope === "global") {
        result.push({ name: step.targetName, type: step.varType, initialValue: step.initialValue });
      } else if (step.kind === "flowControl") {
        walk(step.body);
        if (step.elseBody) walk(step.elseBody);
      }
    }
  }
  walk(steps);
  return result;
}

function customFunctionCallExpr(functionName: string, args: ArgValues, allFunctions: FunctionEntry[]): string {
  const targetHeaderParams = allFunctions.find((f) => f.name === functionName)?.params ?? [];
  const targetParams = expandHeaderParamsToCallParams(targetHeaderParams);
  const argsStr = targetParams.length > 0 ? formatAhkCallArgs(targetParams, args) : "";
  return `${functionName}(${argsStr})`;
}

function builtinCallExpr(meta: FunctionMeta, args: ArgValues): string {
  if (hasHeaderRef(args)) {
    const argsStr = formatAhkCallArgs(meta.params, args);
    return `${toSystemFunctionName(meta.name)}(${argsStr})`;
  }
  return meta.toAhkCall ? meta.toAhkCall(toLiteralParamValues(meta.params, args)) : `${meta.name}()`;
}

function menuTargetCallExpr(target: MenuItemTarget, allFunctions: FunctionEntry[]): string {
  return target.kind === "customFunction"
    ? customFunctionCallExpr(target.functionName, target.args, allFunctions)
    : builtinCallExpr(target.meta, target.args);
}

/** Shared by "showMenu" items and "createGui" button controls — both call a function/builtin on activation. */
function serializeMenuItemTarget(target: MenuItemTarget): SerializedMenuItemTarget {
  return target.kind === "customFunction"
    ? { kind: "customFunction", functionName: target.functionName, args: { ...target.args } }
    : { kind: "builtin", functionId: target.meta.id, args: { ...target.args } };
}

/** Returns null if the target refers to a builtin id that no longer exists. */
function hydrateMenuItemTarget(target: SerializedMenuItemTarget): MenuItemTarget | null {
  if (target.kind === "customFunction") {
    return { kind: "customFunction", functionName: target.functionName, args: { ...(target.args ?? {}) } };
  }
  const meta = BUILTIN_FUNCTIONS.find((f) => f.id === target.functionId);
  return meta ? { kind: "builtin", meta, args: { ...(target.args ?? {}) } } : null;
}

function serializeGuiControl(control: GuiControl): SerializedGuiControl {
  if (control.type === "text") {
    return {
      type: "text",
      text: control.text,
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.width !== undefined ? { width: control.width } : {}),
      ...(control.color ? { color: control.color } : {}),
    };
  }
  if (control.type === "button") {
    return {
      type: "button",
      text: control.text,
      onClick: serializeMenuItemTarget(control.onClick),
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.width !== undefined ? { width: control.width } : {}),
      ...(control.height !== undefined ? { height: control.height } : {}),
    };
  }
  if (control.type === "edit") {
    return {
      type: "edit",
      initialValue: control.initialValue,
      multiline: control.multiline,
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.width !== undefined ? { width: control.width } : {}),
      ...(control.height !== undefined ? { height: control.height } : {}),
      ...(control.color ? { color: control.color } : {}),
    };
  }
  if (control.type === "checkbox") {
    return {
      type: "checkbox",
      label: control.label,
      checked: control.checked,
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.color ? { color: control.color } : {}),
    };
  }
  return {
    type: "dropdown",
    options: [...control.options],
    ...(control.x !== undefined ? { x: control.x } : {}),
    ...(control.y !== undefined ? { y: control.y } : {}),
    ...(control.width !== undefined ? { width: control.width } : {}),
    ...(control.color ? { color: control.color } : {}),
  };
}

/** Returns null if a "button" control's target refers to a builtin id that no longer exists. */
function hydrateGuiControl(control: SerializedGuiControl, nextIdRef: { current: number }): GuiControl | null {
  const id = nextIdRef.current++;
  if (control.type === "text") {
    return {
      id,
      type: "text",
      text: control.text,
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.width !== undefined ? { width: control.width } : {}),
      ...(control.color ? { color: control.color } : {}),
    };
  }
  if (control.type === "button") {
    const onClick = hydrateMenuItemTarget(control.onClick);
    if (!onClick) return null;
    return {
      id,
      type: "button",
      text: control.text,
      onClick,
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.width !== undefined ? { width: control.width } : {}),
      ...(control.height !== undefined ? { height: control.height } : {}),
    };
  }
  if (control.type === "edit") {
    return {
      id,
      type: "edit",
      initialValue: control.initialValue,
      multiline: control.multiline ?? false,
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.width !== undefined ? { width: control.width } : {}),
      ...(control.height !== undefined ? { height: control.height } : {}),
      ...(control.color ? { color: control.color } : {}),
    };
  }
  if (control.type === "checkbox") {
    return {
      id,
      type: "checkbox",
      label: control.label,
      checked: control.checked ?? false,
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.color ? { color: control.color } : {}),
    };
  }
  return {
    id,
    type: "dropdown",
    options: [...(control.options ?? [])],
    ...(control.x !== undefined ? { x: control.x } : {}),
    ...(control.y !== undefined ? { y: control.y } : {}),
    ...(control.width !== undefined ? { width: control.width } : {}),
    ...(control.color ? { color: control.color } : {}),
  };
}

function stepToAhkLines(step: Step, allFunctions: FunctionEntry[], indent: string): string[] {
  if (step.kind === "customFunction") {
    return [`${indent}${customFunctionCallExpr(step.functionName, step.args, allFunctions)}`];
  }

  if (step.kind === "variableAction") {
    if (step.action === "set") {
      return [`${indent}${step.targetName} := ${formatArgSourceForAssignment(step.value)}`];
    }
    if (step.action === "increment") {
      return [`${indent}${step.targetName} += ${step.amount}`];
    }
    if (step.action === "toggle") {
      return [`${indent}${step.targetName} := !${step.targetName}`];
    }
    if (step.action === "promptInput") {
      return [
        `${indent}${step.targetName} := InputBox(${quoteAhkString(step.prompt)}, ${quoteAhkString(
          step.title
        )}).Value`,
      ];
    }
    const literal = formatAhkArgLiteral(
      { key: step.targetName, label: step.targetName, type: step.varType },
      step.initialValue
    );
    return [`${indent}${step.targetName} := ${literal}`];
  }

  if (step.kind === "flowControl") {
    const expr = conditionToAhkExpression(step.condition);
    const keyword = step.flowType === "loop" ? "while" : "if";
    const innerIndent = `${indent}    `;
    const bodyLines = step.body.flatMap((s) => stepToAhkLines(s, allFunctions, innerIndent));
    const lines = [`${indent}${keyword} (${expr}) {`, ...bodyLines, `${indent}}`];
    if (step.flowType === "conditional" && step.elseBody && step.elseBody.length > 0) {
      const elseLines = step.elseBody.flatMap((s) => stepToAhkLines(s, allFunctions, innerIndent));
      lines.push(`${indent}else {`, ...elseLines, `${indent}}`);
    }
    return lines;
  }

  if (step.kind === "showMenu") {
    const varName = `menu_${step.id}`;
    const lines = [`${indent}${varName} := Menu()`];
    for (const item of step.items) {
      const callExpr = menuTargetCallExpr(item.target, allFunctions);
      lines.push(`${indent}${varName}.Add(${quoteAhkString(item.label)}, (*) => ${callExpr})`);
    }
    lines.push(`${indent}${varName}.Show()`);
    return lines;
  }

  if (step.kind === "createGui") {
    const creationOptions = [
      step.resizable ? "+Resize" : "",
      step.alwaysOnTop ? "+AlwaysOnTop" : "",
      step.noCaption ? "-Caption" : "",
      step.toolWindow ? "+ToolWindow" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const lines = [
      `${indent}${step.varName} := Gui(${quoteAhkString(creationOptions)}, ${quoteAhkString(step.title)})`,
    ];
    if (step.color) lines.push(`${indent}${step.varName}.BackColor := "0x${step.color}"`);

    step.controls.forEach((control, index) => {
      const positionOptions = [
        control.x !== undefined ? `x${control.x}` : "",
        control.y !== undefined ? `y${control.y}` : "",
        "width" in control && control.width !== undefined ? `w${control.width}` : "",
        "height" in control && control.height !== undefined ? `h${control.height}` : "",
      ];
      if (control.type === "edit" && control.multiline) positionOptions.push("Multi");
      if (control.type === "checkbox" && control.checked) positionOptions.push("Checked");
      if (control.type !== "button" && control.color) positionOptions.push(`c${control.color}`);
      const optionsArg = quoteAhkString(positionOptions.filter(Boolean).join(" "));

      if (control.type === "text") {
        lines.push(`${indent}${step.varName}.Add("Text", ${optionsArg}, ${quoteAhkString(control.text)})`);
      } else if (control.type === "button") {
        const ctrlVar = `${step.varName}_ctrl${index}`;
        lines.push(
          `${indent}${ctrlVar} := ${step.varName}.Add("Button", ${optionsArg}, ${quoteAhkString(control.text)})`
        );
        lines.push(
          `${indent}${ctrlVar}.OnEvent("Click", (*) => ${menuTargetCallExpr(control.onClick, allFunctions)})`
        );
      } else if (control.type === "edit") {
        lines.push(`${indent}${step.varName}.Add("Edit", ${optionsArg}, ${quoteAhkString(control.initialValue)})`);
      } else if (control.type === "checkbox") {
        lines.push(`${indent}${step.varName}.Add("Checkbox", ${optionsArg}, ${quoteAhkString(control.label)})`);
      } else {
        lines.push(
          `${indent}${step.varName}.Add("DropDownList", ${optionsArg}, ${quoteAhkString(control.options.join("|"))})`
        );
      }
    });

    const showOptions = [
      step.width !== undefined ? `w${step.width}` : "",
      step.height !== undefined ? `h${step.height}` : "",
      step.x !== undefined ? `x${step.x}` : "",
      step.y !== undefined ? `y${step.y}` : "",
      step.initialState === "maximized" ? "Maximize" : step.initialState === "minimized" ? "Minimize" : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`${indent}${step.varName}.Show(${showOptions ? quoteAhkString(showOptions) : ""})`);

    if (step.opacity !== undefined) {
      lines.push(`${indent}WinSetTransparent(${step.opacity}, "ahk_id " . ${step.varName}.Hwnd)`);
    }
    return lines;
  }

  if (step.kind === "closeGui") {
    return [`${indent}${step.targetVar}.Destroy()`];
  }

  return [`${indent}${builtinCallExpr(step.meta, step.args)}`];
}

const HEADER_PARAM_DEFAULT_LITERAL: Record<string, string> = {
  text: '""',
  number: "0",
  boolean: "false",
  select: '""',
  keyCombo: '""',
};

export function buildCodeFromSteps(
  name: string,
  headerParams: HeaderParamDef[],
  steps: Step[],
  allFunctions: FunctionEntry[],
  globalVariables: GlobalVariable[]
): string {
  const bodyLines = steps.flatMap((step) => stepToAhkLines(step, allFunctions, "    "));

  const globalNames = collectGlobalNames(steps, globalVariables);
  const globalDeclaration = globalNames.size > 0 ? [`    global ${[...globalNames].join(", ")}`] : [];

  const paramList = headerParams
    .flatMap((p) =>
      p.type === "coordinate"
        ? [`${p.key}X := 0`, `${p.key}Y := 0`]
        : [`${p.key} := ${HEADER_PARAM_DEFAULT_LITERAL[p.type] ?? '""'}`]
    )
    .join(", ");
  return [`${name}(${paramList}) {`, ...globalDeclaration, ...bodyLines, "}"].join("\n");
}

function serializeStep(step: Step): SerializedStep {
  if (step.kind === "customFunction") {
    return { kind: "customFunction", functionName: step.functionName, args: { ...step.args } };
  }
  if (step.kind === "variableAction") {
    const { id, ...rest } = step;
    void id;
    return rest;
  }
  if (step.kind === "flowControl") {
    return {
      kind: "flowControl",
      flowType: step.flowType,
      condition: step.condition,
      body: step.body.map(serializeStep),
      ...(step.elseBody ? { elseBody: step.elseBody.map(serializeStep) } : {}),
    };
  }
  if (step.kind === "showMenu") {
    return {
      kind: "showMenu",
      title: step.title,
      items: step.items.map((item) => ({ label: item.label, target: serializeMenuItemTarget(item.target) })),
    };
  }
  if (step.kind === "createGui") {
    return {
      kind: "createGui",
      varName: step.varName,
      title: step.title,
      resizable: step.resizable,
      alwaysOnTop: step.alwaysOnTop,
      noCaption: step.noCaption,
      toolWindow: step.toolWindow,
      initialState: step.initialState,
      ...(step.color ? { color: step.color } : {}),
      ...(step.width !== undefined ? { width: step.width } : {}),
      ...(step.height !== undefined ? { height: step.height } : {}),
      ...(step.x !== undefined ? { x: step.x } : {}),
      ...(step.y !== undefined ? { y: step.y } : {}),
      ...(step.opacity !== undefined ? { opacity: step.opacity } : {}),
      controls: step.controls.map(serializeGuiControl),
    };
  }
  if (step.kind === "closeGui") {
    return { kind: "closeGui", targetVar: step.targetVar };
  }
  return { kind: "builtin", functionId: step.meta.id, args: { ...step.args } };
}

export function serializeSteps(steps: Step[]): SerializedStep[] {
  return steps.map(serializeStep);
}

export function hydrateSteps(
  serialized: (SerializedStep | LegacyKeyStep | LegacyCloseMenuStep | LegacyShowGuiStep)[],
  nextIdRef: { current: number }
): Step[] {
  const hydrated: Step[] = [];
  for (const s of serialized) {
    if (isLegacyCloseMenuStep(s) || isLegacyShowGuiStep(s)) {
      continue;
    } else if (isLegacyKeyStep(s)) {
      const meta = BUILTIN_FUNCTIONS.find((f) => f.id === "keyPress");
      if (meta) {
        hydrated.push({
          id: nextIdRef.current++,
          kind: "builtin",
          meta,
          args: {
            combo: { kind: "literal", value: s.combo },
            duration: { kind: "literal", value: 0 },
          },
        });
      }
    } else if (s.kind === "customFunction") {
      hydrated.push({
        id: nextIdRef.current++,
        kind: "customFunction",
        functionName: s.functionName,
        args: { ...(s.args ?? {}) },
      });
    } else if (s.kind === "variableAction") {
      hydrated.push({ id: nextIdRef.current++, ...s });
    } else if (s.kind === "flowControl") {
      hydrated.push({
        id: nextIdRef.current++,
        kind: "flowControl",
        flowType: s.flowType,
        condition: s.condition,
        body: hydrateSteps(s.body ?? [], nextIdRef),
        ...(s.elseBody ? { elseBody: hydrateSteps(s.elseBody, nextIdRef) } : {}),
      });
    } else if (s.kind === "showMenu") {
      hydrated.push({
        id: nextIdRef.current++,
        kind: "showMenu",
        title: s.title,
        items: (s.items ?? []).flatMap((item): MenuItem[] => {
          const target = hydrateMenuItemTarget(item.target);
          return target ? [{ id: nextIdRef.current++, label: item.label, target }] : [];
        }),
      });
    } else if (s.kind === "createGui") {
      hydrated.push({
        id: nextIdRef.current++,
        kind: "createGui",
        varName: s.varName,
        title: s.title,
        resizable: s.resizable ?? false,
        alwaysOnTop: s.alwaysOnTop ?? false,
        noCaption: s.noCaption ?? false,
        toolWindow: s.toolWindow ?? false,
        initialState: s.initialState ?? "normal",
        ...(s.color ? { color: s.color } : {}),
        ...(s.width !== undefined ? { width: s.width } : {}),
        ...(s.height !== undefined ? { height: s.height } : {}),
        ...(s.x !== undefined ? { x: s.x } : {}),
        ...(s.y !== undefined ? { y: s.y } : {}),
        ...(s.opacity !== undefined ? { opacity: s.opacity } : {}),
        controls: (s.controls ?? []).flatMap((c) => {
          const control = hydrateGuiControl(c, nextIdRef);
          return control ? [control] : [];
        }),
      });
    } else if (s.kind === "closeGui") {
      hydrated.push({ id: nextIdRef.current++, kind: "closeGui", targetVar: s.targetVar });
    } else {
      const meta = BUILTIN_FUNCTIONS.find((f) => f.id === s.functionId);
      if (meta) {
        hydrated.push({
          id: nextIdRef.current++,
          kind: "builtin",
          meta,
          args: { ...(s.args ?? {}) },
        });
      }
    }
  }
  return hydrated;
}

/** The raw AHK identifier(s) a header param is referenced by at a call site — two, for a "coordinate" param's X/Y pair. */
export function headerParamIdentifiers(p: HeaderParamDef): string[] {
  return p.type === "coordinate" ? [`${p.key}X`, `${p.key}Y`] : [p.key];
}

function clearArgsReferencing(identifiers: string[], args: ArgValues, params: ParamDef[]): ArgValues {
  let changed = false;
  const next = { ...args };
  for (const p of params) {
    const arg = next[p.key];
    if (arg?.kind === "headerParam" && identifiers.includes(arg.paramKey)) {
      next[p.key] = { kind: "literal", value: p.type === "boolean" ? false : "" };
      changed = true;
    }
  }
  return changed ? next : args;
}

/** Clears any reference to a removed header parameter from every step in the tree (including nested loop/conditional bodies). */
export function clearHeaderParamRefs(
  steps: Step[],
  identifiers: string[],
  functions: FunctionEntry[]
): Step[] {
  let changed = false;
  const next = steps.map((step) => {
    if (step.kind === "variableAction") {
      if (
        step.action === "set" &&
        step.value.kind === "headerParam" &&
        identifiers.includes(step.value.paramKey)
      ) {
        changed = true;
        return { ...step, value: { kind: "literal" as const, value: "" } };
      }
      return step;
    }
    if (step.kind === "flowControl") {
      let stepChanged = false;
      let condition = step.condition;
      if (
        condition.kind === "variable" &&
        condition.value.kind === "headerParam" &&
        identifiers.includes(condition.value.paramKey)
      ) {
        condition = { ...condition, value: { kind: "literal", value: "" } };
        stepChanged = true;
      }
      const body = clearHeaderParamRefs(step.body, identifiers, functions);
      const elseBody = step.elseBody
        ? clearHeaderParamRefs(step.elseBody, identifiers, functions)
        : step.elseBody;
      if (body !== step.body || elseBody !== step.elseBody) stepChanged = true;
      if (!stepChanged) return step;
      changed = true;
      return { ...step, condition, body, ...(step.elseBody ? { elseBody } : {}) };
    }
    if (step.kind === "showMenu") {
      let stepChanged = false;
      const items = step.items.map((item) => {
        const target = item.target;
        const targetParams =
          target.kind === "builtin"
            ? target.meta.params
            : expandHeaderParamsToCallParams(functions.find((f) => f.name === target.functionName)?.params ?? []);
        const args = clearArgsReferencing(identifiers, target.args, targetParams);
        if (args === target.args) return item;
        stepChanged = true;
        return { ...item, target: { ...target, args } };
      });
      if (!stepChanged) return step;
      changed = true;
      return { ...step, items };
    }
    if (step.kind === "createGui") {
      let stepChanged = false;
      const controls = step.controls.map((control) => {
        if (control.type !== "button") return control;
        const target = control.onClick;
        const targetParams =
          target.kind === "builtin"
            ? target.meta.params
            : expandHeaderParamsToCallParams(functions.find((f) => f.name === target.functionName)?.params ?? []);
        const args = clearArgsReferencing(identifiers, target.args, targetParams);
        if (args === target.args) return control;
        stepChanged = true;
        return { ...control, onClick: { ...target, args } };
      });
      if (!stepChanged) return step;
      changed = true;
      return { ...step, controls };
    }
    if (step.kind === "closeGui") return step;
    const targetParams =
      step.kind === "builtin"
        ? step.meta.params
        : expandHeaderParamsToCallParams(functions.find((f) => f.name === step.functionName)?.params ?? []);
    const args = clearArgsReferencing(identifiers, step.args, targetParams);
    if (args === step.args) return step;
    changed = true;
    return { ...step, args };
  });
  return changed ? next : steps;
}
