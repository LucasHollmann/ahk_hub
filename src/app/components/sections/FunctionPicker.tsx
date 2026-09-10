"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";

export type FunctionPickerItem = {
  value: string;
  label: string;
  description?: string;
  group: string;
};

const GROUP_COLORS = [
  { text: "text-sky-400", border: "border-sky-400/40", dot: "bg-sky-400", selected: "bg-sky-500/25" },
  {
    text: "text-violet-400",
    border: "border-violet-400/40",
    dot: "bg-violet-400",
    selected: "bg-violet-500/25",
  },
  {
    text: "text-emerald-400",
    border: "border-emerald-400/40",
    dot: "bg-emerald-400",
    selected: "bg-emerald-500/25",
  },
  {
    text: "text-amber-400",
    border: "border-amber-400/40",
    dot: "bg-amber-400",
    selected: "bg-amber-500/25",
  },
];

function colorForGroup(index: number) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

type PopupProps = {
  items: FunctionPickerItem[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function FunctionPickerPopup({ items, value, onSelect, onClose }: PopupProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? items.filter(
          (i) => i.label.toLowerCase().includes(query) || i.description?.toLowerCase().includes(query)
        )
      : items;

    const byGroup = new Map<string, FunctionPickerItem[]>();
    for (const item of filtered) {
      const list = byGroup.get(item.group);
      if (list) list.push(item);
      else byGroup.set(item.group, [item]);
    }
    return [...byGroup.entries()];
  }, [items, search]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div
        className="bg-menu-dark rounded-lg shadow-lg flex flex-col w-full max-w-4xl max-h-[85vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-white/10">
          <input
            className="bg-menu-secondary rounded-lg px-3 py-2 outline-none w-full text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("functionPicker.searchPlaceholder", "Buscar função...")}
            autoFocus
          />
        </div>

        {groups.length === 0 ? (
          <p className="opacity-60 text-sm text-center py-8">
            {t("functionPicker.noResults", "Nenhuma função encontrada.")}
          </p>
        ) : (
          <div
            className="grid gap-2 p-2 overflow-y-auto"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
          >
            {groups.map(([group, groupItems], index) => {
              const color = colorForGroup(index);
              return (
                <div
                  key={group}
                  className={`flex flex-col rounded-lg border ${color.border} overflow-hidden`}
                >
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide px-3 py-2 border-b ${color.text} ${color.border}`}
                  >
                    {group}
                  </span>
                  <div className="flex flex-col gap-0.5 p-1.5">
                    {groupItems.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-start gap-1.5 ${
                          item.value === value ? color.selected : "hover:bg-white/5"
                        }`}
                        onClick={() => onSelect(item.value)}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${color.dot}`} />
                        <span className="flex flex-col min-w-0">
                          <span className="text-sm truncate">{item.label}</span>
                          {item.description && (
                            <span className="text-xs opacity-60 truncate">{item.description}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type Props = {
  items: FunctionPickerItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

export default function FunctionPicker({ items, value, onChange, placeholder, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const selected = items.find((i) => i.value === value);

  function pick(itemValue: string) {
    onChange(itemValue);
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 text-sm text-left flex items-center justify-between gap-2 ${className ?? ""}`}
        onClick={() => setIsOpen(true)}
      >
        <span className={`truncate ${selected ? "" : "opacity-60"}`}>{selected?.label ?? placeholder}</span>
        <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-60 shrink-0" fill="none" stroke="currentColor">
          <path d="M4 6l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <FunctionPickerPopup
          items={items}
          value={value}
          onSelect={pick}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
