; Gerado automaticamente pelo AHK Hub (AutoHotkey v2)
#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"

; ==== Declaração das funções ====

system_controller_function_enviar_para_janela_em_segundo_plano(title, what, combo, text, control) {
    if (title = "" || !WinExist(title))
        return

    if (what = "text") {
        if (control = "")
            ControlSendText text, , title
        else
            ControlSendText text, control, title
        return
    }

    parts := StrSplit(combo, "+")
    key := parts[parts.Length]
    key := StrLen(key) = 1 ? StrLower(key) : key
    standalone := Map("Ctrl", "LControl", "Alt", "LAlt", "Shift", "LShift", "Win", "LWin")

    if (parts.Length = 1 && standalone.Has(key)) {
        keys := "{" . standalone[key] . "}"
    } else {
        symbols := Map("Ctrl", "^", "Alt", "!", "Shift", "+", "Win", "#")
        keys := ""
        Loop parts.Length - 1
            keys .= symbols.Has(parts[A_Index]) ? symbols[parts[A_Index]] : ""
        keys .= StrLen(key) > 1 ? "{" . key . "}" : key
    }

    if (control = "")
        ControlSend keys, , title
    else
        ControlSend keys, control, title
}

test() {
    system_controller_function_enviar_para_janela_em_segundo_plano("Bloco", "key", "Shift+A", "", "RichEditD2DPT1")
}

; ==== Remapeamentos ====

^D::test()

; === AHK_HUB_STATE_BEGIN ===
; eyJyZW1hcHBpbmdzIjpbeyJpZCI6MSwiZnJvbSI6IkN0cmwrRCIsImRlc3RpbmF0aW9uIjp7ImtpbmQiOiJjdXN0b21GdW5jdGlvbiIsIm5hbWUiOiJ0ZXN0IiwiYXJncyI6e319LCJ0cmlnZ2VyIjoiZnVsbCJ9XSwiZnVuY3Rpb25zIjpbeyJpZCI6MiwibmFtZSI6InRlc3QiLCJkZXNjcmlwdGlvbiI6IiIsImNvZGUiOiJ0ZXN0KCkge1xuICAgIHN5c3RlbV9jb250cm9sbGVyX2Z1bmN0aW9uX2Vudmlhcl9wYXJhX2phbmVsYV9lbV9zZWd1bmRvX3BsYW5vKFwiQmxvY29cIiwgXCJrZXlcIiwgXCJTaGlmdCtBXCIsIFwiXCIsIFwiUmljaEVkaXREMkRQVDFcIilcbn0iLCJwYXJhbXMiOltdLCJidWlsZGVyIjp7Im1vZGUiOiJzdGVwcyIsInN0ZXBzIjpbeyJraW5kIjoiYnVpbHRpbiIsImZ1bmN0aW9uSWQiOiJzZW5kVG9XaW5kb3ciLCJhcmdzIjp7InRpdGxlIjp7ImtpbmQiOiJsaXRlcmFsIiwidmFsdWUiOiJCbG9jbyJ9LCJ3aGF0Ijp7ImtpbmQiOiJsaXRlcmFsIiwidmFsdWUiOiJrZXkifSwiY29tYm8iOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6IlNoaWZ0K0EifSwidGV4dCI6eyJraW5kIjoibGl0ZXJhbCIsInZhbHVlIjoiIn0sImNvbnRyb2wiOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6IlJpY2hFZGl0RDJEUFQxIn19fV19fV0sInZhcmlhYmxlcyI6W119
; === AHK_HUB_STATE_END ===