import type { FunctionMeta } from "../types";
import { quoteAhkString } from "../ahk";

export const meta: FunctionMeta = {
  id: "condToggleKeyState",
  name: "Tecla de alternância ativa",
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
  toAhkCall: (values) => `GetKeyState(${quoteAhkString(String(values.key ?? "CapsLock"))}, "T")`,
};
