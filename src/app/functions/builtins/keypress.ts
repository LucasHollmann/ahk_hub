import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "KeyPress";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "keyPress",
  name: NAME,
  category: "input",
  description: "Envia uma combinação de teclas (modificador + tecla).",
  params: [
    { key: "combo", label: "Tecla", type: "keyCombo" },
    {
      key: "duration",
      label: "Duração segurando (ms, opcional — deixe vazio para um toque normal)",
      type: "number",
      optional: true,
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(combo, duration) {`,
      '    parts := StrSplit(combo, "+")',
      "    key := parts[parts.Length]",
      "    key := StrLen(key) = 1 ? StrLower(key) : key",
      "    modifiers := []",
      "    Loop parts.Length - 1",
      "        modifiers.Push(parts[A_Index])",
      "",
      '    standalone := Map("Ctrl", "LControl", "Alt", "LAlt", "Shift", "LShift", "Win", "LWin")',
      "    isStandalone := modifiers.Length = 0 && standalone.Has(key)",
      "    keyName := isStandalone ? standalone[key] : key",
      "",
      "    if (duration > 0) {",
      "        for mod in modifiers",
      '            Send "{" . mod . " down}"',
      "        startTime := A_TickCount",
      "        Loop {",
      '            Send "{" . keyName . " down}"',
      '            Send "{" . keyName . " up}"',
      "            if (A_TickCount - startTime >= duration)",
      "                break",
      "            Sleep 40",
      "        }",
      "        for mod in modifiers",
      '            Send "{" . mod . " up}"',
      "        return",
      "    }",
      "",
      "    if (isStandalone) {",
      '        Send "{" . keyName . "}"',
      "        return",
      "    }",
      '    symbols := Map("Ctrl", "^", "Alt", "!", "Shift", "+", "Win", "#")',
      '    out := ""',
      "    for mod in modifiers",
      '        out .= symbols.Has(mod) ? symbols[mod] : ""',
      '    out .= StrLen(key) > 1 ? "{" . key . "}" : key',
      "    Send out",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.combo ?? ""))}, ${Number(values.duration ?? 0)})`,
};
