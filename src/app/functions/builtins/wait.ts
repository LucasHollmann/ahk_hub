import type { FunctionMeta } from "../types";
import { toSystemFunctionName } from "../ahk";

const NAME = "Esperar";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "wait",
  name: NAME,
  description: "Aguarda um tempo determinado (em milissegundos) antes de continuar.",
  params: [{ key: "ms", label: "Tempo (ms)", type: "number" }],
  usableDirectly: false,
  toAhkDeclaration: () => `${AHK_FUNCTION_NAME}(ms) {\n    Sleep ms\n}`,
  toAhkCall: (values) => `${AHK_FUNCTION_NAME}(${Number(values.ms ?? 0)})`,
};