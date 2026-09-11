import type { FunctionMeta } from "../types";
import { toSystemFunctionName } from "../ahk";

const NAME = "Beep";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "beep",
  name: NAME,
  category: "ui",
  description: "Toca um som curto (bipe) como feedback sonoro.",
  params: [
    { key: "frequency", label: "Frequência (Hz, opcional — padrão 523)", type: "number", optional: true },
    { key: "duration", label: "Duração (ms, opcional — padrão 150)", type: "number", optional: true },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(frequency, duration) {`,
      "    SoundBeep(frequency > 0 ? frequency : 523, duration > 0 ? duration : 150)",
      "}",
    ].join("\n"),
  toAhkCall: (values) =>
    `${AHK_FUNCTION_NAME}(${Number(values.frequency ?? 0)}, ${Number(values.duration ?? 0)})`,
};
