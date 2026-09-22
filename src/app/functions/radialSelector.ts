/**
 * "Seletor rápido circular": a gesture menu. One step opens it (recording where the cursor
 * was and, optionally, drawing a circular overlay around it); a later step closes it, measures
 * how far the cursor drifted and calls whichever of the five bound options that drift points at.
 *
 * With `triggerOnMove` the selector doesn't wait to be closed: a timer watches the cursor and
 * fires the moment it crosses the minimum displacement. The closing step still runs the central
 * option, since "moved less than the minimum" can only be known once the selector is dismissed.
 *
 * `keepOpenOnSelect` (only meaningful alongside `triggerOnMove`) leaves the selector up after a
 * pick so several options can be fired in a row. What blocks a repeat there is the direction
 * staying the same, not the cursor having to return to the centre: at a 15 ms sample rate a
 * quick flick crosses the whole dead zone between two ticks, so requiring a sampled centre made
 * switching options feel laggy and often dropped the pick entirely. Parking the cursor out in
 * one direction still can't re-fire it, which is what the rule is there for.
 *
 * `onClose` is an optional extra call the closing step makes after the picked option — whether
 * that option ran just now or fired earlier on move. A selector torn down by `dismiss` (a new
 * one opening over a stale one) is not a close, so it doesn't run it.
 */

/** The five arms of a selector — the four directions the cursor can be flicked toward, plus the fallback taken when it barely moved. */
export type RadialDirection = "up" | "down" | "left" | "right" | "center";

export const RADIAL_DIRECTIONS: RadialDirection[] = ["up", "down", "left", "right", "center"];

export const RADIAL_OPEN_FN = "system_controller_radial_open";
export const RADIAL_CLOSE_FN = "system_controller_radial_close";
const RADIAL_DISMISS_FN = "system_controller_radial_dismiss";
const RADIAL_DIRECTION_FN = "system_controller_radial_direction";
const RADIAL_TICK_FN = "system_controller_radial_tick";

/** Displacement (px) the cursor must travel on at least one axis for a direction to be picked instead of the "center" fallback. */
export const DEFAULT_RADIAL_MIN_DISTANCE = 60;
export const DEFAULT_RADIAL_RADIUS = 120;
export const DEFAULT_RADIAL_BACK_COLOR = "1e1e1e";
export const DEFAULT_RADIAL_TEXT_COLOR = "ffffff";
export const DEFAULT_RADIAL_OPACITY = 210;
/**
 * How often the `triggerOnMove` watcher samples the cursor, in ms. Lower values don't help:
 * AHK's timer resolution floors at roughly this, so 5 ms measured the same ~15 ms latency for
 * three times the wakeups. The sampling is why a cursor swept across several options in one
 * continuous motion only fires the ones a tick happens to catch — landing on an option always
 * fires it, crossing over one on the way somewhere else may not.
 */
const RADIAL_TICK_INTERVAL = 15;

/**
 * The AHK functions every selector step calls, declared once per script.
 *
 * The overlay is click-through (`+E0x20`) and shown with `NoActivate` so opening a selector
 * never steals focus from whatever the user is working in — the hotkey that opened it is
 * usually still held down while they flick the mouse.
 */
export function radialSelectorDeclarations(): string[] {
  // Single source of truth for the rule: the axis that moved most wins, and neither axis
  // reaching the minimum means the central option.
  const direction = [
    `${RADIAL_DIRECTION_FN}(selector, dx, dy) {`,
    "    if (Abs(dx) < selector.minDistance && Abs(dy) < selector.minDistance)",
    '        return "center"',
    '    return Abs(dx) > Abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")',
    "}",
  ];

  // Tears a selector down without running anything: stops the watcher (which also breaks the
  // selector -> closure -> selector reference cycle the timer needs) and removes the overlay.
  const dismiss = [
    `${RADIAL_DISMISS_FN}(selector) {`,
    "    if (!IsObject(selector))",
    "        return",
    '    if (selector.watcher != "") {',
    "        SetTimer(selector.watcher, 0)",
    '        selector.watcher := ""',
    "    }",
    "    if (IsObject(selector.overlay)) {",
    "        try selector.overlay.Destroy()",
    '        selector.overlay := ""',
    "    }",
    "}",
  ];

  const open = [
    `${RADIAL_OPEN_FN}(previous, minDistance, radius, showOverlay, backColor, textColor, opacity, labels, triggerOnMove, keepOpen) {`,
    "    ; Um seletor anterior que ficou aberto (sem passo de fechar) some agora, sem executar nada.",
    `    ${RADIAL_DISMISS_FN}(previous)`,
    '    CoordMode "Mouse", "Screen"',
    "    MouseGetPos(&startX, &startY)",
    "    ; \"armed\" começa ligado porque o mouse abre o seletor já dentro da zona central.",
    "    selector := {startX: startX, startY: startY, minDistance: minDistance, actions: Map()",
    '        , overlay: "", watcher: "", done: false, keepOpen: keepOpen, armed: true, lastDirection: ""',
    '        , onClose: "", closed: false}',
    "    if (showOverlay) {",
    "        size := radius * 2",
    "        labelWidth := Round(size * 0.34)",
    "        middleY := Round(size / 2) - 10",
    '        overlay := Gui("-Caption +AlwaysOnTop +ToolWindow +E0x20")',
    "        overlay.BackColor := backColor",
    '        overlay.SetFont("s10 bold c" . textColor, "Segoe UI")',
    '        if (labels.Has("up"))',
    '            overlay.Add("Text", Format("x0 y{1} w{2} Center BackgroundTrans", Round(size * 0.12), size), labels["up"])',
    '        if (labels.Has("down"))',
    '            overlay.Add("Text", Format("x0 y{1} w{2} Center BackgroundTrans", Round(size * 0.88) - 18, size), labels["down"])',
    '        if (labels.Has("left"))',
    '            overlay.Add("Text", Format("x{1} y{2} w{3} Left BackgroundTrans", Round(size * 0.08), middleY, labelWidth), labels["left"])',
    '        if (labels.Has("right"))',
    '            overlay.Add("Text", Format("x{1} y{2} w{3} Right BackgroundTrans", size - Round(size * 0.08) - labelWidth, middleY, labelWidth), labels["right"])',
    '        if (labels.Has("center"))',
    '            overlay.Add("Text", Format("x{1} y{2} w{3} Center BackgroundTrans", Round((size - labelWidth) / 2), middleY, labelWidth), labels["center"])',
    '        overlay.Show(Format("x{1} y{2} w{3} h{4} NoActivate", startX - radius, startY - radius, size, size))',
    '        WinSetRegion(Format("0-0 w{1} h{2} E", size, size), "ahk_id " . overlay.Hwnd)',
    '        WinSetTransparent(opacity, "ahk_id " . overlay.Hwnd)',
    "        selector.overlay := overlay",
    "    }",
    "    if (triggerOnMove) {",
    `        selector.watcher := (*) => ${RADIAL_TICK_FN}(selector)`,
    `        SetTimer(selector.watcher, ${RADIAL_TICK_INTERVAL})`,
    "    }",
    "    return selector",
    "}",
  ];

  // Runs in its own timer thread, so it sets its own CoordMode.
  const tick = [
    `${RADIAL_TICK_FN}(selector) {`,
    '    CoordMode "Mouse", "Screen"',
    "    MouseGetPos(&x, &y)",
    `    direction := ${RADIAL_DIRECTION_FN}(selector, x - selector.startX, y - selector.startY)`,
    "    ; Dentro da zona central não há direção alguma — a opção central fica para o passo de",
    "    ; fechar, o único momento em que dá para saber que o mouse nunca passou do mínimo.",
    "    ; Voltar para essa zona é também o que libera a próxima escolha quando o seletor",
    "    ; continua aberto; sem isso a mesma opção repetiria a cada tick com o mouse parado.",
    '    if (direction = "center") {',
    "        selector.armed := true",
    '        selector.lastDirection := ""',
    "        return",
    "    }",
    "    ; Mudar de direção já conta como escolha nova. Exigir a volta ao centro deixava a troca",
    "    ; lenta e até impossível: entre dois ticks o mouse atravessa a zona central inteira, e o",
    "    ; rearme só acontecia se algum tick calhasse de amostrá-la.",
    "    if (!selector.armed && direction = selector.lastDirection)",
    "        return",
    "    selector.armed := false",
    "    selector.lastDirection := direction",
    "    selector.done := true",
    "    if (!selector.keepOpen)",
    `        ${RADIAL_DISMISS_FN}(selector)`,
    "    if (selector.actions.Has(direction))",
    "        selector.actions[direction].Call()",
    "}",
  ];

  const close = [
    `${RADIAL_CLOSE_FN}(selector) {`,
    "    ; Fechar duas vezes o mesmo seletor não repete nada: a opção já era protegida por",
    '    ; "done", e sem isto o "ao fechar" rodaria de novo.',
    "    if (!IsObject(selector) || selector.closed)",
    "        return",
    "    selector.closed := true",
    '    CoordMode "Mouse", "Screen"',
    "    MouseGetPos(&endX, &endY)",
    `    direction := ${RADIAL_DIRECTION_FN}(selector, endX - selector.startX, endY - selector.startY)`,
    "    alreadyRan := selector.done",
    "    selector.done := true",
    `    ${RADIAL_DISMISS_FN}(selector)`,
    "    ; A opção só roda aqui se ainda não tiver rodado sozinha (modo \"ao mover\").",
    "    if (!alreadyRan && selector.actions.Has(direction))",
    "        selector.actions[direction].Call()",
    "    ; A função de fechamento vem sempre depois, tenha a opção rodado agora ou antes.",
    '    if (selector.onClose != "")',
    "        selector.onClose.Call()",
    "}",
  ];

  return [
    direction.join("\n"),
    dismiss.join("\n"),
    open.join("\n"),
    tick.join("\n"),
    close.join("\n"),
  ];
}
