import type { FunctionMeta } from "../types";
import { toConditionFunctionName } from "../ahk";

const NAME = "Posição do mouse";
const AHK_FUNCTION_NAME = toConditionFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "condMousePosition",
  name: NAME,
  category: "system",
  description: "Verifica se o cursor do mouse está em uma coordenada específica.",
  params: [
    { key: "x", label: "X", type: "number" },
    { key: "y", label: "Y", type: "number" },
    {
      key: "fullScreen",
      label: "Coordenada relativa à tela toda (senão, à janela ativa)",
      type: "boolean",
    },
  ],
  usableDirectly: false,
  ahkFunctionName: AHK_FUNCTION_NAME,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(x, y, fullScreen) {`,
      "    MouseGetPos(&mx, &my)",
      "    if (fullScreen)",
      "        return mx = x && my = y",
      "    try {",
      '        WinGetPos(&wx, &wy, , , "A")',
      "    } catch {",
      "        return false",
      "    }",
      "    return (mx - wx) = x && (my - wy) = y",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${Number(values.x ?? 0)}, ${Number(values.y ?? 0)}, ${values.fullScreen ? 1 : 0})`,
};
