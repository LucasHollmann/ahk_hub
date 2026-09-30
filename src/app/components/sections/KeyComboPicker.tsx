"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "../../i18n/I18nContext";

type Modifier = "Ctrl" | "Shift" | "Alt" | "Win";

const MODIFIERS: Modifier[] = ["Ctrl", "Shift", "Alt", "Win"];

const MOUSE_ACTIONS = [
  { key: "LButton", labelKey: "keyCombo.mouseLeft", label: "Clique esquerdo", group: "button" },
  { key: "RButton", labelKey: "keyCombo.mouseRight", label: "Clique direito", group: "button" },
  { key: "MButton", labelKey: "keyCombo.mouseMiddle", label: "Clique do meio", group: "button" },
  { key: "XButton1", labelKey: "keyCombo.mouseX1", label: "Botão lateral 1", group: "button" },
  { key: "XButton2", labelKey: "keyCombo.mouseX2", label: "Botão lateral 2", group: "button" },
  { key: "WheelUp", labelKey: "keyCombo.mouseWheelUp", label: "Roda para cima", group: "wheel" },
  { key: "WheelDown", labelKey: "keyCombo.mouseWheelDown", label: "Roda para baixo", group: "wheel" },
  { key: "WheelLeft", labelKey: "keyCombo.mouseWheelLeft", label: "Roda para a esquerda", group: "wheel" },
  { key: "WheelRight", labelKey: "keyCombo.mouseWheelRight", label: "Roda para a direita", group: "wheel" },
] as const;

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

const MODIFIER_LABELS: Record<string, Modifier> = {
  Control: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Meta: "Win",
};

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  Escape: "Esc",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

function formatKeyName(key: string) {
  if (key in KEY_LABELS) return KEY_LABELS[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

const NO_MODIFIERS: Record<Modifier, boolean> = {
  Ctrl: false,
  Shift: false,
  Alt: false,
  Win: false,
};

function parseCombo(combo: string) {
  const parts = combo.split("+");
  const key = parts.pop() ?? "";
  const modifiers: Record<Modifier, boolean> = { ...NO_MODIFIERS };
  for (const part of parts) {
    if (part in modifiers) modifiers[part as Modifier] = true;
  }
  return { modifiers, key };
}

/** Inverse of `parseCombo`. Applying both in sequence is idempotent, which is what keeps the echo below from oscillating. */
function formatCombo(modifiers: Record<Modifier, boolean>, key: string): string {
  const parts: string[] = MODIFIERS.filter((m) => modifiers[m]);
  if (key) parts.push(key);
  return parts.join("+");
}

type Props = {
  resetSignal: number;
  onChange: (combo: string) => void;
  initialValue?: string;
};

export default function KeyComboPicker({ resetSignal, onChange, initialValue }: Props) {
  const { t } = useTranslation();
  const [modifiers, setModifiers] = useState<Record<Modifier, boolean>>(() =>
    parseCombo(initialValue ?? "").modifiers
  );
  const [key, setKey] = useState(() => parseCombo(initialValue ?? "").key);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isModifierMenuOpen, setIsModifierMenuOpen] = useState(false);
  const [isMouseMenuOpen, setIsMouseMenuOpen] = useState(false);
  const otherKeyDuringHold = useRef(false);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const modifierMenuRef = useRef<HTMLDivElement>(null);
  const mouseMenuRef = useRef<HTMLDivElement>(null);

  // Read through a ref so the echo below never depends on the identity of a callback that
  // most callers declare inline, and so re-rendering can never re-fire it on its own.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  /**
   * Re-derives the picked combo when the caller hands over a different value (or bumps
   * resetSignal). Keyed on a token and done while rendering rather than in an effect, so a
   * re-render with unchanged props leaves `modifiers` alone — allocating a fresh object
   * every time would re-trigger the echo below on every render.
   */
  const syncToken = `${resetSignal}\n${initialValue ?? ""}`;
  const [syncedToken, setSyncedToken] = useState(syncToken);
  if (syncedToken !== syncToken) {
    const parsed = parseCombo(initialValue ?? "");
    setSyncedToken(syncToken);
    setModifiers(parsed.modifiers);
    setKey(parsed.key);
  }

  /**
   * Reports the current combo upward. Callers rely on this to pick up the value the picker
   * settled on, including the one parsed out of `initialValue` — but it reports only what it
   * has not reported before. Without that guard the component feeds the parent a value that
   * comes straight back in as `initialValue`, and any parent whose setter allocates a new
   * object drives the pair into an endless update loop.
   */
  const lastReportedRef = useRef<string | null>(null);
  useEffect(() => {
    const combo = formatCombo(modifiers, key);
    if (lastReportedRef.current === combo) return;
    lastReportedRef.current = combo;
    onChangeRef.current(combo);
  }, [modifiers, key]);

  useEffect(() => {
    if (!isModifierMenuOpen) return;

    function onClickOutside(e: globalThis.MouseEvent) {
      if (!modifierMenuRef.current?.contains(e.target as Node)) {
        setIsModifierMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", onClickOutside, true);
    return () => window.removeEventListener("mousedown", onClickOutside, true);
  }, [isModifierMenuOpen]);

  useEffect(() => {
    if (!isMouseMenuOpen) return;

    function onClickOutside(e: globalThis.MouseEvent) {
      if (!mouseMenuRef.current?.contains(e.target as Node)) {
        setIsMouseMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", onClickOutside, true);
    return () => window.removeEventListener("mousedown", onClickOutside, true);
  }, [isMouseMenuOpen]);

  useEffect(() => {
    if (!isCapturing) return;

    function finish(pressedKey: string) {
      setKey(pressedKey);
      setIsCapturing(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      if (MODIFIER_KEYS.has(e.key)) {
        if (!e.repeat) otherKeyDuringHold.current = false;
        return;
      }
      otherKeyDuringHold.current = true;
      finish(formatKeyName(e.key));
    }

    function onKeyUp(e: KeyboardEvent) {
      if (!MODIFIER_KEYS.has(e.key)) return;
      e.preventDefault();
      if (!otherKeyDuringHold.current) {
        finish(MODIFIER_LABELS[e.key]);
      }
    }

    function onClickOutside(e: globalThis.MouseEvent) {
      if (e.target !== keyInputRef.current) setIsCapturing(false);
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("mousedown", onClickOutside, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("mousedown", onClickOutside, true);
    };
  }, [isCapturing]);

  function startCapturing(e: MouseEvent<HTMLInputElement>) {
    e.currentTarget.focus();
    setIsCapturing(true);
  }

  function toggleModifier(modifier: Modifier) {
    setModifiers((prev) => ({ ...prev, [modifier]: !prev[modifier] }));
  }

  function selectMouseAction(mouseKey: string) {
    setKey(mouseKey);
    setIsMouseMenuOpen(false);
  }

  const mouseActionLabel = MOUSE_ACTIONS.find((action) => action.key === key);

  return (
    <div className="flex gap-2 items-center">
      <div className="relative" ref={modifierMenuRef}>
        <button
          type="button"
          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 text-sm text-left w-44 h-9 outline-none focus:outline-none cursor-pointer flex items-center justify-between gap-2"
          onClick={() => setIsModifierMenuOpen((prev) => !prev)}
        >
          <span className="truncate">
            {MODIFIERS.filter((m) => modifiers[m]).join("+") ||
              t("keyCombo.noModifiers", "Sem modificadores")}
          </span>
          <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-60 shrink-0" fill="none" stroke="currentColor">
            <path d="M4 6l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isModifierMenuOpen && (
          <div className="absolute z-30 mt-1 w-44 bg-menu-secondary rounded-lg shadow-lg p-2 flex flex-col gap-1">
            {MODIFIERS.map((modifier) => (
              <label
                key={modifier}
                className="flex items-center gap-2 text-xs cursor-pointer select-none px-1 py-1.5 rounded hover:bg-white/5"
              >
                <span className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="peer appearance-none w-4 h-4 rounded border border-white/25 bg-transparent checked:bg-(--main) checked:border-(--main) transition-colors"
                    checked={modifiers[modifier]}
                    onChange={() => toggleModifier(modifier)}
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
                {modifier}
              </label>
            ))}
          </div>
        )}
      </div>
      <input
        ref={keyInputRef}
        className={`bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer caret-transparent w-40 h-9 text-sm ${
          isCapturing ? "opacity-60 italic" : ""
        }`}
        title={t("keyCombo.placeholder", "Clique e pressione a tecla")}
        value={
          isCapturing
            ? t("keyCombo.pressingKey", "Pressione uma tecla...")
            : mouseActionLabel
              ? t(mouseActionLabel.labelKey, mouseActionLabel.label)
              : key
        }
        onMouseDown={startCapturing}
        readOnly
        placeholder={t("keyCombo.placeholder", "Clique e pressione a tecla")}
      />
      <div className="relative" ref={mouseMenuRef}>
        <button
          type="button"
          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 text-sm h-9 outline-none focus:outline-none cursor-pointer flex items-center gap-1.5"
          onClick={() => {
            setIsCapturing(false);
            setIsMouseMenuOpen((previous) => !previous);
          }}
        >
          {t("keyCombo.mouseButton", "Mouse")}
          <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-60 shrink-0" fill="none" stroke="currentColor">
            <path d="M4 6l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isMouseMenuOpen && (
          <div className="absolute left-0 z-30 mt-1 w-52 max-h-72 overflow-auto bg-menu-secondary rounded-lg shadow-lg p-2 flex flex-col gap-1">
            <span className="px-1 py-1 text-[11px] font-semibold uppercase opacity-70">
              {t("keyCombo.mouseButtonsGroup", "Botões")}
            </span>
            {MOUSE_ACTIONS.filter((action) => action.group === "button").map((action) => (
              <button
                key={action.key}
                type="button"
                className="text-left text-xs px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                onClick={() => selectMouseAction(action.key)}
              >
                {t(action.labelKey, action.label)}
              </button>
            ))}
            <span className="px-1 py-1 text-[11px] font-semibold uppercase opacity-70">
              {t("keyCombo.mouseWheelGroup", "Roda")}
            </span>
            {MOUSE_ACTIONS.filter((action) => action.group === "wheel").map((action) => (
              <button
                key={action.key}
                type="button"
                className="text-left text-xs px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                onClick={() => selectMouseAction(action.key)}
              >
                {t(action.labelKey, action.label)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
