import type { FunctionMeta } from "../types";
import { quoteAhkString } from "../ahk";

export const meta: FunctionMeta = {
  id: "condPixelColor",
  name: "Cor do pixel",
  category: "system",
  description: "Verifica se um pixel da tela tem uma cor específica.",
  params: [
    { key: "x", label: "X", type: "number" },
    { key: "y", label: "Y", type: "number" },
    { key: "color", label: "Cor (ex: 0xFF0000)", type: "text" },
  ],
  usableDirectly: false,
  toAhkCall: (values) =>
    `PixelGetColor(${Number(values.x ?? 0)}, ${Number(values.y ?? 0)}) = ${quoteAhkString(
      String(values.color ?? "0x000000")
    )}`,
};
