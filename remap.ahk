; Gerado automaticamente pelo AHK Hub (AutoHotkey v2)
#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"

; ==== Variáveis globais de seletor circular (pré-declaradas para poderem ser fechadas por outra função) ====

radial_xD := ""

; ==== Declaração das funções ====

system_controller_radial_direction(selector, dx, dy) {
    if (Abs(dx) < selector.minDistance && Abs(dy) < selector.minDistance)
        return "center"
    return Abs(dx) > Abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")
}

system_controller_radial_dismiss(selector) {
    if (!IsObject(selector))
        return
    if (selector.watcher != "") {
        SetTimer(selector.watcher, 0)
        selector.watcher := ""
    }
    if (IsObject(selector.overlay)) {
        try selector.overlay.Destroy()
        selector.overlay := ""
    }
}

system_controller_radial_open(previous, minDistance, radius, showOverlay, backColor, textColor, opacity, labels, triggerOnMove, keepOpen) {
    ; Um seletor anterior que ficou aberto (sem passo de fechar) some agora, sem executar nada.
    system_controller_radial_dismiss(previous)
    CoordMode "Mouse", "Screen"
    MouseGetPos(&startX, &startY)
    ; "armed" começa ligado porque o mouse abre o seletor já dentro da zona central.
    selector := {startX: startX, startY: startY, minDistance: minDistance, actions: Map()
        , overlay: "", watcher: "", done: false, keepOpen: keepOpen, armed: true, lastDirection: ""
        , onClose: "", closed: false}
    if (showOverlay) {
        size := radius * 2
        labelWidth := Round(size * 0.34)
        middleY := Round(size / 2) - 10
        overlay := Gui("-Caption +AlwaysOnTop +ToolWindow +E0x20")
        overlay.BackColor := backColor
        overlay.SetFont("s10 bold c" . textColor, "Segoe UI")
        if (labels.Has("up"))
            overlay.Add("Text", Format("x0 y{1} w{2} Center BackgroundTrans", Round(size * 0.12), size), labels["up"])
        if (labels.Has("down"))
            overlay.Add("Text", Format("x0 y{1} w{2} Center BackgroundTrans", Round(size * 0.88) - 18, size), labels["down"])
        if (labels.Has("left"))
            overlay.Add("Text", Format("x{1} y{2} w{3} Left BackgroundTrans", Round(size * 0.08), middleY, labelWidth), labels["left"])
        if (labels.Has("right"))
            overlay.Add("Text", Format("x{1} y{2} w{3} Right BackgroundTrans", size - Round(size * 0.08) - labelWidth, middleY, labelWidth), labels["right"])
        if (labels.Has("center"))
            overlay.Add("Text", Format("x{1} y{2} w{3} Center BackgroundTrans", Round((size - labelWidth) / 2), middleY, labelWidth), labels["center"])
        overlay.Show(Format("x{1} y{2} w{3} h{4} NoActivate", startX - radius, startY - radius, size, size))
        WinSetRegion(Format("0-0 w{1} h{2} E", size, size), "ahk_id " . overlay.Hwnd)
        WinSetTransparent(opacity, "ahk_id " . overlay.Hwnd)
        selector.overlay := overlay
    }
    if (triggerOnMove) {
        selector.watcher := (*) => system_controller_radial_tick(selector)
        SetTimer(selector.watcher, 15)
    }
    return selector
}

system_controller_radial_tick(selector) {
    CoordMode "Mouse", "Screen"
    MouseGetPos(&x, &y)
    direction := system_controller_radial_direction(selector, x - selector.startX, y - selector.startY)
    ; Dentro da zona central não há direção alguma — a opção central fica para o passo de
    ; fechar, o único momento em que dá para saber que o mouse nunca passou do mínimo.
    ; Voltar para essa zona é também o que libera a próxima escolha quando o seletor
    ; continua aberto; sem isso a mesma opção repetiria a cada tick com o mouse parado.
    if (direction = "center") {
        selector.armed := true
        selector.lastDirection := ""
        return
    }
    ; Mudar de direção já conta como escolha nova. Exigir a volta ao centro deixava a troca
    ; lenta e até impossível: entre dois ticks o mouse atravessa a zona central inteira, e o
    ; rearme só acontecia se algum tick calhasse de amostrá-la.
    if (!selector.armed && direction = selector.lastDirection)
        return
    selector.armed := false
    selector.lastDirection := direction
    selector.done := true
    if (!selector.keepOpen)
        system_controller_radial_dismiss(selector)
    if (selector.actions.Has(direction))
        selector.actions[direction].Call()
}

system_controller_radial_close(selector) {
    ; Fechar duas vezes o mesmo seletor não repete nada: a opção já era protegida por
    ; "done", e sem isto o "ao fechar" rodaria de novo.
    if (!IsObject(selector) || selector.closed)
        return
    selector.closed := true
    CoordMode "Mouse", "Screen"
    MouseGetPos(&endX, &endY)
    direction := system_controller_radial_direction(selector, endX - selector.startX, endY - selector.startY)
    alreadyRan := selector.done
    selector.done := true
    system_controller_radial_dismiss(selector)
    ; A opção só roda aqui se ainda não tiver rodado sozinha (modo "ao mover").
    if (!alreadyRan && selector.actions.Has(direction))
        selector.actions[direction].Call()
    ; A função de fechamento vem sempre depois, tenha a opção rodado agora ou antes.
    if (selector.onClose != "")
        selector.onClose.Call()
}

system_controller_function_keypress(combo, action) {
    keys := StrSplit(combo, "+")
    ; O seletor de teclas grava a letra em maiúscula ("A") e "{A down}" mandaria Shift
    ; junto, então uma tecla de um caractere só desce sempre em minúscula.
    for i, k in keys
        keys[i] := StrLen(k) = 1 ? StrLower(k) : k
    out := ""
    if (action != "up")
        for k in keys
            out .= "{" . k . " down}"
    if (action != "down")
        ; Soltas na ordem inversa: o modificador sai depois da tecla que ele modifica.
        Loop keys.Length
            out .= "{" . keys[keys.Length - A_Index + 1] . " up}"
    Send out
}

test() {
    global radial_xD
    radial_xD := system_controller_radial_open(radial_xD, 60, 120, 1, "0x1e1e1e", "ffffff", 133, Map("up", "up"), 1, 1)
    radial_xD.actions["up"] := (*) => system_controller_function_keypress("A", "down")
    radial_xD.onClose := (*) => system_controller_function_keypress("A", "up")
}

test2() {
    global radial_xD
    system_controller_radial_close(radial_xD)
}

; ==== Remapeamentos ====

^D::
{
    test()
    KeyWait "d"
}

^D Up::test2()

^F::system_controller_function_keypress("A", "down")

^G::system_controller_function_keypress("A", "up")

; === AHK_HUB_STATE_BEGIN ===
; eyJyZW1hcHBpbmdzIjpbeyJpZCI6MSwiZnJvbSI6IkN0cmwrRCIsImRlc3RpbmF0aW9uIjp7ImtpbmQiOiJjdXN0b21GdW5jdGlvbiIsIm5hbWUiOiJ0ZXN0IiwiYXJncyI6e319LCJ0cmlnZ2VyIjoiZG93biJ9LHsiaWQiOjIsImZyb20iOiJDdHJsK0QiLCJkZXN0aW5hdGlvbiI6eyJraW5kIjoiY3VzdG9tRnVuY3Rpb24iLCJuYW1lIjoidGVzdDIiLCJhcmdzIjp7fX0sInRyaWdnZXIiOiJ1cCJ9LHsiaWQiOjYsImZyb20iOiJDdHJsK0YiLCJkZXN0aW5hdGlvbiI6eyJraW5kIjoiYnVpbHRpbiIsImZ1bmN0aW9uSWQiOiJrZXlQcmVzcyIsInBhcmFtcyI6eyJjb21ibyI6IkEiLCJhY3Rpb24iOiJkb3duIn19LCJ0cmlnZ2VyIjoiZnVsbCJ9LHsiaWQiOjcsImZyb20iOiJDdHJsK0ciLCJkZXN0aW5hdGlvbiI6eyJraW5kIjoiYnVpbHRpbiIsImZ1bmN0aW9uSWQiOiJrZXlQcmVzcyIsInBhcmFtcyI6eyJjb21ibyI6IkEiLCJhY3Rpb24iOiJ1cCJ9fSwidHJpZ2dlciI6ImZ1bGwifV0sImZ1bmN0aW9ucyI6W3siaWQiOjMsIm5hbWUiOiJ0ZXN0IiwiZGVzY3JpcHRpb24iOiIiLCJjb2RlIjoidGVzdCgpIHtcbiAgICBnbG9iYWwgcmFkaWFsX3hEXG4gICAgcmFkaWFsX3hEIDo9IHN5c3RlbV9jb250cm9sbGVyX3JhZGlhbF9vcGVuKHJhZGlhbF94RCwgNjAsIDEyMCwgMSwgXCIweDFlMWUxZVwiLCBcImZmZmZmZlwiLCAxMzMsIE1hcChcInVwXCIsIFwidXBcIiksIDEsIDEpXG4gICAgcmFkaWFsX3hELmFjdGlvbnNbXCJ1cFwiXSA6PSAoKikgPT4gc3lzdGVtX2NvbnRyb2xsZXJfZnVuY3Rpb25fa2V5cHJlc3MoXCJBXCIsIFwiZG93blwiKVxuICAgIHJhZGlhbF94RC5vbkNsb3NlIDo9ICgqKSA9PiBzeXN0ZW1fY29udHJvbGxlcl9mdW5jdGlvbl9rZXlwcmVzcyhcIkFcIiwgXCJ1cFwiKVxufSIsInBhcmFtcyI6W10sImJ1aWxkZXIiOnsibW9kZSI6InN0ZXBzIiwic3RlcHMiOlt7ImtpbmQiOiJvcGVuUmFkaWFsU2VsZWN0b3IiLCJ2YXJOYW1lIjoicmFkaWFsX3hEIiwibmFtZSI6InhEIiwibWluRGlzdGFuY2UiOjYwLCJ0cmlnZ2VyT25Nb3ZlIjp0cnVlLCJrZWVwT3Blbk9uU2VsZWN0Ijp0cnVlLCJzaG93T3ZlcmxheSI6dHJ1ZSwicmFkaXVzIjoxMjAsImJhY2tDb2xvciI6IjFlMWUxZSIsInRleHRDb2xvciI6ImZmZmZmZiIsIm9wYWNpdHkiOjEzMywib3B0aW9ucyI6eyJ1cCI6eyJsYWJlbCI6InVwIiwidGFyZ2V0Ijp7ImtpbmQiOiJidWlsdGluIiwiZnVuY3Rpb25JZCI6ImtleVByZXNzIiwiYXJncyI6eyJjb21ibyI6eyJraW5kIjoibGl0ZXJhbCIsInZhbHVlIjoiQSJ9LCJkdXJhdGlvbiI6eyJraW5kIjoibGl0ZXJhbCIsInZhbHVlIjoiIn0sImFjdGlvbiI6eyJraW5kIjoibGl0ZXJhbCIsInZhbHVlIjoiZG93biJ9fX19fSwib25DbG9zZSI6eyJraW5kIjoiYnVpbHRpbiIsImZ1bmN0aW9uSWQiOiJrZXlQcmVzcyIsImFyZ3MiOnsiY29tYm8iOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6IkEifSwiZHVyYXRpb24iOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6IiJ9LCJhY3Rpb24iOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6InVwIn19fX1dfX0seyJpZCI6NCwibmFtZSI6InRlc3QyIiwiZGVzY3JpcHRpb24iOiIiLCJjb2RlIjoidGVzdDIoKSB7XG4gICAgZ2xvYmFsIHJhZGlhbF94RFxuICAgIHN5c3RlbV9jb250cm9sbGVyX3JhZGlhbF9jbG9zZShyYWRpYWxfeEQpXG59IiwicGFyYW1zIjpbXSwiYnVpbGRlciI6eyJtb2RlIjoic3RlcHMiLCJzdGVwcyI6W3sia2luZCI6ImNsb3NlUmFkaWFsU2VsZWN0b3IiLCJ0YXJnZXRWYXIiOiJyYWRpYWxfeEQifV19fV0sInZhcmlhYmxlcyI6W119
; === AHK_HUB_STATE_END ===