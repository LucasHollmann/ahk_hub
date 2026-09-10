; Gerado automaticamente pelo AHK Hub (AutoHotkey v2)
#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"

; ==== Declaração das funções ====

system_controller_function_exibir_mensagem(text) {
    MsgBox text
}

system_controller_condition_janela_ativa_contem(titleContains) {
    try {
        return InStr(WinGetTitle("A"), titleContains) > 0
    } catch {
        return false
    }
}

test() {
    f := "1"
    f := "h"
    if (system_controller_condition_janela_ativa_contem("remap")) {
        system_controller_function_exibir_mensagem("xd")
    }
    else {
        system_controller_function_exibir_mensagem("dx")
        system_controller_function_exibir_mensagem("dy")
    }
}

; ==== Remapeamentos ====

^D::test()

; === AHK_HUB_STATE_BEGIN ===
; eyJyZW1hcHBpbmdzIjpbeyJpZCI6MSwiZnJvbSI6IkN0cmwrRCIsImRlc3RpbmF0aW9uIjp7ImtpbmQiOiJjdXN0b21GdW5jdGlvbiIsIm5hbWUiOiJ0ZXN0IiwiYXJncyI6e319fV0sImZ1bmN0aW9ucyI6W3siaWQiOjEsIm5hbWUiOiJ0ZXN0IiwiZGVzY3JpcHRpb24iOiIiLCJjb2RlIjoidGVzdCgpIHtcbiAgICBmIDo9IFwiMVwiXG4gICAgZiA6PSBcImhcIlxuICAgIGlmIChzeXN0ZW1fY29udHJvbGxlcl9jb25kaXRpb25famFuZWxhX2F0aXZhX2NvbnRlbShcInJlbWFwXCIpKSB7XG4gICAgICAgIHN5c3RlbV9jb250cm9sbGVyX2Z1bmN0aW9uX2V4aWJpcl9tZW5zYWdlbShcInhkXCIpXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBzeXN0ZW1fY29udHJvbGxlcl9mdW5jdGlvbl9leGliaXJfbWVuc2FnZW0oXCJkeFwiKVxuICAgICAgICBzeXN0ZW1fY29udHJvbGxlcl9mdW5jdGlvbl9leGliaXJfbWVuc2FnZW0oXCJkeVwiKVxuICAgIH1cbn0iLCJwYXJhbXMiOltdLCJidWlsZGVyIjp7Im1vZGUiOiJzdGVwcyIsInN0ZXBzIjpbeyJraW5kIjoidmFyaWFibGVBY3Rpb24iLCJhY3Rpb24iOiJjcmVhdGUiLCJ0YXJnZXROYW1lIjoiZiIsInZhclR5cGUiOiJ0ZXh0IiwiaW5pdGlhbFZhbHVlIjoiMSIsInNjb3BlIjoibG9jYWwifSx7ImtpbmQiOiJ2YXJpYWJsZUFjdGlvbiIsImFjdGlvbiI6InNldCIsInRhcmdldE5hbWUiOiJmIiwidmFsdWUiOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6ImgifX0seyJraW5kIjoiZmxvd0NvbnRyb2wiLCJmbG93VHlwZSI6ImNvbmRpdGlvbmFsIiwiY29uZGl0aW9uIjp7ImtpbmQiOiJidWlsdGluIiwiY29uZGl0aW9uSWQiOiJjb25kQWN0aXZlV2luZG93IiwicGFyYW1zIjp7InRpdGxlQ29udGFpbnMiOiJyZW1hcCJ9fSwiYm9keSI6W3sia2luZCI6ImJ1aWx0aW4iLCJmdW5jdGlvbklkIjoic2hvd01lc3NhZ2UiLCJhcmdzIjp7InRleHQiOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6InhkIn19fV0sImVsc2VCb2R5IjpbeyJraW5kIjoiYnVpbHRpbiIsImZ1bmN0aW9uSWQiOiJzaG93TWVzc2FnZSIsImFyZ3MiOnsidGV4dCI6eyJraW5kIjoibGl0ZXJhbCIsInZhbHVlIjoiZHgifX19LHsia2luZCI6ImJ1aWx0aW4iLCJmdW5jdGlvbklkIjoic2hvd01lc3NhZ2UiLCJhcmdzIjp7InRleHQiOnsia2luZCI6ImxpdGVyYWwiLCJ2YWx1ZSI6ImR5In19fV19XX19XSwidmFyaWFibGVzIjpbXX0=
; === AHK_HUB_STATE_END ===