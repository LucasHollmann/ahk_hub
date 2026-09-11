import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Tooltip";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "tooltip",
  name: NAME,
  category: "ui",
  description: "Mostra um texto flutuante temporário na tela, perto do cursor.",
  params: [
    { key: "text", label: "Texto", type: "text" },
    {
      key: "duration",
      label: "Tempo até esconder (ms, opcional — deixe vazio para manter até o próximo passo)",
      type: "number",
      optional: true,
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(text, duration) {`,
      "    ToolTip text",
      "    if (duration > 0)",
      "        SetTimer(() => ToolTip(), -duration)",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.text ?? ""))}, ${Number(values.duration ?? 0)})`,
};
