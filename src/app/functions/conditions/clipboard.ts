import type { FunctionMeta } from "../types";
import { quoteAhkString } from "../ahk";

export const meta: FunctionMeta = {
  id: "condClipboard",
  name: "Área de transferência contém",
  category: "system",
  description: "Verifica se o conteúdo da área de transferência contém um texto.",
  params: [{ key: "text", label: "Texto que deve conter", type: "text" }],
  usableDirectly: false,
  toAhkCall: (values) => `InStr(A_Clipboard, ${quoteAhkString(String(values.text ?? ""))}) > 0`,
};
