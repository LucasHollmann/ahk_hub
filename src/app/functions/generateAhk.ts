import type { FunctionEntry, Remapping } from "../components/types";
import type { FunctionMeta } from "./types";
import { comboToHotkey, comboToSendTarget, quoteAhkString, toUserFunctionName } from "./ahk";
import { AHK_HUB_HEADER, serializeStateComment } from "./serialize";

export function generateAhkScript(
  remappings: Remapping[],
  functions: FunctionEntry[]
): string {
  const usedBuiltins = new Map<string, FunctionMeta>();
  const usedCustomFunctions = new Set<string>();

  for (const { destination } of remappings) {
    if (destination.kind === "builtin" && destination.meta.toAhkDeclaration) {
      usedBuiltins.set(destination.meta.id, destination.meta);
    } else if (destination.kind === "customFunction") {
      usedCustomFunctions.add(destination.name);
    }
  }

  const lines: string[] = [
    AHK_HUB_HEADER,
    "#Requires AutoHotkey v2.0",
    "#SingleInstance Force",
    'SendMode "Input"',
    "",
  ];

  if (usedBuiltins.size > 0 || usedCustomFunctions.size > 0) {
    lines.push("; ==== Declaração das funções ====", "");

    for (const meta of usedBuiltins.values()) {
      lines.push(meta.toAhkDeclaration!());
      lines.push("");
    }

    for (const name of usedCustomFunctions) {
      const entry = functions.find((f) => f.name === name);
      lines.push(`${toUserFunctionName(name)}:`);
      lines.push(
        `; TODO: implementar "${name}"${entry?.description ? ` - ${entry.description}` : ""}`
      );
      lines.push("return");
      lines.push("");
    }
  }

  lines.push("; ==== Remapeamentos ====", "");

  for (const r of remappings) {
    const hotkey = comboToHotkey(r.from);
    const { destination } = r;

    if (destination.kind === "key") {
      lines.push(`${hotkey}::Send ${quoteAhkString(comboToSendTarget(destination.combo))}`);
    } else if (destination.kind === "builtin" && destination.meta.toAhkCall) {
      lines.push(`${hotkey}::${destination.meta.toAhkCall(destination.params)}`);
    } else if (destination.kind === "customFunction") {
      lines.push(`${hotkey}::Gosub ${toUserFunctionName(destination.name)}`);
    }

    lines.push("");
  }

  lines.push(...serializeStateComment(remappings, functions));

  return lines.join("\n");
}
