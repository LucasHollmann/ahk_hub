import type { FunctionMeta } from "../types";
import { toConditionFunctionName } from "../ahk";

const NAME = "Volume do sistema";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condVolume",
  name: NAME,
  category: "system",
  description: "Compara o volume atual do sistema (0 a 100) com um valor.",
  params: [
    {
      key: "comparison",
      label: "Comparação",
      type: "select",
      options: [
        { value: "=", label: "Igual a" },
        { value: ">", label: "Maior que" },
        { value: "<", label: "Menor que" },
      ],
    },
    { key: "value", label: "Valor (0-100)", type: "number" },
  ],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(comparison, value) {`,
      "    current := Round(SoundGetVolume())",
      '    if (comparison = ">")',
      "        return current > value",
      '    if (comparison = "<")',
      "        return current < value",
      "    return current = value",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `Round(SoundGetVolume()) ${values.comparison ?? "="} ${Number(values.value ?? 0)}`,
};
