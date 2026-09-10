"use client";

import type { ConditionOperator, ConditionValue } from "../types";
import type { ArgSource, HeaderParamDef } from "../../functions/types";
import { defaultParamValues, tFunctionDescription, tFunctionName } from "../../functions/types";
import { BUILTIN_CONDITIONS } from "../../functions/conditions";
import { useTranslation } from "../../i18n/I18nContext";
import FunctionPicker, { type FunctionPickerItem } from "./FunctionPicker";
import ParamsFields from "./ParamsFields";

const OPERATORS: ConditionOperator[] = ["=", "!=", ">", "<", ">=", "<="];

/** Rough grouping of the ready-made condition kinds, purely for the picker's columns. */
const CONDITION_GROUPS: Record<string, string[]> = {
  mouse: ["condMousePosition", "condPixelColor"],
  window: ["condActiveWindow", "condWindowExists", "condWindowState"],
  system: ["condKeyState", "condToggleKeyState", "condClipboard", "condIdleTime", "condTimeOfDay", "condVolume"],
};

function conditionGroupLabel(id: string, t: ReturnType<typeof useTranslation>["t"]): string {
  if (CONDITION_GROUPS.mouse.includes(id)) return t("functionCategories.mouseConditions", "Mouse");
  if (CONDITION_GROUPS.window.includes(id)) return t("functionCategories.windowConditions", "Janelas");
  return t("functionCategories.systemConditions", "Sistema");
}

type Props = {
  condition: ConditionValue;
  onChange: (condition: ConditionValue) => void;
  headerParams: HeaderParamDef[];
  localVariables: HeaderParamDef[];
  globalVariables: HeaderParamDef[];
};

export default function ConditionFields({
  condition,
  onChange,
  headerParams,
  localVariables,
  globalVariables,
}: Props) {
  const { t } = useTranslation();

  const kindSelection =
    condition.kind === "builtin" ? `builtin:${condition.conditionId}` : condition.kind;

  const kindPickerItems: FunctionPickerItem[] = [
    {
      value: "variable",
      label: t("functionsSection.conditionKindVariable", "Comparar variável"),
      group: t("functionsSection.conditionGroupBasic", "Básico"),
    },
    {
      value: "code",
      label: t("functionsSection.conditionKindCode", "Código puro"),
      group: t("functionsSection.conditionGroupBasic", "Básico"),
    },
    ...BUILTIN_CONDITIONS.map((meta) => ({
      value: `builtin:${meta.id}`,
      label: tFunctionName(t, meta),
      description: tFunctionDescription(t, meta),
      group: conditionGroupLabel(meta.id, t),
    })),
  ];

  function selectKind(value: string) {
    if (value === "code") {
      onChange({ kind: "code", code: condition.kind === "code" ? condition.code : "" });
    } else if (value === "variable") {
      onChange({
        kind: "variable",
        targetName: condition.kind === "variable" ? condition.targetName : "",
        operator: condition.kind === "variable" ? condition.operator : "=",
        value: condition.kind === "variable" ? condition.value : { kind: "literal", value: "" },
      });
    } else if (value.startsWith("builtin:")) {
      const conditionId = value.slice("builtin:".length);
      const meta = BUILTIN_CONDITIONS.find((c) => c.id === conditionId);
      onChange({
        kind: "builtin",
        conditionId,
        params:
          condition.kind === "builtin" && condition.conditionId === conditionId
            ? condition.params
            : meta
              ? defaultParamValues(meta)
              : {},
      });
    }
  }

  function valueSourceValue(value: ArgSource): string {
    if (value.kind === "headerParam") return `header:${value.paramKey}`;
    if (value.kind === "localVariable") return `local:${value.variableName}`;
    if (value.kind === "globalVariable") return `global:${value.variableName}`;
    return "";
  }

  function applyValueSource(rawValue: string) {
    if (condition.kind !== "variable") return;
    if (!rawValue) {
      onChange({ ...condition, value: { kind: "literal", value: "" } });
      return;
    }
    const idx = rawValue.indexOf(":");
    const prefix = rawValue.slice(0, idx);
    const name = rawValue.slice(idx + 1);
    if (prefix === "header") onChange({ ...condition, value: { kind: "headerParam", paramKey: name } });
    else if (prefix === "local")
      onChange({ ...condition, value: { kind: "localVariable", variableName: name } });
    else if (prefix === "global")
      onChange({ ...condition, value: { kind: "globalVariable", variableName: name } });
  }

  function valueUsingLabel(value: ArgSource): string | null {
    if (value.kind === "headerParam") {
      const name = headerParams.find((p) => p.key === value.paramKey)?.label ?? value.paramKey;
      return t("stepArgsFields.usingHeaderParam", 'Usando o parâmetro "{{name}}" do cabeçalho', { name });
    }
    if (value.kind === "localVariable") {
      return t("stepArgsFields.usingLocalVariable", 'Usando a variável local "{{name}}"', {
        name: value.variableName,
      });
    }
    if (value.kind === "globalVariable") {
      return t("stepArgsFields.usingGlobalVariable", 'Usando a variável global "{{name}}"', {
        name: value.variableName,
      });
    }
    return null;
  }

  const builtinMeta =
    condition.kind === "builtin" ? BUILTIN_CONDITIONS.find((c) => c.id === condition.conditionId) : undefined;

  return (
    <div className="flex flex-col gap-2 bg-menu-secondary/40 rounded-lg p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs opacity-70">
          {t("functionsSection.conditionKindLabel", "Tipo de condição")}
        </label>
        <FunctionPicker
          items={kindPickerItems}
          value={kindSelection}
          onChange={selectKind}
          placeholder={t("functionsSection.conditionKindLabel", "Tipo de condição")}
        />
      </div>

      {condition.kind === "code" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs opacity-70">
            {t("functionsSection.conditionCodeLabel", "Condição (código AHK)")}
          </label>
          <input
            className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm font-mono"
            value={condition.code}
            onChange={(e) => onChange({ kind: "code", code: e.target.value })}
            placeholder={t("functionsSection.conditionCodePlaceholder", "Ex: A_Index < 10")}
          />
        </div>
      )}

      {condition.kind === "builtin" && builtinMeta && (
        <ParamsFields meta={builtinMeta} values={condition.params} onChange={(key, value) =>
          onChange({ ...condition, params: { ...condition.params, [key]: value } })
        } resetSignal={0} />
      )}

      {condition.kind === "variable" && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-70">
              {t("functionsSection.conditionTargetLabel", "Variável")}
            </label>
            {localVariables.length === 0 && globalVariables.length === 0 ? (
              <p className="opacity-60 text-xs">
                {t("functionsSection.noVariablesAvailable", "Nenhuma variável disponível — crie uma primeiro.")}
              </p>
            ) : (
              <select
                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 w-full text-sm appearance-none"
                value={condition.targetName}
                onChange={(e) => onChange({ ...condition, targetName: e.target.value })}
              >
                <option value="">
                  {t("functionsSection.selectVariablePlaceholder", "Selecione uma variável")}
                </option>
                {localVariables.length > 0 && (
                  <optgroup label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}>
                    {localVariables.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {globalVariables.length > 0 && (
                  <optgroup label={t("stepArgsFields.groupGlobalVariables", "Variáveis globais")}>
                    {globalVariables.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-70">
              {t("functionsSection.conditionOperatorLabel", "Operador")}
            </label>
            <select
              className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 w-fit text-sm appearance-none font-mono"
              value={condition.operator}
              onChange={(e) => onChange({ ...condition, operator: e.target.value as ConditionOperator })}
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs opacity-70">
                {t("functionsSection.conditionValueLabel", "Comparar com")}
              </label>
              {(headerParams.length > 0 || localVariables.length > 0 || globalVariables.length > 0) && (
                <select
                  className="bg-menu-secondary rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none"
                  value={valueSourceValue(condition.value)}
                  onChange={(e) => applyValueSource(e.target.value)}
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
            {condition.value.kind === "literal" ? (
              <input
                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                value={String(condition.value.value ?? "")}
                onChange={(e) => onChange({ ...condition, value: { kind: "literal", value: e.target.value } })}
              />
            ) : (
              <div className="bg-menu-secondary rounded-lg px-3 py-2 text-sm opacity-70 italic">
                {valueUsingLabel(condition.value)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
