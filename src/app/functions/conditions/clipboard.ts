import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Área de transferência contém";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condClipboard",
  name: NAME,
  category: "system",
  description: "Verifica se o conteúdo da área de transferência contém um texto.",
  params: [{ key: "text", label: "Texto que deve conter", type: "text" }],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [`${AHK_FUNCTION_NAME}(text) {`, "    return InStr(A_Clipboard, text) > 0", "}"].join("\n"),
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.text ?? ""))})`,
};
