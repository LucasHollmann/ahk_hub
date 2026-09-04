import type { FunctionMeta } from "../types";
import { quoteAhkString, toSystemFunctionName } from "../ahk";

const NAME = "Mídia/Volume";
const AHK_FUNCTION_NAME = toSystemFunctionName(NAME);

export const meta: FunctionMeta = {
  id: "media",
  name: NAME,
  description: "Controla volume e reprodução de mídia (aumentar, mudo, play/pause, próxima faixa, etc).",
  params: [
    {
      key: "action",
      label: "Ação",
      type: "select",
      options: [
        { value: "VolumeUp", label: "Aumentar volume" },
        { value: "VolumeDown", label: "Diminuir volume" },
        { value: "Mute", label: "Mudo (alternar)" },
        { value: "SetVolume", label: "Definir volume exato" },
        { value: "PlayPause", label: "Play/Pause" },
        { value: "Next", label: "Próxima faixa" },
        { value: "Previous", label: "Faixa anterior" },
        { value: "Stop", label: "Parar" },
      ],
    },
    {
      key: "volume",
      label: "Volume exato em % (usado só em 'Definir volume exato')",
      type: "number",
      optional: true,
    },
  ],
  usableDirectly: true,
  toAhkDeclaration: () =>
    [
      `${AHK_FUNCTION_NAME}(action, volume) {`,
      '    if (action = "VolumeUp") {',
      '        Send("{Volume_Up}")',
      "        return",
      "    }",
      '    if (action = "VolumeDown") {',
      '        Send("{Volume_Down}")',
      "        return",
      "    }",
      '    if (action = "Mute") {',
      '        Send("{Volume_Mute}")',
      "        return",
      "    }",
      '    if (action = "SetVolume") {',
      "        SoundSetVolume(volume)",
      "        return",
      "    }",
      '    if (action = "PlayPause") {',
      '        Send("{Media_Play_Pause}")',
      "        return",
      "    }",
      '    if (action = "Next") {',
      '        Send("{Media_Next}")',
      "        return",
      "    }",
      '    if (action = "Previous") {',
      '        Send("{Media_Prev}")',
      "        return",
      "    }",
      '    if (action = "Stop") {',
      '        Send("{Media_Stop}")',
      "        return",
      "    }",
      "}",
    ].join("\n"),
  toAhkCall: (values) => {
    const volume = Number(values.volume ?? 0);
    return `${AHK_FUNCTION_NAME}(${quoteAhkString(String(values.action ?? ""))}, ${volume})`;
  },
};
