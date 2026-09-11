export type ParamType = "text" | "number" | "boolean" | "select" | "keyCombo";

export type ParamOption = { value: string; label: string };

export type ParamDef = {
  key: string;
  label: string;
  type: ParamType;
  /** When true, this param may be left empty (e.g. an optional exclude filter). */
  optional?: boolean;
  /** Required when type is "select" — the choices offered to the user. */
  options?: ParamOption[];
  /** When true, literal text values are escaped for `Send` (e.g. `{`, `%`) before being embedded in AHK code. */
  sendEscape?: boolean;
};

/**
 * Types a user-defined function header parameter can have — every scalar type a callable
 * function's own params can have, plus "coordinate": a screen position, the other param
 * "type" that existing functions use (Clicar, Arrastar, Mover Mouse...), represented as an
 * X/Y pair rather than a single value.
 */
export type HeaderParamType = ParamType | "coordinate";

export type HeaderParamDef = {
  key: string;
  label: string;
  type: HeaderParamType;
  /** Required when type is "select" — the choices offered to the user. */
  options?: ParamOption[];
};

/**
 * A value passed as an argument to a function call within a step body: typed in directly,
 * forwarded from one of the enclosing function's header parameters, or forwarded from a
 * variable — local (declared earlier in the same function's steps) or global (registered
 * in the "Variáveis globais" tab).
 */
export type ArgSource =
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "headerParam"; paramKey: string }
  | { kind: "localVariable"; variableName: string }
  | { kind: "globalVariable"; variableName: string };

export type ArgValues = Record<string, ArgSource>;

export function defaultArgValues(params: ParamDef[]): ArgValues {
  const values: ArgValues = {};
  for (const param of params) {
    values[param.key] = { kind: "literal", value: param.type === "boolean" ? false : "" };
  }
  return values;
}

export function areArgsFilled(params: ParamDef[], values: ArgValues): boolean {
  return params.every((p) => {
    const arg = values[p.key];
    if (!arg) return Boolean(p.optional);
    if (arg.kind !== "literal") return true;
    if (p.type === "boolean" || p.optional) return true;
    return String(arg.value ?? "").trim() !== "";
  });
}

/**
 * Header params a given target param can be filled from — matched by type, since AHK values
 * carry no richer type info. For "select" params, the option sets must match exactly too,
 * since forwarding a value the target doesn't recognize as one of its choices is meaningless.
 * "coordinate" header params aren't offered here — they're an X/Y pair, matched separately
 * against coordinate pairs via `compatibleCoordinateHeaderParams`.
 */
export function compatibleHeaderParams(
  headerParams: HeaderParamDef[],
  target: ParamDef
): HeaderParamDef[] {
  return headerParams.filter((hp) => {
    if (hp.type !== target.type) return false;
    if (hp.type !== "select") return true;
    const hpValues = new Set((hp.options ?? []).map((o) => o.value));
    const targetValues = (target.options ?? []).map((o) => o.value);
    return hpValues.size === targetValues.length && targetValues.every((v) => hpValues.has(v));
  });
}

/** "coordinate" header params — candidates to forward into a target's X/Y coordinate pair as a unit. */
export function compatibleCoordinateHeaderParams(headerParams: HeaderParamDef[]): HeaderParamDef[] {
  return headerParams.filter((hp) => hp.type === "coordinate");
}

/**
 * Expands a function's header parameters into the plain call-argument slots a caller sees:
 * scalar params pass through as-is, while a "coordinate" param becomes two number slots
 * (`${key}X`, `${key}Y`) — the same naming convention `getCoordinatePairs` already recognizes,
 * so a coordinate header param can itself be called like any other coordinate-taking function.
 */
export function expandHeaderParamsToCallParams(headerParams: HeaderParamDef[]): ParamDef[] {
  return headerParams.flatMap((p): ParamDef[] =>
    p.type === "coordinate"
      ? [
          { key: `${p.key}X`, label: `${p.label} X`, type: "number" },
          { key: `${p.key}Y`, label: `${p.label} Y`, type: "number" },
        ]
      : [{ key: p.key, label: p.label, type: p.type, options: p.options }]
  );
}

export type ParamValues = Record<string, string | number | boolean>;

/** Groups builtins in pickers — "input" (keyboard/mouse), "window", "system" (misc/media), "ui" (tooltip, notification, input prompt...). */
export type FunctionCategoryId = "input" | "window" | "system" | "ui";

export const FUNCTION_CATEGORY_LABELS: Record<FunctionCategoryId, string> = {
  input: "Entradas básicas",
  window: "Janelas",
  system: "Sistema",
  ui: "Interface",
};

export function tFunctionCategoryLabel(t: Translate, category: FunctionCategoryId): string {
  return t(`functionCategories.${category}`, FUNCTION_CATEGORY_LABELS[category]);
}

export type FunctionMeta = {
  id: string;
  name: string;
  description: string;
  params: ParamDef[];
  /** Groups this builtin in pickers, alongside "Personalizadas" and "Variáveis". */
  category: FunctionCategoryId;
  /** Whether this function can be mapped directly to a hotkey. False means it only makes sense as a step inside another function (e.g. "Esperar"). */
  usableDirectly: boolean;
  /** Returns the AHK function definition for this builtin (declared once, before any hotkey uses it). */
  toAhkDeclaration?: () => string;
  /** Returns the call expression (e.g. `controller_function_Clicar(120, 340, 0)`) used at the hotkey site. */
  toAhkCall?: (values: ParamValues) => string;
};

export function defaultParamValues(meta: FunctionMeta): ParamValues {
  const values: ParamValues = {};
  for (const param of meta.params) {
    values[param.key] = param.type === "boolean" ? false : "";
  }
  return values;
}

export function areParamsFilled(meta: FunctionMeta, values: ParamValues): boolean {
  return meta.params.every((p) =>
    p.type === "boolean" || p.optional ? true : String(values[p.key] ?? "").trim() !== ""
  );
}

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
