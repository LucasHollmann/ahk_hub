"use client";

import { useEffect, useState } from "react";
import KeyComboPicker from "./KeyComboPicker";
import ParamsModal from "./ParamsModal";
import type { FunctionEntry } from "../types";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import type { FunctionMeta, ParamValues } from "../../functions/types";

type Remapping = {
  id: number;
  from: string;
  to: string;
};

function defaultParamValues(meta: FunctionMeta): ParamValues {
  const values: ParamValues = {};
  for (const param of meta.params) {
    values[param.key] = param.type === "boolean" ? false : "";
  }
  return values;
}

function formatFunctionCall(meta: FunctionMeta, values: ParamValues) {
  const args = meta.params.map((param) => {
    const value = values[param.key];
    if (param.type === "boolean") return value ? "Sim" : "Não";
    return String(value);
  });
  return `${meta.name}(${args.join(", ")})`;
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

type Props = {
  functions: FunctionEntry[];
};

export default function RemappingsSection({ functions }: Props) {
  const [remappings, setRemappings] = useState<Remapping[]>([]);
  const [from, setFrom] = useState("");
  const [destinationType, setDestinationType] = useState<DestinationType>("key");
  const [toKey, setToKey] = useState("");
  const [toFunction, setToFunction] = useState("");
  const [paramValues, setParamValues] = useState<ParamValues>({});
  const [isParamsModalOpen, setIsParamsModalOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const selectedBuiltin = BUILTIN_FUNCTIONS.find((f) => f.name === toFunction);

  useEffect(() => {
    setParamValues(selectedBuiltin ? defaultParamValues(selectedBuiltin) : {});
    setIsParamsModalOpen(false);
  }, [selectedBuiltin]);

  const to =
    destinationType === "key"
      ? toKey
      : selectedBuiltin
        ? formatFunctionCall(selectedBuiltin, paramValues)
        : toFunction;

  const paramsFilled =
    !selectedBuiltin ||
    selectedBuiltin.params.every((p) =>
      p.type === "boolean" ? true : String(paramValues[p.key] ?? "").trim() !== ""
    );

  function addRemapping() {
    if (!from || !to || !paramsFilled) return;
    setRemappings((prev) => [...prev, { id: Date.now(), from, to }]);
    setToFunction("");
    setResetSignal((s) => s + 1);
  }

  function setParamValue(key: string, value: string | number | boolean) {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }

  function removeRemapping(id: number) {
    setRemappings((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-sm">Tecla de origem</label>
          <KeyComboPicker resetSignal={resetSignal} onChange={setFrom} />
        </div>

        <span className="pb-2 opacity-60">→</span>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label className="text-sm">
              {destinationType === "key" ? "Tecla de destino" : "Função de destino"}
            </label>
            <div className="flex gap-1 bg-menu-secondary rounded-md p-0.5 text-xs">
              <button
                type="button"
                title="Remapeamento simples, tecla para tecla (1 para 1)"
                className={`flex items-center gap-1 px-2 py-0.5 rounded outline-none focus:outline-none cursor-pointer ${
                  destinationType === "key"
                    ? "bg-(--main) text-white"
                    : "opacity-60"
                }`}
                onClick={() => setDestinationType("key")}
              >
                Tecla
                <InfoIcon />
              </button>
              <button
                type="button"
                title="Remapeamento complexo: executa uma função com múltiplos passos, condicionais, etc."
                className={`flex items-center gap-1 px-2 py-0.5 rounded outline-none focus:outline-none cursor-pointer ${
                  destinationType === "function"
                    ? "bg-(--main) text-white"
                    : "opacity-60"
                }`}
                onClick={() => setDestinationType("function")}
              >
                Função
                <InfoIcon />
              </button>
            </div>
          </div>

          {destinationType === "key" ? (
            <KeyComboPicker resetSignal={resetSignal} onChange={setToKey} />
          ) : (
            <div className="flex gap-2">
              <select
                className="bg-menu-secondary rounded-lg px-3 py-2 outline-none cursor-pointer w-56 h-10 appearance-none"
                value={toFunction}
                onChange={(e) => setToFunction(e.target.value)}
              >
                <option value="">Selecione uma função</option>
                <optgroup label="Padrão">
                  {BUILTIN_FUNCTIONS.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
                {functions.length > 0 && (
                  <optgroup label="Personalizadas">
                    {functions.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {selectedBuiltin && selectedBuiltin.params.length > 0 && (
                <button
                  type="button"
                  title="Definir parâmetros"
                  className="button-secondary h-10 w-10 p-0! inline-flex! items-center! justify-center!"
                  onClick={() => setIsParamsModalOpen(true)}
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle cx="8" cy="4" r="1.3" />
                    <line x1="8" y1="6" x2="8" y2="14" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="4.5" cy="9.5" r="1.3" />
                    <line x1="4.5" y1="2" x2="4.5" y2="8" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1="4.5" y1="11" x2="4.5" y2="14" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="11.5" cy="11" r="1.3" />
                    <line x1="11.5" y1="2" x2="11.5" y2="9.5" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1="11.5" y1="12.5" x2="11.5" y2="14" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {isParamsModalOpen && selectedBuiltin && (
            <ParamsModal
              meta={selectedBuiltin}
              values={paramValues}
              onChange={setParamValue}
              onClose={() => setIsParamsModalOpen(false)}
            />
          )}
        </div>

        <button
          className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!from || !to || !paramsFilled}
          onClick={addRemapping}
        >
          Adicionar
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-auto">
        {remappings.length === 0 && (
          <p className="opacity-60 text-sm">Nenhum remapeamento cadastrado.</p>
        )}
        {remappings.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between bg-menu-secondary rounded-lg px-4 py-2"
          >
            <span>
              {r.from} → {r.to}
            </span>
            <button
              className="button-secondary py-1 px-3 text-sm"
              onClick={() => removeRemapping(r.id)}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
