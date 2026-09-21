"use client";

import { useState } from "react";
import type { CoordinateLiteral, GlobalVariable, VariableInitialValue, VariableType } from "../types";
import {
  defaultVariableValue,
  isValidAhkIdentifier,
  toCoordinateLiteral,
} from "../../functions/ahk";
import { useTranslation } from "../../i18n/I18nContext";
import { CoordinateLiteralFields } from "./CoordinateFields";

type Props = {
  variables: GlobalVariable[];
  onAddVariable: (variable: Omit<GlobalVariable, "id">) => void;
  onUpdateVariable: (id: number, variable: Omit<GlobalVariable, "id">) => void;
  onRemoveVariable: (id: number) => void;
};

function ArrayValueField({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const { t } = useTranslation();
  const [newItem, setNewItem] = useState("");

  function addItem() {
    const value = newItem.trim();
    if (!value) return;
    onChange([...items, value]);
    setNewItem("");
  }

  return (
    <div className="flex flex-col gap-1.5 bg-menu-secondary/60 rounded-lg p-2">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-center gap-1 bg-menu-secondary rounded px-2 py-1 text-xs"
            >
              {item}
              <button
                type="button"
                className="opacity-60 hover:opacity-100 cursor-pointer"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className="bg-menu-secondary rounded-lg px-2 py-1.5 outline-none text-sm flex-1"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={t("functionsSection.paramOptionPlaceholder", "Ex: Rápido")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <button
          type="button"
          className="button-secondary py-1 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!newItem.trim()}
          onClick={addItem}
        >
          {t("functionsSection.addParamOption", "Adicionar opção")}
        </button>
      </div>
    </div>
  );
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
      : type === "boolean"
        ? t("functionsSection.paramTypeBoolean", "Booleano")
        : type === "coordinate"
          ? t("functionsSection.paramTypeCoordinate", "Coordenada na tela")
          : t("functionsSection.paramTypeArray", "Array");
}

/** How a variable's initial value reads in the list — an array's items, a coordinate's pair, or the plain value. */
function initialValueLabel(variable: GlobalVariable): string {
  if (variable.type === "boolean") return variable.initialValue ? "true" : "false";
  if (Array.isArray(variable.initialValue)) return `[${variable.initialValue.join(", ")}]`;
  if (variable.type === "coordinate") {
    const point = toCoordinateLiteral(variable.initialValue);
    return `(${point.x}, ${point.y})`;
  }
  return String(variable.initialValue);
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
  const [varInitialValue, setVarInitialValue] = useState<VariableInitialValue>("");

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
                {initialValueLabel(v)}
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
                  setVarInitialValue(defaultVariableValue(nextType));
                }}
              >
                <option value="text">{t("functionsSection.paramTypeText", "Texto")}</option>
                <option value="number">{t("functionsSection.paramTypeNumber", "Número")}</option>
                <option value="boolean">{t("functionsSection.paramTypeBoolean", "Booleano")}</option>
                <option value="array">{t("functionsSection.paramTypeArray", "Array")}</option>
                <option value="coordinate">
                  {t("functionsSection.paramTypeCoordinate", "Coordenada na tela")}
                </option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-70">
                {varType === "array"
                  ? t("variablesSection.arrayItemsLabel", "Itens iniciais do array")
                  : t("variablesSection.initialValueLabel", "Valor inicial")}
              </label>
              {varType === "array" ? (
                <ArrayValueField
                  items={Array.isArray(varInitialValue) ? varInitialValue : []}
                  onChange={setVarInitialValue}
                />
              ) : varType === "coordinate" ? (
                <CoordinateLiteralFields
                  value={toCoordinateLiteral(varInitialValue)}
                  onChange={(point: CoordinateLiteral) => setVarInitialValue(point)}
                />
              ) : (
                <ValueField type={varType} value={varInitialValue as string | number | boolean} onChange={setVarInitialValue} />
              )}
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
