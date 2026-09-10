; Gerado automaticamente pelo AHK Hub (AutoHotkey v2)
#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"

; ==== Declaração das funções ====

system_controller_function_midia_volume(action, volume) {
    if (action = "VolumeUp") {
        Send("{Volume_Up}")
        return
    }
    if (action = "VolumeDown") {
        Send("{Volume_Down}")
        return
    }
    if (action = "Mute") {
        Send("{Volume_Mute}")
        return
    }
    if (action = "SetVolume") {
        SoundSetVolume(volume)
        return
    }
    if (action = "PlayPause") {
        Send("{Media_Play_Pause}")
        return
    }
    if (action = "Next") {
        Send("{Media_Next}")
        return
    }
    if (action = "Previous") {
        Send("{Media_Prev}")
        return
    }
    if (action = "Stop") {
        Send("{Media_Stop}")
        return
    }
}

; ==== Remapeamentos ====

^D::system_controller_function_midia_volume("PlayPause", 0)

; === AHK_HUB_STATE_BEGIN ===
; eyJyZW1hcHBpbmdzIjpbeyJpZCI6MTc4ODU1MDIzNzY0MiwiZnJvbSI6IkN0cmwrRCIsImRlc3RpbmF0aW9uIjp7ImtpbmQiOiJidWlsdGluIiwiZnVuY3Rpb25JZCI6Im1lZGlhIiwicGFyYW1zIjp7ImFjdGlvbiI6IlBsYXlQYXVzZSIsInZvbHVtZSI6IiJ9fX1dLCJmdW5jdGlvbnMiOltdfQ==
; === AHK_HUB_STATE_END ===