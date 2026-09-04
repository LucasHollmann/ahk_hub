import type { FunctionMeta } from "../types";
import { toSystemFunctionName } from "../ahk";

const NAME = "Arrastar";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "drag",
  name: NAME,
  description: "Arrasta o mouse de uma coordenada até outra (clique, move, solta).",
  params: [
    { key: "x", label: "X inicial", type: "number" },
    { key: "y", label: "Y inicial", type: "number" },
    { key: "endX", label: "X final", type: "number" },
    { key: "endY", label: "Y final", type: "number" },
    {
      key: "fullScreen",
      label: "Coordenada relativa à tela toda (senão, à janela ativa)",
      type: "boolean",
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(x, y, endX, endY, fullScreen) {`,
      '    CoordMode "Mouse", fullScreen ? "Screen" : "Window"',
      '    Click(x, y, , , "D")',
      "    MouseMove(endX, endY)",
      '    Click(, , , , "U")',
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const x = Number(values.x ?? 0);
    const y = Number(values.y ?? 0);
    const endX = Number(values.endX ?? 0);
    const endY = Number(values.endY ?? 0);
    const fullScreen = values.fullScreen ? 1 : 0;
    return `${AHK_FUNCTION_NAME}(${x}, ${y}, ${endX}, ${endY}, ${fullScreen})`;
  },
};
