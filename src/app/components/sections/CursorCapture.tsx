"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";

/** What a cursor capture resolved to, after the window-relative / full-screen choice is applied. */
export type CursorCaptureResult = {
  x: number;
  y: number;
  /** Screen pixel under the cursor as "0xRRGGBB" — only when the capture asked for it and the screen could be sampled. */
  color: string | null;
  /** ClassNN of the control under the cursor — only when the capture asked for it and AutoHotkey could be reached. */
  control: string | null;
  /** Window the coordinate ended up relative to, for the "captured at" note. Null when it's a full-screen coordinate. */
  windowLabel: string | null;
};

/**
 * What the F8 press is being pointed at. "color" and "control" both need to inspect the
 * screen from outside the browser, so they are only available in the desktop app.
 */
export type CaptureTarget = "position" | "color" | "control";

type Props = {
  onCaptured: (result: CursorCaptureResult) => void;
  /** What to capture; defaults to the cursor position. */
  capture?: CaptureTarget;
  /** Report the position relative to the active window instead of to the whole screen. */
  relativeToWindow?: boolean;
};

/**
 * "Capture cursor position" button: in the desktop app it arms a global F8 shortcut so the
 * point can be picked anywhere on screen; in the browser it falls back to a click inside the
 * page, which is all a web page can observe.
 */
export default function CursorCaptureButton({
  onCaptured,
  capture = "position",
  relativeToWindow = false,
}: Props) {
  const desktopOnly = capture !== "position";
  const { t } = useTranslation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const isDesktop = typeof window !== "undefined" && Boolean(window.desktop);

  // Kept in a ref so re-rendering with a fresh callback doesn't tear down an armed capture.
  const onCapturedRef = useRef(onCaptured);
  useEffect(() => {
    onCapturedRef.current = onCaptured;
  });

  useEffect(() => {
    if (!isCapturing) return;

    if (isDesktop) {
      const unsubscribe = window.desktop!.onPositionCaptured((result) => {
        const color = result.color ?? null;
        const control = result.control ?? null;

        if (relativeToWindow && result.window) {
          const windowLabel =
            result.window.title ||
            result.window.owner ||
            t("paramsFields.activeWindowFallback", "janela ativa");
          onCapturedRef.current({
            x: result.window.relative.x,
            y: result.window.relative.y,
            color,
            control,
            windowLabel,
          });
          setNote(t("paramsFields.capturedAt", "Capturado em: {{label}}", { label: windowLabel }));
        } else {
          onCapturedRef.current({
            x: result.point.x,
            y: result.point.y,
            color,
            control,
            windowLabel: null,
          });
          setNote(
            relativeToWindow
              ? t(
                  "paramsFields.captureFallbackFullScreen",
                  "não foi possível detectar a janela ativa; usada a tela toda"
                )
              : null
          );
        }

        if (capture === "control" && !control) {
          setNote(
            t(
              "paramsFields.captureControlFailed",
              "não foi possível ler o controle — verifique se o AutoHotkey v2 está instalado e se havia um controle sob o cursor"
            )
          );
        }

        setIsCapturing(false);
      });

      window.desktop!.startCapturePosition({
        withColor: capture === "color",
        withControl: capture === "control",
      });
      return () => {
        unsubscribe();
        window.desktop!.cancelCapturePosition();
      };
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      onCapturedRef.current({
        x: e.screenX,
        y: e.screenY,
        color: null,
        control: null,
        windowLabel: null,
      });
      setIsCapturing(false);
    }

    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [isCapturing, isDesktop, relativeToWindow, capture, t]);

  const idleLabel =
    capture === "color"
      ? t("paramsFields.captureColor", "Capturar cor do pixel sob o cursor")
      : capture === "control"
        ? t("paramsFields.captureControl", "Capturar controle sob o cursor")
        : t("paramsFields.capture", "Capturar posição do cursor");

  return (
    <>
      <button
        type="button"
        className="button-secondary text-xs py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={desktopOnly && !isDesktop}
        onClick={() => {
          setNote(null);
          setIsCapturing(true);
        }}
      >
        {isCapturing
          ? isDesktop
            ? t("paramsFields.capturingDesktop", "Mova o mouse e pressione F8...")
            : t("paramsFields.capturingBrowser", "Clique em qualquer ponto da tela...")
          : idleLabel}
      </button>
      <p className="text-xs opacity-50">
        {!isDesktop && desktopOnly
          ? t(
              "paramsFields.helpBrowserDesktopOnly",
              "Só funciona no aplicativo — o navegador não enxerga nada fora desta janela."
            )
          : isDesktop && capture === "control"
          ? t(
              "paramsFields.helpDesktopControl",
              "Deixe o mouse parado sobre o campo desejado, em qualquer janela, e pressione F8. O nome capturado (ClassNN) é o mesmo que o Window Spy mostra."
            )
          : isDesktop
          ? relativeToWindow
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
      {note && <p className="text-xs text-(--main)">{note}</p>}
    </>
  );
}
