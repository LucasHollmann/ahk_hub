import type { FunctionMeta } from "../types";
import { toConditionFunctionName } from "../ahk";

const NAME = "Tempo ocioso";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condIdleTime",
  name: NAME,
  category: "system",
  description: "Verifica há quanto tempo o mouse/teclado estão sem uso.",
  params: [
    { key: "ms", label: "Tempo (ms)", type: "number" },
    {
      key: "comparison",
      label: "Comparação",
      type: "select",
      options: [
        { value: ">", label: "Maior que" },
        { value: "<", label: "Menor que" },
      ],
    },
  ],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(ms, comparison) {`,
      '    if (comparison = "<")',
      "        return A_TimeIdlePhysical < ms",
      "    return A_TimeIdlePhysical > ms",
      "}",
    ].join("\n"),
  toAhkCall: (values) => `A_TimeIdlePhysical ${values.comparison ?? ">"} ${Number(values.ms ?? 0)}`,
};
