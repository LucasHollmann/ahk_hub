"use client";

import { useState } from "react";
import type { GlobalVariable, VariableType } from "../types";
import { isValidAhkIdentifier } from "../../functions/ahk";
import { useTranslation } from "../../i18n/I18nContext";

type Props = {
  variables: GlobalVariable[];
  onAddVariable: (variable: Omit<GlobalVariable, "id">) => void;
  onUpdateVariable: (id: number, variable: Omit<GlobalVariable, "id">) => void;
  onRemoveVariable: (id: number) => void;
};

function defaultValueFor(type: VariableType): string | number | boolean {
  return type === "boolean" ? false : type === "number" ? 0 : "";
}

function ValueField({
  type,
  value,
  onChange,
}: {
  type: VariableType;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  const { t } = useTranslation();
  if (type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none h-9">
        <span className="relative flex items-center justify-center">
          <input
            type="checkbox"
            className="peer appearance-none w-4 h-4 rounded border border-white/25 bg-transparent checked:bg-(--main) checked:border-(--main) transition-colors"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <svg
            viewBox="0 0 16 16"
            className="absolute w-3 h-3 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity"
            fill="none"
          >
            <path
              d="M3 8.5L6.5 12L13 4.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {t("variablesSection.trueLabel", "Verdadeiro")}
      </label>
    );
  }
  return (
    <input
      type={type === "number" ? "number" : "text"}
      className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
      value={String(value)}
      onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
    />
  );
}

function variableTypeLabel(t: ReturnType<typeof useTranslation>["t"], type: VariableType): string {
  return type === "text"
    ? t("functionsSection.paramTypeText", "Texto")
    : type === "number"
      ? t("functionsSection.paramTypeNumber", "Número")
      : t("functionsSection.paramTypeBoolean", "Booleano");
}

export default function VariablesSection({
  variables,
  onAddVariable,
  onUpdateVariable,
  onRemoveVariable,
}: Props) {
  const { t } = useTranslation();

  const [isVarFormOpen, setIsVarFormOpen] = useState(false);
  const [editingVarId, setEditingVarId] = useState<number | null>(null);
  const [varName, setVarName] = useState("");
  const [varType, setVarType] = useState<VariableType>("text");
  const [varInitialValue, setVarInitialValue] = useState<string | number | boolean>("");

  const trimmedVarName = varName.trim();

  function resetVarForm() {
    setEditingVarId(null);
    setVarName("");
    setVarType("text");
    setVarInitialValue("");
  }

  function openNewVarForm() {
    resetVarForm();
    setIsVarFormOpen(true);
  }

  function closeVarForm() {
    resetVarForm();
    setIsVarFormOpen(false);
  }

  function startEditVar(variable: GlobalVariable) {
    setEditingVarId(variable.id);
    setVarName(variable.name);
    setVarType(variable.type);
    setVarInitialValue(variable.initialValue);
    setIsVarFormOpen(true);
  }

  function submitVariable() {
    if (!isValidAhkIdentifier(trimmedVarName)) return;
    if (variables.some((v) => v.name === trimmedVarName && v.id !== editingVarId)) return;

    const entry = { name: trimmedVarName, type: varType, initialValue: varInitialValue };
    if (editingVarId !== null) {
      onUpdateVariable(editingVarId, entry);
    } else {
      onAddVariable(entry);
    }
    closeVarForm();
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold opacity-80">
          {t("variablesSection.variablesTitle", "Variáveis globais")}
        </span>
        <button className="button-secondary flex items-center gap-1.5" onClick={openNewVarForm}>
          {t("variablesSection.addVariable", "Adicionar nova")}
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor">
            <line x1="8" y1="2.5" x2="8" y2="13.5" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <p className="opacity-60 text-xs">
        {t(
          "variablesSection.hint",
          "Também dá para criar uma variável global direto de dentro de uma função, na aba Funções — ela aparece aqui também."
        )}
      </p>

      <div className="flex flex-col gap-2 overflow-auto">
        {variables.length === 0 && (
          <p className="opacity-60 text-sm">
            {t("variablesSection.emptyVariables", "Nenhuma variável cadastrada.")}
          </p>
        )}
        {variables.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between bg-menu-secondary rounded-lg px-4 py-2"
          >
            <div className="flex flex-col">
              <span className="font-semibold font-mono text-sm">{v.name}</span>
              <span className="text-xs opacity-70">
                {variableTypeLabel(t, v.type)} · {t("variablesSection.initialValue", "valor inicial")}:{" "}
                {v.type === "boolean" ? (v.initialValue ? "true" : "false") : String(v.initialValue)}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary py-1 px-3 text-sm" onClick={() => startEditVar(v)}>
                {t("functionsSection.edit", "Editar")}
              </button>
              <button
                className="button-secondary py-1 px-3 text-sm"
                onClick={() => onRemoveVariable(v.id)}
              >
                {t("functionsSection.remove", "Remover")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isVarFormOpen && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50"
          onMouseDown={closeVarForm}
        >
          <div
            className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-sm"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold">
              {editingVarId !== null
                ? t("variablesSection.editVariable", "Editar variável")
                : t("variablesSection.newVariable", "Nova variável")}
            </span>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-70">{t("variablesSection.nameLabel", "Nome")}</label>
              <input
                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full"
                value={varName}
                onChange={(e) => setVarName(e.target.value)}
                placeholder={t("variablesSection.namePlaceholder", "Ex: contador")}
                autoFocus
              />
              {trimmedVarName !== "" && !isValidAhkIdentifier(trimmedVarName) && (
                <span className="text-xs text-red-400">
                  {t(
                    "functionsSection.invalidName",
                    "Nome inválido: use apenas letras, números e _, sem começar com número."
                  )}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-70">{t("variablesSection.typeLabel", "Tipo")}</label>
              <select
                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 appearance-none"
                value={varType}
                onChange={(e) => {
                  const nextType = e.target.value as VariableType;
                  setVarType(nextType);
                  setVarInitialValue(defaultValueFor(nextType));
                }}
              >
                <option value="text">{t("functionsSection.paramTypeText", "Texto")}</option>
                <option value="number">{t("functionsSection.paramTypeNumber", "Número")}</option>
                <option value="boolean">{t("functionsSection.paramTypeBoolean", "Booleano")}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-70">
                {t("variablesSection.initialValueLabel", "Valor inicial")}
              </label>
              <ValueField type={varType} value={varInitialValue} onChange={setVarInitialValue} />
            </div>

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeVarForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={
                  !isValidAhkIdentifier(trimmedVarName) ||
                  variables.some((v) => v.name === trimmedVarName && v.id !== editingVarId)
                }
                onClick={submitVariable}
              >
                {editingVarId !== null
                  ? t("functionsSection.save", "Salvar")
                  : t("functionsSection.add", "Adicionar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
