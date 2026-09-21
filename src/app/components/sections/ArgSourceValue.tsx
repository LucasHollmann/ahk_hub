"use client";

import {
  MATH_OPERATORS,
  argModifier,
  withArgModifier,
  type ArgSource,
  type MathOperator,
} from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";

/**
 * Read-only display of where a non-literal argument comes from, plus the optional math
 * modifier applied to it (`+ 10`, `- 5`, ...) — offered wherever a variable or header
 * parameter is forwarded, so a value can be shifted without a separate step.
 */
export default function ArgSourceValue({
  arg,
  label,
  onChange,
  /** Modifiers only make sense for numeric values; hidden for booleans, key combos and pick-lists. */
  allowModifier = true,
}: {
  arg: ArgSource;
  label: string;
  onChange: (arg: ArgSource) => void;
  allowModifier?: boolean;
}) {
  const { t } = useTranslation();
  const modifier = argModifier(arg);

  return (
    <div className="flex flex-col gap-1.5 bg-menu-secondary rounded-lg px-3 py-2">
      <span className="text-sm opacity-70 italic">{label}</span>
      {allowModifier && (
        <div className="flex items-center gap-2">
          <label className="text-xs opacity-70">
            {t("stepArgsFields.modifierLabel", "Modificador")}
          </label>
          <select
            className="bg-menu-secondary/70 rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none font-mono"
            value={modifier?.op ?? ""}
            onChange={(e) =>
              onChange(
                withArgModifier(
                  arg,
                  e.target.value
                    ? { op: e.target.value as MathOperator, amount: modifier?.amount ?? 0 }
                    : undefined
                )
              )
            }
          >
            <option value="">{t("stepArgsFields.modifierNone", "nenhum")}</option>
            {MATH_OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          {modifier && (
            <input
              type="number"
              className="bg-menu-secondary/70 rounded px-2 py-1 outline-none text-xs w-24"
              value={modifier.amount}
              onChange={(e) =>
                onChange(withArgModifier(arg, { op: modifier.op, amount: Number(e.target.value) }))
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
