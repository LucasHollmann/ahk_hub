import type {
  AssignedValue,
  ConditionValue,
  FlowControlType,
  FunctionEntry,
  GlobalVariable,
  GuiInitialState,
  SerializedGuiControl,
  SerializedMenuItemTarget,
  SerializedRadialOption,
  SerializedStep,
  VariableAction,
  VariableInitialValue,
  VariableType,
} from "../types";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import { BUILTIN_CONDITIONS } from "../../functions/conditions";
import {
  DEFAULT_RADIAL_BACK_COLOR,
  DEFAULT_RADIAL_MIN_DISTANCE,
  DEFAULT_RADIAL_OPACITY,
  DEFAULT_RADIAL_RADIUS,
  DEFAULT_RADIAL_TEXT_COLOR,
  RADIAL_CLOSE_FN,
  RADIAL_DIRECTIONS,
  RADIAL_OPEN_FN,
  type RadialDirection,
} from "../../functions/radialSelector";
import {
  argSourceExpression,
  argSourceIdentifier,
  formatAhkCallArgs,
  formatVariableInitialLiteral,
  quoteAhkString,
  toAhkLabel,
  toCoordinateLiteral,
  toSystemFunctionName,
} from "../../functions/ahk";
import {
  areArgsFilled,
  defaultArgValues,
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

/** One arm of a circular quick selector: what it calls, and the text the overlay shows for it. */
export type RadialOption = { label: string; target: MenuItemTarget };

/** The five arms of a selector, keyed by direction — a missing key means that direction does nothing. */
export type RadialOptions = Partial<Record<RadialDirection, RadialOption>>;

export type GuiControlType = "text" | "button" | "edit" | "checkbox" | "dropdown" | "code";

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
  | { id: number; type: "dropdown"; options: string[]; x?: number; y?: number; width?: number; color?: string }
  | { id: number; type: "code"; code: string };

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
  | { id: number; kind: "closeGui"; targetVar: string }
  | {
      id: number;
      kind: "openRadialSelector";
      varName: string;
      name: string;
      minDistance: number;
      triggerOnMove: boolean;
      keepOpenOnSelect: boolean;
      showOverlay: boolean;
      radius: number;
      backColor?: string;
      textColor?: string;
      opacity?: number;
      options: RadialOptions;
      onClose?: MenuItemTarget;
    }
  | { id: number; kind: "closeRadialSelector"; targetVar: string };

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

/** The global variable name an "Abrir seletor rápido circular" step stores its selector in — same convention as `guiVarNameFromTitle`. */
export function radialVarNameFromName(name: string): string {
  return `radial_${toAhkLabel(name)}`;
}

/** The options of a selector in a stable order, skipping the directions left unbound. */
export function radialOptionEntries(options: RadialOptions): [RadialDirection, RadialOption][] {
  return RADIAL_DIRECTIONS.flatMap((direction): [RadialDirection, RadialOption][] => {
    const option = options[direction];
    return option ? [[direction, option]] : [];
  });
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
  const identifier = argSourceIdentifier(arg);
  return arg.modifier ? `${identifier} ${arg.modifier.op} ${arg.modifier.amount}` : identifier;
}

/** Same as `argSourceText`, but for a "definir variavel" value, which may be an X/Y pair. */
export function assignedValueText(value: AssignedValue): string | null {
  if (value.kind !== "coordinate") return argSourceText(value);
  return `(${argSourceText(value.x) ?? 0}, ${argSourceText(value.y) ?? 0})`;
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
  return argSourceExpression(value);
}

/** The AHK right-hand side of a "definir variavel" step — an `{x, y}` object for a coordinate target. */
export function formatAssignedValue(value: AssignedValue): string {
  if (value.kind !== "coordinate") return formatArgSourceForAssignment(value);
  const x = value.x.kind === "literal" ? String(Number(value.x.value ?? 0)) : argSourceExpression(value.x);
  const y = value.y.kind === "literal" ? String(Number(value.y.value ?? 0)) : argSourceExpression(value.y);
  return `{x: ${x}, y: ${y}}`;
}

/** Every argument source inside a "definir variavel" value — one, or the two halves of a coordinate. */
export function assignedValueSources(value: AssignedValue): ArgSource[] {
  return value.kind === "coordinate" ? [value.x, value.y] : [value];
}

export function conditionToAhkExpression(condition: ConditionValue): string {
  if (condition.kind === "code") return condition.code.trim() || "true";
  if (condition.kind === "builtin") {
    const meta = BUILTIN_CONDITIONS.find((c) => c.id === condition.conditionId);
    if (!meta) return "true";
    // Same split as `builtinCallExpr`: an all-literal condition keeps its own (often inline,
    // more readable) rendering, while anything sourced from a variable has to go through the
    // declared function, whose parameters can hold an arbitrary expression.
    if (hasHeaderRef(condition.args) && meta.ahkFunctionName) {
      return `${meta.ahkFunctionName}(${formatAhkCallArgs(meta.params, condition.args)})`;
    }
    return meta.toAhkCall ? meta.toAhkCall(toLiteralParamValues(meta.params, condition.args)) : "true";
  }
  return `${condition.targetName} ${condition.operator} ${formatArgSourceForAssignment(condition.value)}`;
}

export function isConditionReady(condition: ConditionValue): boolean {
  if (condition.kind === "code") return condition.code.trim() !== "";
  if (condition.kind === "builtin") {
    const meta = BUILTIN_CONDITIONS.find((c) => c.id === condition.conditionId);
    return Boolean(meta) && areArgsFilled(meta!.params, condition.args);
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
    if (step.action === "set") return `${step.targetName} := ${assignedValueText(step.value) ?? '""'}`;
    if (step.action === "increment") return `${step.targetName} += ${step.amount}`;
    if (step.action === "toggle") return `${step.targetName} := !${step.targetName}`;
    if (step.action === "promptInput") return `${step.targetName} := InputBox("${step.prompt}")`;
    const scopeLabel =
      step.scope === "global"
        ? t("functionsSection.varActionCreateGlobalTag", "global")
        : t("functionsSection.varActionCreateLocalTag", "local");
    const initialValueLabel = Array.isArray(step.initialValue)
      ? `[${step.initialValue.join(", ")}]`
      : step.varType === "coordinate"
        ? coordinateText(toCoordinateLiteral(step.initialValue))
        : String(step.initialValue);
    return `${t("functionsSection.varActionCreateTag", "criar")} (${scopeLabel}) ${step.targetName} = ${initialValueLabel}`;
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
  if (step.kind === "openRadialSelector") {
    return t("functionsSection.openRadialSummary", 'Abrir seletor circular "{{name}}" ({{count}} opções)', {
      name: step.name,
      count: radialOptionEntries(step.options).length,
    });
  }
  if (step.kind === "closeRadialSelector") {
    return t("functionsSection.closeRadialSummary", "Fechar seletor circular {{name}}", {
      name: step.targetVar,
    });
  }
  const summary = argSummary(step.meta.params, step.args);
  return summary ? `${tFunctionName(t, step.meta)}(${summary})` : `${tFunctionName(t, step.meta)}()`;
}

function collectStepGlobalNames(step: Step, globalVariables: GlobalVariable[], acc: Set<string>) {
  if (step.kind === "variableAction") {
    if (step.action === "create" && step.scope === "global") acc.add(step.targetName);
    else if (step.action === "set") {
      for (const source of assignedValueSources(step.value)) {
        if (source.kind === "globalVariable") acc.add(source.variableName);
      }
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
    } else if (condition.kind === "builtin") {
      for (const arg of Object.values(condition.args)) {
        if (arg.kind === "globalVariable") acc.add(arg.variableName);
      }
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
  } else if (step.kind === "openRadialSelector") {
    acc.add(step.varName);
    const targets = radialOptionEntries(step.options).map(([, option]) => option.target);
    if (step.onClose) targets.push(step.onClose);
    for (const target of targets) {
      for (const arg of Object.values(target.args)) {
        if (arg.kind === "globalVariable") acc.add(arg.variableName);
      }
    }
  } else if (step.kind === "closeRadialSelector") {
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
/** Renders a coordinate value the way step summaries show it, e.g. `(120, 340)`. */
export function coordinateText(point: { x: number; y: number }): string {
  return `(${point.x}, ${point.y})`;
}

export function collectAllLocalVariableCreations(steps: Step[]): HeaderParamDef[] {
  const result: HeaderParamDef[] = [];
  function walk(list: Step[]) {
    for (const step of list) {
      if (
        step.kind === "variableAction" &&
        step.action === "create" &&
        step.scope === "local" &&
        step.varType !== "array"
      ) {
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

/** Every selector armed by an "Abrir seletor rápido circular" step anywhere in this function's step tree, for the "Fechar seletor" target picker. */
export function collectAllRadialVariables(steps: Step[]): HeaderParamDef[] {
  const result: HeaderParamDef[] = [];
  function walk(list: Step[]) {
    for (const step of list) {
      if (step.kind === "openRadialSelector") {
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

/** Every selector armed across all other saved functions — since selector variables are global, one function can open a selector and another close it, which is how the feature is normally wired to a key press/release pair. */
export function collectAllRadialVariablesAcrossFunctions(functions: FunctionEntry[]): HeaderParamDef[] {
  const result: HeaderParamDef[] = [];
  function walk(list: SerializedStep[]) {
    for (const step of list) {
      if (step.kind === "openRadialSelector") {
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
): { name: string; type: VariableType; initialValue: VariableInitialValue }[] {
  const result: { name: string; type: VariableType; initialValue: VariableInitialValue }[] = [];
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
  if (control.type === "dropdown") {
    return {
      type: "dropdown",
      options: [...control.options],
      ...(control.x !== undefined ? { x: control.x } : {}),
      ...(control.y !== undefined ? { y: control.y } : {}),
      ...(control.width !== undefined ? { width: control.width } : {}),
      ...(control.color ? { color: control.color } : {}),
    };
  }
  return { type: "code", code: control.code };
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
  if (control.type === "dropdown") {
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
  return { id, type: "code", code: control.code };
}

function stepToAhkLines(step: Step, allFunctions: FunctionEntry[], indent: string): string[] {
  if (step.kind === "customFunction") {
    return [`${indent}${customFunctionCallExpr(step.functionName, step.args, allFunctions)}`];
  }

  if (step.kind === "variableAction") {
    if (step.action === "set") {
      return [`${indent}${step.targetName} := ${formatAssignedValue(step.value)}`];
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
    const literal = formatVariableInitialLiteral(step.varType, step.initialValue);
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
      if (control.type === "code") {
        for (const codeLine of control.code.split("\n")) lines.push(`${indent}${codeLine}`);
        return;
      }
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

  if (step.kind === "openRadialSelector") {
    const entries = radialOptionEntries(step.options);
    // Only the bound directions reach the overlay's label Map — the helper draws a label
    // per key it finds there, so an unbound direction stays blank instead of showing an
    // empty caption for something that does nothing. An invisible selector draws nothing
    // at all, so it carries no labels either.
    const labels = step.showOverlay
      ? entries
          .map(([direction, option]) => `${quoteAhkString(direction)}, ${quoteAhkString(option.label)}`)
          .join(", ")
      : "";
    const args = [
      // Passing the variable's current value in lets the helper dismiss a selector that a
      // previous run left open, so a missing "fechar" step can't orphan an overlay or a watcher.
      step.varName,
      String(step.minDistance),
      String(step.radius),
      step.showOverlay ? "1" : "0",
      quoteAhkString(`0x${step.backColor ?? DEFAULT_RADIAL_BACK_COLOR}`),
      quoteAhkString(step.textColor ?? DEFAULT_RADIAL_TEXT_COLOR),
      String(step.opacity ?? DEFAULT_RADIAL_OPACITY),
      `Map(${labels})`,
      step.triggerOnMove ? "1" : "0",
      // Only means anything while the watcher is running, so it can't linger from an earlier edit.
      step.triggerOnMove && step.keepOpenOnSelect ? "1" : "0",
    ].join(", ");

    const lines = [`${indent}${step.varName} := ${RADIAL_OPEN_FN}(${args})`];
    for (const [direction, option] of entries) {
      lines.push(
        `${indent}${step.varName}.actions[${quoteAhkString(direction)}] := (*) => ${menuTargetCallExpr(
          option.target,
          allFunctions
        )}`
      );
    }
    if (step.onClose) {
      lines.push(
        `${indent}${step.varName}.onClose := (*) => ${menuTargetCallExpr(step.onClose, allFunctions)}`
      );
    }
    return lines;
  }

  if (step.kind === "closeRadialSelector") {
    return [`${indent}${RADIAL_CLOSE_FN}(${step.targetVar})`];
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
  if (step.kind === "openRadialSelector") {
    const options: Partial<Record<RadialDirection, SerializedRadialOption>> = {};
    for (const [direction, option] of radialOptionEntries(step.options)) {
      options[direction] = { label: option.label, target: serializeMenuItemTarget(option.target) };
    }
    return {
      kind: "openRadialSelector",
      varName: step.varName,
      name: step.name,
      minDistance: step.minDistance,
      triggerOnMove: step.triggerOnMove,
      keepOpenOnSelect: step.keepOpenOnSelect,
      showOverlay: step.showOverlay,
      radius: step.radius,
      ...(step.backColor ? { backColor: step.backColor } : {}),
      ...(step.textColor ? { textColor: step.textColor } : {}),
      ...(step.opacity !== undefined ? { opacity: step.opacity } : {}),
      options,
      ...(step.onClose ? { onClose: serializeMenuItemTarget(step.onClose) } : {}),
    };
  }
  if (step.kind === "closeRadialSelector") {
    return { kind: "closeRadialSelector", targetVar: step.targetVar };
  }
  return { kind: "builtin", functionId: step.meta.id, args: { ...step.args } };
}

export function serializeSteps(steps: Step[]): SerializedStep[] {
  return steps.map(serializeStep);
}

/** Shape of a builtin condition saved before its arguments could come from variables. */
type LegacyBuiltinCondition = { kind: "builtin"; conditionId: string; params: ParamValues };

function isLegacyBuiltinCondition(
  condition: ConditionValue | LegacyBuiltinCondition
): condition is LegacyBuiltinCondition {
  return condition.kind === "builtin" && "params" in condition;
}

/** Upgrades a saved condition whose builtin arguments were plain literals into the ArgValues shape. */
export function hydrateCondition(condition: ConditionValue | LegacyBuiltinCondition): ConditionValue {
  if (!isLegacyBuiltinCondition(condition)) return condition;
  const meta = BUILTIN_CONDITIONS.find((c) => c.id === condition.conditionId);
  const args = meta ? defaultArgValues(meta.params) : {};
  for (const [key, value] of Object.entries(condition.params ?? {})) {
    args[key] = { kind: "literal", value };
  }
  return { kind: "builtin", conditionId: condition.conditionId, args };
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
        condition: hydrateCondition(s.condition),
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
    } else if (s.kind === "openRadialSelector") {
      const options: RadialOptions = {};
      for (const direction of RADIAL_DIRECTIONS) {
        const saved = s.options?.[direction];
        if (!saved) continue;
        // Same as a menu item: an option pointing at a builtin id that no longer exists is dropped.
        const target = hydrateMenuItemTarget(saved.target);
        if (target) options[direction] = { label: saved.label ?? "", target };
      }
      // Same as an option: a target pointing at a builtin id that no longer exists is dropped.
      const onClose = s.onClose ? hydrateMenuItemTarget(s.onClose) : null;
      hydrated.push({
        id: nextIdRef.current++,
        kind: "openRadialSelector",
        varName: s.varName,
        name: s.name,
        minDistance: s.minDistance ?? DEFAULT_RADIAL_MIN_DISTANCE,
        // Absent in selectors saved before this existed — they all waited for the closing step.
        triggerOnMove: s.triggerOnMove ?? false,
        keepOpenOnSelect: s.keepOpenOnSelect ?? false,
        showOverlay: s.showOverlay ?? true,
        radius: s.radius ?? DEFAULT_RADIAL_RADIUS,
        ...(s.backColor ? { backColor: s.backColor } : {}),
        ...(s.textColor ? { textColor: s.textColor } : {}),
        ...(s.opacity !== undefined ? { opacity: s.opacity } : {}),
        options,
        ...(onClose ? { onClose } : {}),
      });
    } else if (s.kind === "closeRadialSelector") {
      hydrated.push({ id: nextIdRef.current++, kind: "closeRadialSelector", targetVar: s.targetVar });
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

/** Same as `clearArgsReferencing`, for a "definir variavel" value (which may be an X/Y pair). */
function clearAssignedValueReferencing(identifiers: string[], value: AssignedValue): AssignedValue {
  const clearOne = (source: ArgSource): ArgSource =>
    source.kind === "headerParam" && identifiers.includes(source.paramKey)
      ? { kind: "literal", value: "" }
      : source;
  if (value.kind !== "coordinate") return clearOne(value);
  const x = clearOne(value.x);
  const y = clearOne(value.y);
  return x === value.x && y === value.y ? value : { kind: "coordinate", x, y };
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
      if (step.action !== "set") return step;
      const value = clearAssignedValueReferencing(identifiers, step.value);
      if (value === step.value) return step;
      changed = true;
      return { ...step, value };
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
      } else if (condition.kind === "builtin") {
        const builtin = condition;
        const meta = BUILTIN_CONDITIONS.find((c) => c.id === builtin.conditionId);
        const args = clearArgsReferencing(identifiers, builtin.args, meta?.params ?? []);
        if (args !== builtin.args) {
          condition = { ...builtin, args };
          stepChanged = true;
        }
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
    if (step.kind === "openRadialSelector") {
      let stepChanged = false;
      const clearTarget = (target: MenuItemTarget): MenuItemTarget => {
        const targetParams =
          target.kind === "builtin"
            ? target.meta.params
            : expandHeaderParamsToCallParams(functions.find((f) => f.name === target.functionName)?.params ?? []);
        const args = clearArgsReferencing(identifiers, target.args, targetParams);
        if (args === target.args) return target;
        stepChanged = true;
        return { ...target, args };
      };
      const options: RadialOptions = { ...step.options };
      for (const [direction, option] of radialOptionEntries(step.options)) {
        const target = clearTarget(option.target);
        if (target !== option.target) options[direction] = { ...option, target };
      }
      const onClose = step.onClose ? clearTarget(step.onClose) : step.onClose;
      if (!stepChanged) return step;
      changed = true;
      return { ...step, options, ...(onClose ? { onClose } : {}) };
    }
    if (step.kind === "closeGui" || step.kind === "closeRadialSelector") return step;
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
