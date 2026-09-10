import type { FunctionMeta } from "../types";

export const meta: FunctionMeta = {
  id: "condVolume",
  name: "Volume do sistema",
  category: "system",
  description: "Compara o volume atual do sistema (0 a 100) com um valor.",
  params: [
    {
      key: "comparison",
      label: "Comparação",
      type: "select",
      options: [
        { value: "=", label: "Igual a" },
        { value: ">", label: "Maior que" },
        { value: "<", label: "Menor que" },
      ],
    },
    { key: "value", label: "Valor (0-100)", type: "number" },
  ],
  usableDirectly: false,
  toAhkCall: (values) => `Round(SoundGetVolume()) ${values.comparison ?? "="} ${Number(values.value ?? 0)}`,
};
