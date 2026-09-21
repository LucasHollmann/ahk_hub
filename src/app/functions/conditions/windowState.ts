import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Estado da janela";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condWindowState",
  name: NAME,
  category: "system",
  description: "Verifica se uma janela está maximizada, minimizada ou em tamanho normal.",
  params: [
    { key: "title", label: "Título da janela (vazio = janela ativa)", type: "text", optional: true },
    {
      key: "state",
      label: "Estado",
      type: "select",
      options: [
        { value: "maximized", label: "Maximizada" },
        { value: "minimized", label: "Minimizada" },
        { value: "normal", label: "Normal" },
      ],
    },
  ],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  // Takes the state as the same string the picker stores (rather than WinGetMinMax's -1/0/1)
  // so the signature lines up with `params`, which is what lets a call be built from variables.
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(title, state) {`,
      '    if (title = "")',
      '        title := "A"',
      "    try {",
      "        current := WinGetMinMax(title)",
      "    } catch {",
      "        return false",
      "    }",
      '    if (state = "maximized")',
      "        return current = 1",
      '    if (state = "minimized")',
      "        return current = -1",
      "    return current = 0",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.title ?? ""))}, ${quoteAhkString(
      String(values.state ?? "normal")
    )})`,
};
