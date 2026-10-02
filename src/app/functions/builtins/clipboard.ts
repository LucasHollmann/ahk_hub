import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Área de transferência";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "clipboard",
  name: NAME,
  category: "system",
  description:
    "Copia, cola ou escreve um texto na área de transferência — inclusive para colar algo sem digitar.",
  params: [
    {
      key: "action",
      label: "Ação",
      type: "select",
      options: [
        { value: "set", label: "Definir o texto" },
        { value: "setAndPaste", label: "Definir o texto e colar (Ctrl+V)" },
        { value: "append", label: "Acrescentar ao que já está lá" },
        { value: "copy", label: "Copiar a seleção atual (Ctrl+C)" },
        { value: "paste", label: "Colar (Ctrl+V)" },
      ],
    },
    { key: "text", label: "Texto (apenas para definir/acrescentar)", type: "text", optional: true },
  ],
  usableDirectly: true,
  // "copy" empties the clipboard before Ctrl+C so ClipWait can tell a fresh copy from whatever
  // was already there, and every paste waits for content first — pressing Ctrl+V before the
  // clipboard settles is what makes this kind of automation paste the previous text.
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(action, text) {`,
      '    if (action = "copy") {',
      '        A_Clipboard := ""',
      '        Send "^c"',
      "        ClipWait 1",
      "        return",
      "    }",
      '    if (action = "paste") {',
      '        Send "^v"',
      "        return",
      "    }",
      '    if (action = "append")',
      "        A_Clipboard := A_Clipboard . text",
      "    else",
      "        A_Clipboard := text",
      '    if (action = "setAndPaste") {',
      "        ClipWait 1",
      '        Send "^v"',
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.action ?? "set"))}, ${quoteAhkString(
      String(values.text ?? "")
    )})`,
};
