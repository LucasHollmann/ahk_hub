import type { CoordinateLiteral, VariableInitialValue, VariableType } from "../components/types";
import type { ArgSource, ArgValues, ParamDef } from "./types";

const MODIFIER_SYMBOLS: Record<string, string> = {
  Ctrl: "^",
  Alt: "!",
  Shift: "+",
  Win: "#",
};

const STANDALONE_KEY_NAMES: Record<string, string> = {
  Ctrl: "LControl",
  Alt: "LAlt",
  Shift: "LShift",
  Win: "LWin",
};

function splitCombo(combo: string) {
  const parts = combo.split("+");
  const key = parts.pop() ?? "";
  return { modifiers: parts, key };
}

export function comboToHotkey(combo: string): string {
  const { modifiers, key } = splitCombo(combo);
  if (modifiers.length === 0 && key in STANDALONE_KEY_NAMES) {
    return STANDALONE_KEY_NAMES[key];
  }
  const symbols = modifiers.map((m) => MODIFIER_SYMBOLS[m] ?? "").join("");
  return `${symbols}${key}`;
}

/** The raw AHK key name `KeyWait` expects for this combo's final key (ignores modifiers, same as a standalone tap). */
export function comboToKeyWaitName(combo: string): string {
  const { modifiers, key } = splitCombo(combo);
  if (modifiers.length === 0 && key in STANDALONE_KEY_NAMES) {
    return STANDALONE_KEY_NAMES[key];
  }
  return key.length > 1 ? key : key.toLowerCase();
}

export function comboToSendTarget(combo: string): string {
  const { modifiers, key } = splitCombo(combo);
  if (modifiers.length === 0 && key in STANDALONE_KEY_NAMES) {
    return `{${STANDALONE_KEY_NAMES[key]}}`;
  }
  const symbols = modifiers.map((m) => MODIFIER_SYMBOLS[m] ?? "").join("");
  const keyPart = key.length > 1 ? `{${key}}` : key.toLowerCase();
  return `${symbols}${keyPart}`;
}

const AHK_IDENTIFIER_PATTERN = /^[A-Za-z_]\w*$/;

/** Valid as both an AHK identifier (function/parameter name) and, unprefixed, a JS object key. */
export function isValidAhkIdentifier(value: string): boolean {
  return AHK_IDENTIFIER_PATTERN.test(value);
}

export function escapeForSend(text: string): string {
  return text.replace(/[{}%!^+#]/g, (char) => `{${char}}`);
}

const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripDiacritics(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < COMBINING_DIACRITICS_START || code > COMBINING_DIACRITICS_END) {
      result += char;
    }
  }
  return result;
}

export function toAhkLabel(name: string): string {
  const withoutDiacritics = stripDiacritics(name.normalize("NFD"));
  const cleaned = withoutDiacritics.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned || "Func";
}

export function quoteAhkString(text: string): string {
  const escaped = text.replace(/`/g, "``").replace(/"/g, '`"');
  return `"${escaped}"`;
}

export function toSystemFunctionName(name: string): string {
  return `system_controller_function_${toAhkLabel(name).toLowerCase()}`;
}

export function toUserFunctionName(name: string): string {
  return `user_controller_function_${toAhkLabel(name).toLowerCase()}`;
}

export function toConditionFunctionName(name: string): string {
  return `system_controller_condition_${toAhkLabel(name).toLowerCase()}`;
}

const AHK_RESERVED_WORDS = new Set([
  "if",
  "else",
  "while",
  "loop",
  "for",
  "switch",
  "case",
  "catch",
  "try",
  "return",
  "until",
]);

/** Extracts the declared function name from a block of AHK v2 code, e.g. `MyFunc(a, b) {`. */
export function extractFunctionName(code: string): string | null {
  const matches = code.matchAll(/^[ \t]*([A-Za-z_]\w*)\s*\(/gm);
  for (const match of matches) {
    const candidate = match[1];
    if (!AHK_RESERVED_WORDS.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return null;
}

/** Formats a single literal value the same way every builtin's own `toAhkCall` does for that param type. */
export function formatAhkArgLiteral(param: ParamDef, value: string | number | boolean): string {
  if (param.type === "boolean") return value ? "1" : "0";
  if (param.type === "number") return String(Number(value ?? 0));
  const text = String(value ?? "");
  return quoteAhkString(param.sendEscape ? escapeForSend(text) : text);
}

/** The `{x: 10, y: 20}` object literal a "coordinate" value is stored as in AHK. */
export function formatCoordinateLiteral(value: CoordinateLiteral): string {
  return `{x: ${Number(value.x ?? 0)}, y: ${Number(value.y ?? 0)}}`;
}

/** Formats a variable's initial value literal — handles "array" (an AHK Array() of quoted strings) and "coordinate" (an `{x, y}` object), delegating every other type to `formatAhkArgLiteral`. */
export function formatVariableInitialLiteral(type: VariableType, value: VariableInitialValue): string {
  if (type === "array") {
    const items = Array.isArray(value) ? value : [];
    return `[${items.map((item) => quoteAhkString(item)).join(", ")}]`;
  }
  if (type === "coordinate") {
    return formatCoordinateLiteral(toCoordinateLiteral(value));
  }
  return formatAhkArgLiteral({ key: "", label: "", type }, value as string | number | boolean);
}

/** The value a variable starts out with when its type is (re)chosen in a form. */
export function defaultVariableValue(type: VariableType): VariableInitialValue {
  if (type === "boolean") return false;
  if (type === "number") return 0;
  if (type === "array") return [];
  if (type === "coordinate") return { x: 0, y: 0 };
  return "";
}

/** Reads a stored initial value as a coordinate, falling back to the origin for values saved under another type. */
export function toCoordinateLiteral(value: VariableInitialValue): CoordinateLiteral {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? { x: Number(value.x ?? 0), y: Number(value.y ?? 0) }
    : { x: 0, y: 0 };
}

/**
 * The raw AHK identifier a non-literal argument source reads — a plain name, or `name.x` /
 * `name.y` when only one half of a coordinate variable is wanted.
 */
export function argSourceIdentifier(arg: ArgSource): string {
  if (arg.kind === "literal") return "";
  if (arg.kind === "headerParam") return arg.paramKey;
  return arg.component ? `${arg.variableName}.${arg.component}` : arg.variableName;
}

/**
 * The AHK expression a non-literal argument source evaluates to, with the user's math modifier
 * applied. Parenthesised so it stays a single operand wherever it's embedded.
 */
export function argSourceExpression(arg: ArgSource): string {
  const identifier = argSourceIdentifier(arg);
  const modifier = arg.kind === "literal" ? undefined : arg.modifier;
  return modifier ? `(${identifier} ${modifier.op} ${modifier.amount})` : identifier;
}

/**
 * Renders a call's argument list in `params` order. An argument sourced from a header
 * parameter or a variable (local or global) is emitted as that identifier's raw AHK name
 * (the enclosing function already holds the caller-supplied value in it); anything else is
 * formatted as a literal.
 */
export function formatAhkCallArgs(params: ParamDef[], args: ArgValues): string {
  return params
    .map((p) => {
      const arg = args[p.key];
      if (arg && arg.kind !== "literal") return argSourceExpression(arg);
      const value = arg?.kind === "literal" ? arg.value : p.type === "boolean" ? false : "";
      return formatAhkArgLiteral(p, value);
    })
    .join(", ");
}

/** Every distinct AHK identifier referenced as a `globalVariable` argument source across a set of steps' args — used to emit `global x, y` declarations. */
export function collectGlobalVariableRefs(argsList: ArgValues[]): Set<string> {
  const names = new Set<string>();
  for (const args of argsList) {
    for (const arg of Object.values(args)) {
      if (arg.kind === "globalVariable") names.add(arg.variableName);
    }
  }
  return names;
}
