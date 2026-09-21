import type { FunctionMeta } from "../types";
import { quoteAhkString, toConditionFunctionName } from "../ahk";

const NAME = "Cor do pixel";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condPixelColor",
  name: NAME,
  category: "system",
  description: "Verifica se um pixel da tela tem uma cor específica.",
  params: [
    { key: "x", label: "X", type: "number" },
    { key: "y", label: "Y", type: "number" },
    { key: "color", label: "Cor (ex: 0xFF0000)", type: "text" },
  ],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(x, y, color) {`,
      "    try {",
      "        current := PixelGetColor(x, y)",
      "    } catch {",
      "        return false",
      "    }",
      // The color arrives as whatever the user typed ("0xFF0000", "FF0000"...), so both sides
      // are normalized to a plain integer before comparing.
      '    return current = Integer(InStr(color, "0x") = 1 ? color : "0x" . color)',
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${Number(values.x ?? 0)}, ${Number(values.y ?? 0)}, ${quoteAhkString(
      String(values.color ?? "0x000000")
    )})`,
};
