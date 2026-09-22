import type { FunctionEntry, GlobalVariable, Remapping } from "../components/types";
import {
  collectAllGuiVariablesAcrossFunctions,
  collectAllRadialVariablesAcrossFunctions,
} from "../components/sections/stepTypes";
import { radialSelectorDeclarations } from "./radialSelector";
import { expandHeaderParamsToCallParams, type FunctionMeta } from "./types";
import { BUILTIN_FUNCTIONS } from "./builtins";
import { BUILTIN_CONDITIONS } from "./conditions";
import {
  comboToHotkey,
  comboToKeyWaitName,
  formatAhkCallArgs,
  formatVariableInitialLiteral,
  toConditionFunctionName,
  toSystemFunctionName,
} from "./ahk";
import { AHK_HUB_HEADER, serializeStateComment } from "./serialize";

function referencesCall(code: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*\\(`).test(code);
}

/**
 * A custom function's code can itself call builtins or other custom functions
 * (via the step builder or hand-written code), so usage has to be resolved
 * transitively from the remapping entry points rather than just read off them.
 */
function collectUsedFunctions(remappings: Remapping[], functions: FunctionEntry[]) {
  const usedBuiltins = new Map<string, FunctionMeta>();
  const usedCustomFunctions = new Set<string>();

  for (const { destination } of remappings) {
    if (destination.kind === "builtin" && destination.meta.toAhkDeclaration) {
      usedBuiltins.set(destination.meta.id, destination.meta);
    } else if (destination.kind === "customFunction") {
      usedCustomFunctions.add(destination.name);
    }
  }

  const queue = [...usedCustomFunctions];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const name = queue.pop()!;
    if (processed.has(name)) continue;
    processed.add(name);

    const entry = functions.find((f) => f.name === name);
    if (!entry?.code) continue;

    for (const meta of BUILTIN_FUNCTIONS) {
      if (!meta.toAhkDeclaration || usedBuiltins.has(meta.id)) continue;
      if (referencesCall(entry.code, toSystemFunctionName(meta.name))) {
        usedBuiltins.set(meta.id, meta);
      }
    }

    for (const meta of BUILTIN_CONDITIONS) {
      if (!meta.toAhkDeclaration || usedBuiltins.has(meta.id)) continue;
      if (referencesCall(entry.code, toConditionFunctionName(meta.name))) {
        usedBuiltins.set(meta.id, meta);
      }
    }

    for (const other of functions) {
      if (usedCustomFunctions.has(other.name)) continue;
      if (referencesCall(entry.code, other.name)) {
        usedCustomFunctions.add(other.name);
        queue.push(other.name);
      }
    }
  }

  return { usedBuiltins, usedCustomFunctions };
}

export function generateAhkScript(
  remappings: Remapping[],
  functions: FunctionEntry[],
  variables: GlobalVariable[] = []
): string {
  const { usedBuiltins, usedCustomFunctions } = collectUsedFunctions(remappings, functions);

  const lines: string[] = [
    AHK_HUB_HEADER,
    "#Requires AutoHotkey v2.0",
    "#SingleInstance Force",
    'SendMode "Input"',
    "",
  ];

  if (variables.length > 0) {
    lines.push("; ==== Variáveis globais ====", "");
    for (const v of variables) {
      lines.push(`${v.name} := ${formatVariableInitialLiteral(v.type, v.initialValue)}`);
    }
    lines.push("");
  }

  const guiVariableNames = [...new Set(collectAllGuiVariablesAcrossFunctions(functions).map((v) => v.key))];
  if (guiVariableNames.length > 0) {
    lines.push(
      "; ==== Variáveis globais de Gui (pré-declaradas para poderem ser usadas antes de \"Criar Gui\" rodar) ====",
      ""
    );
    for (const name of guiVariableNames) {
      lines.push(`${name} := ""`);
    }
    lines.push("");
  }

  const radialVariableNames = [
    ...new Set(collectAllRadialVariablesAcrossFunctions(functions).map((v) => v.key)),
  ];
  if (radialVariableNames.length > 0) {
    lines.push(
      "; ==== Variáveis globais de seletor circular (pré-declaradas para poderem ser fechadas por outra função) ====",
      ""
    );
    for (const name of radialVariableNames) {
      lines.push(`${name} := ""`);
    }
    lines.push("");
  }

  if (usedBuiltins.size > 0 || usedCustomFunctions.size > 0 || radialVariableNames.length > 0) {
    lines.push("; ==== Declaração das funções ====", "");

    // Not a builtin, so it isn't reached by the usage walk above: the helpers are emitted
    // whenever any function's steps arm a selector at all.
    if (radialVariableNames.length > 0) {
      for (const declaration of radialSelectorDeclarations()) {
        lines.push(declaration, "");
      }
    }

    for (const meta of usedBuiltins.values()) {
      lines.push(meta.toAhkDeclaration!());
      lines.push("");
    }

    // Declared in the order the Functions tab lists them, which the user controls by
    // dragging, rather than in the order the dependency walk happened to discover them.
    // Only the first entry of a given name is emitted: AHK rejects a duplicate definition,
    // and everything else here resolves a name to that same first entry.
    const declared = new Set<string>();
    for (const entry of functions) {
      if (!usedCustomFunctions.has(entry.name) || declared.has(entry.name)) continue;
      declared.add(entry.name);
      lines.push(entry.code?.trim() || `; TODO: implementar "${entry.name}"`);
      lines.push("");
    }

    // Names reached from a remapping that no longer have an entry at all.
    for (const name of usedCustomFunctions) {
      if (declared.has(name)) continue;
      lines.push(`; TODO: implementar "${name}"`, "");
    }
  }

  lines.push("; ==== Remapeamentos ====", "");

  for (const r of remappings) {
    const hotkey = comboToHotkey(r.from);
    const { destination } = r;

    let callExpr: string | null = null;
    if (destination.kind === "builtin" && destination.meta.toAhkCall) {
      callExpr = destination.meta.toAhkCall(destination.params);
    } else if (destination.kind === "customFunction") {
      const targetParams = expandHeaderParamsToCallParams(
        functions.find((f) => f.name === destination.name)?.params ?? []
      );
      const argsStr = targetParams.length > 0 ? formatAhkCallArgs(targetParams, destination.args) : "";
      callExpr = `${destination.name}(${argsStr})`;
    }

    if (callExpr) {
      if (r.trigger === "up") {
        lines.push(`${hotkey} Up::${callExpr}`);
      } else if (r.trigger === "down") {
        // Fires once for the press, then blocks re-firing (e.g. from OS key-repeat while held)
        // until the physical key is released — as opposed to "full", the plain default remap.
        lines.push(`${hotkey}::`, "{", `    ${callExpr}`, `    KeyWait "${comboToKeyWaitName(r.from)}"`, "}");
      } else {
        lines.push(`${hotkey}::${callExpr}`);
      }
    }

    lines.push("");
  }

  lines.push(...serializeStateComment(remappings, functions, variables));

  return lines.join("\n");
}
