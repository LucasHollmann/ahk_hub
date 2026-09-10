import type { FunctionMeta } from "../types";

const NAME = "Repetir";

export const meta: FunctionMeta = {
  id: "loop",
  name: NAME,
  category: "flow",
  description: "Repete os passos seguintes um número de vezes. (em breve)",
  params: [{ key: "times", label: "Número de repetições", type: "number" }],
  usableDirectly: false,
};
