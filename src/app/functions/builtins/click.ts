import type { FunctionMeta } from "../types";

export const meta: FunctionMeta = {
  id: "click",
  name: "Clicar",
  description: "Realiza um clique do mouse em uma coordenada.",
  params: [
    { key: "x", label: "X", type: "number" },
    { key: "y", label: "Y", type: "number" },
    {
      key: "fullScreen",
      label: "Coordenada relativa à tela toda (senão, à janela ativa)",
      type: "boolean",
    },
  ],
};

export function run(_x: number, _y: number, _fullScreen: boolean) {
  // TODO: implementar o clique do mouse no sistema operacional
}
