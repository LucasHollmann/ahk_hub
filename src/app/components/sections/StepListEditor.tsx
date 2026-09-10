"use client";

import { useState } from "react";
import type { VariableType, FunctionEntry, ConditionValue, FlowControlType } from "../types";
import StepArgsFields from "./StepArgsFields";
import ConditionFields from "./ConditionFields";
import FunctionPicker, { FunctionPickerPopup, type FunctionPickerItem } from "./FunctionPicker";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import { isValidAhkIdentifier } from "../../functions/ahk";
import {
  areArgsFilled,
  defaultArgValues,
  expandHeaderParamsToCallParams,
  tFunctionCategoryLabel,
  tFunctionDescription,
  tFunctionName,
  type ArgSource,
  type ArgValues,
  type HeaderParamDef,
  type HeaderParamType,
} from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";
import {
  isConditionReady,
  stepLabel,
  type Step,
  type StepVarActionKind,
} from "./stepTypes";

type Props = {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  functions: FunctionEntry[];
  headerParams: HeaderParamDef[];
  localVariables: HeaderParamDef[];
  globalVariables: HeaderParamDef[];
  nextStepIdRef: { current: number };
  depth?: number;
};

export default function StepListEditor({
  steps,
  onChange,
  functions,
  headerParams,
  localVariables,
  globalVariables,
  nextStepIdRef,
  depth = 0,
}: Props) {
  const { t } = useTranslation();

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
  const [stepFlowType, setStepFlowType] = useState<FlowControlType | null>(null);
  const [stepFlowCondition, setStepFlowCondition] = useState<ConditionValue>({ kind: "code", code: "" });
  const [stepFlowBody, setStepFlowBody] = useState<Step[]>([]);
  const [stepFlowElseBody, setStepFlowElseBody] = useState<Step[]>([]);
  const [stepResetSignal, setStepResetSignal] = useState(0);
  const [isStepFormOpen, setIsStepFormOpen] = useState(false);
  const [isStepPickerOpen, setIsStepPickerOpen] = useState(false);
  const [editingStepId, setEditingStepId] = useState<number | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<number | null>(null);

  const trimmedVarTargetName = stepVarTargetName.trim();
  const stepBuiltin = BUILTIN_FUNCTIONS.find((f) => f.id === stepBuiltinId);
  const stepFunctionTarget = functions.find((f) => f.name === stepFunctionName);
  const stepFunctionCallParams = stepFunctionTarget
    ? expandHeaderParamsToCallParams(stepFunctionTarget.params)
    : [];
  const stepSelection = stepBuiltinId
    ? `builtin:${stepBuiltinId}`
    : stepFunctionName
      ? `custom:${stepFunctionName}`
      : stepVarAction
        ? `varaction:${stepVarAction}`
        : stepFlowType
          ? `flow:${stepFlowType}`
          : "";

  const stepPickerItems: FunctionPickerItem[] = [
    ...BUILTIN_FUNCTIONS.map((f) => ({
      value: `builtin:${f.id}`,
      label: tFunctionName(t, f),
      description: tFunctionDescription(t, f),
      group: tFunctionCategoryLabel(t, f.category),
    })),
    ...functions.map((f) => ({
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
    {
      value: "flow:loop",
      label: t("functionsSection.flowLoopLabel", "Loop"),
      description: t(
        "functionsSection.flowLoopDescription",
        "Repete os passos seguintes enquanto uma condição for verdadeira."
      ),
      group: t("functionCategories.flow", "Controle de fluxo"),
    },
    {
      value: "flow:conditional",
      label: t("functionsSection.flowConditionalLabel", "Conditional"),
      description: t(
        "functionsSection.flowConditionalDescription",
        "Executa os passos seguintes apenas se uma condição for verdadeira."
      ),
      group: t("functionCategories.flow", "Controle de fluxo"),
    },
  ];

  function matchesVarActionType(type: HeaderParamType): boolean {
    if (stepVarAction === "increment") return type === "number";
    if (stepVarAction === "toggle") return type === "boolean";
    return true;
  }
  const localVarTargets = localVariables.filter((v) => matchesVarActionType(v.type));
  const globalVarTargets = globalVariables.filter((v) => matchesVarActionType(v.type));

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
    setStepFlowType(null);
    setStepFlowCondition({ kind: "code", code: "" });
    setStepFlowBody([]);
    setStepFlowElseBody([]);
    setStepResetSignal((s) => s + 1);
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
      const target = functions.find((f) => f.name === name);
      resetStepSelectionState();
      setStepFunctionName(name);
      setStepFunctionArgs(target ? defaultArgValues(expandHeaderParamsToCallParams(target.params)) : {});
    } else if (value.startsWith("varaction:")) {
      const action = value.slice("varaction:".length) as StepVarActionKind;
      resetStepSelectionState();
      setStepVarAction(action);
    } else if (value.startsWith("flow:")) {
      const flowType = value.slice("flow:".length) as FlowControlType;
      resetStepSelectionState();
      setStepFlowType(flowType);
    } else {
      resetStepSelectionState();
    }
  }

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
    } else if (step.kind === "flowControl") {
      setStepFlowType(step.flowType);
      setStepFlowCondition(step.condition);
      setStepFlowBody(step.body);
      setStepFlowElseBody(step.elseBody ?? []);
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

  const varStepReady =
    stepVarAction === "set"
      ? isValidAhkIdentifier(trimmedVarTargetName) &&
        (stepVarSetValue.kind !== "literal" || String(stepVarSetValue.value ?? "").trim() !== "")
      : stepVarAction === "increment" || stepVarAction === "toggle" || stepVarAction === "create"
        ? isValidAhkIdentifier(trimmedVarTargetName)
        : false;

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
    if (stepFlowType) {
      if (!isConditionReady(stepFlowCondition)) return null;
      return {
        id: -1,
        kind: "flowControl",
        flowType: stepFlowType,
        condition: stepFlowCondition,
        body: stepFlowBody,
        ...(stepFlowType === "conditional" && stepFlowElseBody.length > 0
          ? { elseBody: stepFlowElseBody }
          : {}),
      };
    }
    return null;
  }

  function submitStep() {
    const stepData = buildStepFromSelection();
    if (!stepData) return;

    if (editingStepId !== null) {
      const finalStep: Step = { ...stepData, id: editingStepId };
      onChange(steps.map((s) => (s.id === editingStepId ? finalStep : s)));
    } else {
      const finalStep: Step = { ...stepData, id: nextStepIdRef.current++ };
      onChange([...steps, finalStep]);
    }
    closeStepForm();
  }

  function reorderSteps(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const dragIndex = steps.findIndex((s) => s.id === draggedId);
    const dropIndex = steps.findIndex((s) => s.id === targetId);
    if (dragIndex === -1 || dropIndex === -1) return;
    const next = [...steps];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next);
  }

  function removeStep(id: number) {
    onChange(steps.filter((s) => s.id !== id));
  }

  function setStepBuiltinArg(key: string, arg: ArgSource) {
    setStepBuiltinArgs((prev) => ({ ...prev, [key]: arg }));
  }

  function setStepFunctionArg(key: string, arg: ArgSource) {
    setStepFunctionArgs((prev) => ({ ...prev, [key]: arg }));
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

  const formZ = 30 + depth * 2;

  return (
    <div className="flex flex-col gap-2">
      {steps.length === 0 ? (
        <p className="opacity-60 text-xs">{t("functionsSection.emptySteps", "Nenhum passo adicionado ainda.")}</p>
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
                  {index + 1}. {stepLabel(t, step, functions)}
                </span>
              </span>
              <div className="flex gap-1 shrink-0">
                <button className="button-secondary py-0.5 px-2 text-xs" onClick={() => startEditStep(step)}>
                  {t("functionsSection.edit", "Editar")}
                </button>
                <button className="button-secondary py-0.5 px-2 text-xs" onClick={() => removeStep(step.id)}>
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
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          style={{ zIndex: formZ }}
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
                  globalVariables={globalVariables}
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
                  globalVariables={globalVariables}
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
                          <optgroup label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}>
                            {localVarTargets.map((v) => (
                              <option key={v.key} value={v.key}>
                                {v.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {globalVarTargets.length > 0 && (
                          <optgroup label={t("stepArgsFields.groupGlobalVariables", "Variáveis globais")}>
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
                        {(headerParams.length > 0 || localVariables.length > 0 || globalVariables.length > 0) && (
                          <select
                            className="bg-menu-secondary rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none"
                            value={varSourceSelectValue()}
                            onChange={(e) => setVarSourceSelection(e.target.value)}
                          >
                            <option value="">{t("stepArgsFields.fixedValue", "Valor fixo")}</option>
                            {headerParams.length > 0 && (
                              <optgroup label={t("stepArgsFields.groupHeaderParams", "Parâmetros do cabeçalho")}>
                                {headerParams.map((p) => (
                                  <option key={`header:${p.key}`} value={`header:${p.key}`}>
                                    {p.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {localVariables.length > 0 && (
                              <optgroup label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}>
                                {localVariables.map((v) => (
                                  <option key={`local:${v.key}`} value={`local:${v.key}`}>
                                    {v.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {globalVariables.length > 0 && (
                              <optgroup label={t("stepArgsFields.groupGlobalVariables", "Variáveis globais")}>
                                {globalVariables.map((v) => (
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
                          onChange={(e) => setStepVarSetValue({ kind: "literal", value: e.target.value })}
                        />
                      ) : (
                        <div className="bg-menu-secondary rounded-lg px-3 py-2 text-sm opacity-70 italic">
                          {t("functionsSection.varActionUsingSource", 'Usando "{{name}}"', {
                            name:
                              stepVarSetValue.kind === "headerParam"
                                ? stepVarSetValue.paramKey
                                : stepVarSetValue.variableName,
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {stepVarAction === "increment" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.varActionAmountLabel", "Quantidade (pode ser negativa)")}
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
                            <option value="text">{t("functionsSection.paramTypeText", "Texto")}</option>
                            <option value="number">{t("functionsSection.paramTypeNumber", "Número")}</option>
                            <option value="boolean">{t("functionsSection.paramTypeBoolean", "Booleano")}</option>
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
                                  stepVarCreateType === "number" ? Number(e.target.value) : e.target.value
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

              {stepFlowType && (
                <>
                  <ConditionFields
                    condition={stepFlowCondition}
                    onChange={setStepFlowCondition}
                    headerParams={headerParams}
                    localVariables={localVariables}
                    globalVariables={globalVariables}
                  />

                  <div className="flex flex-col gap-1.5 bg-menu-secondary/30 border border-white/10 rounded-lg p-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                      {stepFlowType === "loop"
                        ? t("functionsSection.flowBodyLoopTitle", "Corpo do loop")
                        : t("functionsSection.flowBodyTitle", "Corpo (se verdadeiro)")}
                    </span>
                    <StepListEditor
                      steps={stepFlowBody}
                      onChange={setStepFlowBody}
                      functions={functions}
                      headerParams={headerParams}
                      localVariables={localVariables}
                      globalVariables={globalVariables}
                      nextStepIdRef={nextStepIdRef}
                      depth={depth + 1}
                    />
                  </div>

                  {stepFlowType === "conditional" && (
                    <div className="flex flex-col gap-1.5 bg-menu-secondary/30 border border-white/10 rounded-lg p-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                        {t("functionsSection.flowElseBodyTitle", "Senão (opcional)")}
                      </span>
                      <StepListEditor
                        steps={stepFlowElseBody}
                        onChange={setStepFlowElseBody}
                        functions={functions}
                        headerParams={headerParams}
                        localVariables={localVariables}
                        globalVariables={globalVariables}
                        nextStepIdRef={nextStepIdRef}
                        depth={depth + 1}
                      />
                    </div>
                  )}
                </>
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
                    ? !stepFunctionTarget || !areArgsFilled(stepFunctionCallParams, stepFunctionArgs)
                    : stepBuiltinId
                      ? !stepBuiltin || !areArgsFilled(stepBuiltin.params, stepBuiltinArgs)
                      : stepVarAction
                        ? !varStepReady
                        : stepFlowType
                          ? !isConditionReady(stepFlowCondition)
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
    </div>
  );
}
