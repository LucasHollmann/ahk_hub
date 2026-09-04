export type ParamType = "text" | "number" | "boolean" | "select";

export type ParamOption = { value: string; label: string };

export type ParamDef = {
  key: string;
  label: string;
  type: ParamType;
  /** When true, this param may be left empty (e.g. an optional exclude filter). */
  optional?: boolean;
  /** Required when type is "select" — the choices offered to the user. */
  options?: ParamOption[];
};

export type ParamValues = Record<string, string | number | boolean>;

export type FunctionMeta = {
  id: string;
  name: string;
  description: string;
  params: ParamDef[];
  /** Whether this function can be mapped directly to a hotkey. False means it only makes sense as a step inside another function (e.g. "Esperar"). */
  usableDirectly: boolean;
  /** Returns the AHK function definition for this builtin (declared once, before any hotkey uses it). */
  toAhkDeclaration?: () => string;
  /** Returns the call expression (e.g. `controller_function_Clicar(120, 340, 0)`) used at the hotkey site. */
  toAhkCall?: (values: ParamValues) => string;
};

export type ParamEntry = { label: string; value: string };

export type CoordinatePair = {
  xKey: string;
  yKey: string;
  xParam: ParamDef;
  yParam: ParamDef;
  /** Portuguese fallback label, derived from the X param's label (e.g. "Coordenada final"). */
  label: string;
};

/** Signature shared with the i18n context's `t`, kept here so this module stays framework-agnostic. */
export type Translate = (
  key: string,
  fallback: string,
  vars?: Record<string, string | number>
) => string;

export function tFunctionName(t: Translate, meta: FunctionMeta): string {
  return t(`functions.${meta.id}.name`, meta.name);
}

export function tFunctionDescription(t: Translate, meta: FunctionMeta): string {
  return t(`functions.${meta.id}.description`, meta.description);
}

export function tParamLabel(t: Translate, functionId: string, param: ParamDef): string {
  return t(`functions.${functionId}.params.${param.key}.label`, param.label);
}

export function tParamOption(
  t: Translate,
  functionId: string,
  paramKey: string,
  option: ParamOption
): string {
  return t(
    `functions.${functionId}.params.${paramKey}.options.${option.value}`,
    option.label
  );
}

export function tCoordinateLabel(t: Translate, functionId: string, pair: CoordinatePair): string {
  return t(`functions.${functionId}.coordinates.${pair.xKey}`, pair.label);
}

function coordinateGroupLabel(xLabel: string): string {
  const stripped = xLabel.replace(/^X\s*/i, "").trim();
  return stripped ? `Coordenada ${stripped}` : "Coordenada";
}

/**
 * Finds coordinate pairs by naming convention: "x"/"y", or "<prefix>X"/"<prefix>Y"
 * (e.g. "endX"/"endY"). Lets any function declare more than one coordinate
 * without dedicated per-function UI code.
 */
export function getCoordinatePairs(params: ParamDef[]): CoordinatePair[] {
  const byKey = new Map(params.map((p) => [p.key, p]));
  const pairs: CoordinatePair[] = [];

  for (const p of params) {
    let prefix: string | null = null;
    if (p.key === "x") prefix = "";
    else if (/^.+X$/.test(p.key)) prefix = p.key.slice(0, -1);
    if (prefix === null) continue;

    const yKey = prefix === "" ? "y" : `${prefix}Y`;
    const yParam = byKey.get(yKey);
    if (!yParam) continue;

    pairs.push({
      xKey: p.key,
      yKey,
      xParam: p,
      yParam,
      label: coordinateGroupLabel(p.label),
    });
  }

  return pairs;
}

export function getParamEntries(
  meta: FunctionMeta,
  values: ParamValues,
  t: Translate
): ParamEntry[] {
  const pairs = getCoordinatePairs(meta.params);
  const consumedKeys = new Set(pairs.flatMap((p) => [p.xKey, p.yKey]));

  const entries: ParamEntry[] = pairs.map((pair) => ({
    label: tCoordinateLabel(t, meta.id, pair),
    value: `(${values[pair.xKey] ?? "?"}, ${values[pair.yKey] ?? "?"})`,
  }));

  for (const param of meta.params) {
    if (consumedKeys.has(param.key)) continue;
    const raw = values[param.key];
    const value =
      param.type === "boolean"
        ? raw
          ? t("common.yes", "Sim")
          : t("common.no", "Não")
        : param.type === "select"
          ? (() => {
              const option = param.options?.find((o) => o.value === raw);
              return option ? tParamOption(t, meta.id, param.key, option) : String(raw ?? "");
            })()
          : String(raw ?? "");
    entries.push({ label: tParamLabel(t, meta.id, param), value });
  }

  return entries;
}
