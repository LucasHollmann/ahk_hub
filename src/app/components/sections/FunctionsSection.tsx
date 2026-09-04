"use client";

import { useState } from "react";
import type { FunctionEntry } from "../types";
import { useTranslation } from "../../i18n/I18nContext";

type Props = {
  functions: FunctionEntry[];
  onAdd: (entry: Omit<FunctionEntry, "id">) => void;
  onRemove: (id: number) => void;
};

export default function FunctionsSection({ functions, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function addFunction() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), description: description.trim() });
    setName("");
    setDescription("");
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold opacity-80">
          {t("functionsSection.customTitle", "Funções personalizadas")}
        </span>
        <div className="flex gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm">{t("functionsSection.nameLabel", "Nome da função")}</label>
            <input
              className="bg-menu-secondary rounded-lg px-3 py-2 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("functionsSection.namePlaceholder", "Ex: AbrirNotas")}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-sm">
              {t("functionsSection.descriptionLabel", "Descrição")}
            </label>
            <input
              className="bg-menu-secondary rounded-lg px-3 py-2 outline-none w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("functionsSection.descriptionPlaceholder", "O que essa função faz")}
            />
          </div>
          <button className="button-main" onClick={addFunction}>
            {t("functionsSection.add", "Adicionar")}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {functions.length === 0 && (
            <p className="opacity-60 text-sm">
              {t("functionsSection.emptyCustomList", "Nenhuma função personalizada cadastrada.")}
            </p>
          )}
          {functions.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between bg-menu-secondary rounded-lg px-4 py-2"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{f.name}</span>
                {f.description && (
                  <span className="text-sm opacity-70">{f.description}</span>
                )}
              </div>
              <button
                className="button-secondary py-1 px-3 text-sm"
                onClick={() => onRemove(f.id)}
              >
                {t("functionsSection.remove", "Remover")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
