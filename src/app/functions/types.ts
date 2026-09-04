export type ParamType = "text" | "number" | "boolean";

export type ParamDef = {
  key: string;
  label: string;
  type: ParamType;
};

export type FunctionMeta = {
  id: string;
  name: string;
  description: string;
  params: ParamDef[];
};

export type ParamValues = Record<string, string | number | boolean>;
