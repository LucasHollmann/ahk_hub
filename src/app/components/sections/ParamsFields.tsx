"use client";

import { useEffect, useState } from "react";
import {
  getCoordinatePairs,
  tCoordinateLabel,
  tFunctionName,
  tParamLabel,
  tParamOption,
  type CoordinatePair,
  type FunctionMeta,
  type ParamValues,
} from "../../functions/types";
import { useTranslation, type Translate } from "../../i18n/I18nContext";

function CoordinateField({
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
  onChange: (key: string, value: string | number | boolean) => void;
  hasFullScreenToggle: boolean;
  t: Translate;
}) {
  const [isCapturingPosition, setIsCapturingPosition] = useState(false);
  const [capturedWindowLabel, setCapturedWindowLabel] = useState<string | null>(null);
  const isDesktop = typeof window !== "undefined" && Boolean(window.desktop);

  useEffect(() => {
    if (!isCapturingPosition) return;

    if (isDesktop) {
      const unsubscribe = window.desktop!.onPositionCaptured((result) => {
        const relativeToWindow = hasFullScreenToggle && !values.fullScreen;

        if (relativeToWindow && result.window) {
          onChange(pair.xKey, result.window.relative.x);
          onChange(pair.yKey, result.window.relative.y);
          setCapturedWindowLabel(
            result.window.title ||
              result.window.owner ||
              t("paramsFields.activeWindowFallback", "janela ativa")
          );
        } else {
          onChange(pair.xKey, result.point.x);
          onChange(pair.yKey, result.point.y);
          setCapturedWindowLabel(
            relativeToWindow
              ? t(
                  "paramsFields.captureFallbackFullScreen",
                  "não foi possível detectar a janela ativa; usada a tela toda"
                )
              : null
          );
        }

        setIsCapturingPosition(false);
      });
      window.desktop!.startCapturePosition();
      return () => {
        unsubscribe();
        window.desktop!.cancelCapturePosition();
      };
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      onChange(pair.xKey, e.screenX);
      onChange(pair.yKey, e.screenY);
      setIsCapturingPosition(false);
    }

    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [
    isCapturingPosition,
    isDesktop,
    hasFullScreenToggle,
    values.fullScreen,
    onChange,
    pair.xKey,
    pair.yKey,
    t,
  ]);

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
      <button
        type="button"
        className="button-secondary text-xs py-1.5"
        onClick={() => {
          setCapturedWindowLabel(null);
          setIsCapturingPosition(true);
        }}
      >
        {isCapturingPosition
          ? isDesktop
            ? t("paramsFields.capturingDesktop", "Mova o mouse e pressione F8...")
            : t("paramsFields.capturingBrowser", "Clique em qualquer ponto da tela...")
          : t("paramsFields.capture", "Capturar posição do cursor")}
      </button>
      <p className="text-xs opacity-50">
        {isDesktop
          ? hasFullScreenToggle && !values.fullScreen
            ? t(
                "paramsFields.helpDesktopWindow",
                "Clique na janela alvo para focá-la, depois mova o mouse até o local desejado dentro dela e pressione F8 — a coordenada será relativa a essa janela."
              )
            : t(
                "paramsFields.helpDesktopScreen",
                "Mova o mouse até o local desejado, em qualquer lugar da tela, e pressione F8 para capturar."
              )
          : t(
              "paramsFields.helpBrowser",
              "Só funciona clicando dentro desta janela do navegador — não é possível capturar a posição do cursor fora dela."
            )}
      </p>
      {capturedWindowLabel && (
        <p className="text-xs text-(--main)">
          {t("paramsFields.capturedAt", "Capturado em: {{label}}", { label: capturedWindowLabel })}
        </p>
      )}
    </div>
  );
}

type Props = {
  meta: FunctionMeta;
  values: ParamValues;
  onChange: (key: string, value: string | number | boolean) => void;
};

export default function ParamsFields({ meta, values, onChange }: Props) {
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
            </>
          )}
        </div>
      ))}
    </div>
  );
}
