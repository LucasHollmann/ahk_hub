"use client";

import { useRef, useState } from "react";
import type { FunctionEntry, GlobalVariable, SerializedStep, VariableAction, VariableType } from "../types";
import StepArgsFields from "./StepArgsFields";
import FunctionPicker, { FunctionPickerPopup, type FunctionPickerItem } from "./FunctionPicker";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import {
  extractFunctionName,
  formatAhkArgLiteral,
  formatAhkCallArgs,
  isValidAhkIdentifier,
  quoteAhkString,
  toSystemFunctionName,
} from "../../functions/ahk";
import {
  areArgsFilled,
  defaultArgValues,
  expandHeaderParamsToCallParams,
  tFunctionCategoryLabel,
  tFunctionDescription,
  tFunctionName,
  type ArgSource,
  type ArgValues,
  type FunctionMeta,
  type HeaderParamDef,
  type HeaderParamType,
  type ParamDef,
  type ParamOption,
  type ParamValues,
} from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";

type Props = {
  functions: FunctionEntry[];
  onAdd: (entry: Omit<FunctionEntry, "id">) => void;
  onUpdate: (id: number, entry: Omit<FunctionEntry, "id">) => void;
  onRemove: (id: number) => void;
  globalVariables: GlobalVariable[];
  onRegisterGlobalVariable: (variable: Omit<GlobalVariable, "id">) => void;
};

type CreationMode = "code" | "steps";
type StepVarActionKind = VariableAction["action"];

type Step =
  | { id: number; kind: "customFunction"; functionName: string; args: ArgValues }
  | { id: number; kind: "builtin"; meta: FunctionMeta; args: ArgValues }
  | ({ id: number; kind: "variableAction" } & VariableAction);

const CODE_EXAMPLE = `AbrirNotas() {
    Run "notepad.exe"
    WinWaitActive "ahk_exe notepad.exe"
    Send "Lembrete: ligar para o cliente{enter}"
}`;

const HEADER_PARAM_DEFAULT_LITERAL: Record<Exclude<HeaderParamType, "coordinate">, string> = {
  text: '""',
  number: "0",
  boolean: "false",
  select: '""',
  keyCombo: '""',
};

function hasHeaderRef(args: ArgValues): boolean {
  return Object.values(args).some((a) => a.kind !== "literal");
}

function toLiteralParamValues(params: ParamDef[], args: ArgValues): ParamValues {
  const values: ParamValues = {};
  for (const p of params) {
    const arg = args[p.key];
    values[p.key] = arg?.kind === "literal" ? arg.value : p.type === "boolean" ? false : "";
  }
  return values;
}

function argSourceText(arg: ArgSource): string | null {
  if (arg.kind === "literal") return arg.value === "" || arg.value === false ? null : String(arg.value);
  if (arg.kind === "headerParam") return arg.paramKey;
  return arg.variableName;
}

function argSummary(params: ParamDef[], args: ArgValues): string {
  return params
    .map((p) => {
      const arg = args[p.key];
      return arg ? argSourceText(arg) : null;
    })
    .filter((v): v is string => v !== null)
    .join(", ");
}

/** Literal formatting for a free-typed "definir variável" value — auto-detects number/boolean keywords, quotes everything else. */
function formatFreeLiteral(raw: string): string {
  if (raw === "") return '""';
  if (raw === "true" || raw === "false") return raw;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  return quoteAhkString(raw);
}

function formatArgSourceForAssignment(value: ArgSource): string {
  if (value.kind === "literal") return formatFreeLiteral(String(value.value ?? ""));
  if (value.kind === "headerParam") return value.paramKey;
  return value.variableName;
}

/** Legacy shape from before "send a key" became the KeyPress builtin — kept so old saved functions still load. */
type LegacyKeyStep = { kind: "key"; combo: string };

function isLegacyKeyStep(s: SerializedStep | LegacyKeyStep): s is LegacyKeyStep {
  return s.kind === "key";
}

function buildCodeFromSteps(
  name: string,
  headerParams: HeaderParamDef[],
  steps: Step[],
  allFunctions: FunctionEntry[],
  globalVariables: GlobalVariable[]
): string {
  const bodyLines = steps.map((step) => {
    if (step.kind === "customFunction") {
      const targetHeaderParams = allFunctions.find((f) => f.name === step.functionName)?.params ?? [];
      const targetParams = expandHeaderParamsToCallParams(targetHeaderParams);
      const argsStr = targetParams.length > 0 ? formatAhkCallArgs(targetParams, step.args) : "";
      return `    ${step.functionName}(${argsStr})`;
    }

    if (step.kind === "variableAction") {
      if (step.action === "set") {
        return `    ${step.targetName} := ${formatArgSourceForAssignment(step.value)}`;
      }
      if (step.action === "increment") {
        return `    ${step.targetName} += ${step.amount}`;
      }
      if (step.action === "toggle") {
        return `    ${step.targetName} := !${step.targetName}`;
      }
      const literal = formatAhkArgLiteral(
        { key: step.targetName, label: step.targetName, type: step.varType },
        step.initialValue
      );
      return `    ${step.targetName} := ${literal}`;
    }

    if (hasHeaderRef(step.args)) {
      const argsStr = formatAhkCallArgs(step.meta.params, step.args);
      return `    ${toSystemFunctionName(step.meta.name)}(${argsStr})`;
    }
    return `    ${
      step.meta.toAhkCall
        ? step.meta.toAhkCall(toLiteralParamValues(step.meta.params, step.args))
        : `${step.meta.name}()`
    }`;
  });

  const globalNames = new Set<string>();
  for (const step of steps) {
    if (step.kind === "variableAction") {
      if (step.action === "create" && step.scope === "global") globalNames.add(step.targetName);
      else if (step.action === "set" && step.value.kind === "globalVariable") {
        globalNames.add(step.value.variableName);
      }
      if (
        (step.action === "set" || step.action === "increment" || step.action === "toggle") &&
        globalVariables.some((v) => v.name === step.targetName)
      ) {
        globalNames.add(step.targetName);
      }
    } else {
      for (const arg of Object.values(step.args)) {
        if (arg.kind === "globalVariable") globalNames.add(arg.variableName);
      }
    }
  }
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

function serializeSteps(steps: Step[]): SerializedStep[] {
  return steps.map((step) => {
    if (step.kind === "customFunction") {
      return { kind: "customFunction", functionName: step.functionName, args: { ...step.args } };
    }
    if (step.kind === "variableAction") {
      const { id, ...rest } = step;
      void id;
      return rest;
    }
    return { kind: "builtin", functionId: step.meta.id, args: { ...step.args } };
  });
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-menu-secondary/30 border border-white/10 rounded-lg p-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{title}</span>
      {children}
    </div>
  );
}

export default function FunctionsSection({
  functions,
  onAdd,
  onUpdate,
  onRemove,
  globalVariables,
  onRegisterGlobalVariable,
}: Props) {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");

  const [headerParams, setHeaderParams] = useState<HeaderParamDef[]>([]);
  const [newParamName, setNewParamName] = useState("");
  const [newParamType, setNewParamType] = useState<HeaderParamType>("text");
  const [newParamOptions, setNewParamOptions] = useState<ParamOption[]>([]);
  const [newOptionValue, setNewOptionValue] = useState("");

  const [steps, setSteps] = useState<Step[]>([]);
  const [stepFunctionName, setStepFunctionName] = useState("");
  const [stepFunctionArgs, setStepFunctionArgs] = useState<ArgValues>({});
  const [stepBuiltinId, setStepBuiltinId] = useState("");
  const [stepBuiltinArgs, setStepBuiltinArgs] = useState<ArgValues>({});
  const [stepVarAction, setStepVarAction] = useState<StepVarActionKind | null>(null);
  const [stepVarTargetName, setStepVarTargetName] = useState("");
  const [stepVarSetValue, setStepVarSetValue] = useState<ArgSource>({ kind: "literal", value: "" });
  const [stepVarIncrementAmount, setStepVarIncrementAmount] = useState(1);
  const [stepVarCreateType, setStepVarCreateType] = useState<VariableType>("text");
  const [stepVarCreateInitialValue, setStepVarCreateInitialValue] = useState<string | number | boolean>("");
  const [stepVarCreateScope, setStepVarCreateScope] = useState<"local" | "global">("local");
  const [stepResetSignal, setStepResetSignal] = useState(0);
  const [isStepFormOpen, setIsStepFormOpen] = useState(false);
  const [isStepPickerOpen, setIsStepPickerOpen] = useState(false);
  const [editingStepId, setEditingStepId] = useState<number | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<number | null>(null);
  const nextStepIdRef = useRef(0);

  const detectedName = extractFunctionName(code);
  const trimmedName = name.trim();
  const trimmedParamName = newParamName.trim();
  const trimmedVarTargetName = stepVarTargetName.trim();
  const availableStepFunctions = functions.filter((f) => f.id !== editingId);
  const stepBuiltin = BUILTIN_FUNCTIONS.find((f) => f.id === stepBuiltinId);
  const stepFunctionTarget = availableStepFunctions.find((f) => f.name === stepFunctionName);
  const stepFunctionCallParams = stepFunctionTarget
    ? expandHeaderParamsToCallParams(stepFunctionTarget.params)
    : [];
  const stepSelection = stepBuiltinId
    ? `builtin:${stepBuiltinId}`
    : stepFunctionName
      ? `custom:${stepFunctionName}`
      : stepVarAction
        ? `varaction:${stepVarAction}`
        : "";

  const stepPickerItems: FunctionPickerItem[] = [
    ...BUILTIN_FUNCTIONS.map((f) => ({
      value: `builtin:${f.id}`,
      label: tFunctionName(t, f),
      description: tFunctionDescription(t, f),
      group: tFunctionCategoryLabel(t, f.category),
    })),
    ...availableStepFunctions.map((f) => ({
      value: `custom:${f.name}`,
      label: f.name,
      description: f.description || undefined,
      group: t("functionsSection.groupCustom", "Personalizadas"),
    })),
    {
      value: "varaction:set",
      label: t("functionsSection.varActionSet", "Definir valor"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
    {
      value: "varaction:increment",
      label: t("functionsSection.varActionIncrement", "Incrementar/decrementar"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
    {
      value: "varaction:toggle",
      label: t("functionsSection.varActionToggle", "Alternar (toggle)"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
    {
      value: "varaction:create",
      label: t("functionsSection.varActionCreate", "Criar variável"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
  ];

  const localVariables: HeaderParamDef[] = steps
    .filter(
      (s): s is Step & { kind: "variableAction"; action: "create" } =>
        s.kind === "variableAction" && s.action === "create" && s.scope === "local"
    )
    .map((s) => ({ key: s.targetName, label: s.targetName, type: s.varType }));

  const globalVariableParams: HeaderParamDef[] = globalVariables.map((v) => ({
    key: v.name,
    label: v.name,
    type: v.type,
  }));

  /** For "incrementar"/"alternar", only variables of a matching type make sense as the target; "definir" accepts any. */
  function matchesVarActionType(type: HeaderParamType): boolean {
    if (stepVarAction === "increment") return type === "number";
    if (stepVarAction === "toggle") return type === "boolean";
    return true;
  }
  const localVarTargets = localVariables.filter((v) => matchesVarActionType(v.type));
  const globalVarTargets = globalVariableParams.filter((v) => matchesVarActionType(v.type));

  function paramTypeLabel(type: HeaderParamType): string {
    return type === "text"
      ? t("functionsSection.paramTypeText", "Texto")
      : type === "number"
        ? t("functionsSection.paramTypeNumber", "Número")
        : type === "boolean"
          ? t("functionsSection.paramTypeBoolean", "Booleano")
          : type === "select"
            ? t("functionsSection.paramTypeSelect", "Seleção")
            : type === "keyCombo"
              ? t("functionsSection.paramTypeKeyCombo", "Tecla")
              : t("functionsSection.paramTypeCoordinate", "Coordenada na tela");
  }

  function addNewParamOption() {
    const value = newOptionValue.trim();
    if (!value || newParamOptions.some((o) => o.value === value)) return;
    setNewParamOptions((prev) => [...prev, { value, label: value }]);
    setNewOptionValue("");
  }

  function removeNewParamOption(value: string) {
    setNewParamOptions((prev) => prev.filter((o) => o.value !== value));
  }

  function resetStepSelectionState() {
    setStepBuiltinId("");
    setStepBuiltinArgs({});
    setStepFunctionName("");
    setStepFunctionArgs({});
    setStepVarAction(null);
    setStepVarTargetName("");
    setStepVarSetValue({ kind: "literal", value: "" });
    setStepVarIncrementAmount(1);
    setStepVarCreateType("text");
    setStepVarCreateInitialValue("");
    setStepVarCreateScope("local");
  }

  function selectStep(value: string) {
    if (value.startsWith("builtin:")) {
      const id = value.slice("builtin:".length);
      const meta = BUILTIN_FUNCTIONS.find((f) => f.id === id);
      resetStepSelectionState();
      setStepBuiltinId(id);
      setStepBuiltinArgs(meta ? defaultArgValues(meta.params) : {});
    } else if (value.startsWith("custom:")) {
      const name = value.slice("custom:".length);
      const target = availableStepFunctions.find((f) => f.name === name);
      resetStepSelectionState();
      setStepFunctionName(name);
      setStepFunctionArgs(target ? defaultArgValues(expandHeaderParamsToCallParams(target.params)) : {});
    } else if (value.startsWith("varaction:")) {
      const action = value.slice("varaction:".length) as StepVarActionKind;
      resetStepSelectionState();
      setStepVarAction(action);
    } else {
      resetStepSelectionState();
    }
  }

  function hydrateSteps(serialized: (SerializedStep | LegacyKeyStep)[]): Step[] {
    const hydrated: Step[] = [];
    for (const s of serialized) {
      if (isLegacyKeyStep(s)) {
        const meta = BUILTIN_FUNCTIONS.find((f) => f.id === "keyPress");
        if (meta) {
          hydrated.push({
            id: nextStepIdRef.current++,
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
          id: nextStepIdRef.current++,
          kind: "customFunction",
          functionName: s.functionName,
          args: { ...(s.args ?? {}) },
        });
      } else if (s.kind === "variableAction") {
        hydrated.push({ id: nextStepIdRef.current++, ...s });
      } else {
        const meta = BUILTIN_FUNCTIONS.find((f) => f.id === s.functionId);
        if (meta) {
          hydrated.push({
            id: nextStepIdRef.current++,
            kind: "builtin",
            meta,
            args: { ...(s.args ?? {}) },
          });
        }
      }
    }
    return hydrated;
  }

  const canSubmit =
    mode === "code"
      ? Boolean(detectedName) && code.trim().length > 0
      : mode === "steps"
        ? isValidAhkIdentifier(trimmedName) && steps.length > 0
        : false;

  function resetForm() {
    setEditingId(null);
    setMode(null);
    setName("");
    setDescription("");
    setCode("");
    setHeaderParams([]);
    setNewParamName("");
    setNewParamType("text");
    setNewParamOptions([]);
    setNewOptionValue("");
    setSteps([]);
    resetStepSelectionState();
    setStepResetSignal((s) => s + 1);
    setIsStepFormOpen(false);
    setEditingStepId(null);
  }

  function openNewForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function startEdit(entry: FunctionEntry) {
    setEditingId(entry.id);
    setDescription(entry.description);

    if (entry.builder?.mode === "steps") {
      setMode("steps");
      setName(entry.name);
      setHeaderParams(entry.params ?? []);
      setSteps(hydrateSteps(entry.builder.steps));
      setCode("");
    } else {
      setMode("code");
      setCode(entry.code);
      setName("");
      setHeaderParams([]);
      setSteps([]);
    }

    setIsFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setIsFormOpen(false);
  }

  function addHeaderParam() {
    if (!isValidAhkIdentifier(trimmedParamName)) return;
    if (headerParams.some((p) => p.key === trimmedParamName)) return;
    if (newParamType === "select" && newParamOptions.length === 0) return;
    setHeaderParams((prev) => [
      ...prev,
      {
        key: trimmedParamName,
        label: trimmedParamName,
        type: newParamType,
        ...(newParamType === "select" ? { options: newParamOptions } : {}),
      },
    ]);
    setNewParamName("");
    setNewParamType("text");
    setNewParamOptions([]);
    setNewOptionValue("");
  }

  /** The raw AHK identifier(s) a header param is referenced by at a call site — two, for a "coordinate" param's X/Y pair. */
  function headerParamIdentifiers(p: HeaderParamDef): string[] {
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

  function removeHeaderParam(key: string) {
    const removed = headerParams.find((p) => p.key === key);
    const identifiers = removed ? headerParamIdentifiers(removed) : [key];
    setHeaderParams((prev) => prev.filter((p) => p.key !== key));
    setSteps((prev) =>
      prev.map((step) => {
        if (step.kind === "variableAction") {
          if (step.action === "set" && step.value.kind === "headerParam" && identifiers.includes(step.value.paramKey)) {
            return { ...step, value: { kind: "literal", value: "" } };
          }
          return step;
        }
        const targetParams =
          step.kind === "builtin"
            ? step.meta.params
            : expandHeaderParamsToCallParams(
                functions.find((f) => f.name === step.functionName)?.params ?? []
              );
        const args = clearArgsReferencing(identifiers, step.args, targetParams);
        return args === step.args ? step : { ...step, args };
      })
    );
  }

  const varStepReady =
    stepVarAction === "set"
      ? isValidAhkIdentifier(trimmedVarTargetName) &&
        (stepVarSetValue.kind !== "literal" || String(stepVarSetValue.value ?? "").trim() !== "")
      : stepVarAction === "increment" || stepVarAction === "toggle" || stepVarAction === "create"
        ? isValidAhkIdentifier(trimmedVarTargetName)
        : false;

  function openStepPicker() {
    resetStepSelectionState();
    setEditingStepId(null);
    setIsStepPickerOpen(true);
  }

  function closeStepForm() {
    resetStepSelectionState();
    setEditingStepId(null);
    setIsStepPickerOpen(false);
    setIsStepFormOpen(false);
  }

  function pickNewStepFunction(value: string) {
    selectStep(value);
    setIsStepPickerOpen(false);
    setIsStepFormOpen(true);
  }

  function startEditStep(step: Step) {
    resetStepSelectionState();
    setEditingStepId(step.id);
    if (step.kind === "builtin") {
      setStepBuiltinId(step.meta.id);
      setStepBuiltinArgs({ ...step.args });
    } else if (step.kind === "customFunction") {
      setStepFunctionName(step.functionName);
      setStepFunctionArgs({ ...step.args });
    } else {
      setStepVarAction(step.action);
      setStepVarTargetName(step.targetName);
      if (step.action === "set") setStepVarSetValue(step.value);
      else if (step.action === "increment") setStepVarIncrementAmount(step.amount);
      else if (step.action === "create") {
        setStepVarCreateType(step.varType);
        setStepVarCreateInitialValue(step.initialValue);
        setStepVarCreateScope(step.scope);
      }
    }
    setIsStepFormOpen(true);
  }

  function buildStepFromSelection(): Step | null {
    if (stepFunctionName) {
      if (!stepFunctionTarget || !areArgsFilled(stepFunctionCallParams, stepFunctionArgs)) return null;
      return { id: -1, kind: "customFunction", functionName: stepFunctionName, args: { ...stepFunctionArgs } };
    }
    if (stepBuiltinId) {
      if (!stepBuiltin || !areArgsFilled(stepBuiltin.params, stepBuiltinArgs)) return null;
      return { id: -1, kind: "builtin", meta: stepBuiltin, args: { ...stepBuiltinArgs } };
    }
    if (stepVarAction) {
      if (!varStepReady) return null;
      const targetName = trimmedVarTargetName;
      if (stepVarAction === "set") {
        return { id: -1, kind: "variableAction", action: "set", targetName, value: stepVarSetValue };
      }
      if (stepVarAction === "increment") {
        return {
          id: -1,
          kind: "variableAction",
          action: "increment",
          targetName,
          amount: stepVarIncrementAmount,
        };
      }
      if (stepVarAction === "toggle") {
        return { id: -1, kind: "variableAction", action: "toggle", targetName };
      }
      return {
        id: -1,
        kind: "variableAction",
        action: "create",
        targetName,
        varType: stepVarCreateType,
        initialValue: stepVarCreateInitialValue,
        scope: stepVarCreateScope,
      };
    }
    return null;
  }

  function submitStep() {
    const stepData = buildStepFromSelection();
    if (!stepData) return;

    if (
      stepData.kind === "variableAction" &&
      stepData.action === "create" &&
      stepData.scope === "global" &&
      !globalVariables.some((v) => v.name === stepData.targetName)
    ) {
      onRegisterGlobalVariable({
        name: stepData.targetName,
        type: stepData.varType,
        initialValue: stepData.initialValue,
      });
    }

    if (editingStepId !== null) {
      const finalStep: Step = { ...stepData, id: editingStepId };
      setSteps((prev) => prev.map((s) => (s.id === editingStepId ? finalStep : s)));
    } else {
      const finalStep: Step = { ...stepData, id: nextStepIdRef.current++ };
      setSteps((prev) => [...prev, finalStep]);
    }
    closeStepForm();
  }

  function reorderSteps(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    setSteps((prev) => {
      const dragIndex = prev.findIndex((s) => s.id === draggedId);
      const dropIndex = prev.findIndex((s) => s.id === targetId);
      if (dragIndex === -1 || dropIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
  }

  function setStepBuiltinArg(key: string, arg: ArgSource) {
    setStepBuiltinArgs((prev) => ({ ...prev, [key]: arg }));
  }

  function setStepFunctionArg(key: string, arg: ArgSource) {
    setStepFunctionArgs((prev) => ({ ...prev, [key]: arg }));
  }

  function removeStep(id: number) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function submitFunction() {
    if (!canSubmit) return;

    const entry =
      mode === "code"
        ? { name: detectedName!, description: description.trim(), code: code.trim(), params: [] }
        : {
            name: trimmedName,
            description: description.trim(),
            code: buildCodeFromSteps(trimmedName, headerParams, steps, functions, globalVariables),
            params: headerParams,
            builder: { mode: "steps" as const, steps: serializeSteps(steps) },
          };

    if (editingId !== null) {
      onUpdate(editingId, entry);
    } else {
      onAdd(entry);
    }
    resetForm();
    setIsFormOpen(false);
  }

  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const target = e.currentTarget;
    const { selectionStart, selectionEnd, value } = target;
    const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
    setCode(nextValue);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = selectionStart + 1;
    });
  }

  function stepLabel(step: Step): string {
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
    const summary = argSummary(step.meta.params, step.args);
    return summary
      ? `${tFunctionName(t, step.meta)}(${summary})`
      : `${tFunctionName(t, step.meta)}()`;
  }

  function setVarSourceSelection(rawValue: string) {
    if (!rawValue) {
      setStepVarSetValue({ kind: "literal", value: "" });
      return;
    }
    const idx = rawValue.indexOf(":");
    const prefix = rawValue.slice(0, idx);
    const nameValue = rawValue.slice(idx + 1);
    if (prefix === "header") setStepVarSetValue({ kind: "headerParam", paramKey: nameValue });
    else if (prefix === "local") setStepVarSetValue({ kind: "localVariable", variableName: nameValue });
    else if (prefix === "global") setStepVarSetValue({ kind: "globalVariable", variableName: nameValue });
  }

  function varSourceSelectValue(): string {
    if (stepVarSetValue.kind === "headerParam") return `header:${stepVarSetValue.paramKey}`;
    if (stepVarSetValue.kind === "localVariable") return `local:${stepVarSetValue.variableName}`;
    if (stepVarSetValue.kind === "globalVariable") return `global:${stepVarSetValue.variableName}`;
    return "";
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold opacity-80">
          {t("functionsSection.customTitle", "Funções personalizadas")}
        </span>
        <button
          className="button-secondary flex items-center gap-1.5"
          onClick={openNewForm}
        >
          {t("functionsSection.addFunction", "Adicionar nova")}
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor">
            <line x1="8" y1="2.5" x2="8" y2="13.5" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {isFormOpen && mode === null && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50"
          onMouseDown={closeForm}
        >
          <div
            className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold">
              {editingId !== null
                ? t("functionsSection.editTitle", "Editar função")
                : t("functionsSection.newTitle", "Nova função")}
            </span>

            <div className="flex flex-col gap-2">
              <span className="text-sm opacity-70">
                {t(
                  "functionsSection.chooseTypeHint",
                  "Escolha como você quer criar a função:"
                )}
              </span>
              <button
                type="button"
                className="button-secondary text-left px-3 py-2"
                onClick={() => setMode("steps")}
              >
                {t("functionsSection.modeSteps", "Criar por sequência de comandos")}
              </button>
              <button
                type="button"
                className="button-secondary text-left px-3 py-2"
                onClick={() => setMode("code")}
              >
                {t("functionsSection.modeCode", "Escrever código AHK puro")}
              </button>
            </div>

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && mode !== null && (
        <div className="fixed inset-0 z-20 bg-menu-dark flex flex-col overflow-auto">
          <div
            className={`w-full mx-auto flex flex-col gap-2.5 p-5 ${
              mode === "steps" ? "max-w-6xl" : "max-w-2xl"
            }`}
          >
            <span className="text-base font-semibold">
              {editingId !== null
                ? t("functionsSection.editTitle", "Editar função")
                : t("functionsSection.newTitle", "Nova função")}
            </span>

            {mode === "code" ? (
              <>
                <div className="bg-menu-secondary/60 border border-white/10 rounded-lg px-3 py-2 text-xs opacity-80 leading-relaxed">
                  {t(
                    "functionsSection.codeWarning",
                    "Escreva aqui apenas o código de uma função. Qualquer coisa além dela pode fazer o script se comportar de um jeito inesperado ou dar erro — nada muito grave, mas o resultado é por sua conta, então vale revisar antes de salvar."
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm">
                    {t("functionsSection.descriptionLabel", "Descrição")}
                  </label>
                  <input
                    className="bg-menu-secondary rounded-lg px-3 py-2 outline-none w-full"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t(
                      "functionsSection.descriptionPlaceholder",
                      "O que essa função faz"
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm">
                    {t("functionsSection.codeLabel", "Código AHK")}
                  </label>
                  <textarea
                    className="bg-menu-secondary rounded-lg px-3 py-2 outline-none w-full font-mono text-sm resize-y min-h-40"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={handleCodeKeyDown}
                    placeholder={CODE_EXAMPLE}
                    spellCheck={false}
                    wrap="off"
                    rows={10}
                    autoFocus
                  />
                  <span className="text-xs opacity-60">
                    {detectedName
                      ? t("functionsSection.detectedName", "Nome detectado: {{name}}", {
                          name: detectedName,
                        })
                      : t(
                          "functionsSection.noNameDetected",
                          "Escreva o cabeçalho da função (ex: NomeDaFuncao() { ... }) para que o nome seja detectado."
                        )}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="bg-menu-secondary/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs opacity-80 leading-relaxed">
                  {t(
                    "functionsSection.stepsHint",
                    "Monte a função com um cabeçalho (nome e parâmetros) e um corpo (passos na ordem em que devem acontecer). Ao chamar outra função em um passo, os parâmetros dela podem vir de um parâmetro compatível do cabeçalho, de uma variável local ou de uma variável global."
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 items-start">
                  <div className="flex flex-col gap-3 min-w-0">
                    <SectionCard title={t("functionsSection.headerSectionTitle", "Cabeçalho")}>
                      <div className="flex gap-2">
                        <div className="flex flex-col gap-1 w-44">
                          <label className="text-xs opacity-70">
                            {t("functionsSection.nameLabel", "Nome da função")}
                          </label>
                          <input
                            className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("functionsSection.namePlaceholder", "Ex: AbrirNotas")}
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs opacity-70">
                            {t("functionsSection.descriptionLabel", "Descrição")}
                          </label>
                          <input
                            className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t(
                              "functionsSection.descriptionPlaceholder",
                              "O que essa função faz"
                            )}
                          />
                        </div>
                      </div>
                      {name.trim() !== "" && !isValidAhkIdentifier(trimmedName) && (
                        <span className="text-xs text-red-400">
                          {t(
                            "functionsSection.invalidName",
                            "Nome inválido: use apenas letras, números e _, sem começar com número."
                          )}
                        </span>
                      )}
                    </SectionCard>

                    <SectionCard
                      title={t("functionsSection.headerParamsTitle", "Parâmetros da função")}
                    >
                      {headerParams.length === 0 ? (
                        <p className="opacity-60 text-xs">
                          {t(
                            "functionsSection.emptyHeaderParams",
                            "Nenhum parâmetro adicionado ainda."
                          )}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {headerParams.map((p) => (
                            <li
                              key={p.key}
                              className="flex items-center justify-between bg-menu-secondary rounded-lg px-2.5 py-1 text-xs"
                            >
                              <span className="font-mono">
                                {p.label} ({paramTypeLabel(p.type as HeaderParamType)}
                                {p.type === "select" && p.options
                                  ? `: ${p.options.map((o) => o.label).join(", ")}`
                                  : ""}
                                )
                              </span>
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => removeHeaderParam(p.key)}
                              >
                                {t("functionsSection.remove", "Remover")}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap gap-1.5 items-center">
                        <input
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-28 text-sm"
                          value={newParamName}
                          onChange={(e) => setNewParamName(e.target.value)}
                          placeholder={t("functionsSection.paramNamePlaceholder", "Ex: texto")}
                        />
                        <select
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 text-sm appearance-none"
                          value={newParamType}
                          onChange={(e) => {
                            setNewParamType(e.target.value as HeaderParamType);
                            setNewParamOptions([]);
                            setNewOptionValue("");
                          }}
                        >
                          <option value="text">{t("functionsSection.paramTypeText", "Texto")}</option>
                          <option value="number">
                            {t("functionsSection.paramTypeNumber", "Número")}
                          </option>
                          <option value="boolean">
                            {t("functionsSection.paramTypeBoolean", "Booleano")}
                          </option>
                          <option value="select">
                            {t("functionsSection.paramTypeSelect", "Seleção")}
                          </option>
                          <option value="coordinate">
                            {t("functionsSection.paramTypeCoordinate", "Coordenada na tela")}
                          </option>
                          <option value="keyCombo">
                            {t("functionsSection.paramTypeKeyCombo", "Tecla")}
                          </option>
                        </select>
                        <button
                          type="button"
                          className="button-secondary py-1.5 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={
                            !isValidAhkIdentifier(trimmedParamName) ||
                            headerParams.some((p) => p.key === trimmedParamName) ||
                            (newParamType === "select" && newParamOptions.length === 0)
                          }
                          onClick={addHeaderParam}
                        >
                          {t("functionsSection.addParam", "Adicionar parâmetro")}
                        </button>
                      </div>
                      {trimmedParamName !== "" && !isValidAhkIdentifier(trimmedParamName) && (
                        <span className="text-xs text-red-400">
                          {t(
                            "functionsSection.invalidName",
                            "Nome inválido: use apenas letras, números e _, sem começar com número."
                          )}
                        </span>
                      )}

                      {newParamType === "select" && (
                        <div className="flex flex-col gap-1.5 bg-menu-secondary/60 rounded-lg p-2">
                          <span className="text-xs opacity-70">
                            {t("functionsSection.paramOptionsLabel", "Opções da seleção")}
                          </span>
                          {newParamOptions.length > 0 && (
                            <ul className="flex flex-wrap gap-1">
                              {newParamOptions.map((o) => (
                                <li
                                  key={o.value}
                                  className="flex items-center gap-1 bg-menu-secondary rounded px-2 py-1 text-xs"
                                >
                                  {o.label}
                                  <button
                                    type="button"
                                    className="opacity-60 hover:opacity-100 cursor-pointer"
                                    onClick={() => removeNewParamOption(o.value)}
                                  >
                                    ×
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex gap-2">
                            <input
                              className="bg-menu-secondary rounded-lg px-2 py-1.5 outline-none text-sm flex-1"
                              value={newOptionValue}
                              onChange={(e) => setNewOptionValue(e.target.value)}
                              placeholder={t("functionsSection.paramOptionPlaceholder", "Ex: Rápido")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addNewParamOption();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="button-secondary py-1 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={
                                !newOptionValue.trim() ||
                                newParamOptions.some((o) => o.value === newOptionValue.trim())
                              }
                              onClick={addNewParamOption}
                            >
                              {t("functionsSection.addParamOption", "Adicionar opção")}
                            </button>
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </div>

                  <SectionCard title={t("functionsSection.bodySectionTitle", "Corpo")}>
                    {steps.length === 0 ? (
                      <p className="opacity-60 text-xs">
                        {t("functionsSection.emptySteps", "Nenhum passo adicionado ainda.")}
                      </p>
                    ) : (
                      <ol className="flex flex-col gap-1">
                        {steps.map((step, index) => (
                          <li
                            key={step.id}
                            draggable
                            onDragStart={() => setDraggedStepId(step.id)}
                            onDragEnd={() => setDraggedStepId(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggedStepId !== null) reorderSteps(draggedStepId, step.id);
                              setDraggedStepId(null);
                            }}
                            className={`flex items-center justify-between bg-menu-secondary rounded-lg px-2.5 py-1 text-xs gap-2 cursor-grab active:cursor-grabbing ${
                              draggedStepId === step.id ? "opacity-40" : ""
                            }`}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="opacity-40 select-none" aria-hidden="true">
                                ⠿
                              </span>
                              <span className="font-mono truncate">
                                {index + 1}. {stepLabel(step)}
                              </span>
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => startEditStep(step)}
                              >
                                {t("functionsSection.edit", "Editar")}
                              </button>
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => removeStep(step.id)}
                              >
                                {t("functionsSection.remove", "Remover")}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}

                    <button
                      type="button"
                      className="button-secondary flex items-center gap-1.5 justify-center text-sm w-fit"
                      onClick={openStepPicker}
                    >
                      {t("functionsSection.addStep", "Adicionar passo")}
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor">
                        <line x1="8" y1="2.5" x2="8" y2="13.5" strokeWidth="1.8" strokeLinecap="round" />
                        <line x1="2.5" y1="8" x2="13.5" y2="8" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </SectionCard>
                </div>
              </>
            )}

            {isStepPickerOpen && (
              <FunctionPickerPopup
                items={stepPickerItems}
                value={stepSelection}
                onSelect={pickNewStepFunction}
                onClose={closeStepForm}
              />
            )}

            {isStepFormOpen && (
              <div
                className="fixed inset-0 z-30 flex items-center justify-center bg-black/50"
                onMouseDown={closeStepForm}
              >
                <div
                  className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-lg max-h-[85vh] overflow-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <span className="text-sm font-semibold">
                    {editingStepId !== null
                      ? t("functionsSection.editStepTitle", "Editar passo")
                      : t("functionsSection.newStepTitle", "Novo passo")}
                  </span>

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.selectStepFunction", "Selecione uma função")}
                      </label>
                      <FunctionPicker
                        items={stepPickerItems}
                        value={stepSelection}
                        onChange={selectStep}
                        placeholder={t("functionsSection.selectStepFunction", "Selecione uma função")}
                        className="w-full"
                      />
                    </div>

                      {stepBuiltin && stepBuiltin.params.length > 0 && (
                        <StepArgsFields
                          targetId={stepBuiltin.id}
                          params={stepBuiltin.params}
                          headerParams={headerParams}
                          localVariables={localVariables}
                          globalVariables={globalVariableParams}
                          values={stepBuiltinArgs}
                          onChange={setStepBuiltinArg}
                          resetSignal={stepResetSignal}
                          title={t("paramsFields.title", "Parâmetros de {{name}}", {
                            name: tFunctionName(t, stepBuiltin),
                          })}
                        />
                      )}

                      {stepFunctionTarget && stepFunctionCallParams.length > 0 && (
                        <StepArgsFields
                          params={stepFunctionCallParams}
                          headerParams={headerParams}
                          localVariables={localVariables}
                          globalVariables={globalVariableParams}
                          values={stepFunctionArgs}
                          onChange={setStepFunctionArg}
                          resetSignal={stepResetSignal}
                          title={t("paramsFields.title", "Parâmetros de {{name}}", {
                            name: stepFunctionTarget.name,
                          })}
                        />
                      )}

                      {stepVarAction && (
                        <div className="flex flex-col gap-2 bg-menu-secondary/40 rounded-lg p-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs opacity-70">
                              {stepVarAction === "create"
                                ? t("functionsSection.varActionNewNameLabel", "Nome da nova variável")
                                : t("functionsSection.varActionTargetLabel", "Variável")}
                            </label>
                            {stepVarAction === "create" ? (
                              <>
                                <input
                                  className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                                  value={stepVarTargetName}
                                  onChange={(e) => setStepVarTargetName(e.target.value)}
                                  placeholder={t("variablesSection.namePlaceholder", "Ex: contador")}
                                />
                                {trimmedVarTargetName !== "" && !isValidAhkIdentifier(trimmedVarTargetName) && (
                                  <span className="text-xs text-red-400">
                                    {t(
                                      "functionsSection.invalidName",
                                      "Nome inválido: use apenas letras, números e _, sem começar com número."
                                    )}
                                  </span>
                                )}
                              </>
                            ) : localVarTargets.length === 0 && globalVarTargets.length === 0 ? (
                              <p className="opacity-60 text-xs">
                                {t(
                                  "functionsSection.noVariablesAvailable",
                                  "Nenhuma variável disponível — crie uma primeiro."
                                )}
                              </p>
                            ) : (
                              <select
                                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 w-full text-sm appearance-none"
                                value={stepVarTargetName}
                                onChange={(e) => setStepVarTargetName(e.target.value)}
                              >
                                <option value="">
                                  {t("functionsSection.selectVariablePlaceholder", "Selecione uma variável")}
                                </option>
                                {localVarTargets.length > 0 && (
                                  <optgroup
                                    label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}
                                  >
                                    {localVarTargets.map((v) => (
                                      <option key={v.key} value={v.key}>
                                        {v.label}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {globalVarTargets.length > 0 && (
                                  <optgroup
                                    label={t("stepArgsFields.groupGlobalVariables", "Variáveis globais")}
                                  >
                                    {globalVarTargets.map((v) => (
                                      <option key={v.key} value={v.key}>
                                        {v.label}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            )}
                          </div>

                          {stepVarAction === "set" && (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-xs opacity-70">
                                  {t("functionsSection.varActionValueLabel", "Novo valor")}
                                </label>
                                {(headerParams.length > 0 ||
                                  localVariables.length > 0 ||
                                  globalVariableParams.length > 0) && (
                                  <select
                                    className="bg-menu-secondary rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none"
                                    value={varSourceSelectValue()}
                                    onChange={(e) => setVarSourceSelection(e.target.value)}
                                  >
                                    <option value="">
                                      {t("stepArgsFields.fixedValue", "Valor fixo")}
                                    </option>
                                    {headerParams.length > 0 && (
                                      <optgroup
                                        label={t(
                                          "stepArgsFields.groupHeaderParams",
                                          "Parâmetros do cabeçalho"
                                        )}
                                      >
                                        {headerParams.map((p) => (
                                          <option key={`header:${p.key}`} value={`header:${p.key}`}>
                                            {p.label}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {localVariables.length > 0 && (
                                      <optgroup
                                        label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}
                                      >
                                        {localVariables.map((v) => (
                                          <option key={`local:${v.key}`} value={`local:${v.key}`}>
                                            {v.label}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {globalVariableParams.length > 0 && (
                                      <optgroup
                                        label={t(
                                          "stepArgsFields.groupGlobalVariables",
                                          "Variáveis globais"
                                        )}
                                      >
                                        {globalVariableParams.map((v) => (
                                          <option key={`global:${v.key}`} value={`global:${v.key}`}>
                                            {v.label}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                )}
                              </div>
                              {stepVarSetValue.kind === "literal" ? (
                                <input
                                  className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                                  value={String(stepVarSetValue.value ?? "")}
                                  onChange={(e) =>
                                    setStepVarSetValue({ kind: "literal", value: e.target.value })
                                  }
                                />
                              ) : (
                                <div className="bg-menu-secondary rounded-lg px-3 py-2 text-sm opacity-70 italic">
                                  {t(
                                    "functionsSection.varActionUsingSource",
                                    'Usando "{{name}}"',
                                    {
                                      name:
                                        stepVarSetValue.kind === "headerParam"
                                          ? stepVarSetValue.paramKey
                                          : stepVarSetValue.variableName,
                                    }
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {stepVarAction === "increment" && (
                            <div className="flex flex-col gap-1">
                              <label className="text-xs opacity-70">
                                {t(
                                  "functionsSection.varActionAmountLabel",
                                  "Quantidade (pode ser negativa)"
                                )}
                              </label>
                              <input
                                type="number"
                                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                                value={stepVarIncrementAmount}
                                onChange={(e) => setStepVarIncrementAmount(Number(e.target.value))}
                              />
                            </div>
                          )}

                          {stepVarAction === "create" && (
                            <>
                              <div className="flex gap-2">
                                <div className="flex flex-col gap-1 flex-1">
                                  <label className="text-xs opacity-70">
                                    {t("variablesSection.typeLabel", "Tipo")}
                                  </label>
                                  <select
                                    className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 text-sm appearance-none"
                                    value={stepVarCreateType}
                                    onChange={(e) => {
                                      const nextType = e.target.value as VariableType;
                                      setStepVarCreateType(nextType);
                                      setStepVarCreateInitialValue(nextType === "boolean" ? false : "");
                                    }}
                                  >
                                    <option value="text">
                                      {t("functionsSection.paramTypeText", "Texto")}
                                    </option>
                                    <option value="number">
                                      {t("functionsSection.paramTypeNumber", "Número")}
                                    </option>
                                    <option value="boolean">
                                      {t("functionsSection.paramTypeBoolean", "Booleano")}
                                    </option>
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                  <label className="text-xs opacity-70">
                                    {t("variablesSection.initialValueLabel", "Valor inicial")}
                                  </label>
                                  {stepVarCreateType === "boolean" ? (
                                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none h-9">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={Boolean(stepVarCreateInitialValue)}
                                        onChange={(e) => setStepVarCreateInitialValue(e.target.checked)}
                                      />
                                      {t("variablesSection.trueLabel", "Verdadeiro")}
                                    </label>
                                  ) : (
                                    <input
                                      type={stepVarCreateType === "number" ? "number" : "text"}
                                      className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                                      value={String(stepVarCreateInitialValue)}
                                      onChange={(e) =>
                                        setStepVarCreateInitialValue(
                                          stepVarCreateType === "number"
                                            ? Number(e.target.value)
                                            : e.target.value
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-xs opacity-70">
                                  {t("functionsSection.varActionScopeLabel", "Escopo")}
                                </label>
                                <div className="flex gap-1 bg-menu-secondary rounded-md p-0.5 text-xs w-fit">
                                  <button
                                    type="button"
                                    className={`px-2 py-1 rounded outline-none focus:outline-none cursor-pointer ${
                                      stepVarCreateScope === "local" ? "bg-(--main) text-white" : "opacity-60"
                                    }`}
                                    onClick={() => setStepVarCreateScope("local")}
                                  >
                                    {t("functionsSection.varActionScopeLocal", "Local")}
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-2 py-1 rounded outline-none focus:outline-none cursor-pointer ${
                                      stepVarCreateScope === "global" ? "bg-(--main) text-white" : "opacity-60"
                                    }`}
                                    onClick={() => setStepVarCreateScope("global")}
                                  >
                                    {t("functionsSection.varActionScopeGlobal", "Global")}
                                  </button>
                                </div>
                                {stepVarCreateScope === "global" && (
                                  <span className="text-xs opacity-60">
                                    {t(
                                      "functionsSection.varActionScopeGlobalHint",
                                      "Vai aparecer também na aba Variáveis globais."
                                    )}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                  <div className="flex gap-2 justify-end">
                    <button className="button-secondary" onClick={closeStepForm}>
                      {t("functionsSection.cancel", "Cancelar")}
                    </button>
                    <button
                      className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={
                        stepFunctionName
                          ? !stepFunctionTarget ||
                            !areArgsFilled(stepFunctionCallParams, stepFunctionArgs)
                          : stepBuiltinId
                            ? !stepBuiltin || !areArgsFilled(stepBuiltin.params, stepBuiltinArgs)
                            : stepVarAction
                              ? !varStepReady
                              : true
                      }
                      onClick={submitStep}
                    >
                      {editingStepId !== null
                        ? t("functionsSection.save", "Salvar")
                        : t("functionsSection.addStep", "Adicionar passo")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!canSubmit}
                onClick={submitFunction}
              >
                {editingId !== null
                  ? t("functionsSection.save", "Salvar")
                  : t("functionsSection.add", "Adicionar")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 overflow-auto">
        {functions.length === 0 && (
          <p className="opacity-60 text-sm">
            {t("functionsSection.emptyCustomList", "Nenhuma função personalizada cadastrada.")}
          </p>
        )}
        {functions.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between bg-menu-secondary rounded-lg px-4 py-2"
          >
            <div className="flex flex-col">
              <span className="font-semibold">{f.name}</span>
              {f.description && <span className="text-sm opacity-70">{f.description}</span>}
            </div>
            <div className="flex gap-2">
              <button
                className="button-secondary py-1 px-3 text-sm"
                onClick={() => startEdit(f)}
              >
                {t("functionsSection.edit", "Editar")}
              </button>
              <button
                className="button-secondary py-1 px-3 text-sm"
                onClick={() => onRemove(f.id)}
              >
                {t("functionsSection.remove", "Remover")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
