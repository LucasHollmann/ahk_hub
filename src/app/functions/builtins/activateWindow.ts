import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Ativar Janela";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "activateWindow",
  name: NAME,
  description: "Ativa (foca) uma janela pelo título, podendo excluir janelas com um texto específico.",
  params: [
    { key: "title", label: "Título da janela", type: "text" },
    {
      key: "excludeTitle",
      label: "Texto que a janela NÃO deve conter",
      type: "text",
      optional: true,
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    `${AHK_FUNCTION_NAME}(title, excludeTitle) {\n    WinActivate title, , excludeTitle\n}`,
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.title ?? ""))}, ${quoteAhkString(
      String(values.excludeTitle ?? "")
    )})`,
};
