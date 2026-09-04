"use client";

import { useEffect, useRef, useState } from "react";
import KeyComboPicker from "./KeyComboPicker";
import ParamsFields from "./ParamsFields";
import type { FunctionEntry, Remapping } from "../types";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import {
  getParamEntries,
  tFunctionName,
  type FunctionMeta,
  type ParamValues,
} from "../../functions/types";
import { useTranslation, type Translate } from "../../i18n/I18nContext";

const DIRECT_BUILTIN_FUNCTIONS = BUILTIN_FUNCTIONS.filter((f) => f.usableDirectly);

function defaultParamValues(meta: FunctionMeta): ParamValues {
  const values: ParamValues = {};
  for (const param of meta.params) {
    values[param.key] = param.type === "boolean" ? false : "";
  }
  return values;
}

type DestinationType = "key" | "function";

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-3 h-3 opacity-70"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="8" cy="8" r="6.5" strokeWidth="1.2" />
      <line x1="8" y1="7.2" x2="8" y2="11" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
    >
      <path d="M6 3.5L10.5 8L6 12.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function destinationLabel(remapping: Remapping, t: Translate) {
  const { destination } = remapping;
  if (destination.kind === "key") return destination.combo;
  if (destination.kind === "builtin") return tFunctionName(t, destination.meta);
  return destination.name;
}

function RemappingItem({
  remapping,
  onEdit,
  onRemove,
}: {
  remapping: Remapping;
  onEdit: (remapping: Remapping) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { destination } = remapping;
  const entries =
    destination.kind === "builtin"
      ? getParamEntries(destination.meta, destination.params, t)
      : [];

  return (
    <div className="bg-menu-secondary rounded-lg px-4 py-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span>
          {remapping.from} → {destinationLabel(remapping, t)}
        </span>
        <div className="flex gap-2">
          <button
            className="button-secondary py-1 px-3 text-sm"
            onClick={() => onEdit(remapping)}
          >
            {t("remappings.edit", "Editar")}
          </button>
          <button
            className="button-secondary py-1 px-3 text-sm"
            onClick={() => onRemove(remapping.id)}
          >
            {t("remappings.remove", "Remover")}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 cursor-pointer"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            <ChevronIcon expanded={isExpanded} />
            {t("remappings.params", "Parâmetros")}
          </button>

          {isExpanded && (
            <table className="mt-1 text-xs w-full max-w-xs border-collapse">
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.label} className="border-t border-white/10">
                    <td className="py-1 pr-3 opacity-70 whitespace-nowrap">
                      {entry.label}
                    </td>
                    <td className="py-1">{entry.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  functions: FunctionEntry[];
  remappings: Remapping[];
  onAdd: (remapping: Omit<Remapping, "id">) => void;
  onUpdate: (id: number, remapping: Omit<Remapping, "id">) => void;
  onRemove: (id: number) => void;
};

export default function RemappingsSection({
  functions,
  remappings,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fromInitialValue, setFromInitialValue] = useState<string | undefined>();
  const [toKeyInitialValue, setToKeyInitialValue] = useState<string | undefined>();
  const [from, setFrom] = useState("");
  const [destinationType, setDestinationType] = useState<DestinationType>("key");
  const [toKey, setToKey] = useState("");
  const [toFunction, setToFunction] = useState("");
  const [paramValues, setParamValues] = useState<ParamValues>({});
  const [resetSignal, setResetSignal] = useState(0);
  const pendingEditParamsRef = useRef<{ metaId: string; values: ParamValues } | null>(null);

  const selectedBuiltin = DIRECT_BUILTIN_FUNCTIONS.find((f) => f.name === toFunction);

  useEffect(() => {
    if (selectedBuiltin && pendingEditParamsRef.current?.metaId === selectedBuiltin.id) {
      setParamValues(pendingEditParamsRef.current.values);
      pendingEditParamsRef.current = null;
    } else {
      setParamValues(selectedBuiltin ? defaultParamValues(selectedBuiltin) : {});
    }
  }, [selectedBuiltin]);

  const to = destinationType === "key" ? toKey : toFunction;

  const paramsFilled =
    !selectedBuiltin ||
    selectedBuiltin.params.every((p) =>
      p.type === "boolean" || p.optional
        ? true
        : String(paramValues[p.key] ?? "").trim() !== ""
    );

  function resetForm() {
    setEditingId(null);
    setFromInitialValue(undefined);
    setToKeyInitialValue(undefined);
    setDestinationType("key");
    setToFunction("");
    setResetSignal((s) => s + 1);
  }

  function submitRemapping() {
    if (!from || !to || !paramsFilled) return;

    let destination: Remapping["destination"];
    if (destinationType === "key") {
      destination = { kind: "key", combo: toKey };
    } else if (selectedBuiltin) {
      destination = { kind: "builtin", meta: selectedBuiltin, params: { ...paramValues } };
    } else {
      destination = { kind: "customFunction", name: toFunction };
    }

    if (editingId !== null) {
      onUpdate(editingId, { from, destination });
    } else {
      onAdd({ from, destination });
    }

    resetForm();
    setIsFormOpen(false);
  }

  function openNewForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setIsFormOpen(false);
  }

  function startEdit(remapping: Remapping) {
    setEditingId(remapping.id);
    setFromInitialValue(remapping.from);

    const { destination } = remapping;
    if (destination.kind === "key") {
      setDestinationType("key");
      setToKeyInitialValue(destination.combo);
      setToFunction("");
    } else if (destination.kind === "builtin") {
      setDestinationType("function");
      pendingEditParamsRef.current = {
        metaId: destination.meta.id,
        values: { ...destination.params },
      };
      setToKeyInitialValue(undefined);
      setToFunction(destination.meta.name);
    } else {
      setDestinationType("function");
      setToKeyInitialValue(undefined);
      setToFunction(destination.name);
    }

    setResetSignal((s) => s + 1);
    setIsFormOpen(true);
  }

  function setParamValue(key: string, value: string | number | boolean) {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold opacity-80">
          {t("remappings.sectionTitle", "Remapeamentos")}
        </span>
        <button
          className="button-secondary flex items-center gap-1.5"
          onClick={openNewForm}
        >
          <svg
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
          >
            <line x1="8" y1="2.5" x2="8" y2="13.5" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {t("remappings.addRemapping", "Adicionar novo")}
        </button>
      </div>

      {isFormOpen && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50"
          onMouseDown={closeForm}
        >
          <div
            className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold">
              {editingId !== null
                ? t("remappings.editTitle", "Editar remapeamento")
                : t("remappings.newTitle", "Novo remapeamento")}
            </span>

            <div className="flex gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-sm">{t("remappings.sourceKey", "Tecla de origem")}</label>
                <KeyComboPicker
                  resetSignal={resetSignal}
                  initialValue={fromInitialValue}
                  onChange={setFrom}
                />
              </div>

              <span className="pb-2 opacity-60">→</span>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm">
                    {destinationType === "key"
                      ? t("remappings.destKey", "Tecla de destino")
                      : t("remappings.destFunction", "Função de destino")}
                  </label>
                  <div className="flex gap-1 bg-menu-secondary rounded-md p-0.5 text-xs">
                    <button
                      type="button"
                      title={t(
                        "remappings.tabKeyTooltip",
                        "Remapeamento simples, tecla para tecla (1 para 1)"
                      )}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded outline-none focus:outline-none cursor-pointer ${
                        destinationType === "key"
                          ? "bg-(--main) text-white"
                          : "opacity-60"
                      }`}
                      onClick={() => setDestinationType("key")}
                    >
                      {t("remappings.tabKey", "Tecla")}
                      <InfoIcon />
                    </button>
                    <button
                      type="button"
                      title={t(
                        "remappings.tabFunctionTooltip",
                        "Remapeamento complexo: executa uma função com múltiplos passos, condicionais, etc."
                      )}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded outline-none focus:outline-none cursor-pointer ${
                        destinationType === "function"
                          ? "bg-(--main) text-white"
                          : "opacity-60"
                      }`}
                      onClick={() => setDestinationType("function")}
                    >
                      {t("remappings.tabFunction", "Função")}
                      <InfoIcon />
                    </button>
                  </div>
                </div>

                {destinationType === "key" ? (
                  <KeyComboPicker
                    resetSignal={resetSignal}
                    initialValue={toKeyInitialValue}
                    onChange={setToKey}
                  />
                ) : (
                  <select
                    className="bg-menu-secondary rounded-lg px-3 py-2 outline-none cursor-pointer w-56 h-10 appearance-none"
                    value={toFunction}
                    onChange={(e) => setToFunction(e.target.value)}
                  >
                    <option value="">{t("remappings.selectFunction", "Selecione uma função")}</option>
                    <optgroup label={t("remappings.groupDefault", "Padrão")}>
                      {DIRECT_BUILTIN_FUNCTIONS.map((f) => (
                        <option key={f.id} value={f.name}>
                          {tFunctionName(t, f)}
                        </option>
                      ))}
                    </optgroup>
                    {functions.length > 0 && (
                      <optgroup label={t("remappings.groupCustom", "Personalizadas")}>
                        {functions.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>
            </div>

            {selectedBuiltin && selectedBuiltin.params.length > 0 && (
              <ParamsFields meta={selectedBuiltin} values={paramValues} onChange={setParamValue} />
            )}

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeForm}>
                {t("remappings.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!from || !to || !paramsFilled}
                onClick={submitRemapping}
              >
                {editingId !== null ? t("remappings.save", "Salvar") : t("remappings.add", "Adicionar")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 overflow-auto">
        {remappings.length === 0 && (
          <p className="opacity-60 text-sm">
            {t("remappings.emptyList", "Nenhum remapeamento cadastrado.")}
          </p>
        )}
        {remappings.map((r) => (
          <RemappingItem key={r.id} remapping={r} onEdit={startEdit} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
