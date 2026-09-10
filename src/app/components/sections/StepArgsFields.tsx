"use client";

import {
  compatibleCoordinateHeaderParams,
  compatibleHeaderParams,
  getCoordinatePairs,
  tCoordinateLabel,
  tParamLabel,
  tParamOption,
  type ArgSource,
  type ArgValues,
  type HeaderParamDef,
  type ParamDef,
  type ParamValues,
} from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";
import KeyComboPicker from "./KeyComboPicker";
import { CoordinateField } from "./ParamsFields";

function literalDefault(param: ParamDef): string | number | boolean {
  return param.type === "boolean" ? false : "";
}

type Props = {
  /** Id used for i18n label lookups when the target is a builtin function; omit for custom functions (their params have no translation keys, so the label typed by the user is used as-is). */
  targetId?: string;
  /** The called function's own parameter list. */
  params: ParamDef[];
  /** The enclosing function's header parameters — candidates to forward into a compatible argument. */
  headerParams: HeaderParamDef[];
  /** Variables created by earlier "manipulação de variáveis" steps in this same function — local scope. */
  localVariables?: HeaderParamDef[];
  /** Variables registered in the "Variáveis globais" tab. */
  globalVariables?: HeaderParamDef[];
  values: ArgValues;
  onChange: (key: string, arg: ArgSource) => void;
  title: string;
  resetSignal: number;
};

export default function StepArgsFields({
  targetId,
  params,
  headerParams,
  localVariables = [],
  globalVariables = [],
  values,
  onChange,
  title,
  resetSignal,
}: Props) {
  const { t } = useTranslation();
  const coordinatePairs = getCoordinatePairs(params);
  const hasFullScreenToggle = params.some((p) => p.key === "fullScreen");
  const consumedKeys = new Set(coordinatePairs.flatMap((p) => [p.xKey, p.yKey]));
  const otherParams = params.filter((p) => !consumedKeys.has(p.key));

  const literalValues: ParamValues = {};
  for (const p of params) {
    const arg = values[p.key];
    literalValues[p.key] = arg?.kind === "literal" ? arg.value : literalDefault(p);
  }

  function setLiteral(key: string, value: string | number | boolean) {
    onChange(key, { kind: "literal", value });
  }

  function sourceSelectValue(arg: ArgSource): string {
    if (arg.kind === "headerParam") return `header:${arg.paramKey}`;
    if (arg.kind === "localVariable") return `local:${arg.variableName}`;
    if (arg.kind === "globalVariable") return `global:${arg.variableName}`;
    return "";
  }

  function applySourceSelection(param: ParamDef, rawValue: string) {
    if (!rawValue) {
      setLiteral(param.key, literalDefault(param));
      return;
    }
    const [prefix, name] = [rawValue.slice(0, rawValue.indexOf(":")), rawValue.slice(rawValue.indexOf(":") + 1)];
    if (prefix === "header") onChange(param.key, { kind: "headerParam", paramKey: name });
    else if (prefix === "local") onChange(param.key, { kind: "localVariable", variableName: name });
    else if (prefix === "global") onChange(param.key, { kind: "globalVariable", variableName: name });
  }

  function sourceUsingLabel(arg: ArgSource): { key: string; fallback: string; name: string } | null {
    if (arg.kind === "headerParam") {
      return {
        key: "stepArgsFields.usingHeaderParam",
        fallback: 'Usando o parâmetro "{{name}}" do cabeçalho',
        name: headerParams.find((hp) => hp.key === arg.paramKey)?.label ?? arg.paramKey,
      };
    }
    if (arg.kind === "localVariable") {
      return {
        key: "stepArgsFields.usingLocalVariable",
        fallback: 'Usando a variável local "{{name}}"',
        name: arg.variableName,
      };
    }
    if (arg.kind === "globalVariable") {
      return {
        key: "stepArgsFields.usingGlobalVariable",
        fallback: 'Usando a variável global "{{name}}"',
        name: arg.variableName,
      };
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-3 bg-menu-secondary/40 rounded-lg p-3">
      <span className="text-xs font-semibold opacity-70">{title}</span>

      {coordinatePairs.map((pair) => {
        const coordCandidates = compatibleCoordinateHeaderParams(headerParams);
        const xArg = values[pair.xKey];
        const yArg = values[pair.yKey];
        const sourcedFrom =
          xArg?.kind === "headerParam" && yArg?.kind === "headerParam"
            ? coordCandidates.find(
                (hp) => xArg.paramKey === `${hp.key}X` && yArg.paramKey === `${hp.key}Y`
              )
            : undefined;

        return (
          <div key={pair.xKey} className="flex flex-col gap-1">
            {coordCandidates.length > 0 && (
              <div className="flex justify-end">
                <select
                  className="bg-menu-secondary rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none"
                  value={sourcedFrom?.key ?? ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      onChange(pair.xKey, { kind: "headerParam", paramKey: `${e.target.value}X` });
                      onChange(pair.yKey, { kind: "headerParam", paramKey: `${e.target.value}Y` });
                    } else {
                      setLiteral(pair.xKey, 0);
                      setLiteral(pair.yKey, 0);
                    }
                  }}
                >
                  <option value="">{t("stepArgsFields.fixedValue", "Valor fixo")}</option>
                  {coordCandidates.map((hp) => (
                    <option key={hp.key} value={hp.key}>
                      {t("stepArgsFields.fromHeaderParam", "Do parâmetro: {{name}}", {
                        name: hp.label,
                      })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {sourcedFrom ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-70">
                  {tCoordinateLabel(t, targetId ?? "customFunction", pair)}
                </label>
                <div className="bg-menu-secondary rounded-lg px-3 py-2 text-sm opacity-70 italic">
                  {t(
                    "stepArgsFields.usingHeaderParam",
                    'Usando o parâmetro "{{name}}" do cabeçalho',
                    { name: sourcedFrom.label }
                  )}
                </div>
              </div>
            ) : (
              <CoordinateField
                functionId={targetId ?? "customFunction"}
                pair={pair}
                values={literalValues}
                onChange={setLiteral}
                hasFullScreenToggle={hasFullScreenToggle}
                t={t}
              />
            )}
          </div>
        );
      })}

      {otherParams.map((param) => {
        const headerCandidates = compatibleHeaderParams(headerParams, param);
        const localCandidates = compatibleHeaderParams(localVariables, param);
        const globalCandidates = compatibleHeaderParams(globalVariables, param);
        const hasCandidates =
          headerCandidates.length > 0 || localCandidates.length > 0 || globalCandidates.length > 0;
        const arg = values[param.key] ?? { kind: "literal", value: literalDefault(param) };
        const label = tParamLabel(t, targetId ?? "customFunctionParam", param);
        const using = sourceUsingLabel(arg);
        const literalValue = arg.kind === "literal" ? arg.value : literalDefault(param);

        return (
          <div key={param.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs opacity-70">
                {label}
                {param.optional ? t("common.optionalSuffix", " (opcional)") : ""}
              </label>
              {hasCandidates && (
                <select
                  className="bg-menu-secondary rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none"
                  value={sourceSelectValue(arg)}
                  onChange={(e) => applySourceSelection(param, e.target.value)}
                >
                  <option value="">{t("stepArgsFields.fixedValue", "Valor fixo")}</option>
                  {headerCandidates.length > 0 && (
                    <optgroup label={t("stepArgsFields.groupHeaderParams", "Parâmetros do cabeçalho")}>
                      {headerCandidates.map((hp) => (
                        <option key={`header:${hp.key}`} value={`header:${hp.key}`}>
                          {hp.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {localCandidates.length > 0 && (
                    <optgroup label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}>
                      {localCandidates.map((v) => (
                        <option key={`local:${v.key}`} value={`local:${v.key}`}>
                          {v.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {globalCandidates.length > 0 && (
                    <optgroup label={t("stepArgsFields.groupGlobalVariables", "Variáveis globais")}>
                      {globalCandidates.map((v) => (
                        <option key={`global:${v.key}`} value={`global:${v.key}`}>
                          {v.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>

            {using ? (
              <div className="bg-menu-secondary rounded-lg px-3 py-2 text-sm opacity-70 italic">
                {t(using.key, using.fallback, { name: using.name })}
              </div>
            ) : param.type === "boolean" ? (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <span className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="peer appearance-none w-4 h-4 rounded border border-white/25 bg-transparent checked:bg-(--main) checked:border-(--main) transition-colors"
                    checked={Boolean(literalValue)}
                    onChange={(e) => setLiteral(param.key, e.target.checked)}
                  />
                  <svg
                    viewBox="0 0 16 16"
                    className="absolute w-3 h-3 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity"
                    fill="none"
                  >
                    <path
                      d="M3 8.5L6.5 12L13 4.5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </label>
            ) : param.type === "select" ? (
              <select
                className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full cursor-pointer appearance-none"
                value={String(literalValue ?? "")}
                onChange={(e) => setLiteral(param.key, e.target.value)}
              >
                {!param.optional && <option value="">{t("common.select", "Selecione")}</option>}
                {param.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {tParamOption(t, targetId ?? "customFunctionParam", param.key, option)}
                  </option>
                ))}
              </select>
            ) : param.type === "keyCombo" ? (
              <KeyComboPicker
                resetSignal={resetSignal}
                initialValue={String(literalValue ?? "")}
                onChange={(combo) => setLiteral(param.key, combo)}
              />
            ) : (
              <input
                type={param.type === "number" ? "number" : "text"}
                className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full"
                value={String(literalValue ?? "")}
                onChange={(e) =>
                  setLiteral(param.key, param.type === "number" ? Number(e.target.value) : e.target.value)
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
