import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Tecla pressionada";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condKeyState",
  name: NAME,
  category: "system",
  description: "Verifica se uma tecla está pressionada no momento.",
  params: [{ key: "key", label: "Nome da tecla (ex: a, Enter, LButton)", type: "text" }],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(key) {`,
      "    try {",
      '        return GetKeyState(key, "P")',
      "    } catch {",
      "        return false",
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.key ?? ""))})`,
};
