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

export function comboToSendTarget(combo: string): string {
  const { modifiers, key } = splitCombo(combo);
  if (modifiers.length === 0 && key in STANDALONE_KEY_NAMES) {
    return `{${STANDALONE_KEY_NAMES[key]}}`;
  }
  const symbols = modifiers.map((m) => MODIFIER_SYMBOLS[m] ?? "").join("");
  const keyPart = key.length > 1 ? `{${key}}` : key.toLowerCase();
  return `${symbols}${keyPart}`;
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
