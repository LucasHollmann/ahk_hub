import type { FunctionMeta } from "../types";
import { quoteAhkString } from "../ahk";

export const meta: FunctionMeta = {
  id: "condWindowExists",
  name: "Janela existe",
  category: "system",
  description: "Verifica se existe uma janela com o título informado.",
  params: [{ key: "title", label: "Título da janela", type: "text" }],
  usableDirectly: false,
  toAhkCall: (values) => `WinExist(${quoteAhkString(String(values.title ?? ""))}) ? true : false`,
};
