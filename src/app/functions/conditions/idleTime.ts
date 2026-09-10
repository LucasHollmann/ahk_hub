import type { FunctionMeta } from "../types";

export const meta: FunctionMeta = {
  id: "condIdleTime",
  name: "Tempo ocioso",
  category: "system",
  description: "Verifica há quanto tempo o mouse/teclado estão sem uso.",
  params: [
    { key: "ms", label: "Tempo (ms)", type: "number" },
    {
      key: "comparison",
      label: "Comparação",
      type: "select",
      options: [
        { value: ">", label: "Maior que" },
        { value: "<", label: "Menor que" },
      ],
    },
  ],
  usableDirectly: false,
  toAhkCall: (values) => `A_TimeIdlePhysical ${values.comparison ?? ">"} ${Number(values.ms ?? 0)}`,
};
