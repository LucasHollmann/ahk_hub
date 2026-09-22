"use client";

import { useRef, useState } from "react";
import type { FunctionEntry, GlobalVariable, VariableType } from "../types";
import StepListEditor from "./StepListEditor";
import { extractFunctionName, isValidAhkIdentifier } from "../../functions/ahk";
import type { HeaderParamDef, HeaderParamType, ParamOption } from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";
import {
  buildCodeFromSteps,
  clearHeaderParamRefs,
  collectAllGuiVariables,
  collectAllGuiVariablesAcrossFunctions,
  collectAllLocalVariableCreations,
  collectAllRadialVariables,
  collectAllRadialVariablesAcrossFunctions,
  collectGlobalVariableCreations,
  headerParamIdentifiers,
  hydrateSteps,
  serializeSteps,
  type Step,
} from "./stepTypes";

type Props = {
  functions: FunctionEntry[];
  onAdd: (entry: Omit<FunctionEntry, "id">) => void;
  onUpdate: (id: number, entry: Omit<FunctionEntry, "id">) => void;
  onRemove: (id: number) => void;
  /** Receives the whole list in its new order — this is also the order the functions are declared in the generated script. */
  onReorder: (functions: FunctionEntry[]) => void;
  globalVariables: GlobalVariable[];
  onRegisterGlobalVariable: (variable: Omit<GlobalVariable, "id">) => void;
};

type CreationMode = "code" | "steps";

const CODE_EXAMPLE = `AbrirNotas() {
    Run "notepad.exe"
    WinWaitActive "ahk_exe notepad.exe"
    Send "Lembrete: ligar para o cliente{enter}"
}`;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-menu-secondary/30 border border-white/10 rounded-lg p-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{title}</span>
      {children}
    </div>
  );
}

export default function FunctionsSection({
  functions,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  globalVariables,
  onRegisterGlobalVariable,
}: Props) {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");

  const [headerParams, setHeaderParams] = useState<HeaderParamDef[]>([]);
  const [newParamName, setNewParamName] = useState("");
  const [newParamType, setNewParamType] = useState<HeaderParamType>("text");
  const [newParamOptions, setNewParamOptions] = useState<ParamOption[]>([]);
  const [newOptionValue, setNewOptionValue] = useState("");

  const [steps, setSteps] = useState<Step[]>([]);
  const [draggedFunctionId, setDraggedFunctionId] = useState<number | null>(null);
  const nextStepIdRef = useRef(0);

  const detectedName = extractFunctionName(code);
  const trimmedName = name.trim();
  /** The name this function will be saved under, whichever mode the form is in. */
  const effectiveName = mode === "code" ? (detectedName ?? "") : trimmedName;
  /** A name already taken by another function makes the script invalid — AHK would see two definitions. */
  const isDuplicateName =
    effectiveName !== "" && functions.some((f) => f.name === effectiveName && f.id !== editingId);
  const trimmedParamName = newParamName.trim();
  const availableStepFunctions = functions.filter((f) => f.id !== editingId);

  const localVariables: HeaderParamDef[] = collectAllLocalVariableCreations(steps);
  const guiVariables: HeaderParamDef[] = (() => {
    const seen = new Set<string>();
    return [
      ...collectAllGuiVariables(steps),
      ...collectAllGuiVariablesAcrossFunctions(availableStepFunctions),
    ].filter((v) => (seen.has(v.key) ? false : (seen.add(v.key), true)));
  })();
  const radialVariables: HeaderParamDef[] = (() => {
    const seen = new Set<string>();
    return [
      ...collectAllRadialVariables(steps),
      ...collectAllRadialVariablesAcrossFunctions(availableStepFunctions),
    ].filter((v) => (seen.has(v.key) ? false : (seen.add(v.key), true)));
  })();
  const globalVariableParams: HeaderParamDef[] = globalVariables
    .filter((v): v is GlobalVariable & { type: Exclude<VariableType, "array"> } => v.type !== "array")
    .map((v) => ({
      key: v.name,
      label: v.name,
      type: v.type,
    }));

  function paramTypeLabel(type: HeaderParamType): string {
    return type === "text"
      ? t("functionsSection.paramTypeText", "Texto")
      : type === "number"
        ? t("functionsSection.paramTypeNumber", "Número")
        : type === "boolean"
          ? t("functionsSection.paramTypeBoolean", "Booleano")
          : type === "select"
            ? t("functionsSection.paramTypeSelect", "Seleção")
            : type === "keyCombo"
              ? t("functionsSection.paramTypeKeyCombo", "Tecla")
              : t("functionsSection.paramTypeCoordinate", "Coordenada na tela");
  }

  function reorderFunctions(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const dragIndex = functions.findIndex((f) => f.id === draggedId);
    const dropIndex = functions.findIndex((f) => f.id === targetId);
    if (dragIndex === -1 || dropIndex === -1) return;
    const next = [...functions];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onReorder(next);
  }

  function addNewParamOption() {
    const value = newOptionValue.trim();
    if (!value || newParamOptions.some((o) => o.value === value)) return;
    setNewParamOptions((prev) => [...prev, { value, label: value }]);
    setNewOptionValue("");
  }

  function removeNewParamOption(value: string) {
    setNewParamOptions((prev) => prev.filter((o) => o.value !== value));
  }

  /** Registers any "criar variável (global)" action found anywhere in the step tree (including inside loop/conditional bodies) that isn't already known. */
  function updateSteps(next: Step[]) {
    setSteps(next);
    for (const g of collectGlobalVariableCreations(next)) {
      if (!globalVariables.some((v) => v.name === g.name)) onRegisterGlobalVariable(g);
    }
  }

  const canSubmit =
    isDuplicateName
      ? false
      : mode === "code"
        ? Boolean(detectedName) && code.trim().length > 0
        : mode === "steps"
          ? isValidAhkIdentifier(trimmedName) && steps.length > 0
          : false;

  function resetForm() {
    setEditingId(null);
    setMode(null);
    setName("");
    setDescription("");
    setCode("");
    setHeaderParams([]);
    setNewParamName("");
    setNewParamType("text");
    setNewParamOptions([]);
    setNewOptionValue("");
    setSteps([]);
  }

  function openNewForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function startEdit(entry: FunctionEntry) {
    setEditingId(entry.id);
    setDescription(entry.description);

    if (entry.builder?.mode === "steps") {
      setMode("steps");
      setName(entry.name);
      setHeaderParams(entry.params ?? []);
      setSteps(hydrateSteps(entry.builder.steps, nextStepIdRef));
      setCode("");
    } else {
      setMode("code");
      setCode(entry.code);
      setName("");
      setHeaderParams([]);
      setSteps([]);
    }

    setIsFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setIsFormOpen(false);
  }

  function addHeaderParam() {
    if (!isValidAhkIdentifier(trimmedParamName)) return;
    if (headerParams.some((p) => p.key === trimmedParamName)) return;
    if (newParamType === "select" && newParamOptions.length === 0) return;
    setHeaderParams((prev) => [
      ...prev,
      {
        key: trimmedParamName,
        label: trimmedParamName,
        type: newParamType,
        ...(newParamType === "select" ? { options: newParamOptions } : {}),
      },
    ]);
    setNewParamName("");
    setNewParamType("text");
    setNewParamOptions([]);
    setNewOptionValue("");
  }

  function removeHeaderParam(key: string) {
    const removed = headerParams.find((p) => p.key === key);
    const identifiers = removed ? headerParamIdentifiers(removed) : [key];
    setHeaderParams((prev) => prev.filter((p) => p.key !== key));
    setSteps((prev) => clearHeaderParamRefs(prev, identifiers, functions));
  }

  function submitFunction() {
    if (!canSubmit) return;

    const entry =
      mode === "code"
        ? { name: detectedName!, description: description.trim(), code: code.trim(), params: [] }
        : {
            name: trimmedName,
            description: description.trim(),
            code: buildCodeFromSteps(trimmedName, headerParams, steps, functions, globalVariables),
            params: headerParams,
            builder: { mode: "steps" as const, steps: serializeSteps(steps) },
          };

    if (editingId !== null) {
      onUpdate(editingId, entry);
    } else {
      onAdd(entry);
    }
    resetForm();
    setIsFormOpen(false);
  }

  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const target = e.currentTarget;
    const { selectionStart, selectionEnd, value } = target;
    const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
    setCode(nextValue);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = selectionStart + 1;
    });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold opacity-80">
          {t("functionsSection.customTitle", "Funções personalizadas")}
        </span>
        <button className="button-secondary flex items-center gap-1.5" onClick={openNewForm}>
          {t("functionsSection.addFunction", "Adicionar nova")}
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor">
            <line x1="8" y1="2.5" x2="8" y2="13.5" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {isFormOpen && mode === null && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50"
          onMouseDown={closeForm}
        >
          <div
            className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold">
              {editingId !== null
                ? t("functionsSection.editTitle", "Editar função")
                : t("functionsSection.newTitle", "Nova função")}
            </span>

            <div className="flex flex-col gap-2">
              <span className="text-sm opacity-70">
                {t("functionsSection.chooseTypeHint", "Escolha como você quer criar a função:")}
              </span>
              <button
                type="button"
                className="button-secondary text-left px-3 py-2"
                onClick={() => setMode("steps")}
              >
                {t("functionsSection.modeSteps", "Criar por sequência de comandos")}
              </button>
              <button
                type="button"
                className="button-secondary text-left px-3 py-2"
                onClick={() => setMode("code")}
              >
                {t("functionsSection.modeCode", "Escrever código AHK puro")}
              </button>
            </div>

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && mode !== null && (
        <div className="fixed inset-0 z-20 bg-menu-dark flex flex-col overflow-auto">
          <div
            className={`w-full mx-auto flex flex-col gap-2.5 p-5 ${
              mode === "steps" ? "max-w-6xl" : "max-w-2xl"
            }`}
          >
            <span className="text-base font-semibold">
              {editingId !== null
                ? t("functionsSection.editTitle", "Editar função")
                : t("functionsSection.newTitle", "Nova função")}
            </span>

            {mode === "code" ? (
              <>
                <div className="bg-menu-secondary/60 border border-white/10 rounded-lg px-3 py-2 text-xs opacity-80 leading-relaxed">
                  {t(
                    "functionsSection.codeWarning",
                    "Escreva aqui apenas o código de uma função. Qualquer coisa além dela pode fazer o script se comportar de um jeito inesperado ou dar erro — nada muito grave, mas o resultado é por sua conta, então vale revisar antes de salvar."
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm">{t("functionsSection.descriptionLabel", "Descrição")}</label>
                  <input
                    className="bg-menu-secondary rounded-lg px-3 py-2 outline-none w-full"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("functionsSection.descriptionPlaceholder", "O que essa função faz")}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm">{t("functionsSection.codeLabel", "Código AHK")}</label>
                  <textarea
                    className="bg-menu-secondary rounded-lg px-3 py-2 outline-none w-full font-mono text-sm resize-y min-h-40"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={handleCodeKeyDown}
                    placeholder={CODE_EXAMPLE}
                    spellCheck={false}
                    wrap="off"
                    rows={10}
                    autoFocus
                  />
                  <span className="text-xs opacity-60">
                    {detectedName
                      ? t("functionsSection.detectedName", "Nome detectado: {{name}}", {
                          name: detectedName,
                        })
                      : t(
                          "functionsSection.noNameDetected",
                          "Escreva o cabeçalho da função (ex: NomeDaFuncao() { ... }) para que o nome seja detectado."
                        )}
                  </span>
                  {isDuplicateName && (
                    <span className="text-xs text-red-400">
                      {t(
                        "functionsSection.duplicateName",
                        'Já existe uma função chamada "{{name}}".',
                        { name: effectiveName }
                      )}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="bg-menu-secondary/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs opacity-80 leading-relaxed">
                  {t(
                    "functionsSection.stepsHint",
                    "Monte a função com um cabeçalho (nome e parâmetros) e um corpo (passos na ordem em que devem acontecer). Ao chamar outra função em um passo, os parâmetros dela podem vir de um parâmetro compatível do cabeçalho, de uma variável local ou de uma variável global."
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 items-start">
                  <div className="flex flex-col gap-3 min-w-0">
                    <SectionCard title={t("functionsSection.headerSectionTitle", "Cabeçalho")}>
                      <div className="flex gap-2">
                        <div className="flex flex-col gap-1 w-44">
                          <label className="text-xs opacity-70">
                            {t("functionsSection.nameLabel", "Nome da função")}
                          </label>
                          <input
                            className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("functionsSection.namePlaceholder", "Ex: AbrirNotas")}
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs opacity-70">
                            {t("functionsSection.descriptionLabel", "Descrição")}
                          </label>
                          <input
                            className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t("functionsSection.descriptionPlaceholder", "O que essa função faz")}
                          />
                        </div>
                      </div>
                      {isDuplicateName && (
                        <span className="text-xs text-red-400">
                          {t(
                            "functionsSection.duplicateName",
                            'Já existe uma função chamada "{{name}}".',
                            { name: effectiveName }
                          )}
                        </span>
                      )}
                      {name.trim() !== "" && !isValidAhkIdentifier(trimmedName) && (
                        <span className="text-xs text-red-400">
                          {t(
                            "functionsSection.invalidName",
                            "Nome inválido: use apenas letras, números e _, sem começar com número."
                          )}
                        </span>
                      )}
                    </SectionCard>

                    <SectionCard title={t("functionsSection.headerParamsTitle", "Parâmetros da função")}>
                      {headerParams.length === 0 ? (
                        <p className="opacity-60 text-xs">
                          {t("functionsSection.emptyHeaderParams", "Nenhum parâmetro adicionado ainda.")}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {headerParams.map((p) => (
                            <li
                              key={p.key}
                              className="flex items-center justify-between bg-menu-secondary rounded-lg px-2.5 py-1 text-xs"
                            >
                              <span className="font-mono">
                                {p.label} ({paramTypeLabel(p.type as HeaderParamType)}
                                {p.type === "select" && p.options
                                  ? `: ${p.options.map((o) => o.label).join(", ")}`
                                  : ""}
                                )
                              </span>
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => removeHeaderParam(p.key)}
                              >
                                {t("functionsSection.remove", "Remover")}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap gap-1.5 items-center">
                        <input
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-28 text-sm"
                          value={newParamName}
                          onChange={(e) => setNewParamName(e.target.value)}
                          placeholder={t("functionsSection.paramNamePlaceholder", "Ex: texto")}
                        />
                        <select
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 text-sm appearance-none"
                          value={newParamType}
                          onChange={(e) => {
                            setNewParamType(e.target.value as HeaderParamType);
                            setNewParamOptions([]);
                            setNewOptionValue("");
                          }}
                        >
                          <option value="text">{t("functionsSection.paramTypeText", "Texto")}</option>
                          <option value="number">{t("functionsSection.paramTypeNumber", "Número")}</option>
                          <option value="boolean">{t("functionsSection.paramTypeBoolean", "Booleano")}</option>
                          <option value="select">{t("functionsSection.paramTypeSelect", "Seleção")}</option>
                          <option value="coordinate">
                            {t("functionsSection.paramTypeCoordinate", "Coordenada na tela")}
                          </option>
                          <option value="keyCombo">{t("functionsSection.paramTypeKeyCombo", "Tecla")}</option>
                        </select>
                        <button
                          type="button"
                          className="button-secondary py-1.5 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={
                            !isValidAhkIdentifier(trimmedParamName) ||
                            headerParams.some((p) => p.key === trimmedParamName) ||
                            (newParamType === "select" && newParamOptions.length === 0)
                          }
                          onClick={addHeaderParam}
                        >
                          {t("functionsSection.addParam", "Adicionar parâmetro")}
                        </button>
                      </div>
                      {trimmedParamName !== "" && !isValidAhkIdentifier(trimmedParamName) && (
                        <span className="text-xs text-red-400">
                          {t(
                            "functionsSection.invalidName",
                            "Nome inválido: use apenas letras, números e _, sem começar com número."
                          )}
                        </span>
                      )}

                      {newParamType === "select" && (
                        <div className="flex flex-col gap-1.5 bg-menu-secondary/60 rounded-lg p-2">
                          <span className="text-xs opacity-70">
                            {t("functionsSection.paramOptionsLabel", "Opções da seleção")}
                          </span>
                          {newParamOptions.length > 0 && (
                            <ul className="flex flex-wrap gap-1">
                              {newParamOptions.map((o) => (
                                <li
                                  key={o.value}
                                  className="flex items-center gap-1 bg-menu-secondary rounded px-2 py-1 text-xs"
                                >
                                  {o.label}
                                  <button
                                    type="button"
                                    className="opacity-60 hover:opacity-100 cursor-pointer"
                                    onClick={() => removeNewParamOption(o.value)}
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
                              value={newOptionValue}
                              onChange={(e) => setNewOptionValue(e.target.value)}
                              placeholder={t("functionsSection.paramOptionPlaceholder", "Ex: Rápido")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addNewParamOption();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="button-secondary py-1 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={
                                !newOptionValue.trim() ||
                                newParamOptions.some((o) => o.value === newOptionValue.trim())
                              }
                              onClick={addNewParamOption}
                            >
                              {t("functionsSection.addParamOption", "Adicionar opção")}
                            </button>
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </div>

                  <SectionCard title={t("functionsSection.bodySectionTitle", "Corpo")}>
                    <StepListEditor
                      steps={steps}
                      onChange={updateSteps}
                      functions={availableStepFunctions}
                      headerParams={headerParams}
                      localVariables={localVariables}
                      globalVariables={globalVariableParams}
                      guiVariables={guiVariables}
                      radialVariables={radialVariables}
                      nextStepIdRef={nextStepIdRef}
                    />
                  </SectionCard>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!canSubmit}
                onClick={submitFunction}
              >
                {editingId !== null ? t("functionsSection.save", "Salvar") : t("functionsSection.add", "Adicionar")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 overflow-auto">
        {functions.length === 0 && (
          <p className="opacity-60 text-sm">
            {t("functionsSection.emptyCustomList", "Nenhuma função personalizada cadastrada.")}
          </p>
        )}
        {functions.length > 1 && (
          <p className="opacity-60 text-xs">
            {t(
              "functionsSection.reorderHint",
              "Arraste para reordenar — é nessa ordem que as funções são declaradas no script."
            )}
          </p>
        )}
        {functions.map((f) => (
          <div
            key={f.id}
            draggable
            onDragStart={() => setDraggedFunctionId(f.id)}
            onDragEnd={() => setDraggedFunctionId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedFunctionId !== null) reorderFunctions(draggedFunctionId, f.id);
              setDraggedFunctionId(null);
            }}
            className={`flex items-center justify-between bg-menu-secondary rounded-lg px-4 py-2 cursor-grab active:cursor-grabbing ${
              draggedFunctionId === f.id ? "opacity-40" : ""
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="opacity-40 select-none" aria-hidden="true">
                ⠿
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{f.name}</span>
                {f.description && <span className="text-sm opacity-70 truncate">{f.description}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary py-1 px-3 text-sm" onClick={() => startEdit(f)}>
                {t("functionsSection.edit", "Editar")}
              </button>
              <button className="button-secondary py-1 px-3 text-sm" onClick={() => onRemove(f.id)}>
                {t("functionsSection.remove", "Remover")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
