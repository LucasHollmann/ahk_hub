"use client";

import {
  getCoordinatePairs,
  type ParamDef,
  tCoordinateLabel,
  tFunctionName,
  tParamLabel,
  tParamOption,
  type CoordinatePair,
  type FunctionMeta,
  type ParamValues,
} from "../../functions/types";
import { useTranslation, type Translate } from "../../i18n/I18nContext";
import CursorCaptureButton, { type CaptureTarget } from "./CursorCapture";
import KeyComboPicker from "./KeyComboPicker";

/**
 * Params whose value can be read off whatever the cursor is pointing at, so the field gets
 * its own F8 capture button. Both are text params a function declares by a known name.
 */
export function captureTargetForParam(param: ParamDef): CaptureTarget | null {
  if (param.type !== "text") return null;
  if (param.key === "color") return "color";
  if (param.key === "control") return "control";
  return null;
}

/** The captured field a given target fills in. */
export function capturedValue(
  target: CaptureTarget,
  result: { color: string | null; control: string | null }
): string | null {
  return target === "color" ? result.color : target === "control" ? result.control : null;
}

export function CoordinateField({
  functionId,
  pair,
  values,
  onChange,
  hasFullScreenToggle,
  t,
}: {
  functionId: string;
  pair: CoordinatePair;
  values: ParamValues;
  /** Called twice in the same tick when a position is captured (X then Y), so it must apply updates functionally — building the next state off a captured prop drops the X. */
  onChange: (key: string, value: string | number | boolean) => void;
  hasFullScreenToggle: boolean;
  t: Translate;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs opacity-70">{tCoordinateLabel(t, functionId, pair)}</label>
      <div className="flex gap-2">
        <input
          type="number"
          className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full"
          placeholder="X"
          value={String(values[pair.xKey] ?? "")}
          onChange={(e) => onChange(pair.xKey, Number(e.target.value))}
        />
        <input
          type="number"
          className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full"
          placeholder="Y"
          value={String(values[pair.yKey] ?? "")}
          onChange={(e) => onChange(pair.yKey, Number(e.target.value))}
        />
      </div>
      <CursorCaptureButton
        relativeToWindow={hasFullScreenToggle && !values.fullScreen}
        onCaptured={({ x, y }) => {
          onChange(pair.xKey, x);
          onChange(pair.yKey, y);
        }}
      />
    </div>
  );
}

type Props = {
  meta: FunctionMeta;
  values: ParamValues;
  onChange: (key: string, value: string | number | boolean) => void;
  resetSignal: number;
};

export default function ParamsFields({ meta, values, onChange, resetSignal }: Props) {
  const { t } = useTranslation();
  const coordinatePairs = getCoordinatePairs(meta.params);
  const hasFullScreenToggle = meta.params.some((p) => p.key === "fullScreen");

  const consumedKeys = new Set(coordinatePairs.flatMap((p) => [p.xKey, p.yKey]));
  const otherParams = meta.params.filter((p) => !consumedKeys.has(p.key));

  return (
    <div className="flex flex-col gap-3 bg-menu-secondary/40 rounded-lg p-3">
      <span className="text-xs font-semibold opacity-70">
        {t("paramsFields.title", "Parâmetros de {{name}}", { name: tFunctionName(t, meta) })}
      </span>

      {coordinatePairs.map((pair) => (
        <CoordinateField
          key={pair.xKey}
          functionId={meta.id}
          pair={pair}
          values={values}
          onChange={onChange}
          hasFullScreenToggle={hasFullScreenToggle}
          t={t}
        />
      ))}

      {otherParams.map((param) => (
        <div key={param.key} className="flex flex-col gap-1">
          {param.type === "boolean" ? (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <span className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  className="peer appearance-none w-4 h-4 rounded border border-white/25 bg-transparent checked:bg-(--main) checked:border-(--main) transition-colors"
                  checked={Boolean(values[param.key])}
                  onChange={(e) => onChange(param.key, e.target.checked)}
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
              {tParamLabel(t, meta.id, param)}
            </label>
          ) : param.type === "keyCombo" ? (
            <>
              <label className="text-xs opacity-70">{tParamLabel(t, meta.id, param)}</label>
              <KeyComboPicker
                resetSignal={resetSignal}
                initialValue={String(values[param.key] ?? "")}
                onChange={(combo) => onChange(param.key, combo)}
              />
            </>
          ) : param.type === "select" ? (
            <>
              <label className="text-xs opacity-70">
                {tParamLabel(t, meta.id, param)}
                {param.optional ? t("common.optionalSuffix", " (opcional)") : ""}
              </label>
              <select
                className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full cursor-pointer appearance-none"
                value={String(values[param.key] ?? "")}
                onChange={(e) => onChange(param.key, e.target.value)}
              >
                {!param.optional && <option value="">{t("common.select", "Selecione")}</option>}
                {param.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {tParamOption(t, meta.id, param.key, option)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="text-xs opacity-70">
                {tParamLabel(t, meta.id, param)}
                {param.optional ? t("common.optionalSuffix", " (opcional)") : ""}
              </label>
              <input
                type={param.type === "number" ? "number" : "text"}
                className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full"
                value={String(values[param.key] ?? "")}
                onChange={(e) =>
                  onChange(
                    param.key,
                    param.type === "number"
                      ? Number(e.target.value)
                      : e.target.value
                  )
                }
              />
              {(() => {
                const target = captureTargetForParam(param);
                return target ? (
                  <CursorCaptureButton
                    capture={target}
                    onCaptured={(result) => {
                      const value = capturedValue(target, result);
                      if (value) onChange(param.key, value);
                    }}
                  />
                ) : null;
              })()}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
