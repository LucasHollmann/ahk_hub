"use client";

import type { CoordinateLiteral } from "../types";
import {
  compatibleCoordinateHeaderParams,
  type ArgSource,
  type HeaderParamDef,
} from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";
import ArgSourceValue from "./ArgSourceValue";
import CursorCaptureButton from "./CursorCapture";

/** A plain X/Y pair, with the cursor-capture shortcut — used for a coordinate variable's initial value. */
export function CoordinateLiteralFields({
  value,
  onChange,
}: {
  value: CoordinateLiteral;
  onChange: (value: CoordinateLiteral) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          type="number"
          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
          placeholder="X"
          value={String(value.x)}
          onChange={(e) => onChange({ ...value, x: Number(e.target.value) })}
        />
        <input
          type="number"
          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
          placeholder="Y"
          value={String(value.y)}
          onChange={(e) => onChange({ ...value, y: Number(e.target.value) })}
        />
      </div>
      <CursorCaptureButton onCaptured={({ x, y }) => onChange({ x, y })} />
    </div>
  );
}

export type CoordinateAssignment = { kind: "coordinate"; x: ArgSource; y: ArgSource };

export const EMPTY_COORDINATE_ASSIGNMENT: CoordinateAssignment = {
  kind: "coordinate",
  x: { kind: "literal", value: 0 },
  y: { kind: "literal", value: 0 },
};

/**
 * The X/Y pair assigned to a coordinate variable: either typed in (with the capture shortcut)
 * or copied whole from another coordinate — a header parameter or another coordinate variable —
 * in which case each half can still carry its own math modifier.
 */
export function CoordinateValueFields({
  value,
  onChange,
  headerParams,
  localVariables,
  globalVariables,
}: {
  value: CoordinateAssignment;
  onChange: (value: CoordinateAssignment) => void;
  headerParams: HeaderParamDef[];
  localVariables: HeaderParamDef[];
  globalVariables: HeaderParamDef[];
}) {
  const { t } = useTranslation();
  const headerCandidates = compatibleCoordinateHeaderParams(headerParams);
  const localCandidates = compatibleCoordinateHeaderParams(localVariables);
  const globalCandidates = compatibleCoordinateHeaderParams(globalVariables);
  const hasCandidates =
    headerCandidates.length > 0 || localCandidates.length > 0 || globalCandidates.length > 0;

  const selection = (() => {
    const { x, y } = value;
    if (x.kind === "headerParam" && y.kind === "headerParam") {
      const match = headerCandidates.find(
        (hp) => x.paramKey === `${hp.key}X` && y.paramKey === `${hp.key}Y`
      );
      return match ? `header:${match.key}` : "";
    }
    if (
      x.kind === y.kind &&
      (x.kind === "localVariable" || x.kind === "globalVariable") &&
      y.kind !== "literal" &&
      y.kind !== "headerParam" &&
      x.variableName === y.variableName &&
      x.component === "x" &&
      y.component === "y"
    ) {
      return `${x.kind === "localVariable" ? "local" : "global"}:${x.variableName}`;
    }
    return "";
  })();

  function applySelection(rawValue: string) {
    if (!rawValue) {
      onChange(EMPTY_COORDINATE_ASSIGNMENT);
      return;
    }
    const prefix = rawValue.slice(0, rawValue.indexOf(":"));
    const name = rawValue.slice(rawValue.indexOf(":") + 1);
    if (prefix === "header") {
      onChange({
        kind: "coordinate",
        x: { kind: "headerParam", paramKey: `${name}X` },
        y: { kind: "headerParam", paramKey: `${name}Y` },
      });
      return;
    }
    const kind = prefix === "local" ? ("localVariable" as const) : ("globalVariable" as const);
    onChange({
      kind: "coordinate",
      x: { kind, variableName: name, component: "x" },
      y: { kind, variableName: name, component: "y" },
    });
  }

  function usingLabel(source: ArgSource, axis: "x" | "y"): string {
    const suffix = axis.toUpperCase();
    if (source.kind === "headerParam") {
      const name = headerParams.find((p) => `${p.key}${suffix}` === source.paramKey)?.label ?? source.paramKey;
      return t("stepArgsFields.usingHeaderParam", 'Usando o parâmetro "{{name}}" do cabeçalho', {
        name: `${name} ${suffix}`,
      });
    }
    if (source.kind === "localVariable") {
      return t("stepArgsFields.usingLocalVariable", 'Usando a variável local "{{name}}"', {
        name: `${source.variableName}.${axis}`,
      });
    }
    if (source.kind === "globalVariable") {
      return t("stepArgsFields.usingGlobalVariable", 'Usando a variável global "{{name}}"', {
        name: `${source.variableName}.${axis}`,
      });
    }
    return "";
  }

  return (
    <div className="flex flex-col gap-1">
      {hasCandidates && (
        <div className="flex justify-end">
          <select
            className="bg-menu-secondary rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none"
            value={selection}
            onChange={(e) => applySelection(e.target.value)}
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
        </div>
      )}

      {selection ? (
        <>
          <ArgSourceValue
            arg={value.x}
            label={usingLabel(value.x, "x")}
            onChange={(x) => onChange({ ...value, x })}
          />
          <ArgSourceValue
            arg={value.y}
            label={usingLabel(value.y, "y")}
            onChange={(y) => onChange({ ...value, y })}
          />
        </>
      ) : (
        <CoordinateLiteralFields
          value={{
            x: value.x.kind === "literal" ? Number(value.x.value ?? 0) : 0,
            y: value.y.kind === "literal" ? Number(value.y.value ?? 0) : 0,
          }}
          onChange={({ x, y }) =>
            onChange({
              kind: "coordinate",
              x: { kind: "literal", value: x },
              y: { kind: "literal", value: y },
            })
          }
        />
      )}
    </div>
  );
}
