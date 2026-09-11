"use client";

import { useEffect, useRef, useState } from "react";
import KeyComboPicker from "./KeyComboPicker";
import ParamsFields from "./ParamsFields";
import StepArgsFields from "./StepArgsFields";
import FunctionPicker, { type FunctionPickerItem } from "./FunctionPicker";
import type { FunctionEntry, Remapping, RemappingTrigger } from "../types";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import {
  areArgsFilled,
  areParamsFilled,
  defaultArgValues,
  defaultParamValues,
  expandHeaderParamsToCallParams,
  getParamEntries,
  tFunctionCategoryLabel,
  tFunctionDescription,
  tFunctionName,
  type ArgSource,
  type ArgValues,
  type ParamEntry,
  type ParamValues,
} from "../../functions/types";
import { useTranslation, type Translate } from "../../i18n/I18nContext";

const DIRECT_BUILTIN_FUNCTIONS = BUILTIN_FUNCTIONS.filter((f) => f.usableDirectly);

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
  if (destination.kind === "builtin") return tFunctionName(t, destination.meta);
  return destination.name;
}

function triggerTagLabel(trigger: Remapping["trigger"], t: Translate): string | null {
  if (trigger === "up") return t("remappings.triggerUp", "Ao soltar");
  if (trigger === "down") return t("remappings.triggerDown", "Ao pressionar");
  return null;
}

function customFunctionEntries(
  destination: Extract<Remapping["destination"], { kind: "customFunction" }>,
  functions: FunctionEntry[]
): ParamEntry[] {
  const target = functions.find((f) => f.name === destination.name);
  if (!target) return [];
  return expandHeaderParamsToCallParams(target.params)
    .map((p) => {
      const arg = destination.args[p.key];
      if (!arg) return null;
      const value =
        arg.kind === "literal"
          ? String(arg.value)
          : arg.kind === "headerParam"
            ? arg.paramKey
            : arg.variableName;
      return { label: p.label, value };
    })
    .filter((e): e is ParamEntry => e !== null);
}

function RemappingItem({
  remapping,
  functions,
  onEdit,
  onRemove,
}: {
  remapping: Remapping;
  functions: FunctionEntry[];
  onEdit: (remapping: Remapping) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { destination } = remapping;
  const entries =
    destination.kind === "builtin"
      ? getParamEntries(destination.meta, destination.params, t)
      : destination.kind === "customFunction"
        ? customFunctionEntries(destination, functions)
        : [];

  return (
    <div className="bg-menu-secondary rounded-lg px-4 py-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          {remapping.from} → {destinationLabel(remapping, t)}
          {triggerTagLabel(remapping.trigger, t) && (
            <span className="text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 opacity-70">
              {triggerTagLabel(remapping.trigger, t)}
            </span>
          )}
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
  const [from, setFrom] = useState("");
  const [trigger, setTrigger] = useState<RemappingTrigger>("full");
  const [toFunction, setToFunction] = useState("");
  const [paramValues, setParamValues] = useState<ParamValues>({});
  const [toFunctionArgs, setToFunctionArgs] = useState<ArgValues>({});
  const [resetSignal, setResetSignal] = useState(0);
  const pendingEditParamsRef = useRef<{ metaId: string; values: ParamValues } | null>(null);
  const pendingEditArgsRef = useRef<{ functionName: string; args: ArgValues } | null>(null);

  const selectedBuiltin = DIRECT_BUILTIN_FUNCTIONS.find((f) => f.name === toFunction);
  const selectedCustomFunction = !selectedBuiltin
    ? functions.find((f) => f.name === toFunction)
    : undefined;
  const customCallParams = selectedCustomFunction
    ? expandHeaderParamsToCallParams(selectedCustomFunction.params)
    : [];

  const toFunctionPickerItems: FunctionPickerItem[] = [
    ...DIRECT_BUILTIN_FUNCTIONS.map((f) => ({
      value: f.name,
      label: tFunctionName(t, f),
      description: tFunctionDescription(t, f),
      group: tFunctionCategoryLabel(t, f.category),
    })),
    ...functions.map((f) => ({
      value: f.name,
      label: f.name,
      description: f.description || undefined,
      group: t("remappings.groupCustom", "Personalizadas"),
    })),
  ];

  useEffect(() => {
    if (selectedBuiltin && pendingEditParamsRef.current?.metaId === selectedBuiltin.id) {
      setParamValues(pendingEditParamsRef.current.values);
      pendingEditParamsRef.current = null;
    } else {
      setParamValues(selectedBuiltin ? defaultParamValues(selectedBuiltin) : {});
    }
  }, [selectedBuiltin]);

  useEffect(() => {
    if (selectedCustomFunction && pendingEditArgsRef.current?.functionName === selectedCustomFunction.name) {
      setToFunctionArgs(pendingEditArgsRef.current.args);
      pendingEditArgsRef.current = null;
    } else {
      setToFunctionArgs(selectedCustomFunction ? defaultArgValues(customCallParams) : {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomFunction]);

  const paramsFilled =
    (!selectedBuiltin || areParamsFilled(selectedBuiltin, paramValues)) &&
    (!selectedCustomFunction || areArgsFilled(customCallParams, toFunctionArgs));

  function resetForm() {
    setEditingId(null);
    setFromInitialValue(undefined);
    setTrigger("full");
    setToFunction("");
    setResetSignal((s) => s + 1);
  }

  function submitRemapping() {
    if (!from || !toFunction || !paramsFilled) return;

    const destination: Remapping["destination"] = selectedBuiltin
      ? { kind: "builtin", meta: selectedBuiltin, params: { ...paramValues } }
      : { kind: "customFunction", name: toFunction, args: { ...toFunctionArgs } };

    if (editingId !== null) {
      onUpdate(editingId, { from, destination, trigger });
    } else {
      onAdd({ from, destination, trigger });
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
    setTrigger(remapping.trigger);

    const { destination } = remapping;
    if (destination.kind === "builtin") {
      pendingEditParamsRef.current = {
        metaId: destination.meta.id,
        values: { ...destination.params },
      };
      setToFunction(destination.meta.name);
    } else {
      pendingEditArgsRef.current = {
        functionName: destination.name,
        args: { ...destination.args },
      };
      setToFunction(destination.name);
    }

    setResetSignal((s) => s + 1);
    setIsFormOpen(true);
  }

  function setParamValue(key: string, value: string | number | boolean) {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }

  function setToFunctionArg(key: string, arg: ArgSource) {
    setToFunctionArgs((prev) => ({ ...prev, [key]: arg }));
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
          {t("remappings.addRemapping", "Adicionar novo")}
          <svg
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
          >
            <line x1="8" y1="2.5" x2="8" y2="13.5" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
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
                <label className="text-sm">
                  {t("remappings.destFunction", "Função de destino")}
                </label>

                <FunctionPicker
                  items={toFunctionPickerItems}
                  value={toFunction}
                  onChange={setToFunction}
                  placeholder={t("remappings.selectFunction", "Selecione uma função")}
                  className="w-56"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm">{t("remappings.triggerLabel", "Disparar")}</label>
              <div className="flex gap-1 bg-menu-secondary rounded-md p-0.5 text-xs w-fit">
                <button
                  type="button"
                  className={`px-2.5 py-1.5 rounded outline-none focus:outline-none cursor-pointer ${
                    trigger === "full" ? "bg-(--main) text-white" : "opacity-60"
                  }`}
                  onClick={() => setTrigger("full")}
                >
                  {t("remappings.triggerFull", "Padrão")}
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1.5 rounded outline-none focus:outline-none cursor-pointer ${
                    trigger === "down" ? "bg-(--main) text-white" : "opacity-60"
                  }`}
                  onClick={() => setTrigger("down")}
                >
                  {t("remappings.triggerDown", "Ao pressionar")}
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1.5 rounded outline-none focus:outline-none cursor-pointer ${
                    trigger === "up" ? "bg-(--main) text-white" : "opacity-60"
                  }`}
                  onClick={() => setTrigger("up")}
                >
                  {t("remappings.triggerUp", "Ao soltar")}
                </button>
              </div>
              {trigger === "down" && (
                <span className="text-xs opacity-60">
                  {t(
                    "remappings.triggerDownHint",
                    "Executa uma vez ao pressionar e só permite disparar de novo depois de soltar a tecla."
                  )}
                </span>
              )}
              {trigger === "full" && (
                <span className="text-xs opacity-60">
                  {t(
                    "remappings.triggerFullHint",
                    "Remapeamento padrão — dispara ao pressionar e pode repetir se a tecla ficar segurada."
                  )}
                </span>
              )}
            </div>

            {selectedBuiltin && selectedBuiltin.params.length > 0 && (
              <ParamsFields
                meta={selectedBuiltin}
                values={paramValues}
                onChange={setParamValue}
                resetSignal={resetSignal}
              />
            )}

            {selectedCustomFunction && customCallParams.length > 0 && (
              <StepArgsFields
                params={customCallParams}
                headerParams={[]}
                values={toFunctionArgs}
                onChange={setToFunctionArg}
                resetSignal={resetSignal}
                title={t("paramsFields.title", "Parâmetros de {{name}}", {
                  name: selectedCustomFunction.name,
                })}
              />
            )}

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeForm}>
                {t("remappings.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!from || !toFunction || !paramsFilled}
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
          <RemappingItem
            key={r.id}
            remapping={r}
            functions={functions}
            onEdit={startEdit}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
