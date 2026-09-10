import type { FunctionMeta } from "../types";

const NAME = "Se";

export const meta: FunctionMeta = {
  id: "conditional",
  name: NAME,
  category: "flow",
  description: "Executa os passos seguintes apenas se uma condição for verdadeira. (em breve)",
  params: [{ key: "condition", label: "Condição (código AHK)", type: "text" }],
  usableDirectly: false,
};
