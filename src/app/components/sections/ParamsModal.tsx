"use client";

import { useEffect, useState } from "react";
import type { FunctionMeta, ParamValues } from "../../functions/types";

type Props = {
  meta: FunctionMeta;
  values: ParamValues;
  onChange: (key: string, value: string | number | boolean) => void;
  onClose: () => void;
};

export default function ParamsModal({ meta, values, onChange, onClose }: Props) {
  const [isCapturingPosition, setIsCapturingPosition] = useState(false);
  const [capturedWindowLabel, setCapturedWindowLabel] = useState<string | null>(null);
  const hasCoordinate =
    meta.params.some((p) => p.key === "x") &&
    meta.params.some((p) => p.key === "y");
  const hasFullScreenToggle = meta.params.some((p) => p.key === "fullScreen");
  const isDesktop = typeof window !== "undefined" && Boolean(window.desktop);

  useEffect(() => {
    if (!isCapturingPosition) return;

    if (isDesktop) {
      const unsubscribe = window.desktop!.onPositionCaptured((result) => {
        const relativeToWindow = hasFullScreenToggle && !values.fullScreen;

        if (relativeToWindow && result.window) {
          onChange("x", result.window.relative.x);
          onChange("y", result.window.relative.y);
          setCapturedWindowLabel(
            result.window.title || result.window.owner || "janela ativa"
          );
        } else {
          onChange("x", result.point.x);
          onChange("y", result.point.y);
          setCapturedWindowLabel(
            relativeToWindow ? "não foi possível detectar a janela ativa; usada a tela toda" : null
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
      onChange("x", e.screenX);
      onChange("y", e.screenY);
      setIsCapturingPosition(false);
    }

    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [isCapturingPosition, isDesktop, hasFullScreenToggle, values.fullScreen, onChange]);

  const otherParams = meta.params.filter(
    (p) => !hasCoordinate || (p.key !== "x" && p.key !== "y")
  );

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/50"
      onMouseDown={onClose}
    >
      <div
        className="bg-menu-dark rounded-lg shadow-lg p-4 w-80 flex flex-col gap-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-semibold">Parâmetros de {meta.name}</span>

        {hasCoordinate && (
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-70">Coordenada</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full"
                placeholder="X"
                value={String(values.x ?? "")}
                onChange={(e) => onChange("x", Number(e.target.value))}
              />
              <input
                type="number"
                className="bg-menu-secondary rounded-lg px-3 py-2 outline-none h-10 w-full"
                placeholder="Y"
                value={String(values.y ?? "")}
                onChange={(e) => onChange("y", Number(e.target.value))}
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
                  ? "Mova o mouse e pressione F8..."
                  : "Clique em qualquer ponto da tela..."
                : "Capturar posição do cursor"}
            </button>
            <p className="text-xs opacity-50">
              {isDesktop
                ? hasFullScreenToggle && !values.fullScreen
                  ? "Clique na janela alvo para focá-la, depois mova o mouse até o local desejado dentro dela e pressione F8 — a coordenada será relativa a essa janela."
                  : "Mova o mouse até o local desejado, em qualquer lugar da tela, e pressione F8 para capturar."
                : "Só funciona clicando dentro desta janela do navegador — não é possível capturar a posição do cursor fora dela."}
            </p>
            {capturedWindowLabel && (
              <p className="text-xs text-(--main)">
                Capturado em: {capturedWindowLabel}
              </p>
            )}
          </div>
        )}

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
                {param.label}
              </label>
            ) : (
              <>
                <label className="text-xs opacity-70">{param.label}</label>
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

        <button className="button-main self-end" onClick={onClose}>
          Concluir
        </button>
      </div>
    </div>
  );
}
