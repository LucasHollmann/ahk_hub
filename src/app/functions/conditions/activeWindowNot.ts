import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Janela ativa não contém";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condActiveWindowNot",
  name: NAME,
  category: "system",
  description: "Verifica se o título da janela ativa não contém um texto.",
  params: [{ key: "titleContains", label: "Texto que o título não deve conter", type: "text" }],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(titleContains) {`,
      "    try {",
      '        return InStr(WinGetTitle("A"), titleContains) = 0',
      "    } catch {",
      // Mirror of "Janela ativa contém", which returns false here: with no readable title
      // there is nothing containing the text, so the negated check holds.
      "        return true",
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.titleContains ?? ""))})`,
};
