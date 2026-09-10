import type { FunctionMeta } from "../types";
import { quoteAhkString } from "../ahk";

export const meta: FunctionMeta = {
  id: "condKeyState",
  name: "Tecla pressionada",
  category: "system",
  description: "Verifica se uma tecla está pressionada no momento.",
  params: [{ key: "key", label: "Nome da tecla (ex: a, Enter, LButton)", type: "text" }],
  usableDirectly: false,
  toAhkCall: (values) => `GetKeyState(${quoteAhkString(String(values.key ?? ""))}, "P")`,
};
