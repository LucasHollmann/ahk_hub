; Gerado automaticamente pelo AHK Hub (AutoHotkey v2)
#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"

; ==== Variáveis globais de Gui (pré-declaradas para poderem ser usadas antes de "Criar Gui" rodar) ====

gui_xD := ""

; ==== Declaração das funções ====

system_controller_function_esperar(ms) {
    Sleep ms
}

test() {
    global gui_xD
    gui_xD := Gui("+AlwaysOnTop -Caption +ToolWindow", "xD")
    gui_xD.BackColor := "0x312f31"
    gui_xD.Add("Text", "cffffff", "xD")
    gui_xD.Show("w300")
    while (GetKeyState("ctrl", "P")) {
        system_controller_function_esperar(100)
    }
    gui_xD.Destroy()
}

; ==== Remapeamentos ====

^D::test()

; === AHK_HUB_STATE_BEGIN ===
; eyJyZW1hcHBpbmdzIjpbeyJpZCI6NSwiZnJvbSI6IkN0cmwrRCIsImRlc3RpbmF0aW9uIjp7ImtpbmQiOiJjdXN0b21GdW5jdGlvbiIsIm5hbWUiOiJ0ZXN0IiwiYXJncyI6e319LCJ0cmlnZ2VyIjoiZnVsbCJ9XSwiZnVuY3Rpb25zIjpbeyJpZCI6NCwibmFtZSI6InRlc3QiLCJkZXNjcmlwdGlvbiI6IiIsImNvZGUiOiJ0ZXN0KCkge1xuICAgIGdsb2JhbCBndWlfeERcbiAgICBndWlfeEQgOj0gR3VpKFwiK0Fsd2F5c09uVG9wIC1DYXB0aW9uICtUb29sV2luZG93XCIsIFwieERcIilcbiAgICBndWlfeEQuQmFja0NvbG9yIDo9IFwiMHgzMTJmMzFcIlxuICAgIGd1aV94RC5BZGQoXCJUZXh0XCIsIFwiY2ZmZmZmZlwiLCBcInhEXCIpXG4gICAgZ3VpX3hELlNob3coXCJ3MzAwXCIpXG4gICAgd2hpbGUgKEdldEtleVN0YXRlKFwiY3RybFwiLCBcIlBcIikpIHtcbiAgICAgICAgc3lzdGVtX2NvbnRyb2xsZXJfZnVuY3Rpb25fZXNwZXJhcigxMDApXG4gICAgfVxuICAgIGd1aV94RC5EZXN0cm95KClcbn0iLCJwYXJhbXMiOltdLCJidWlsZGVyIjp7Im1vZGUiOiJzdGVwcyIsInN0ZXBzIjpbeyJraW5kIjoiY3JlYXRlR3VpIiwidmFyTmFtZSI6Imd1aV94RCIsInRpdGxlIjoieEQiLCJyZXNpemFibGUiOmZhbHNlLCJhbHdheXNPblRvcCI6dHJ1ZSwibm9DYXB0aW9uIjp0cnVlLCJ0b29sV2luZG93Ijp0cnVlLCJpbml0aWFsU3RhdGUiOiJub3JtYWwiLCJjb2xvciI6IjMxMmYzMSIsIndpZHRoIjozMDAsImNvbnRyb2xzIjpbeyJ0eXBlIjoidGV4dCIsInRleHQiOiJ4RCIsImNvbG9yIjoiZmZmZmZmIn1dfSx7ImtpbmQiOiJmbG93Q29udHJvbCIsImZsb3dUeXBlIjoibG9vcCIsImNvbmRpdGlvbiI6eyJraW5kIjoiYnVpbHRpbiIsImNvbmRpdGlvbklkIjoiY29uZEtleVN0YXRlIiwicGFyYW1zIjp7ImtleSI6ImN0cmwifX0sImJvZHkiOlt7ImtpbmQiOiJidWlsdGluIiwiZnVuY3Rpb25JZCI6IndhaXQiLCJhcmdzIjp7Im1zIjp7ImtpbmQiOiJsaXRlcmFsIiwidmFsdWUiOjEwMH19fV19LHsia2luZCI6ImNsb3NlR3VpIiwidGFyZ2V0VmFyIjoiZ3VpX3hEIn1dfX1dLCJ2YXJpYWJsZXMiOltdfQ==
; === AHK_HUB_STATE_END ===