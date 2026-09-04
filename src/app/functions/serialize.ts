import type { FunctionEntry, Remapping, RemappingDestination } from "../components/types";
import { BUILTIN_FUNCTIONS } from "./builtins";
import type { ParamValues } from "./types";

export const AHK_HUB_HEADER = "; Gerado automaticamente pelo AHK Hub (AutoHotkey v2)";
const STATE_BEGIN = "; === AHK_HUB_STATE_BEGIN ===";
const STATE_END = "; === AHK_HUB_STATE_END ===";

type SerializedDestination =
  | { kind: "key"; combo: string }
  | { kind: "builtin"; functionId: string; params: ParamValues }
  | { kind: "customFunction"; name: string };

type SerializedRemapping = {
  id: number;
  from: string;
  destination: SerializedDestination;
};

type SerializedState = {
  remappings: SerializedRemapping[];
  functions: FunctionEntry[];
};

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function serializeDestination(destination: RemappingDestination): SerializedDestination {
  if (destination.kind === "builtin") {
    return {
      kind: "builtin",
      functionId: destination.meta.id,
      params: destination.params,
    };
  }
  return destination;
}

/** Appends a hidden, machine-readable snapshot of the app state as an AHK comment block. */
export function serializeStateComment(
  remappings: Remapping[],
  functions: FunctionEntry[]
): string[] {
  const state: SerializedState = {
    remappings: remappings.map((r) => ({
      id: r.id,
      from: r.from,
      destination: serializeDestination(r.destination),
    })),
    functions,
  };

  const encoded = toBase64(JSON.stringify(state));
  return [STATE_BEGIN, `; ${encoded}`, STATE_END];
}

export type ParseResult =
  | { ok: true; remappings: Remapping[]; functions: FunctionEntry[] }
  | { ok: false; error: string };

export function parseAhkScript(content: string): ParseResult {
  if (!content.includes(AHK_HUB_HEADER)) {
    return { ok: false, error: "cabeçalho do AHK Hub não encontrado" };
  }

  const beginIndex = content.indexOf(STATE_BEGIN);
  const endIndex = content.indexOf(STATE_END);
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    return { ok: false, error: "bloco de dados do AHK Hub não encontrado" };
  }

  const block = content.slice(beginIndex + STATE_BEGIN.length, endIndex);
  const encodedLine = block
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(";") && line.length > 1);

  if (!encodedLine) {
    return { ok: false, error: "dados codificados ausentes" };
  }

  const encoded = encodedLine.replace(/^;\s*/, "");

  let state: SerializedState;
  try {
    state = JSON.parse(fromBase64(encoded));
  } catch {
    return { ok: false, error: "dados corrompidos" };
  }

  if (!state || !Array.isArray(state.remappings) || !Array.isArray(state.functions)) {
    return { ok: false, error: "formato de dados inválido" };
  }

  const remappings: Remapping[] = [];
  for (const r of state.remappings) {
    if (!r || typeof r.id !== "number" || typeof r.from !== "string" || !r.destination) {
      return { ok: false, error: "remapeamento inválido" };
    }

    const destination = r.destination;
    if (destination.kind === "key" && typeof destination.combo === "string") {
      remappings.push({ id: r.id, from: r.from, destination: { kind: "key", combo: destination.combo } });
    } else if (destination.kind === "customFunction" && typeof destination.name === "string") {
      remappings.push({
        id: r.id,
        from: r.from,
        destination: { kind: "customFunction", name: destination.name },
      });
    } else if (destination.kind === "builtin" && typeof destination.functionId === "string") {
      const meta = BUILTIN_FUNCTIONS.find((f) => f.id === destination.functionId);
      if (!meta) {
        return { ok: false, error: `função desconhecida "${destination.functionId}"` };
      }
      remappings.push({
        id: r.id,
        from: r.from,
        destination: { kind: "builtin", meta, params: destination.params ?? {} },
      });
    } else {
      return { ok: false, error: "tipo de destino desconhecido" };
    }
  }

  const functions: FunctionEntry[] = [];
  for (const f of state.functions) {
    if (!f || typeof f.id !== "number" || typeof f.name !== "string") {
      return { ok: false, error: "função personalizada inválida" };
    }
    functions.push({ id: f.id, name: f.name, description: String(f.description ?? "") });
  }

  return { ok: true, remappings, functions };
}
