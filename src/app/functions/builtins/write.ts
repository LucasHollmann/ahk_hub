import type { FunctionMeta } from "../types";
import { escapeForSend, quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Escrever";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "write",
  name: NAME,
  description: "Digita um texto definido automaticamente.",
  params: [{ key: "text", label: "Texto", type: "text" }],
  usableDirectly: true,
  toAhkDeclaration: () => `${AHK_FUNCTION_NAME}(text) {\n    Send text\n}`,
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(escapeForSend(String(values.text ?? "")))})`,
};
