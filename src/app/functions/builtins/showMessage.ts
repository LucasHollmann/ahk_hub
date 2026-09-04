import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Exibir Mensagem";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "showMessage",
  name: NAME,
  description: "Mostra um popup com um texto na tela.",
  params: [{ key: "text", label: "Texto", type: "text" }],
  usableDirectly: true,
  toAhkDeclaration: () => `${AHK_FUNCTION_NAME}(text) {\n    MsgBox text\n}`,
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.text ?? ""))})`,
};
