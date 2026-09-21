"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AssignedValue,
  VariableType,
  VariableInitialValue,
  FunctionEntry,
  ConditionValue,
  FlowControlType,
  GuiInitialState,
} from "../types";
import ArgSourceValue from "./ArgSourceValue";
import {
  CoordinateLiteralFields,
  CoordinateValueFields,
  EMPTY_COORDINATE_ASSIGNMENT,
} from "./CoordinateFields";
import StepArgsFields from "./StepArgsFields";
import ConditionFields from "./ConditionFields";
import FunctionPicker, { FunctionPickerPopup, type FunctionPickerItem } from "./FunctionPicker";
import { BUILTIN_FUNCTIONS } from "../../functions/builtins";
import {
  defaultVariableValue,
  isValidAhkIdentifier,
  toCoordinateLiteral,
} from "../../functions/ahk";
import {
  areArgsFilled,
  defaultArgValues,
  expandHeaderParamsToCallParams,
  tFunctionCategoryLabel,
  tFunctionDescription,
  tFunctionName,
  type ArgSource,
  type ArgValues,
  type HeaderParamDef,
  type HeaderParamType,
  type Translate,
} from "../../functions/types";
import { useTranslation } from "../../i18n/I18nContext";
import {
  guiVarNameFromTitle,
  isConditionReady,
  stepLabel,
  type GuiControl,
  type GuiControlType,
  type MenuItem,
  type MenuItemTarget,
  type Step,
  type StepVarActionKind,
} from "./stepTypes";

type Props = {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  functions: FunctionEntry[];
  headerParams: HeaderParamDef[];
  localVariables: HeaderParamDef[];
  globalVariables: HeaderParamDef[];
  guiVariables: HeaderParamDef[];
  nextStepIdRef: { current: number };
  depth?: number;
};

/** A held click longer than this, or one that moved more than this many px, is recorded as a drag instead of a click. */
const DRAG_HOLD_THRESHOLD_MS = 400;
const DRAG_DISTANCE_THRESHOLD_PX = 6;

function RecordOptionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
      <span className="relative flex items-center justify-center shrink-0">
        <input
          type="checkbox"
          className="peer appearance-none w-4 h-4 rounded border border-white/25 bg-transparent checked:bg-(--main) checked:border-(--main) transition-colors"
          checked={checked}
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
      {label}
    </label>
  );
}

function guiControlSummary(t: Translate, control: GuiControl): string {
  if (control.type === "text") return t("functionsSection.guiControlTextSummary", 'Texto "{{text}}"', { text: control.text });
  if (control.type === "button") {
    const targetLabel =
      control.onClick.kind === "customFunction" ? control.onClick.functionName : tFunctionName(t, control.onClick.meta);
    return t("functionsSection.guiControlButtonSummary", 'Botão "{{text}}" → {{target}}', {
      text: control.text,
      target: targetLabel,
    });
  }
  if (control.type === "edit") {
    return t("functionsSection.guiControlEditSummary", "Caixa de texto");
  }
  if (control.type === "checkbox") {
    return t("functionsSection.guiControlCheckboxSummary", 'Caixa de seleção "{{label}}"', {
      label: control.label,
    });
  }
  if (control.type === "dropdown") {
    return t("functionsSection.guiControlDropdownSummary", "Lista suspensa ({{count}} opções)", {
      count: control.options.length,
    });
  }
  return t("functionsSection.guiControlCodeSummary", "Código AHK personalizado");
}

export default function StepListEditor({
  steps,
  onChange,
  functions,
  headerParams,
  localVariables,
  globalVariables,
  guiVariables,
  nextStepIdRef,
  depth = 0,
}: Props) {
  const { t } = useTranslation();

  const [stepFunctionName, setStepFunctionName] = useState("");
  const [stepFunctionArgs, setStepFunctionArgs] = useState<ArgValues>({});
  const [stepBuiltinId, setStepBuiltinId] = useState("");
  const [stepBuiltinArgs, setStepBuiltinArgs] = useState<ArgValues>({});
  const [stepVarAction, setStepVarAction] = useState<StepVarActionKind | null>(null);
  const [stepVarTargetName, setStepVarTargetName] = useState("");
  const [stepVarSetValue, setStepVarSetValue] = useState<AssignedValue>({ kind: "literal", value: "" });
  const [stepVarIncrementAmount, setStepVarIncrementAmount] = useState(1);
  const [stepVarCreateType, setStepVarCreateType] = useState<VariableType>("text");
  const [stepVarCreateInitialValue, setStepVarCreateInitialValue] = useState<VariableInitialValue>("");
  const [stepVarArrayNewItem, setStepVarArrayNewItem] = useState("");
  const [stepVarCreateScope, setStepVarCreateScope] = useState<"local" | "global">("local");
  const [stepVarPromptText, setStepVarPromptText] = useState("");
  const [stepVarPromptTitle, setStepVarPromptTitle] = useState("");
  const [stepFlowType, setStepFlowType] = useState<FlowControlType | null>(null);
  const [stepFlowCondition, setStepFlowCondition] = useState<ConditionValue>({ kind: "code", code: "" });
  const [stepFlowBody, setStepFlowBody] = useState<Step[]>([]);
  const [stepFlowElseBody, setStepFlowElseBody] = useState<Step[]>([]);
  const [stepIsMenu, setStepIsMenu] = useState(false);
  const [stepMenuTitle, setStepMenuTitle] = useState("");
  const [stepMenuItems, setStepMenuItems] = useState<MenuItem[]>([]);
  const [stepIsCreateGui, setStepIsCreateGui] = useState(false);
  const [stepGuiTitle, setStepGuiTitle] = useState("");
  const [stepGuiResizable, setStepGuiResizable] = useState(false);
  const [stepGuiAlwaysOnTop, setStepGuiAlwaysOnTop] = useState(false);
  const [stepGuiNoCaption, setStepGuiNoCaption] = useState(false);
  const [stepGuiToolWindow, setStepGuiToolWindow] = useState(false);
  const [stepGuiInitialState, setStepGuiInitialState] = useState<GuiInitialState>("normal");
  const [stepGuiWidth, setStepGuiWidth] = useState("");
  const [stepGuiHeight, setStepGuiHeight] = useState("");
  const [stepGuiX, setStepGuiX] = useState("");
  const [stepGuiY, setStepGuiY] = useState("");
  const [stepGuiUseColor, setStepGuiUseColor] = useState(false);
  const [stepGuiColor, setStepGuiColor] = useState("ffffff");
  const [stepGuiUseOpacity, setStepGuiUseOpacity] = useState(false);
  const [stepGuiOpacity, setStepGuiOpacity] = useState(255);
  const [stepGuiControls, setStepGuiControls] = useState<GuiControl[]>([]);
  const nextGuiControlIdRef = useRef(0);
  const [isGuiControlFormOpen, setIsGuiControlFormOpen] = useState(false);
  const [editingGuiControlId, setEditingGuiControlId] = useState<number | null>(null);
  const [guiControlType, setGuiControlType] = useState<GuiControlType>("text");
  const [guiControlText, setGuiControlText] = useState("");
  const [guiControlInitialValue, setGuiControlInitialValue] = useState("");
  const [guiControlMultiline, setGuiControlMultiline] = useState(false);
  const [guiControlChecked, setGuiControlChecked] = useState(false);
  const [guiControlOptions, setGuiControlOptions] = useState<string[]>([]);
  const [guiControlNewOption, setGuiControlNewOption] = useState("");
  const [guiControlX, setGuiControlX] = useState("");
  const [guiControlY, setGuiControlY] = useState("");
  const [guiControlWidth, setGuiControlWidth] = useState("");
  const [guiControlHeight, setGuiControlHeight] = useState("");
  const [guiControlUseColor, setGuiControlUseColor] = useState(false);
  const [guiControlColor, setGuiControlColor] = useState("ffffff");
  const [guiControlCode, setGuiControlCode] = useState("");
  const [guiControlBuiltinId, setGuiControlBuiltinId] = useState("");
  const [guiControlBuiltinArgs, setGuiControlBuiltinArgs] = useState<ArgValues>({});
  const [guiControlFunctionName, setGuiControlFunctionName] = useState("");
  const [guiControlFunctionArgs, setGuiControlFunctionArgs] = useState<ArgValues>({});
  const [stepIsCloseGui, setStepIsCloseGui] = useState(false);
  const [stepCloseGuiTarget, setStepCloseGuiTarget] = useState("");
  const [isMenuItemFormOpen, setIsMenuItemFormOpen] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState<number | null>(null);
  const [menuItemLabel, setMenuItemLabel] = useState("");
  const [menuItemBuiltinId, setMenuItemBuiltinId] = useState("");
  const [menuItemBuiltinArgs, setMenuItemBuiltinArgs] = useState<ArgValues>({});
  const [menuItemFunctionName, setMenuItemFunctionName] = useState("");
  const [menuItemFunctionArgs, setMenuItemFunctionArgs] = useState<ArgValues>({});
  const nextMenuItemIdRef = useRef(0);
  const [stepResetSignal, setStepResetSignal] = useState(0);
  const [isStepFormOpen, setIsStepFormOpen] = useState(false);
  const [isStepPickerOpen, setIsStepPickerOpen] = useState(false);
  const [editingStepId, setEditingStepId] = useState<number | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<number | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordFullScreen, setRecordFullScreen] = useState(false);
  const [recordInsertWaits, setRecordInsertWaits] = useState(false);
  const [recordConvertDrag, setRecordConvertDrag] = useState(false);
  const [recordTimeKeys, setRecordTimeKeys] = useState(false);
  const [stagedSteps, setStagedSteps] = useState<Step[]>([]);
  const recordFullScreenRef = useRef(recordFullScreen);
  const recordInsertWaitsRef = useRef(recordInsertWaits);
  const recordConvertDragRef = useRef(recordConvertDrag);
  const recordTimeKeysRef = useRef(recordTimeKeys);
  const lastEventTimeRef = useRef<number | null>(null);
  const unsubscribeRecordingRef = useRef<(() => void) | null>(null);
  const isCapturingRef = useRef(false);
  const isDesktop = typeof window !== "undefined" && Boolean(window.desktop);

  useEffect(() => {
    recordFullScreenRef.current = recordFullScreen;
  }, [recordFullScreen]);

  useEffect(() => {
    recordInsertWaitsRef.current = recordInsertWaits;
  }, [recordInsertWaits]);

  useEffect(() => {
    recordConvertDragRef.current = recordConvertDrag;
  }, [recordConvertDrag]);

  useEffect(() => {
    recordTimeKeysRef.current = recordTimeKeys;
  }, [recordTimeKeys]);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  useEffect(() => {
    return () => {
      // Every nested StepListEditor (loop/conditional bodies, the review list for a
      // recording batch) mounts its own instance of this effect. Recording is a single
      // shared session in the main process, so only the instance that actually started
      // it should ever stop it on unmount — otherwise an unrelated instance mounting for
      // the first time (e.g. the review list appearing once the first step is staged)
      // tears down someone else's active recording.
      unsubscribeRecordingRef.current?.();
      if (isCapturingRef.current) window.desktop?.stopRecording();
    };
  }, []);

  function openRecordModal() {
    setStagedSteps([]);
    setIsCapturing(false);
    setIsRecordModalOpen(true);
  }

  /** Starts (or resumes, after a pause) capturing global input into the staged batch. */
  function startCapturing() {
    if (!window.desktop) return;
    lastEventTimeRef.current = null;

    unsubscribeRecordingRef.current = window.desktop.onRecordedEvent((event) => {
      const clickMeta = BUILTIN_FUNCTIONS.find((f) => f.id === "click");
      const dragMeta = BUILTIN_FUNCTIONS.find((f) => f.id === "drag");
      const keyPressMeta = BUILTIN_FUNCTIONS.find((f) => f.id === "keyPress");
      const waitMeta = BUILTIN_FUNCTIONS.find((f) => f.id === "wait");
      let newStep: Step | null = null;

      if (event.kind === "key" && keyPressMeta) {
        const duration = recordTimeKeysRef.current ? (event.heldMs ?? 0) : 0;
        newStep = {
          id: nextStepIdRef.current++,
          kind: "builtin",
          meta: keyPressMeta,
          args: {
            combo: { kind: "literal", value: event.combo },
            duration: { kind: "literal", value: duration },
          },
        };
      } else if (event.kind === "click") {
        const windowBounds = event.window?.bounds;
        const fullScreen = recordFullScreenRef.current || !windowBounds;
        const toCoords = (p: { x: number; y: number }) =>
          fullScreen || !windowBounds ? p : { x: p.x - windowBounds.x, y: p.y - windowBounds.y };
        const downPoint = event.downPoint ?? event.point;
        const heldMs = event.heldMs ?? 0;
        const isDragGesture =
          recordConvertDragRef.current &&
          (heldMs > DRAG_HOLD_THRESHOLD_MS ||
            Math.hypot(event.point.x - downPoint.x, event.point.y - downPoint.y) >
              DRAG_DISTANCE_THRESHOLD_PX);

        if (isDragGesture && dragMeta) {
          const start = toCoords(downPoint);
          const end = toCoords(event.point);
          newStep = {
            id: nextStepIdRef.current++,
            kind: "builtin",
            meta: dragMeta,
            args: {
              x: { kind: "literal", value: start.x },
              y: { kind: "literal", value: start.y },
              endX: { kind: "literal", value: end.x },
              endY: { kind: "literal", value: end.y },
              fullScreen: { kind: "literal", value: fullScreen },
            },
          };
        } else if (clickMeta) {
          const point = toCoords(event.point);
          newStep = {
            id: nextStepIdRef.current++,
            kind: "builtin",
            meta: clickMeta,
            args: {
              x: { kind: "literal", value: point.x },
              y: { kind: "literal", value: point.y },
              fullScreen: { kind: "literal", value: fullScreen },
              button: { kind: "literal", value: event.button },
              doubleClick: { kind: "literal", value: event.doubleClick },
            },
          };
        }
      }

      if (!newStep) return;

      const now = Date.now();
      const toAppend: Step[] = [];
      if (recordInsertWaitsRef.current && lastEventTimeRef.current !== null && waitMeta) {
        const elapsed = now - lastEventTimeRef.current;
        if (elapsed > 20) {
          toAppend.push({
            id: nextStepIdRef.current++,
            kind: "builtin",
            meta: waitMeta,
            args: { ms: { kind: "literal", value: elapsed } },
          });
        }
      }
      lastEventTimeRef.current = now;
      toAppend.push(newStep);

      setStagedSteps((prev) => [...prev, ...toAppend]);
    });
    window.desktop.startRecording();
    setIsCapturing(true);
  }

  /** Pauses capturing without closing the modal or losing what's been staged — "start" resumes it. */
  function pauseCapturing() {
    window.desktop?.stopRecording();
    unsubscribeRecordingRef.current?.();
    unsubscribeRecordingRef.current = null;
    setIsCapturing(false);
  }

  function commitRecording() {
    pauseCapturing();
    onChange([...steps, ...stagedSteps]);
    setStagedSteps([]);
    setIsRecordModalOpen(false);
  }

  function discardRecording() {
    pauseCapturing();
    setStagedSteps([]);
    setIsRecordModalOpen(false);
  }

  const trimmedVarTargetName = stepVarTargetName.trim();
  const stepBuiltin = BUILTIN_FUNCTIONS.find((f) => f.id === stepBuiltinId);
  const stepFunctionTarget = functions.find((f) => f.name === stepFunctionName);
  const stepFunctionCallParams = stepFunctionTarget
    ? expandHeaderParamsToCallParams(stepFunctionTarget.params)
    : [];
  const stepSelection = stepBuiltinId
    ? `builtin:${stepBuiltinId}`
    : stepFunctionName
      ? `custom:${stepFunctionName}`
      : stepVarAction
        ? `varaction:${stepVarAction}`
        : stepFlowType
          ? `flow:${stepFlowType}`
          : stepIsMenu
            ? "showMenu"
            : stepIsCreateGui
              ? "createGui"
              : stepIsCloseGui
                ? "closeGui"
                : "";

  const stepPickerItems: FunctionPickerItem[] = [
    ...BUILTIN_FUNCTIONS.map((f) => ({
      value: `builtin:${f.id}`,
      label: tFunctionName(t, f),
      description: tFunctionDescription(t, f),
      group: tFunctionCategoryLabel(t, f.category),
    })),
    ...functions.map((f) => ({
      value: `custom:${f.name}`,
      label: f.name,
      description: f.description || undefined,
      group: t("functionsSection.groupCustom", "Personalizadas"),
    })),
    {
      value: "varaction:set",
      label: t("functionsSection.varActionSet", "Definir valor"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
    {
      value: "varaction:increment",
      label: t("functionsSection.varActionIncrement", "Incrementar/decrementar"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
    {
      value: "varaction:toggle",
      label: t("functionsSection.varActionToggle", "Alternar (toggle)"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
    {
      value: "varaction:create",
      label: t("functionsSection.varActionCreate", "Criar variável"),
      group: t("functionsSection.groupVariableActions", "Variáveis"),
    },
    {
      value: "varaction:promptInput",
      label: t("functionsSection.varActionPromptInput", "Pedir texto ao usuário (InputBox)"),
      description: t(
        "functionsSection.varActionPromptInputDescription",
        "Abre uma caixa pedindo um texto e guarda o valor digitado em uma variável."
      ),
      group: tFunctionCategoryLabel(t, "ui"),
    },
    {
      value: "flow:loop",
      label: t("functionsSection.flowLoopLabel", "Loop"),
      description: t(
        "functionsSection.flowLoopDescription",
        "Repete os passos seguintes enquanto uma condição for verdadeira."
      ),
      group: t("functionCategories.flow", "Controle de fluxo"),
    },
    {
      value: "flow:conditional",
      label: t("functionsSection.flowConditionalLabel", "Conditional"),
      description: t(
        "functionsSection.flowConditionalDescription",
        "Executa os passos seguintes apenas se uma condição for verdadeira."
      ),
      group: t("functionCategories.flow", "Controle de fluxo"),
    },
    {
      value: "showMenu",
      label: t("functionsSection.showMenuLabel", "Mostrar menu"),
      description: t(
        "functionsSection.showMenuDescription",
        "Mostra um menu com opções à escolha; cada opção chama outra função."
      ),
      group: tFunctionCategoryLabel(t, "ui"),
    },
    {
      value: "createGui",
      label: t("functionsSection.createGuiLabel", "Criar Gui"),
      description: t(
        "functionsSection.createGuiDescription",
        "Cria e mostra uma janela (Gui) como variável global, para poder fechá-la de qualquer função."
      ),
      group: tFunctionCategoryLabel(t, "ui"),
    },
    {
      value: "closeGui",
      label: t("functionsSection.closeGuiLabel", "Fechar Gui"),
      description: t(
        "functionsSection.closeGuiDescription",
        "Fecha uma Gui aberta por um passo \"Criar Gui\" anterior."
      ),
      group: tFunctionCategoryLabel(t, "ui"),
    },
  ];

  function matchesVarActionType(type: HeaderParamType): boolean {
    if (stepVarAction === "increment") return type === "number";
    if (stepVarAction === "toggle") return type === "boolean";
    return true;
  }
  const localVarTargets = localVariables.filter((v) => matchesVarActionType(v.type));
  const globalVarTargets = globalVariables.filter((v) => matchesVarActionType(v.type));

  function resetStepSelectionState() {
    setStepBuiltinId("");
    setStepBuiltinArgs({});
    setStepFunctionName("");
    setStepFunctionArgs({});
    setStepVarAction(null);
    setStepVarTargetName("");
    setStepVarSetValue({ kind: "literal", value: "" });
    setStepVarIncrementAmount(1);
    setStepVarCreateType("text");
    setStepVarCreateInitialValue("");
    setStepVarArrayNewItem("");
    setStepVarCreateScope("local");
    setStepVarPromptText("");
    setStepVarPromptTitle("");
    setStepFlowType(null);
    setStepFlowCondition({ kind: "code", code: "" });
    setStepFlowBody([]);
    setStepFlowElseBody([]);
    setStepIsMenu(false);
    setStepMenuTitle("");
    setStepMenuItems([]);
    setStepIsCreateGui(false);
    setStepGuiTitle("");
    setStepGuiResizable(false);
    setStepGuiAlwaysOnTop(false);
    setStepGuiNoCaption(false);
    setStepGuiToolWindow(false);
    setStepGuiInitialState("normal");
    setStepGuiWidth("");
    setStepGuiHeight("");
    setStepGuiX("");
    setStepGuiY("");
    setStepGuiUseColor(false);
    setStepGuiColor("ffffff");
    setStepGuiUseOpacity(false);
    setStepGuiOpacity(255);
    setStepGuiControls([]);
    setStepIsCloseGui(false);
    setStepCloseGuiTarget("");
    setStepResetSignal((s) => s + 1);
  }

  function selectStep(value: string) {
    if (value.startsWith("builtin:")) {
      const id = value.slice("builtin:".length);
      const meta = BUILTIN_FUNCTIONS.find((f) => f.id === id);
      resetStepSelectionState();
      setStepBuiltinId(id);
      setStepBuiltinArgs(meta ? defaultArgValues(meta.params) : {});
    } else if (value.startsWith("custom:")) {
      const name = value.slice("custom:".length);
      const target = functions.find((f) => f.name === name);
      resetStepSelectionState();
      setStepFunctionName(name);
      setStepFunctionArgs(target ? defaultArgValues(expandHeaderParamsToCallParams(target.params)) : {});
    } else if (value.startsWith("varaction:")) {
      const action = value.slice("varaction:".length) as StepVarActionKind;
      resetStepSelectionState();
      setStepVarAction(action);
    } else if (value.startsWith("flow:")) {
      const flowType = value.slice("flow:".length) as FlowControlType;
      resetStepSelectionState();
      setStepFlowType(flowType);
    } else if (value === "showMenu") {
      resetStepSelectionState();
      setStepIsMenu(true);
    } else if (value === "createGui") {
      resetStepSelectionState();
      setStepIsCreateGui(true);
    } else if (value === "closeGui") {
      resetStepSelectionState();
      setStepIsCloseGui(true);
    } else {
      resetStepSelectionState();
    }
  }

  function openStepPicker() {
    resetStepSelectionState();
    setEditingStepId(null);
    setIsStepPickerOpen(true);
  }

  function closeStepForm() {
    resetStepSelectionState();
    setEditingStepId(null);
    setIsStepPickerOpen(false);
    setIsStepFormOpen(false);
  }

  function pickNewStepFunction(value: string) {
    selectStep(value);
    setIsStepPickerOpen(false);
    setIsStepFormOpen(true);
  }

  function startEditStep(step: Step) {
    resetStepSelectionState();
    setEditingStepId(step.id);
    if (step.kind === "builtin") {
      setStepBuiltinId(step.meta.id);
      setStepBuiltinArgs({ ...step.args });
    } else if (step.kind === "customFunction") {
      setStepFunctionName(step.functionName);
      setStepFunctionArgs({ ...step.args });
    } else if (step.kind === "flowControl") {
      setStepFlowType(step.flowType);
      setStepFlowCondition(step.condition);
      setStepFlowBody(step.body);
      setStepFlowElseBody(step.elseBody ?? []);
    } else if (step.kind === "showMenu") {
      setStepIsMenu(true);
      setStepMenuTitle(step.title);
      setStepMenuItems(step.items);
    } else if (step.kind === "createGui") {
      setStepIsCreateGui(true);
      setStepGuiTitle(step.title);
      setStepGuiResizable(step.resizable);
      setStepGuiAlwaysOnTop(step.alwaysOnTop);
      setStepGuiNoCaption(step.noCaption);
      setStepGuiToolWindow(step.toolWindow);
      setStepGuiInitialState(step.initialState);
      setStepGuiWidth(step.width !== undefined ? String(step.width) : "");
      setStepGuiHeight(step.height !== undefined ? String(step.height) : "");
      setStepGuiX(step.x !== undefined ? String(step.x) : "");
      setStepGuiY(step.y !== undefined ? String(step.y) : "");
      setStepGuiUseColor(Boolean(step.color));
      setStepGuiColor(step.color ?? "ffffff");
      setStepGuiUseOpacity(step.opacity !== undefined);
      setStepGuiOpacity(step.opacity ?? 255);
      setStepGuiControls(step.controls);
    } else if (step.kind === "closeGui") {
      setStepIsCloseGui(true);
      setStepCloseGuiTarget(step.targetVar);
    } else {
      setStepVarAction(step.action);
      setStepVarTargetName(step.targetName);
      if (step.action === "set") setStepVarSetValue(step.value);
      else if (step.action === "increment") setStepVarIncrementAmount(step.amount);
      else if (step.action === "create") {
        setStepVarCreateType(step.varType);
        setStepVarCreateInitialValue(step.initialValue);
        setStepVarCreateScope(step.scope);
      } else if (step.action === "promptInput") {
        setStepVarPromptText(step.prompt);
        setStepVarPromptTitle(step.title);
      }
    }
    setIsStepFormOpen(true);
  }

  const varStepReady =
    stepVarAction === "set"
      ? isValidAhkIdentifier(trimmedVarTargetName) &&
        (stepVarSetValue.kind !== "literal" || String(stepVarSetValue.value ?? "").trim() !== "")
      : stepVarAction === "increment" ||
          stepVarAction === "toggle" ||
          stepVarAction === "create" ||
          stepVarAction === "promptInput"
        ? isValidAhkIdentifier(trimmedVarTargetName)
        : false;

  function buildStepFromSelection(): Step | null {
    if (stepFunctionName) {
      if (!stepFunctionTarget || !areArgsFilled(stepFunctionCallParams, stepFunctionArgs)) return null;
      return { id: -1, kind: "customFunction", functionName: stepFunctionName, args: { ...stepFunctionArgs } };
    }
    if (stepBuiltinId) {
      if (!stepBuiltin || !areArgsFilled(stepBuiltin.params, stepBuiltinArgs)) return null;
      return { id: -1, kind: "builtin", meta: stepBuiltin, args: { ...stepBuiltinArgs } };
    }
    if (stepVarAction) {
      if (!varStepReady) return null;
      const targetName = trimmedVarTargetName;
      if (stepVarAction === "set") {
        return { id: -1, kind: "variableAction", action: "set", targetName, value: stepVarSetValue };
      }
      if (stepVarAction === "increment") {
        return {
          id: -1,
          kind: "variableAction",
          action: "increment",
          targetName,
          amount: stepVarIncrementAmount,
        };
      }
      if (stepVarAction === "toggle") {
        return { id: -1, kind: "variableAction", action: "toggle", targetName };
      }
      if (stepVarAction === "promptInput") {
        return {
          id: -1,
          kind: "variableAction",
          action: "promptInput",
          targetName,
          prompt: stepVarPromptText,
          title: stepVarPromptTitle,
        };
      }
      return {
        id: -1,
        kind: "variableAction",
        action: "create",
        targetName,
        varType: stepVarCreateType,
        initialValue: stepVarCreateInitialValue,
        scope: stepVarCreateScope,
      };
    }
    if (stepFlowType) {
      if (!isConditionReady(stepFlowCondition)) return null;
      return {
        id: -1,
        kind: "flowControl",
        flowType: stepFlowType,
        condition: stepFlowCondition,
        body: stepFlowBody,
        ...(stepFlowType === "conditional" && stepFlowElseBody.length > 0
          ? { elseBody: stepFlowElseBody }
          : {}),
      };
    }
    if (stepIsMenu) {
      if (stepMenuTitle.trim() === "" || stepMenuItems.length === 0) return null;
      return { id: -1, kind: "showMenu", title: stepMenuTitle.trim(), items: stepMenuItems };
    }
    if (stepIsCreateGui) {
      const varName = guiVarNameFromTitle(stepGuiTitle.trim());
      if (stepGuiTitle.trim() === "" || !isValidAhkIdentifier(varName)) return null;
      const parseDimension = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));
      return {
        id: -1,
        kind: "createGui",
        varName,
        title: stepGuiTitle.trim(),
        resizable: stepGuiResizable,
        alwaysOnTop: stepGuiAlwaysOnTop,
        noCaption: stepGuiNoCaption,
        toolWindow: stepGuiToolWindow,
        initialState: stepGuiInitialState,
        ...(stepGuiUseColor ? { color: stepGuiColor } : {}),
        ...(parseDimension(stepGuiWidth) !== undefined ? { width: parseDimension(stepGuiWidth) } : {}),
        ...(parseDimension(stepGuiHeight) !== undefined ? { height: parseDimension(stepGuiHeight) } : {}),
        ...(parseDimension(stepGuiX) !== undefined ? { x: parseDimension(stepGuiX) } : {}),
        ...(parseDimension(stepGuiY) !== undefined ? { y: parseDimension(stepGuiY) } : {}),
        ...(stepGuiUseOpacity ? { opacity: stepGuiOpacity } : {}),
        controls: stepGuiControls,
      };
    }
    if (stepIsCloseGui) {
      if (!stepCloseGuiTarget) return null;
      return { id: -1, kind: "closeGui", targetVar: stepCloseGuiTarget };
    }
    return null;
  }

  const menuItemBuiltin = BUILTIN_FUNCTIONS.find((f) => f.id === menuItemBuiltinId);
  const menuItemFunctionTarget = functions.find((f) => f.name === menuItemFunctionName);
  const menuItemFunctionCallParams = menuItemFunctionTarget
    ? expandHeaderParamsToCallParams(menuItemFunctionTarget.params)
    : [];
  const menuItemSelection = menuItemBuiltinId
    ? `builtin:${menuItemBuiltinId}`
    : menuItemFunctionName
      ? `custom:${menuItemFunctionName}`
      : "";

  const menuItemPickerItems: FunctionPickerItem[] = [
    ...BUILTIN_FUNCTIONS.map((f) => ({
      value: `builtin:${f.id}`,
      label: tFunctionName(t, f),
      description: tFunctionDescription(t, f),
      group: tFunctionCategoryLabel(t, f.category),
    })),
    ...functions.map((f) => ({
      value: `custom:${f.name}`,
      label: f.name,
      description: f.description || undefined,
      group: t("functionsSection.groupCustom", "Personalizadas"),
    })),
  ];

  const menuItemReady =
    menuItemLabel.trim() !== "" &&
    (menuItemBuiltinId
      ? Boolean(menuItemBuiltin) && areArgsFilled(menuItemBuiltin!.params, menuItemBuiltinArgs)
      : menuItemFunctionName
        ? Boolean(menuItemFunctionTarget) && areArgsFilled(menuItemFunctionCallParams, menuItemFunctionArgs)
        : false);

  function openMenuItemForm() {
    setEditingMenuItemId(null);
    setMenuItemLabel("");
    setMenuItemBuiltinId("");
    setMenuItemBuiltinArgs({});
    setMenuItemFunctionName("");
    setMenuItemFunctionArgs({});
    setIsMenuItemFormOpen(true);
  }

  function closeMenuItemForm() {
    setIsMenuItemFormOpen(false);
    setEditingMenuItemId(null);
  }

  function editMenuItem(item: MenuItem) {
    setEditingMenuItemId(item.id);
    setMenuItemLabel(item.label);
    if (item.target.kind === "builtin") {
      setMenuItemBuiltinId(item.target.meta.id);
      setMenuItemBuiltinArgs({ ...item.target.args });
      setMenuItemFunctionName("");
      setMenuItemFunctionArgs({});
    } else {
      setMenuItemFunctionName(item.target.functionName);
      setMenuItemFunctionArgs({ ...item.target.args });
      setMenuItemBuiltinId("");
      setMenuItemBuiltinArgs({});
    }
    setIsMenuItemFormOpen(true);
  }

  function removeMenuItem(id: number) {
    setStepMenuItems((prev) => prev.filter((i) => i.id !== id));
  }

  function selectMenuItemTarget(value: string) {
    if (value.startsWith("builtin:")) {
      const id = value.slice("builtin:".length);
      const meta = BUILTIN_FUNCTIONS.find((f) => f.id === id);
      setMenuItemBuiltinId(id);
      setMenuItemBuiltinArgs(meta ? defaultArgValues(meta.params) : {});
      setMenuItemFunctionName("");
      setMenuItemFunctionArgs({});
    } else if (value.startsWith("custom:")) {
      const name = value.slice("custom:".length);
      const target = functions.find((f) => f.name === name);
      setMenuItemFunctionName(name);
      setMenuItemFunctionArgs(target ? defaultArgValues(expandHeaderParamsToCallParams(target.params)) : {});
      setMenuItemBuiltinId("");
      setMenuItemBuiltinArgs({});
    }
  }

  function submitMenuItem() {
    if (!menuItemReady) return;
    const target: MenuItemTarget = menuItemBuiltinId
      ? { kind: "builtin", meta: menuItemBuiltin!, args: { ...menuItemBuiltinArgs } }
      : { kind: "customFunction", functionName: menuItemFunctionName, args: { ...menuItemFunctionArgs } };

    if (editingMenuItemId !== null) {
      setStepMenuItems((prev) =>
        prev.map((i) => (i.id === editingMenuItemId ? { ...i, label: menuItemLabel.trim(), target } : i))
      );
    } else {
      setStepMenuItems((prev) => [...prev, { id: nextMenuItemIdRef.current++, label: menuItemLabel.trim(), target }]);
    }
    closeMenuItemForm();
  }

  const guiControlBuiltin = BUILTIN_FUNCTIONS.find((f) => f.id === guiControlBuiltinId);
  const guiControlFunctionTarget = functions.find((f) => f.name === guiControlFunctionName);
  const guiControlFunctionCallParams = guiControlFunctionTarget
    ? expandHeaderParamsToCallParams(guiControlFunctionTarget.params)
    : [];
  const guiControlSelection = guiControlBuiltinId
    ? `builtin:${guiControlBuiltinId}`
    : guiControlFunctionName
      ? `custom:${guiControlFunctionName}`
      : "";

  const guiControlReady =
    guiControlType === "text"
      ? guiControlText.trim() !== ""
      : guiControlType === "button"
        ? guiControlText.trim() !== "" &&
          (guiControlBuiltinId
            ? Boolean(guiControlBuiltin) && areArgsFilled(guiControlBuiltin!.params, guiControlBuiltinArgs)
            : guiControlFunctionName
              ? Boolean(guiControlFunctionTarget) &&
                areArgsFilled(guiControlFunctionCallParams, guiControlFunctionArgs)
              : false)
        : guiControlType === "edit"
          ? true
          : guiControlType === "checkbox"
            ? guiControlText.trim() !== ""
            : guiControlType === "dropdown"
              ? guiControlOptions.length > 0
              : guiControlCode.trim() !== "";

  function resetGuiControlFormState() {
    setEditingGuiControlId(null);
    setGuiControlType("text");
    setGuiControlText("");
    setGuiControlInitialValue("");
    setGuiControlMultiline(false);
    setGuiControlChecked(false);
    setGuiControlOptions([]);
    setGuiControlNewOption("");
    setGuiControlX("");
    setGuiControlY("");
    setGuiControlWidth("");
    setGuiControlHeight("");
    setGuiControlUseColor(false);
    setGuiControlColor("ffffff");
    setGuiControlCode("");
    setGuiControlBuiltinId("");
    setGuiControlBuiltinArgs({});
    setGuiControlFunctionName("");
    setGuiControlFunctionArgs({});
  }

  function openGuiControlForm() {
    resetGuiControlFormState();
    setIsGuiControlFormOpen(true);
  }

  function closeGuiControlForm() {
    setIsGuiControlFormOpen(false);
    resetGuiControlFormState();
  }

  function editGuiControl(control: GuiControl) {
    resetGuiControlFormState();
    setEditingGuiControlId(control.id);
    setGuiControlType(control.type);
    if ("x" in control && control.x !== undefined) setGuiControlX(String(control.x));
    if ("y" in control && control.y !== undefined) setGuiControlY(String(control.y));
    if ("width" in control && control.width !== undefined) setGuiControlWidth(String(control.width));
    if ("height" in control && control.height !== undefined) setGuiControlHeight(String(control.height));
    if ("color" in control && control.color) {
      setGuiControlUseColor(true);
      setGuiControlColor(control.color);
    }
    if (control.type === "text") {
      setGuiControlText(control.text);
    } else if (control.type === "button") {
      setGuiControlText(control.text);
      if (control.onClick.kind === "builtin") {
        setGuiControlBuiltinId(control.onClick.meta.id);
        setGuiControlBuiltinArgs({ ...control.onClick.args });
      } else {
        setGuiControlFunctionName(control.onClick.functionName);
        setGuiControlFunctionArgs({ ...control.onClick.args });
      }
    } else if (control.type === "edit") {
      setGuiControlInitialValue(control.initialValue);
      setGuiControlMultiline(control.multiline);
    } else if (control.type === "checkbox") {
      setGuiControlText(control.label);
      setGuiControlChecked(control.checked);
    } else if (control.type === "dropdown") {
      setGuiControlOptions(control.options);
    } else {
      setGuiControlCode(control.code);
    }
    setIsGuiControlFormOpen(true);
  }

  function removeGuiControl(id: number) {
    setStepGuiControls((prev) => prev.filter((c) => c.id !== id));
  }

  function selectGuiControlTarget(value: string) {
    if (value.startsWith("builtin:")) {
      const id = value.slice("builtin:".length);
      const meta = BUILTIN_FUNCTIONS.find((f) => f.id === id);
      setGuiControlBuiltinId(id);
      setGuiControlBuiltinArgs(meta ? defaultArgValues(meta.params) : {});
      setGuiControlFunctionName("");
      setGuiControlFunctionArgs({});
    } else if (value.startsWith("custom:")) {
      const name = value.slice("custom:".length);
      const target = functions.find((f) => f.name === name);
      setGuiControlFunctionName(name);
      setGuiControlFunctionArgs(target ? defaultArgValues(expandHeaderParamsToCallParams(target.params)) : {});
      setGuiControlBuiltinId("");
      setGuiControlBuiltinArgs({});
    }
  }

  function addGuiControlOption() {
    const value = guiControlNewOption.trim();
    if (!value) return;
    setGuiControlOptions((prev) => [...prev, value]);
    setGuiControlNewOption("");
  }

  function removeGuiControlOption(index: number) {
    setGuiControlOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function submitGuiControl() {
    if (!guiControlReady) return;
    const parseDimension = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));
    const x = parseDimension(guiControlX);
    const y = parseDimension(guiControlY);
    const width = parseDimension(guiControlWidth);
    const height = parseDimension(guiControlHeight);

    const id = editingGuiControlId ?? -1;
    let control: GuiControl;
    if (guiControlType === "text") {
      control = {
        id,
        type: "text",
        text: guiControlText.trim(),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(guiControlUseColor ? { color: guiControlColor } : {}),
      };
    } else if (guiControlType === "button") {
      const onClick: MenuItemTarget = guiControlBuiltinId
        ? { kind: "builtin", meta: guiControlBuiltin!, args: { ...guiControlBuiltinArgs } }
        : { kind: "customFunction", functionName: guiControlFunctionName, args: { ...guiControlFunctionArgs } };
      control = {
        id,
        type: "button",
        text: guiControlText.trim(),
        onClick,
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      };
    } else if (guiControlType === "edit") {
      control = {
        id,
        type: "edit",
        initialValue: guiControlInitialValue,
        multiline: guiControlMultiline,
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(guiControlUseColor ? { color: guiControlColor } : {}),
      };
    } else if (guiControlType === "checkbox") {
      control = {
        id,
        type: "checkbox",
        label: guiControlText.trim(),
        checked: guiControlChecked,
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
        ...(guiControlUseColor ? { color: guiControlColor } : {}),
      };
    } else if (guiControlType === "dropdown") {
      control = {
        id,
        type: "dropdown",
        options: [...guiControlOptions],
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(guiControlUseColor ? { color: guiControlColor } : {}),
      };
    } else {
      control = { id, type: "code", code: guiControlCode };
    }

    if (editingGuiControlId !== null) {
      setStepGuiControls((prev) => prev.map((c) => (c.id === editingGuiControlId ? control : c)));
    } else {
      setStepGuiControls((prev) => [...prev, { ...control, id: nextGuiControlIdRef.current++ }]);
    }
    closeGuiControlForm();
  }

  function submitStep() {
    const stepData = buildStepFromSelection();
    if (!stepData) return;

    if (editingStepId !== null) {
      const finalStep: Step = { ...stepData, id: editingStepId };
      onChange(steps.map((s) => (s.id === editingStepId ? finalStep : s)));
    } else {
      const finalStep: Step = { ...stepData, id: nextStepIdRef.current++ };
      onChange([...steps, finalStep]);
    }
    closeStepForm();
  }

  function reorderSteps(draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const dragIndex = steps.findIndex((s) => s.id === draggedId);
    const dropIndex = steps.findIndex((s) => s.id === targetId);
    if (dragIndex === -1 || dropIndex === -1) return;
    const next = [...steps];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next);
  }

  function removeStep(id: number) {
    onChange(steps.filter((s) => s.id !== id));
  }

  function setStepBuiltinArg(key: string, arg: ArgSource) {
    setStepBuiltinArgs((prev) => ({ ...prev, [key]: arg }));
  }

  function setStepFunctionArg(key: string, arg: ArgSource) {
    setStepFunctionArgs((prev) => ({ ...prev, [key]: arg }));
  }

  function setVarSourceSelection(rawValue: string) {
    if (!rawValue) {
      setStepVarSetValue({ kind: "literal", value: "" });
      return;
    }
    const idx = rawValue.indexOf(":");
    const prefix = rawValue.slice(0, idx);
    const nameValue = rawValue.slice(idx + 1);
    if (prefix === "header") setStepVarSetValue({ kind: "headerParam", paramKey: nameValue });
    else if (prefix === "local") setStepVarSetValue({ kind: "localVariable", variableName: nameValue });
    else if (prefix === "global") setStepVarSetValue({ kind: "globalVariable", variableName: nameValue });
  }

  function varSourceSelectValue(): string {
    if (stepVarSetValue.kind === "headerParam") return `header:${stepVarSetValue.paramKey}`;
    if (stepVarSetValue.kind === "localVariable") return `local:${stepVarSetValue.variableName}`;
    if (stepVarSetValue.kind === "globalVariable") return `global:${stepVarSetValue.variableName}`;
    return "";
  }

  /** Declared type of the variable a "definir"/"incrementar"/... action targets, if it is a known one. */
  function varTargetType(name: string): HeaderParamType | undefined {
    return [...localVariables, ...globalVariables].find((v) => v.key === name)?.type;
  }

  const isCoordinateVarTarget = varTargetType(stepVarTargetName) === "coordinate";

  /** Keeps the pending "definir" value in the shape the newly picked target variable expects. */
  function selectVarTarget(name: string) {
    setStepVarTargetName(name);
    const wantsCoordinate = varTargetType(name) === "coordinate";
    setStepVarSetValue((prev) =>
      wantsCoordinate === (prev.kind === "coordinate")
        ? prev
        : wantsCoordinate
          ? EMPTY_COORDINATE_ASSIGNMENT
          : { kind: "literal", value: "" }
    );
  }

  const formZ = 30 + depth * 2;

  return (
    <div className="flex flex-col gap-2">
      {steps.length === 0 ? (
        <p className="opacity-60 text-xs">{t("functionsSection.emptySteps", "Nenhum passo adicionado ainda.")}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {steps.map((step, index) => (
            <li
              key={step.id}
              draggable={!isRecordModalOpen}
              onDragStart={() => setDraggedStepId(step.id)}
              onDragEnd={() => setDraggedStepId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedStepId !== null) reorderSteps(draggedStepId, step.id);
                setDraggedStepId(null);
              }}
              className={`flex items-center justify-between bg-menu-secondary rounded-lg px-2.5 py-1 text-xs gap-2 ${
                isRecordModalOpen ? "" : "cursor-grab active:cursor-grabbing"
              } ${draggedStepId === step.id ? "opacity-40" : ""}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="opacity-40 select-none" aria-hidden="true">
                  ⠿
                </span>
                <span className="font-mono truncate">
                  {index + 1}. {stepLabel(t, step, functions)}
                </span>
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  className="button-secondary py-0.5 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isRecordModalOpen}
                  onClick={() => startEditStep(step)}
                >
                  {t("functionsSection.edit", "Editar")}
                </button>
                <button
                  className="button-secondary py-0.5 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isRecordModalOpen}
                  onClick={() => removeStep(step.id)}
                >
                  {t("functionsSection.remove", "Remover")}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="button-secondary flex items-center gap-1.5 justify-center text-sm w-fit disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={isRecordModalOpen}
          onClick={openStepPicker}
        >
          {t("functionsSection.addStep", "Adicionar passo")}
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor">
            <line x1="8" y1="2.5" x2="8" y2="13.5" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="2.5" y1="8" x2="13.5" y2="8" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className="button-secondary flex items-center gap-1.5 justify-center text-sm w-fit disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!isDesktop || isRecordModalOpen}
          title={
            isDesktop
              ? undefined
              : t(
                  "functionsSection.recordDesktopOnly",
                  "Gravar comandos só está disponível no aplicativo desktop."
                )
          }
          onClick={openRecordModal}
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {t("functionsSection.startRecording", "Gravar comandos")}
        </button>
      </div>

      {isRecordModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          style={{ zIndex: formZ }}
        >
          <div className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-lg max-h-[85vh] overflow-auto">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isCapturing ? "bg-red-500 animate-pulse" : "bg-gray-500"
                }`}
              />
              <span className="text-sm font-semibold">
                {isCapturing
                  ? t("functionsSection.recordingTitle", "Gravando comandos...")
                  : t("functionsSection.recordingPausedTitle", "Gravação pausada")}
              </span>
            </div>

            <div className="flex flex-col gap-2 bg-menu-secondary/40 rounded-lg p-3">
              <RecordOptionCheckbox
                checked={recordFullScreen}
                onChange={setRecordFullScreen}
                label={t(
                  "functionsSection.recordClickFullScreen",
                  "Considerar cliques relativos à tela toda (senão, à janela clicada)"
                )}
              />
              <RecordOptionCheckbox
                checked={recordInsertWaits}
                onChange={setRecordInsertWaits}
                label={t(
                  "functionsSection.recordInsertWaits",
                  "Inserir esperas entre os passos (tempo real entre as ações)"
                )}
              />
              <RecordOptionCheckbox
                checked={recordConvertDrag}
                onChange={setRecordConvertDrag}
                label={t(
                  "functionsSection.recordConvertDrag",
                  "Converter cliques alongados em arrastar"
                )}
              />
              <RecordOptionCheckbox
                checked={recordTimeKeys}
                onChange={setRecordTimeKeys}
                label={t(
                  "functionsSection.recordTimeKeys",
                  "Cronometrar teclas alongadas (tempo real segurado)"
                )}
              />
            </div>

            <button
              type="button"
              className={`flex items-center gap-1.5 justify-center text-sm rounded-lg px-3 py-1.5 cursor-pointer ${
                isCapturing ? "bg-red-500/80 hover:bg-red-500 text-white" : "button-main"
              }`}
              onClick={isCapturing ? pauseCapturing : startCapturing}
            >
              {isCapturing
                ? t("functionsSection.pauseRecording", "Pausar gravação")
                : stagedSteps.length > 0
                  ? t("functionsSection.resumeRecording", "Retomar gravação")
                  : t("functionsSection.startCapturing", "Iniciar")}
            </button>

            {stagedSteps.length === 0 ? (
              <p className="opacity-60 text-xs">
                {t(
                  "functionsSection.recordingEmpty",
                  "Nenhum comando gravado ainda — use o mouse/teclado fora do app."
                )}
              </p>
            ) : (
              <StepListEditor
                steps={stagedSteps}
                onChange={setStagedSteps}
                functions={functions}
                headerParams={headerParams}
                localVariables={localVariables}
                globalVariables={globalVariables}
                guiVariables={guiVariables}
                nextStepIdRef={nextStepIdRef}
                depth={depth + 1}
              />
            )}

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={discardRecording}>
                {t("functionsSection.discardRecording", "Descartar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={stagedSteps.length === 0}
                onClick={commitRecording}
              >
                {t("functionsSection.addRecordedSteps", "Adicionar passos")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isStepPickerOpen && (
        <FunctionPickerPopup
          items={stepPickerItems}
          value={stepSelection}
          onSelect={pickNewStepFunction}
          onClose={closeStepForm}
        />
      )}

      {isStepFormOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          style={{ zIndex: formZ }}
          onMouseDown={closeStepForm}
        >
          <div
            className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-lg max-h-[85vh] overflow-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold">
              {editingStepId !== null
                ? t("functionsSection.editStepTitle", "Editar passo")
                : t("functionsSection.newStepTitle", "Novo passo")}
            </span>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-70">
                  {t("functionsSection.selectStepFunction", "Selecione uma função")}
                </label>
                <FunctionPicker
                  items={stepPickerItems}
                  value={stepSelection}
                  onChange={selectStep}
                  placeholder={t("functionsSection.selectStepFunction", "Selecione uma função")}
                  className="w-full"
                />
              </div>

              {stepBuiltin && stepBuiltin.params.length > 0 && (
                <StepArgsFields
                  targetId={stepBuiltin.id}
                  params={stepBuiltin.params}
                  headerParams={headerParams}
                  localVariables={localVariables}
                  globalVariables={globalVariables}
                  values={stepBuiltinArgs}
                  onChange={setStepBuiltinArg}
                  resetSignal={stepResetSignal}
                  title={t("paramsFields.title", "Parâmetros de {{name}}", {
                    name: tFunctionName(t, stepBuiltin),
                  })}
                />
              )}

              {stepFunctionTarget && stepFunctionCallParams.length > 0 && (
                <StepArgsFields
                  params={stepFunctionCallParams}
                  headerParams={headerParams}
                  localVariables={localVariables}
                  globalVariables={globalVariables}
                  values={stepFunctionArgs}
                  onChange={setStepFunctionArg}
                  resetSignal={stepResetSignal}
                  title={t("paramsFields.title", "Parâmetros de {{name}}", {
                    name: stepFunctionTarget.name,
                  })}
                />
              )}

              {stepVarAction && (
                <div className="flex flex-col gap-2 bg-menu-secondary/40 rounded-lg p-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-70">
                      {stepVarAction === "create"
                        ? t("functionsSection.varActionNewNameLabel", "Nome da nova variável")
                        : t("functionsSection.varActionTargetLabel", "Variável")}
                    </label>
                    {stepVarAction === "create" ? (
                      <>
                        <input
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                          value={stepVarTargetName}
                          onChange={(e) => setStepVarTargetName(e.target.value)}
                          placeholder={t("variablesSection.namePlaceholder", "Ex: contador")}
                        />
                        {trimmedVarTargetName !== "" && !isValidAhkIdentifier(trimmedVarTargetName) && (
                          <span className="text-xs text-red-400">
                            {t(
                              "functionsSection.invalidName",
                              "Nome inválido: use apenas letras, números e _, sem começar com número."
                            )}
                          </span>
                        )}
                      </>
                    ) : localVarTargets.length === 0 && globalVarTargets.length === 0 ? (
                      <p className="opacity-60 text-xs">
                        {t(
                          "functionsSection.noVariablesAvailable",
                          "Nenhuma variável disponível — crie uma primeiro."
                        )}
                      </p>
                    ) : (
                      <select
                        className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 w-full text-sm appearance-none"
                        value={stepVarTargetName}
                        onChange={(e) => selectVarTarget(e.target.value)}
                      >
                        <option value="">
                          {t("functionsSection.selectVariablePlaceholder", "Selecione uma variável")}
                        </option>
                        {localVarTargets.length > 0 && (
                          <optgroup label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}>
                            {localVarTargets.map((v) => (
                              <option key={v.key} value={v.key}>
                                {v.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {globalVarTargets.length > 0 && (
                          <optgroup label={t("stepArgsFields.groupGlobalVariables", "Variáveis globais")}>
                            {globalVarTargets.map((v) => (
                              <option key={v.key} value={v.key}>
                                {v.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                  </div>

                  {stepVarAction === "set" && isCoordinateVarTarget && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.varActionValueLabel", "Novo valor")}
                      </label>
                      <CoordinateValueFields
                        value={
                          stepVarSetValue.kind === "coordinate"
                            ? stepVarSetValue
                            : EMPTY_COORDINATE_ASSIGNMENT
                        }
                        onChange={setStepVarSetValue}
                        headerParams={headerParams}
                        localVariables={localVariables}
                        globalVariables={globalVariables}
                      />
                    </div>
                  )}

                  {stepVarAction === "set" && !isCoordinateVarTarget && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs opacity-70">
                          {t("functionsSection.varActionValueLabel", "Novo valor")}
                        </label>
                        {(headerParams.length > 0 || localVariables.length > 0 || globalVariables.length > 0) && (
                          <select
                            className="bg-menu-secondary rounded px-2 py-1 outline-none cursor-pointer text-xs appearance-none"
                            value={varSourceSelectValue()}
                            onChange={(e) => setVarSourceSelection(e.target.value)}
                          >
                            <option value="">{t("stepArgsFields.fixedValue", "Valor fixo")}</option>
                            {headerParams.length > 0 && (
                              <optgroup label={t("stepArgsFields.groupHeaderParams", "Parâmetros do cabeçalho")}>
                                {headerParams.map((p) => (
                                  <option key={`header:${p.key}`} value={`header:${p.key}`}>
                                    {p.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {localVariables.length > 0 && (
                              <optgroup label={t("stepArgsFields.groupLocalVariables", "Variáveis locais")}>
                                {localVariables.map((v) => (
                                  <option key={`local:${v.key}`} value={`local:${v.key}`}>
                                    {v.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {globalVariables.length > 0 && (
                              <optgroup label={t("stepArgsFields.groupGlobalVariables", "Variáveis globais")}>
                                {globalVariables.map((v) => (
                                  <option key={`global:${v.key}`} value={`global:${v.key}`}>
                                    {v.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        )}
                      </div>
                      {stepVarSetValue.kind === "literal" ? (
                        <input
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                          value={String(stepVarSetValue.value ?? "")}
                          onChange={(e) => setStepVarSetValue({ kind: "literal", value: e.target.value })}
                        />
                      ) : stepVarSetValue.kind === "coordinate" ? null : (
                        <ArgSourceValue
                          arg={stepVarSetValue}
                          label={t("functionsSection.varActionUsingSource", 'Usando "{{name}}"', {
                            name:
                              stepVarSetValue.kind === "headerParam"
                                ? stepVarSetValue.paramKey
                                : stepVarSetValue.variableName,
                          })}
                          onChange={setStepVarSetValue}
                        />
                      )}
                    </div>
                  )}

                  {stepVarAction === "increment" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.varActionAmountLabel", "Quantidade (pode ser negativa)")}
                      </label>
                      <input
                        type="number"
                        className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                        value={stepVarIncrementAmount}
                        onChange={(e) => setStepVarIncrementAmount(Number(e.target.value))}
                      />
                    </div>
                  )}

                  {stepVarAction === "create" && (
                    <>
                      <div className="flex gap-2">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs opacity-70">
                            {t("variablesSection.typeLabel", "Tipo")}
                          </label>
                          <select
                            className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 text-sm appearance-none"
                            value={stepVarCreateType}
                            onChange={(e) => {
                              const nextType = e.target.value as VariableType;
                              setStepVarCreateType(nextType);
                              setStepVarCreateInitialValue(defaultVariableValue(nextType));
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
                        {stepVarCreateType !== "array" && stepVarCreateType !== "coordinate" && (
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs opacity-70">
                              {t("variablesSection.initialValueLabel", "Valor inicial")}
                            </label>
                            {stepVarCreateType === "boolean" ? (
                              <label className="flex items-center gap-2 text-sm cursor-pointer select-none h-9">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4"
                                  checked={Boolean(stepVarCreateInitialValue)}
                                  onChange={(e) => setStepVarCreateInitialValue(e.target.checked)}
                                />
                                {t("variablesSection.trueLabel", "Verdadeiro")}
                              </label>
                            ) : (
                              <input
                                type={stepVarCreateType === "number" ? "number" : "text"}
                                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                                value={String(stepVarCreateInitialValue)}
                                onChange={(e) =>
                                  setStepVarCreateInitialValue(
                                    stepVarCreateType === "number" ? Number(e.target.value) : e.target.value
                                  )
                                }
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {stepVarCreateType === "coordinate" && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-70">
                            {t("variablesSection.initialValueLabel", "Valor inicial")}
                          </label>
                          <CoordinateLiteralFields
                            value={toCoordinateLiteral(stepVarCreateInitialValue)}
                            onChange={setStepVarCreateInitialValue}
                          />
                        </div>
                      )}

                      {stepVarCreateType === "array" && (
                        <div className="flex flex-col gap-1.5 bg-menu-secondary/60 rounded-lg p-2">
                          <span className="text-xs opacity-70">
                            {t("variablesSection.arrayItemsLabel", "Itens iniciais do array")}
                          </span>
                          {Array.isArray(stepVarCreateInitialValue) && stepVarCreateInitialValue.length > 0 && (
                            <ul className="flex flex-wrap gap-1">
                              {stepVarCreateInitialValue.map((item, index) => (
                                <li
                                  key={`${item}-${index}`}
                                  className="flex items-center gap-1 bg-menu-secondary rounded px-2 py-1 text-xs"
                                >
                                  {item}
                                  <button
                                    type="button"
                                    className="opacity-60 hover:opacity-100 cursor-pointer"
                                    onClick={() =>
                                      setStepVarCreateInitialValue((prev) =>
                                        Array.isArray(prev) ? prev.filter((_, i) => i !== index) : prev
                                      )
                                    }
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
                              value={stepVarArrayNewItem}
                              onChange={(e) => setStepVarArrayNewItem(e.target.value)}
                              placeholder={t("functionsSection.paramOptionPlaceholder", "Ex: Rápido")}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                const value = stepVarArrayNewItem.trim();
                                if (!value) return;
                                setStepVarCreateInitialValue((prev) =>
                                  Array.isArray(prev) ? [...prev, value] : [value]
                                );
                                setStepVarArrayNewItem("");
                              }}
                            />
                            <button
                              type="button"
                              className="button-secondary py-1 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={!stepVarArrayNewItem.trim()}
                              onClick={() => {
                                const value = stepVarArrayNewItem.trim();
                                if (!value) return;
                                setStepVarCreateInitialValue((prev) =>
                                  Array.isArray(prev) ? [...prev, value] : [value]
                                );
                                setStepVarArrayNewItem("");
                              }}
                            >
                              {t("functionsSection.addParamOption", "Adicionar opção")}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="text-xs opacity-70">
                          {t("functionsSection.varActionScopeLabel", "Escopo")}
                        </label>
                        <div className="flex gap-1 bg-menu-secondary rounded-md p-0.5 text-xs w-fit">
                          <button
                            type="button"
                            className={`px-2 py-1 rounded outline-none focus:outline-none cursor-pointer ${
                              stepVarCreateScope === "local" ? "bg-(--main) text-white" : "opacity-60"
                            }`}
                            onClick={() => setStepVarCreateScope("local")}
                          >
                            {t("functionsSection.varActionScopeLocal", "Local")}
                          </button>
                          <button
                            type="button"
                            className={`px-2 py-1 rounded outline-none focus:outline-none cursor-pointer ${
                              stepVarCreateScope === "global" ? "bg-(--main) text-white" : "opacity-60"
                            }`}
                            onClick={() => setStepVarCreateScope("global")}
                          >
                            {t("functionsSection.varActionScopeGlobal", "Global")}
                          </button>
                        </div>
                        {stepVarCreateScope === "global" && (
                          <span className="text-xs opacity-60">
                            {t(
                              "functionsSection.varActionScopeGlobalHint",
                              "Vai aparecer também na aba Variáveis globais."
                            )}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {stepVarAction === "promptInput" && (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs opacity-70">
                          {t("functionsSection.varActionPromptTitleLabel", "Título da caixa")}
                        </label>
                        <input
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                          value={stepVarPromptTitle}
                          onChange={(e) => setStepVarPromptTitle(e.target.value)}
                          placeholder={t("functionsSection.varActionPromptTitlePlaceholder", "Ex: Nome do arquivo")}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs opacity-70">
                          {t("functionsSection.varActionPromptTextLabel", "Texto da pergunta")}
                        </label>
                        <input
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                          value={stepVarPromptText}
                          onChange={(e) => setStepVarPromptText(e.target.value)}
                          placeholder={t(
                            "functionsSection.varActionPromptTextPlaceholder",
                            "Ex: Digite o nome do arquivo:"
                          )}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {stepFlowType && (
                <>
                  <ConditionFields
                    condition={stepFlowCondition}
                    onChange={setStepFlowCondition}
                    headerParams={headerParams}
                    localVariables={localVariables}
                    globalVariables={globalVariables}
                  />

                  <div className="flex flex-col gap-1.5 bg-menu-secondary/30 border border-white/10 rounded-lg p-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                      {stepFlowType === "loop"
                        ? t("functionsSection.flowBodyLoopTitle", "Corpo do loop")
                        : t("functionsSection.flowBodyTitle", "Corpo (se verdadeiro)")}
                    </span>
                    <StepListEditor
                      steps={stepFlowBody}
                      onChange={setStepFlowBody}
                      functions={functions}
                      headerParams={headerParams}
                      localVariables={localVariables}
                      globalVariables={globalVariables}
                      guiVariables={guiVariables}
                      nextStepIdRef={nextStepIdRef}
                      depth={depth + 1}
                    />
                  </div>

                  {stepFlowType === "conditional" && (
                    <div className="flex flex-col gap-1.5 bg-menu-secondary/30 border border-white/10 rounded-lg p-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                        {t("functionsSection.flowElseBodyTitle", "Senão (opcional)")}
                      </span>
                      <StepListEditor
                        steps={stepFlowElseBody}
                        onChange={setStepFlowElseBody}
                        functions={functions}
                        headerParams={headerParams}
                        localVariables={localVariables}
                        globalVariables={globalVariables}
                        guiVariables={guiVariables}
                        nextStepIdRef={nextStepIdRef}
                        depth={depth + 1}
                      />
                    </div>
                  )}
                </>
              )}

              {stepIsMenu && (
                <div className="flex flex-col gap-2 bg-menu-secondary/40 rounded-lg p-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-70">
                      {t("functionsSection.showMenuTitleLabel", "Título do menu")}
                    </label>
                    <input
                      className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                      value={stepMenuTitle}
                      onChange={(e) => setStepMenuTitle(e.target.value)}
                      placeholder={t("functionsSection.showMenuTitlePlaceholder", "Ex: Ações rápidas")}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-70">
                      {t("functionsSection.showMenuItemsLabel", "Opções")}
                    </label>
                    {stepMenuItems.length === 0 ? (
                      <p className="opacity-60 text-xs">
                        {t("functionsSection.showMenuEmptyItems", "Nenhuma opção adicionada ainda.")}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {stepMenuItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between bg-menu-secondary rounded-lg px-2.5 py-1 text-xs gap-2"
                          >
                            <span className="font-mono truncate">
                              {item.label} →{" "}
                              {item.target.kind === "customFunction"
                                ? item.target.functionName
                                : tFunctionName(t, item.target.meta)}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => editMenuItem(item)}
                              >
                                {t("functionsSection.edit", "Editar")}
                              </button>
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => removeMenuItem(item.id)}
                              >
                                {t("functionsSection.remove", "Remover")}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="button-secondary text-xs py-1.5 w-fit"
                      onClick={openMenuItemForm}
                    >
                      {t("functionsSection.showMenuAddItem", "Adicionar opção")}
                    </button>
                  </div>
                </div>
              )}

              {stepIsCreateGui && (
                <div className="flex flex-col gap-2 bg-menu-secondary/40 rounded-lg p-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-70">
                      {t("functionsSection.createGuiTitleLabel", "Título da janela")}
                    </label>
                    <input
                      className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                      value={stepGuiTitle}
                      onChange={(e) => setStepGuiTitle(e.target.value)}
                      placeholder={t("functionsSection.createGuiTitlePlaceholder", "Ex: Configurações")}
                    />
                    {stepGuiTitle.trim() !== "" && (
                      <span className="text-xs opacity-60">
                        {t("functionsSection.createGuiVarNamePreview", "Variável: {{name}}", {
                          name: guiVarNameFromTitle(stepGuiTitle.trim()),
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <RecordOptionCheckbox
                      checked={stepGuiResizable}
                      onChange={setStepGuiResizable}
                      label={t("functionsSection.createGuiResizable", "Redimensionável")}
                    />
                    <RecordOptionCheckbox
                      checked={stepGuiAlwaysOnTop}
                      onChange={setStepGuiAlwaysOnTop}
                      label={t("functionsSection.createGuiAlwaysOnTop", "Sempre no topo")}
                    />
                    <RecordOptionCheckbox
                      checked={stepGuiNoCaption}
                      onChange={setStepGuiNoCaption}
                      label={t("functionsSection.createGuiNoCaption", "Sem barra de título")}
                    />
                    <RecordOptionCheckbox
                      checked={stepGuiToolWindow}
                      onChange={setStepGuiToolWindow}
                      label={t(
                        "functionsSection.createGuiToolWindow",
                        "Janela de ferramenta (some da barra de tarefas e do alt+tab)"
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-70">
                      {t("functionsSection.createGuiInitialStateLabel", "Estado inicial")}
                    </label>
                    <div className="flex gap-1 bg-menu-secondary rounded-md p-0.5 text-xs w-fit">
                      {(
                        [
                          ["normal", t("functionsSection.createGuiStateNormal", "Normal")],
                          ["maximized", t("functionsSection.createGuiStateMaximized", "Maximizada")],
                          ["minimized", t("functionsSection.createGuiStateMinimized", "Minimizada")],
                        ] as [GuiInitialState, string][]
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`px-2 py-1 rounded outline-none focus:outline-none cursor-pointer ${
                            stepGuiInitialState === value ? "bg-(--main) text-white" : "opacity-60"
                          }`}
                          onClick={() => setStepGuiInitialState(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.createGuiWidthLabel", "Largura")}
                      </label>
                      <input
                        type="number"
                        className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                        value={stepGuiWidth}
                        onChange={(e) => setStepGuiWidth(e.target.value)}
                        placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.createGuiHeightLabel", "Altura")}
                      </label>
                      <input
                        type="number"
                        className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                        value={stepGuiHeight}
                        onChange={(e) => setStepGuiHeight(e.target.value)}
                        placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.createGuiXLabel", "Posição X")}
                      </label>
                      <input
                        type="number"
                        className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                        value={stepGuiX}
                        onChange={(e) => setStepGuiX(e.target.value)}
                        placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs opacity-70">
                        {t("functionsSection.createGuiYLabel", "Posição Y")}
                      </label>
                      <input
                        type="number"
                        className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                        value={stepGuiY}
                        onChange={(e) => setStepGuiY(e.target.value)}
                        placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <RecordOptionCheckbox
                      checked={stepGuiUseColor}
                      onChange={setStepGuiUseColor}
                      label={t("functionsSection.createGuiUseColor", "Usar cor de fundo personalizada")}
                    />
                    {stepGuiUseColor && (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="w-9 h-9 rounded cursor-pointer bg-menu-secondary border border-white/10"
                          value={`#${stepGuiColor}`}
                          onChange={(e) => setStepGuiColor(e.target.value.slice(1))}
                        />
                        <input
                          className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none text-sm font-mono w-28"
                          value={stepGuiColor}
                          onChange={(e) =>
                            setStepGuiColor(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
                          }
                          placeholder="ffffff"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <RecordOptionCheckbox
                      checked={stepGuiUseOpacity}
                      onChange={setStepGuiUseOpacity}
                      label={t("functionsSection.createGuiUseOpacity", "Usar opacidade personalizada")}
                    />
                    {stepGuiUseOpacity && (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={255}
                          className="flex-1"
                          value={stepGuiOpacity}
                          onChange={(e) => setStepGuiOpacity(Number(e.target.value))}
                        />
                        <span className="text-xs opacity-70 font-mono w-10 text-right">{stepGuiOpacity}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-70">
                      {t("functionsSection.createGuiControlsLabel", "Itens")}
                    </label>
                    {stepGuiControls.length === 0 ? (
                      <p className="opacity-60 text-xs">
                        {t("functionsSection.createGuiEmptyControls", "Nenhum item adicionado ainda.")}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {stepGuiControls.map((control) => (
                          <li
                            key={control.id}
                            className="flex items-center justify-between bg-menu-secondary rounded-lg px-2.5 py-1 text-xs gap-2"
                          >
                            <span className="font-mono truncate">{guiControlSummary(t, control)}</span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => editGuiControl(control)}
                              >
                                {t("functionsSection.edit", "Editar")}
                              </button>
                              <button
                                className="button-secondary py-0.5 px-2 text-xs"
                                onClick={() => removeGuiControl(control.id)}
                              >
                                {t("functionsSection.remove", "Remover")}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="button-secondary text-xs py-1.5 w-fit"
                      onClick={openGuiControlForm}
                    >
                      {t("functionsSection.createGuiAddControl", "Adicionar item")}
                    </button>
                  </div>
                </div>
              )}

              {stepIsCloseGui && (
                <div className="flex flex-col gap-1 bg-menu-secondary/40 rounded-lg p-3">
                  <label className="text-xs opacity-70">
                    {t("functionsSection.closeGuiTargetLabel", "Gui a fechar")}
                  </label>
                  {guiVariables.length === 0 ? (
                    <p className="opacity-60 text-xs">
                      {t(
                        "functionsSection.closeGuiNoneAvailable",
                        "Nenhuma Gui disponível — crie um passo \"Criar Gui\" primeiro."
                      )}
                    </p>
                  ) : (
                    <select
                      className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 w-full text-sm appearance-none"
                      value={stepCloseGuiTarget}
                      onChange={(e) => setStepCloseGuiTarget(e.target.value)}
                    >
                      <option value="">
                        {t("functionsSection.closeGuiSelectPlaceholder", "Selecione uma Gui")}
                      </option>
                      {guiVariables.map((v) => (
                        <option key={v.key} value={v.key}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeStepForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={
                  stepFunctionName
                    ? !stepFunctionTarget || !areArgsFilled(stepFunctionCallParams, stepFunctionArgs)
                    : stepBuiltinId
                      ? !stepBuiltin || !areArgsFilled(stepBuiltin.params, stepBuiltinArgs)
                      : stepVarAction
                        ? !varStepReady
                        : stepFlowType
                          ? !isConditionReady(stepFlowCondition)
                          : stepIsMenu
                            ? stepMenuTitle.trim() === "" || stepMenuItems.length === 0
                            : stepIsCreateGui
                              ? stepGuiTitle.trim() === "" ||
                                !isValidAhkIdentifier(guiVarNameFromTitle(stepGuiTitle.trim()))
                              : stepIsCloseGui
                                ? !stepCloseGuiTarget
                                : true
                }
                onClick={submitStep}
              >
                {editingStepId !== null
                  ? t("functionsSection.save", "Salvar")
                  : t("functionsSection.addStep", "Adicionar passo")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isMenuItemFormOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          style={{ zIndex: formZ + 1 }}
          onMouseDown={closeMenuItemForm}
        >
          <div
            className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-lg max-h-[85vh] overflow-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold">
              {editingMenuItemId !== null
                ? t("functionsSection.showMenuEditItemTitle", "Editar opção")
                : t("functionsSection.showMenuNewItemTitle", "Nova opção")}
            </span>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-70">
                {t("functionsSection.showMenuItemLabelLabel", "Texto da opção")}
              </label>
              <input
                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                value={menuItemLabel}
                onChange={(e) => setMenuItemLabel(e.target.value)}
                placeholder={t("functionsSection.showMenuItemLabelPlaceholder", "Ex: Abrir configurações")}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-70">
                {t("functionsSection.selectStepFunction", "Selecione uma função")}
              </label>
              <FunctionPicker
                items={menuItemPickerItems}
                value={menuItemSelection}
                onChange={selectMenuItemTarget}
                placeholder={t("functionsSection.selectStepFunction", "Selecione uma função")}
                className="w-full"
              />
            </div>

            {menuItemBuiltin && menuItemBuiltin.params.length > 0 && (
              <StepArgsFields
                targetId={menuItemBuiltin.id}
                params={menuItemBuiltin.params}
                headerParams={headerParams}
                localVariables={localVariables}
                globalVariables={globalVariables}
                values={menuItemBuiltinArgs}
                onChange={(key, arg) => setMenuItemBuiltinArgs((prev) => ({ ...prev, [key]: arg }))}
                resetSignal={stepResetSignal}
                title={t("paramsFields.title", "Parâmetros de {{name}}", {
                  name: tFunctionName(t, menuItemBuiltin),
                })}
              />
            )}

            {menuItemFunctionTarget && menuItemFunctionCallParams.length > 0 && (
              <StepArgsFields
                params={menuItemFunctionCallParams}
                headerParams={headerParams}
                localVariables={localVariables}
                globalVariables={globalVariables}
                values={menuItemFunctionArgs}
                onChange={(key, arg) => setMenuItemFunctionArgs((prev) => ({ ...prev, [key]: arg }))}
                resetSignal={stepResetSignal}
                title={t("paramsFields.title", "Parâmetros de {{name}}", {
                  name: menuItemFunctionTarget.name,
                })}
              />
            )}

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeMenuItemForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!menuItemReady}
                onClick={submitMenuItem}
              >
                {editingMenuItemId !== null
                  ? t("functionsSection.save", "Salvar")
                  : t("functionsSection.add", "Adicionar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGuiControlFormOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          style={{ zIndex: formZ + 1 }}
          onMouseDown={closeGuiControlForm}
        >
          <div
            className="bg-menu-dark rounded-lg shadow-lg p-4 flex flex-col gap-3 w-full max-w-lg max-h-[85vh] overflow-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-semibold">
              {editingGuiControlId !== null
                ? t("functionsSection.createGuiEditControlTitle", "Editar item")
                : t("functionsSection.createGuiNewControlTitle", "Novo item")}
            </span>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-70">
                {t("functionsSection.createGuiControlTypeLabel", "Tipo de item")}
              </label>
              <select
                className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none cursor-pointer h-9 w-full text-sm appearance-none"
                value={guiControlType}
                onChange={(e) => setGuiControlType(e.target.value as GuiControlType)}
              >
                <option value="text">{t("functionsSection.guiControlTypeText", "Texto")}</option>
                <option value="button">{t("functionsSection.guiControlTypeButton", "Botão")}</option>
                <option value="edit">{t("functionsSection.guiControlTypeEdit", "Caixa de texto")}</option>
                <option value="checkbox">
                  {t("functionsSection.guiControlTypeCheckbox", "Caixa de seleção")}
                </option>
                <option value="dropdown">
                  {t("functionsSection.guiControlTypeDropdown", "Lista suspensa")}
                </option>
                <option value="code">{t("functionsSection.guiControlTypeCode", "Código AHK personalizado")}</option>
              </select>
            </div>

            {guiControlType === "code" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-70">
                  {t("functionsSection.guiControlCodeLabel", "Código AHK")}
                </label>
                <textarea
                  className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full font-mono text-sm resize-y min-h-24"
                  value={guiControlCode}
                  onChange={(e) => setGuiControlCode(e.target.value)}
                  placeholder={t(
                    "functionsSection.guiControlCodePlaceholder",
                    'Ex: {{varName}}.Add("Progress", "w200 h20", 50)'
                  ).replace("{{varName}}", stepGuiTitle.trim() ? guiVarNameFromTitle(stepGuiTitle.trim()) : "gui")}
                  spellCheck={false}
                  wrap="off"
                  rows={4}
                  autoFocus
                />
                <span className="text-xs opacity-60">
                  {t(
                    "functionsSection.guiControlCodeHint",
                    "Inserido tal como escrito, logo após a criação da janela. Use a variável {{name}} para referenciá-la.",
                    { name: stepGuiTitle.trim() ? guiVarNameFromTitle(stepGuiTitle.trim()) : "gui_..." }
                  )}
                </span>
              </div>
            )}

            {(guiControlType === "text" || guiControlType === "button" || guiControlType === "checkbox") && (
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-70">
                  {guiControlType === "checkbox"
                    ? t("functionsSection.guiControlLabelLabel", "Texto da caixa de seleção")
                    : t("functionsSection.guiControlTextLabel", "Texto")}
                </label>
                <input
                  className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                  value={guiControlText}
                  onChange={(e) => setGuiControlText(e.target.value)}
                  placeholder={t("functionsSection.guiControlTextPlaceholder", "Ex: Confirmar")}
                  autoFocus
                />
              </div>
            )}

            {guiControlType === "button" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs opacity-70">
                    {t("functionsSection.selectStepFunction", "Selecione uma função")}
                  </label>
                  <FunctionPicker
                    items={menuItemPickerItems}
                    value={guiControlSelection}
                    onChange={selectGuiControlTarget}
                    placeholder={t("functionsSection.selectStepFunction", "Selecione uma função")}
                    className="w-full"
                  />
                </div>

                {guiControlBuiltin && guiControlBuiltin.params.length > 0 && (
                  <StepArgsFields
                    targetId={guiControlBuiltin.id}
                    params={guiControlBuiltin.params}
                    headerParams={headerParams}
                    localVariables={localVariables}
                    globalVariables={globalVariables}
                    values={guiControlBuiltinArgs}
                    onChange={(key, arg) => setGuiControlBuiltinArgs((prev) => ({ ...prev, [key]: arg }))}
                    resetSignal={stepResetSignal}
                    title={t("paramsFields.title", "Parâmetros de {{name}}", {
                      name: tFunctionName(t, guiControlBuiltin),
                    })}
                  />
                )}

                {guiControlFunctionTarget && guiControlFunctionCallParams.length > 0 && (
                  <StepArgsFields
                    params={guiControlFunctionCallParams}
                    headerParams={headerParams}
                    localVariables={localVariables}
                    globalVariables={globalVariables}
                    values={guiControlFunctionArgs}
                    onChange={(key, arg) => setGuiControlFunctionArgs((prev) => ({ ...prev, [key]: arg }))}
                    resetSignal={stepResetSignal}
                    title={t("paramsFields.title", "Parâmetros de {{name}}", {
                      name: guiControlFunctionTarget.name,
                    })}
                  />
                )}
              </>
            )}

            {guiControlType === "edit" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs opacity-70">
                    {t("functionsSection.guiControlInitialValueLabel", "Valor inicial")}
                  </label>
                  <input
                    className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                    value={guiControlInitialValue}
                    onChange={(e) => setGuiControlInitialValue(e.target.value)}
                  />
                </div>
                <RecordOptionCheckbox
                  checked={guiControlMultiline}
                  onChange={setGuiControlMultiline}
                  label={t("functionsSection.guiControlMultiline", "Múltiplas linhas")}
                />
              </>
            )}

            {guiControlType === "checkbox" && (
              <RecordOptionCheckbox
                checked={guiControlChecked}
                onChange={setGuiControlChecked}
                label={t("functionsSection.guiControlCheckedByDefault", "Marcada por padrão")}
              />
            )}

            {guiControlType === "dropdown" && (
              <div className="flex flex-col gap-1.5 bg-menu-secondary/60 rounded-lg p-2">
                <span className="text-xs opacity-70">
                  {t("functionsSection.guiControlOptionsLabel", "Opções da lista")}
                </span>
                {guiControlOptions.length > 0 && (
                  <ul className="flex flex-wrap gap-1">
                    {guiControlOptions.map((option, index) => (
                      <li
                        key={`${option}-${index}`}
                        className="flex items-center gap-1 bg-menu-secondary rounded px-2 py-1 text-xs"
                      >
                        {option}
                        <button
                          type="button"
                          className="opacity-60 hover:opacity-100 cursor-pointer"
                          onClick={() => removeGuiControlOption(index)}
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
                    value={guiControlNewOption}
                    onChange={(e) => setGuiControlNewOption(e.target.value)}
                    placeholder={t("functionsSection.paramOptionPlaceholder", "Ex: Rápido")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGuiControlOption();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="button-secondary py-1 px-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!guiControlNewOption.trim()}
                    onClick={addGuiControlOption}
                  >
                    {t("functionsSection.addParamOption", "Adicionar opção")}
                  </button>
                </div>
              </div>
            )}

            {guiControlType !== "code" && (
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs opacity-70">
                    {t("functionsSection.createGuiXLabel", "Posição X")}
                  </label>
                  <input
                    type="number"
                    className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                    value={guiControlX}
                    onChange={(e) => setGuiControlX(e.target.value)}
                    placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs opacity-70">
                    {t("functionsSection.createGuiYLabel", "Posição Y")}
                  </label>
                  <input
                    type="number"
                    className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                    value={guiControlY}
                    onChange={(e) => setGuiControlY(e.target.value)}
                    placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                  />
                </div>
              </div>
            )}

            {guiControlType !== "checkbox" && guiControlType !== "code" && (
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs opacity-70">
                    {t("functionsSection.createGuiWidthLabel", "Largura")}
                  </label>
                  <input
                    type="number"
                    className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                    value={guiControlWidth}
                    onChange={(e) => setGuiControlWidth(e.target.value)}
                    placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                  />
                </div>
                {(guiControlType === "button" || guiControlType === "edit") && (
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs opacity-70">
                      {t("functionsSection.createGuiHeightLabel", "Altura")}
                    </label>
                    <input
                      type="number"
                      className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none w-full text-sm"
                      value={guiControlHeight}
                      onChange={(e) => setGuiControlHeight(e.target.value)}
                      placeholder={t("functionsSection.createGuiAutoPlaceholder", "Automático")}
                    />
                  </div>
                )}
              </div>
            )}

            {guiControlType !== "button" && guiControlType !== "code" && (
              <div className="flex flex-col gap-1.5">
                <RecordOptionCheckbox
                  checked={guiControlUseColor}
                  onChange={setGuiControlUseColor}
                  label={t("functionsSection.guiControlUseColor", "Usar cor de texto personalizada")}
                />
                {guiControlUseColor && (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="w-9 h-9 rounded cursor-pointer bg-menu-secondary border border-white/10"
                      value={`#${guiControlColor}`}
                      onChange={(e) => setGuiControlColor(e.target.value.slice(1))}
                    />
                    <input
                      className="bg-menu-secondary rounded-lg px-2.5 py-1.5 outline-none text-sm font-mono w-28"
                      value={guiControlColor}
                      onChange={(e) =>
                        setGuiControlColor(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
                      }
                      placeholder="ffffff"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button className="button-secondary" onClick={closeGuiControlForm}>
                {t("functionsSection.cancel", "Cancelar")}
              </button>
              <button
                className="button-main disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!guiControlReady}
                onClick={submitGuiControl}
              >
                {editingGuiControlId !== null
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
