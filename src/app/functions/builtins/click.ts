import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Clicar";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "click",
  name: NAME,
  category: "input",
  description: "Realiza um clique (simples ou duplo) do mouse em uma coordenada.",
  params: [
    { key: "x", label: "X", type: "number" },
    { key: "y", label: "Y", type: "number" },
    {
      key: "fullScreen",
      label: "Coordenada relativa à tela toda (senão, à janela ativa)",
      type: "boolean",
    },
    {
      key: "button",
      label: "Botão",
      type: "select",
      optional: true,
      options: [
        { value: "Left", label: "Esquerdo" },
        { value: "Right", label: "Direito" },
        { value: "Middle", label: "Meio" },
      ],
    },
    { key: "doubleClick", label: "Clique duplo", type: "boolean" },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(x, y, fullScreen, button, doubleClick) {`,
      '    CoordMode "Mouse", fullScreen ? "Screen" : "Window"',
      "    count := doubleClick ? 2 : 1",
      "    Click x, y, button, count",
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const x = Number(values.x ?? 0);
    const y = Number(values.y ?? 0);
    const fullScreen = values.fullScreen ? 1 : 0;
    const button = quoteAhkString(String(values.button ?? "") || "Left");
    const doubleClick = values.doubleClick ? 1 : 0;
    return `${AHK_FUNCTION_NAME}(${x}, ${y}, ${fullScreen}, ${button}, ${doubleClick})`;
  },
};
