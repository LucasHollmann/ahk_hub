import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Ação do Sistema";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "systemAction",
  name: NAME,
  description:
    "Bloqueia a tela, desconecta, desliga, reinicia, hiberna ou suspende o computador.",
  params: [
    {
      key: "action",
      label: "Ação",
      type: "select",
      options: [
        { value: "Lock", label: "Bloquear tela" },
        { value: "Logoff", label: "Sair (logout)" },
        { value: "Shutdown", label: "Desligar" },
        { value: "Restart", label: "Reiniciar" },
        { value: "Hibernate", label: "Hibernar" },
        { value: "Sleep", label: "Suspender" },
      ],
    },
    {
      key: "force",
      label: "Forçar (fecha programas sem salvar, ignorado em Bloquear/Hibernar/Suspender)",
      type: "boolean",
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(action, force) {`,
      '    if (action = "Lock") {',
      '        DllCall("LockWorkStation")',
      "        return",
      "    }",
      '    if (action = "Hibernate") {',
      '        DllCall("PowrProf\\SetSuspendState", "int", 1, "int", 0, "int", 0)',
      "        return",
      "    }",
      '    if (action = "Sleep") {',
      '        DllCall("PowrProf\\SetSuspendState", "int", 0, "int", 0, "int", 0)',
      "        return",
      "    }",
      "",
      "    flag := 0",
      '    if (action = "Shutdown")',
      "        flag := 9",
      '    else if (action = "Restart")',
      "        flag := 2",
      "    if (force)",
      "        flag := flag | 4",
      "    Shutdown(flag)",
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const force = values.force ? 1 : 0;
    return `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.action ?? ""))}, ${force})`;
  },
};
