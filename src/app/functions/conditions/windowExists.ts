import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Janela existe";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condWindowExists",
  name: NAME,
  category: "system",
  description: "Verifica se existe uma janela com o título informado.",
  params: [{ key: "title", label: "Título da janela", type: "text" }],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [`${AHK_FUNCTION_NAME}(title) {`, "    return WinExist(title) ? true : false", "}"].join("\n"),
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.title ?? ""))})`,
};
