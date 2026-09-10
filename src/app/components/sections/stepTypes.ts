import type {
  ConditionValue,
  FlowControlType,
  FunctionEntry,
  GlobalVariable,
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
    };

/** Legacy shape from before "send a key" became the KeyPress builtin — kept so old saved functions still load. */
export type LegacyKeyStep = { kind: "key"; combo: string };

export function isLegacyKeyStep(s: SerializedStep | LegacyKeyStep): s is LegacyKeyStep {
  return s.kind === "key";
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
      (step.action === "set" || step.action === "increment" || step.action === "toggle") &&
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

function stepToAhkLines(step: Step, allFunctions: FunctionEntry[], indent: string): string[] {
  if (step.kind === "customFunction") {
    const targetHeaderParams = allFunctions.find((f) => f.name === step.functionName)?.params ?? [];
    const targetParams = expandHeaderParamsToCallParams(targetHeaderParams);
    const argsStr = targetParams.length > 0 ? formatAhkCallArgs(targetParams, step.args) : "";
    return [`${indent}${step.functionName}(${argsStr})`];
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

  if (hasHeaderRef(step.args)) {
    const argsStr = formatAhkCallArgs(step.meta.params, step.args);
    return [`${indent}${toSystemFunctionName(step.meta.name)}(${argsStr})`];
  }
  return [
    `${indent}${
      step.meta.toAhkCall
        ? step.meta.toAhkCall(toLiteralParamValues(step.meta.params, step.args))
        : `${step.meta.name}()`
    }`,
  ];
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
  return { kind: "builtin", functionId: step.meta.id, args: { ...step.args } };
}

export function serializeSteps(steps: Step[]): SerializedStep[] {
  return steps.map(serializeStep);
}

export function hydrateSteps(
  serialized: (SerializedStep | LegacyKeyStep)[],
  nextIdRef: { current: number }
): Step[] {
  const hydrated: Step[] = [];
  for (const s of serialized) {
    if (isLegacyKeyStep(s)) {
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
