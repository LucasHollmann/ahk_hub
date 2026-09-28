"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ConditionValue } from "../types";
import type { HeaderParamDef } from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";
import ConditionFields from "./ConditionFields";

type Props = {
  conditions: ConditionValue[];
  onChange: Dispatch<SetStateAction<ConditionValue[]>>;
  headerParams: HeaderParamDef[];
  localVariables: HeaderParamDef[];
  globalVariables: HeaderParamDef[];
  allowEmpty?: boolean;
};

export default function ConditionsEditor({
  conditions,
  onChange,
  headerParams,
  localVariables,
  globalVariables,
  allowEmpty = false,
}: Props) {
  const { t } = useTranslation();

  function updateCondition(index: number, update: SetStateAction<ConditionValue>) {
    onChange((previous) =>
      previous.map((condition, conditionIndex) =>
        conditionIndex === index
          ? typeof update === "function"
            ? update(condition)
            : update
          : condition
      )
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {conditions.map((condition, index) => (
        <div key={index} className="flex flex-col gap-2">
          {index > 0 && (
            <span className="text-xs font-semibold uppercase opacity-60">
              {t("functionsSection.conditionAnd", "E")}
            </span>
          )}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ConditionFields
                condition={condition}
                onChange={(update) => updateCondition(index, update)}
                headerParams={headerParams}
                localVariables={localVariables}
                globalVariables={globalVariables}
              />
            </div>
            {(allowEmpty || conditions.length > 1) && (
              <button
                type="button"
                className="button-secondary shrink-0 px-2 py-1 text-xs"
                onClick={() => onChange((previous) => previous.filter((_, conditionIndex) => conditionIndex !== index))}
              >
                {t("functionsSection.conditionRemove", "Remover")}
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="button-secondary self-start px-2.5 py-1.5 text-xs"
        onClick={() => onChange((previous) => [...previous, { kind: "code", code: "" }])}
      >
        {t("functionsSection.conditionAdd", "Adicionar condição")}
      </button>
    </div>
  );
}
