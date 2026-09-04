"use client";

import { useState } from "react";
import RemappingsSection from "./sections/RemappingsSection";
import FunctionsSection from "./sections/FunctionsSection";
import type { FunctionEntry } from "./types";

type Tab = "remappings" | "functions";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("remappings");
  const [functions, setFunctions] = useState<FunctionEntry[]>([]);

  function addFunction(entry: Omit<FunctionEntry, "id">) {
    setFunctions((prev) => [...prev, { id: Date.now(), ...entry }]);
  }

  function removeFunction(id: number) {
    setFunctions((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex gap-2 p-4 pb-0">
        <button
          className={`outline-none focus:outline-none ${
            activeTab === "remappings" ? "button-main" : "button-secondary"
          }`}
          onClick={() => setActiveTab("remappings")}
        >
          Remapeamentos
        </button>
        <button
          className={`outline-none focus:outline-none ${
            activeTab === "functions" ? "button-main" : "button-secondary"
          }`}
          onClick={() => setActiveTab("functions")}
        >
          Funções
        </button>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div className="h-full bg-menu-secondary/40 rounded-lg p-4">
          {activeTab === "remappings" ? (
            <RemappingsSection functions={functions} />
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
