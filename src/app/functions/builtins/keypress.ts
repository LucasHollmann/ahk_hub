import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "KeyPress";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "keyPress",
  name: NAME,
  category: "input",
  description:
    "Envia uma combinação de teclas (modificador + tecla). Pode também apenas pressionar ou apenas soltar, para deixar a tecla segurada entre dois passos.",
  params: [
    { key: "combo", label: "Tecla", type: "keyCombo" },
    {
      key: "action",
      label: "Ação",
      type: "select",
      optional: true,
      options: [
        { value: "press", label: "Toque (pressiona e solta)" },
        { value: "down", label: "Segurar (só pressiona)" },
        { value: "up", label: "Soltar (só libera)" },
      ],
    },
  ],
  usableDirectly: true,
  /**
   * Um toque é só "descer tudo e subir tudo", então as três ações saem da mesma montagem:
   * "down" para na metade, "up" começa na metade. Tratar o modificador como uma tecla
   * qualquer dispensa os símbolos (`^`, `!`, `+`, `#`) e o caso especial do modificador
   * sozinho, que existia só porque `Send "^"` sem tecla nenhuma não envia nada.
   */
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(combo, action) {`,
      '    keys := StrSplit(combo, "+")',
      '    ; O seletor de teclas grava a letra em maiúscula ("A") e "{A down}" mandaria Shift',
      "    ; junto, então uma tecla de um caractere só desce sempre em minúscula.",
      "    for i, k in keys",
      "        keys[i] := StrLen(k) = 1 ? StrLower(k) : k",
      '    out := ""',
      '    if (action != "up")',
      "        for k in keys",
      '            out .= "{" . k . " down}"',
      '    if (action != "down")',
      "        ; Soltas na ordem inversa: o modificador sai depois da tecla que ele modifica.",
      "        Loop keys.Length",
      '            out .= "{" . keys[keys.Length - A_Index + 1] . " up}"',
      "    Send out",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.combo ?? ""))}, ${quoteAhkString(
      String(values.action ?? "")
    )})`,
};
