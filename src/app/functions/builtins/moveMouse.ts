import type { FunctionMeta } from "../types";
import { toSystemFunctionName } from "../ahk";

const NAME = "Mover Mouse";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "moveMouse",
  name: NAME,
  description: "Move o cursor do mouse para uma coordenada, sem clicar.",
  params: [
    { key: "x", label: "X", type: "number" },
    { key: "y", label: "Y", type: "number" },
    {
      key: "fullScreen",
      label: "Coordenada relativa à tela toda (senão, à janela ativa)",
      type: "boolean",
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(x, y, fullScreen) {`,
      '    CoordMode "Mouse", fullScreen ? "Screen" : "Window"',
      "    MouseMove x, y",
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const x = Number(values.x ?? 0);
    const y = Number(values.y ?? 0);
    const fullScreen = values.fullScreen ? 1 : 0;
    return `${AHK_FUNCTION_NAME}(${x}, ${y}, ${fullScreen})`;
  },
};
