import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Gerenciar Janela";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "manageWindow",
  name: NAME,
  description:
    "Minimiza, maximiza, fecha ou encaixa em metades/cantos/centro da tela uma janela pelo título ou a janela ativa.",
  params: [
    {
      key: "useActiveWindow",
      label: "Usar a janela ativa (ignora o título)",
      type: "boolean",
    },
    {
      key: "title",
      label: "Título da janela",
      type: "text",
      optional: true,
    },
    {
      key: "excludeTitle",
      label: "Texto que a janela NÃO deve conter",
      type: "text",
      optional: true,
    },
    {
      key: "action",
      label: "Ação",
      type: "select",
      options: [
        { value: "Minimize", label: "Minimizar" },
        { value: "Maximize", label: "Maximizar" },
        { value: "Close", label: "Fechar" },
        { value: "Center", label: "Centralizar" },
        { value: "LeftHalf", label: "Metade esquerda da tela" },
        { value: "RightHalf", label: "Metade direita da tela" },
        { value: "TopHalf", label: "Metade superior da tela" },
        { value: "BottomHalf", label: "Metade inferior da tela" },
        { value: "TopLeft", label: "Canto superior esquerdo" },
        { value: "TopRight", label: "Canto superior direito" },
        { value: "BottomLeft", label: "Canto inferior esquerdo" },
        { value: "BottomRight", label: "Canto inferior direito" },
      ],
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(useActiveWindow, title, excludeTitle, action) {`,
      '    target := useActiveWindow ? "A" : title',
      '    if (action = "Minimize") {',
      "        WinMinimize(target, , excludeTitle)",
      "        return",
      "    }",
      '    if (action = "Maximize") {',
      "        WinMaximize(target, , excludeTitle)",
      "        return",
      "    }",
      '    if (action = "Close") {',
      "        WinClose(target, , , excludeTitle)",
      "        return",
      "    }",
      "",
      "    ; Ações de posicionamento: garante que a janela não esteja maximizada antes de redimensionar",
      "    WinRestore(target, , excludeTitle)",
      "    MonitorGetWorkArea(MonitorGetPrimary(), &areaLeft, &areaTop, &areaRight, &areaBottom)",
      "    w := areaRight - areaLeft",
      "    h := areaBottom - areaTop",
      "    halfW := Round(w / 2)",
      "    halfH := Round(h / 2)",
      "",
      "    switch action {",
      '        case "Center":',
      "            cw := Round(w * 0.6)",
      "            ch := Round(h * 0.6)",
      "            WinMove(areaLeft + Round((w - cw) / 2), areaTop + Round((h - ch) / 2), cw, ch, target, , excludeTitle)",
      '        case "LeftHalf":',
      "            WinMove(areaLeft, areaTop, halfW, h, target, , excludeTitle)",
      '        case "RightHalf":',
      "            WinMove(areaLeft + halfW, areaTop, halfW, h, target, , excludeTitle)",
      '        case "TopHalf":',
      "            WinMove(areaLeft, areaTop, w, halfH, target, , excludeTitle)",
      '        case "BottomHalf":',
      "            WinMove(areaLeft, areaTop + halfH, w, halfH, target, , excludeTitle)",
      '        case "TopLeft":',
      "            WinMove(areaLeft, areaTop, halfW, halfH, target, , excludeTitle)",
      '        case "TopRight":',
      "            WinMove(areaLeft + halfW, areaTop, halfW, halfH, target, , excludeTitle)",
      '        case "BottomLeft":',
      "            WinMove(areaLeft, areaTop + halfH, halfW, halfH, target, , excludeTitle)",
      '        case "BottomRight":',
      "            WinMove(areaLeft + halfW, areaTop + halfH, halfW, halfH, target, , excludeTitle)",
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const useActiveWindow = values.useActiveWindow ? 1 : 0;
    return `${AHK_FUNCTION_NAME}(${useActiveWindow}, ${quoteAhkString(
      String(values.title ?? "")
    )}, ${quoteAhkString(String(values.excludeTitle ?? ""))}, ${quoteAhkString(
      String(values.action ?? "")
    )})`;
  },
};
