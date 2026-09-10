import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Horário do dia";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condTimeOfDay",
  name: NAME,
  category: "system",
  description: "Verifica se o horário atual está dentro de um intervalo (ex: 09:00 até 18:00).",
  params: [
    { key: "from", label: "A partir de (HH:mm)", type: "text" },
    { key: "to", label: "Até (HH:mm)", type: "text" },
  ],
  usableDirectly: false,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(fromStr, toStr) {`,
      "    now := A_Hour * 60 + A_Min",
      "    from := Integer(SubStr(fromStr, 1, 2)) * 60 + Integer(SubStr(fromStr, 4, 2))",
      "    to := Integer(SubStr(toStr, 1, 2)) * 60 + Integer(SubStr(toStr, 4, 2))",
      "    if (from <= to)",
      "        return now >= from && now <= to",
      "    return now >= from || now <= to",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.from ?? "00:00"))}, ${quoteAhkString(
      String(values.to ?? "23:59")
    )})`,
};
