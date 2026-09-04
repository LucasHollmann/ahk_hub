import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Abrir";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "open",
  name: NAME,
  description: "Abre um programa, arquivo ou link.",
  params: [{ key: "path", label: "Caminho ou link", type: "text" }],
  usableDirectly: true,
  toAhkDeclaration: () => `${AHK_FUNCTION_NAME}(path) {\n    Run path\n}`,
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.path ?? ""))})`,
};
