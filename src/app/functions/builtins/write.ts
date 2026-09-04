import type { FunctionMeta } from "../types";

export const meta: FunctionMeta = {
  id: "write",
  name: "Escrever",
  description: "Digita um texto definido automaticamente.",
  params: [{ key: "text", label: "Texto", type: "text" }],
};

export function run(_text: string) {
  // TODO: implementar o envio do texto para o sistema operacional
}
