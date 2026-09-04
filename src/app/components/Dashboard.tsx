"use client";

import { useEffect, useRef, useState } from "react";
import RemappingsSection from "./sections/RemappingsSection";
import FunctionsSection from "./sections/FunctionsSection";
import type { FunctionEntry, Remapping } from "./types";
import { generateAhkScript } from "../functions/generateAhk";
import { parseAhkScript } from "../functions/serialize";
import { useTranslation, type Locale } from "../i18n/I18nContext";

type Tab = "remappings" | "functions";

function basename(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default function Dashboard() {
  const { t, locale, setLocale } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("remappings");
  const [functions, setFunctions] = useState<FunctionEntry[]>([]);
  const [remappings, setRemappings] = useState<Remapping[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const nextIdRef = useRef(1);

  function generateId() {
    return nextIdRef.current++;
  }

  function applyTitle(path: string | null) {
    const title = path ? basename(path) : t("dashboard.untitledTitle", "novo script.ahk*");
    document.title = title;
    // Runs again on the next tick in case Next.js re-applies its static
    // metadata <title> right after this (observed race on first mount).
    setTimeout(() => {
      document.title = title;
    }, 0);
  }

  useEffect(() => {
    applyTitle(lastSavedPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSavedPath, locale]);

  function addFunction(entry: Omit<FunctionEntry, "id">) {
    setFunctions((prev) => [...prev, { id: generateId(), ...entry }]);
  }

  function removeFunction(id: number) {
    setFunctions((prev) => prev.filter((f) => f.id !== id));
  }

  function addRemapping(remapping: Omit<Remapping, "id">) {
    const next = [...remappings, { id: generateId(), ...remapping }];
    setRemappings(next);
    autoSaveAndReload(next);
  }

  function updateRemapping(id: number, remapping: Omit<Remapping, "id">) {
    const next = remappings.map((r) => (r.id === id ? { id, ...remapping } : r));
    setRemappings(next);
    autoSaveAndReload(next);
  }

  function removeRemapping(id: number) {
    setRemappings((prev) => prev.filter((r) => r.id !== id));
  }

  async function saveAndRun(forcePathPrompt: boolean) {
    const script = generateAhkScript(remappings, functions);

    if (!window.desktop?.saveScript || !window.desktop?.runScript) {
      setSaveStatus(t("dashboard.desktopOnlySave", "Salvar só está disponível no aplicativo desktop."));
      return;
    }

    const targetPath = forcePathPrompt ? undefined : lastSavedPath ?? undefined;
    const saveResult = await window.desktop.saveScript(script, targetPath);
    if (saveResult.status === "canceled") {
      setSaveStatus(null);
      return;
    }
    if (saveResult.status === "error") {
      setSaveStatus(t("dashboard.saveError", "Erro ao salvar: {{error}}", { error: saveResult.error }));
      return;
    }

    setLastSavedPath(saveResult.path);
    applyTitle(saveResult.path);

    const runResult = await window.desktop.runScript(saveResult.path);
    setSaveStatus(
      runResult.status === "ok"
        ? t("dashboard.savedAndReloaded", "Script salvo e recarregado em {{path}}", {
            path: saveResult.path,
          })
        : t("dashboard.savedButRunError", "Salvo, mas houve erro ao executar: {{error}}", {
            error: runResult.error,
          })
    );
  }

  // Only auto-saves when a file is already linked — never prompts a dialog on its own.
  async function autoSaveAndReload(nextRemappings: Remapping[]) {
    if (!lastSavedPath) return;
    if (!window.desktop?.saveScript || !window.desktop?.runScript) return;

    const script = generateAhkScript(nextRemappings, functions);
    const saveResult = await window.desktop.saveScript(script, lastSavedPath);
    if (saveResult.status !== "saved") {
      setSaveStatus(
        saveResult.status === "error"
          ? t("dashboard.saveError", "Erro ao salvar: {{error}}", { error: saveResult.error })
          : null
      );
      return;
    }
    applyTitle(saveResult.path);

    const runResult = await window.desktop.runScript(saveResult.path);
    setSaveStatus(
      runResult.status === "ok"
        ? t("dashboard.savedAndReloaded", "Script salvo e recarregado em {{path}}", {
            path: saveResult.path,
          })
        : t("dashboard.savedButRunError", "Salvo, mas houve erro ao executar: {{error}}", {
            error: runResult.error,
          })
    );
  }

  function handleSave() {
    saveAndRun(false);
  }

  function handleSaveAs() {
    saveAndRun(true);
  }

  async function handleLoad() {
    if (!window.desktop?.loadScript) {
      setSaveStatus(t("dashboard.desktopOnlyLoad", "Carregar só está disponível no aplicativo desktop."));
      return;
    }

    const result = await window.desktop.loadScript();
    if (result.status === "canceled") {
      setSaveStatus(null);
      return;
    }
    if (result.status === "error") {
      setSaveStatus(t("dashboard.loadError", "Erro ao carregar: {{error}}", { error: result.error }));
      return;
    }

    if (!result.path.toLowerCase().endsWith(".ahk")) {
      setSaveStatus(
        t(
          "dashboard.outOfSpecExtension",
          "Arquivo fora do padrão, não é possível carregar (precisa ser um .ahk)."
        )
      );
      return;
    }

    const parsed = parseAhkScript(result.content);
    if (!parsed.ok) {
      setSaveStatus(
        t("dashboard.outOfSpec", "Arquivo fora do padrão, não é possível carregar: {{error}}.", {
          error: parsed.error,
        })
      );
      return;
    }

    setFunctions(parsed.functions);
    setRemappings(parsed.remappings);
    setLastSavedPath(result.path);
    applyTitle(result.path);
    setSaveStatus(t("dashboard.loadedFrom", "Script carregado de {{path}}", { path: result.path }));
  }

  function handleLocaleChange(next: Locale) {
    setLocale(next);
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="min-w-full h-6 bg-menu-dark flex items-center justify-between">
        <div>
          <button
            className="button-topbar"
            onClick={handleSave}
            title={t(
              "dashboard.saveTooltip",
              "Salva no arquivo atual (ou pede o local, se ainda não houver um) e recarrega o script — útil durante testes"
            )}
          >
            {t("dashboard.save", "Salvar")}
          </button>
          <button
            className="button-topbar"
            onClick={handleSaveAs}
            title={t("dashboard.saveAsTooltip", "Pede um novo local para salvar e recarrega o script")}
          >
            {t("dashboard.saveAs", "Salvar como")}
          </button>
          <button
            className="button-topbar"
            onClick={handleLoad}
            title={t("dashboard.loadTooltip", "Carrega um script .ahk gerado por este app")}
          >
            Load
          </button>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus && <span className="text-xs px-3 opacity-70">{saveStatus}</span>}
          <div className="flex gap-1 bg-menu-secondary rounded-md p-0.5 text-xs mr-2">
            <button
              type="button"
              className={`px-2 py-0.5 rounded outline-none focus:outline-none cursor-pointer ${
                locale === "pt" ? "bg-(--main) text-white" : "opacity-60"
              }`}
              onClick={() => handleLocaleChange("pt")}
            >
              PT
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded outline-none focus:outline-none cursor-pointer ${
                locale === "en" ? "bg-(--main) text-white" : "opacity-60"
              }`}
              onClick={() => handleLocaleChange("en")}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-4 pb-0">
        <button
          className={`outline-none focus:outline-none ${
            activeTab === "remappings" ? "button-main" : "button-secondary"
          }`}
          onClick={() => setActiveTab("remappings")}
        >
          {t("dashboard.tabRemappings", "Remapeamentos")}
        </button>
        <button
          className={`outline-none focus:outline-none ${
            activeTab === "functions" ? "button-main" : "button-secondary"
          }`}
          onClick={() => setActiveTab("functions")}
        >
          {t("dashboard.tabFunctions", "Funções")}
        </button>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div className="h-full bg-menu-secondary/40 rounded-lg p-4">
          {activeTab === "remappings" ? (
            <RemappingsSection
              functions={functions}
              remappings={remappings}
              onAdd={addRemapping}
              onUpdate={updateRemapping}
              onRemove={removeRemapping}
            />
          ) : (
            <FunctionsSection
              functions={functions}
              onAdd={addFunction}
              onRemove={removeFunction}
            />
          )}
        </div>
      </div>
    </div>
  );
}
