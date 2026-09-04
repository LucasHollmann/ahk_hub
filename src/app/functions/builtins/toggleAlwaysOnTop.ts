import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Alternar Sempre Visível";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "toggleAlwaysOnTop",
  name: NAME,
  description:
    "Ativa ou desativa o modo 'sempre visível' (always on top) de uma janela pelo título, ou a janela ativa.",
  params: [
    {
      key: "useActiveWindow",
      label: "Usar a janela ativa (ignora o título)",
      type: "boolean",
    },
    {
      key: "title",
      label: "Título da janela",
      type: "text",
      optional: true,
    },
    {
      key: "excludeTitle",
      label: "Texto que a janela NÃO deve conter",
      type: "text",
      optional: true,
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(useActiveWindow, title, excludeTitle) {`,
      '    target := useActiveWindow ? "A" : title',
      "    WinSetAlwaysOnTop(-1, target, , excludeTitle)",
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const useActiveWindow = values.useActiveWindow ? 1 : 0;
    return `${AHK_FUNCTION_NAME}(${useActiveWindow}, ${quoteAhkString(
      String(values.title ?? "")
    )}, ${quoteAhkString(String(values.excludeTitle ?? ""))})`;
  },
};
