import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Enviar para janela em segundo plano";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "sendToWindow",
  name: NAME,
  category: "window",
  description:
    "Envia teclas ou texto para uma janela sem focá-la nem trazê-la para a frente. Nem todo programa aceita — jogos e alguns apps ignoram entradas que não vêm do teclado real.",
  params: [
    {
      key: "title",
      label: "Título da janela (ex: Bloco de Notas, ahk_exe notepad.exe)",
      type: "text",
    },
    {
      key: "what",
      label: "O que enviar",
      type: "select",
      options: [
        { value: "key", label: "Combinação de teclas" },
        { value: "text", label: "Texto" },
      ],
    },
    { key: "combo", label: "Tecla (quando enviar teclas)", type: "keyCombo", optional: true },
    { key: "text", label: "Texto (quando enviar texto)", type: "text", optional: true },
    {
      key: "control",
      label: "Controle dentro da janela (vazio = a janela toda)",
      type: "text",
      optional: true,
    },
  ],
  usableDirectly: true,
  // The combo is turned into a Send string here rather than in TypeScript because it can
  // arrive from a variable at runtime, the same reason KeyPress does its own parsing.
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(title, what, combo, text, control) {`,
      '    if (title = "" || !WinExist(title))',
      "        return",
      "",
      '    if (what = "text") {',
      '        if (control = "")',
      "            ControlSendText text, , title",
      "        else",
      "            ControlSendText text, control, title",
      "        return",
      "    }",
      "",
      '    parts := StrSplit(combo, "+")',
      "    key := parts[parts.Length]",
      "    key := StrLen(key) = 1 ? StrLower(key) : key",
      '    standalone := Map("Ctrl", "LControl", "Alt", "LAlt", "Shift", "LShift", "Win", "LWin")',
      "",
      "    if (parts.Length = 1 && standalone.Has(key)) {",
      '        keys := "{" . standalone[key] . "}"',
      "    } else {",
      '        symbols := Map("Ctrl", "^", "Alt", "!", "Shift", "+", "Win", "#")',
      '        keys := ""',
      "        Loop parts.Length - 1",
      '            keys .= symbols.Has(parts[A_Index]) ? symbols[parts[A_Index]] : ""',
      '        keys .= StrLen(key) > 1 ? "{" . key . "}" : key',
      "    }",
      "",
      '    if (control = "")',
      "        ControlSend keys, , title",
      "    else",
      "        ControlSend keys, control, title",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.title ?? ""))}, ${quoteAhkString(
      String(values.what ?? "key")
    )}, ${quoteAhkString(String(values.combo ?? ""))}, ${quoteAhkString(
      String(values.text ?? "")
    )}, ${quoteAhkString(String(values.control ?? ""))})`,
};
