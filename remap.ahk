; Gerado automaticamente pelo AHK Hub (AutoHotkey v2)
#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"

; ==== Declaração das funções ====

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

; ==== Remapeamentos ====

#HotIf
CapsLock::system_controller_function_keypress("D", "")

#HotIf

; === AHK_HUB_STATE_BEGIN ===
; eyJyZW1hcHBpbmdzIjpbeyJpZCI6MSwiZnJvbSI6IkNhcHNMb2NrIiwiZGVzdGluYXRpb24iOnsia2luZCI6ImJ1aWx0aW4iLCJmdW5jdGlvbklkIjoia2V5UHJlc3MiLCJwYXJhbXMiOnsiY29tYm8iOiJEIiwiYWN0aW9uIjoiIn19LCJ0cmlnZ2VyIjoiZnVsbCIsImNvbmRpdGlvbnMiOltdfV0sImZ1bmN0aW9ucyI6W3siaWQiOjUsIm5hbWUiOiJ0ZXN0IiwiZGVzY3JpcHRpb24iOiIiLCJjb2RlIjoidGVzdCgpIHtcbiAgICBzeXN0ZW1fY29udHJvbGxlcl9mdW5jdGlvbl9leGliaXJfbWVuc2FnZW0oXCJ0ZXN0XCIpXG59IiwicGFyYW1zIjpbXSwiYnVpbGRlciI6eyJtb2RlIjoic3RlcHMiLCJzdGVwcyI6W3sia2luZCI6ImJ1aWx0aW4iLCJmdW5jdGlvbklkIjoic2hvd01lc3NhZ2UiLCJhcmdzIjp7InRleHQiOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6InRlc3QifX19XX19LHsiaWQiOjYsIm5hbWUiOiJ0ZXN0MiIsImRlc2NyaXB0aW9uIjoiIiwiY29kZSI6InRlc3QyKCkge1xuICAgIHN5c3RlbV9jb250cm9sbGVyX2Z1bmN0aW9uX2V4aWJpcl9tZW5zYWdlbShcInhkXCIpXG59IiwicGFyYW1zIjpbXSwiYnVpbGRlciI6eyJtb2RlIjoic3RlcHMiLCJzdGVwcyI6W3sia2luZCI6ImJ1aWx0aW4iLCJmdW5jdGlvbklkIjoic2hvd01lc3NhZ2UiLCJhcmdzIjp7InRleHQiOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6InhkIn19fV19fV0sInZhcmlhYmxlcyI6W119
; === AHK_HUB_STATE_END ===