import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Janela ativa contém";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condActiveWindow",
  name: NAME,
  category: "system",
  description: "Verifica se o título da janela ativa contém um texto.",
  params: [{ key: "titleContains", label: "Texto que o título deve conter", type: "text" }],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(titleContains) {`,
      "    try {",
      '        return InStr(WinGetTitle("A"), titleContains) > 0',
      "    } catch {",
      "        return false",
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.titleContains ?? ""))})`,
};
