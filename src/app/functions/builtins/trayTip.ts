import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Notificação";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "trayTip",
  name: NAME,
  category: "ui",
  description: "Mostra uma notificação do Windows (balão perto da bandeja do sistema).",
  params: [
    { key: "title", label: "Título", type: "text" },
    { key: "text", label: "Texto", type: "text" },
  ],
  usableDirectly: true,
  toAhkDeclaration: () => `${AHK_FUNCTION_NAME}(title, text) {\n    TrayTip text, title\n}`,
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.title ?? ""))}, ${quoteAhkString(
      String(values.text ?? "")
    )})`,
};
