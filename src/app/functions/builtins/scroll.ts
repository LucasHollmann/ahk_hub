import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Rolar";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "scroll",
  name: NAME,
  description: "Rola a roda do mouse para cima ou para baixo.",
  params: [
    {
      key: "direction",
      label: "Direção",
      type: "select",
      options: [
        { value: "Up", label: "Para cima" },
        { value: "Down", label: "Para baixo" },
      ],
    },
    { key: "amount", label: "Quantidade de cliques da roda", type: "number" },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(direction, amount) {`,
      '    key := direction = "Up" ? "WheelUp" : "WheelDown"',
      '    Send("{" . key . " " . amount . "}")',
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const amount = Number(values.amount ?? 1);
    return `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.direction ?? "Down"))}, ${amount})`;
  },
};
