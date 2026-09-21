import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Tecla de alternância ativa";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condToggleKeyState",
  name: NAME,
  category: "system",
  description: "Verifica se CapsLock, NumLock ou ScrollLock está ativado.",
  params: [
    {
      key: "key",
      label: "Tecla",
      type: "select",
      options: [
        { value: "CapsLock", label: "CapsLock" },
        { value: "NumLock", label: "NumLock" },
        { value: "ScrollLock", label: "ScrollLock" },
      ],
    },
  ],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(key) {`,
      "    try {",
      '        return GetKeyState(key, "T")',
      "    } catch {",
      "        return false",
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.key ?? "CapsLock"))})`,
};
