import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Estado da janela";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);
const STATE_VALUES: Record<string, number> = { maximized: 1, minimized: -1, normal: 0 };

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
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(title, state) {`,
      "    try {",
      "        return WinGetMinMax(title) = state",
      "    } catch {",
      "        return false",
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const title = String(values.title ?? "") || "A";
    const state = STATE_VALUES[String(values.state ?? "normal")] ?? 0;
    return `${AHK_FUNCTION_NAME}(${quoteAhkString(title)}, ${state})`;
  },
};
