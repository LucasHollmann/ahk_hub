import { meta as activeWindowMeta } from "./activeWindow";
import { meta as windowExistsMeta } from "./windowExists";
import { meta as windowStateMeta } from "./windowState";
import { meta as keyStateMeta } from "./keyState";
import { meta as toggleKeyStateMeta } from "./toggleKeyState";
import { meta as mousePositionMeta } from "./mousePosition";
import { meta as pixelColorMeta } from "./pixelColor";
import { meta as clipboardMeta } from "./clipboard";
import { meta as idleTimeMeta } from "./idleTime";
import { meta as timeOfDayMeta } from "./timeOfDay";
import { meta as volumeMeta } from "./volume";
import type { FunctionMeta } from "../types";

/** Built-in, ready-to-use condition kinds (mouse/window/key/time/etc) selectable in a Loop/Conditional step's condition. */
export const BUILTIN_CONDITIONS: FunctionMeta[] = [
  activeWindowMeta,
  windowExistsMeta,
  windowStateMeta,
  keyStateMeta,
  toggleKeyStateMeta,
  mousePositionMeta,
  pixelColorMeta,
  clipboardMeta,
  idleTimeMeta,
  timeOfDayMeta,
  volumeMeta,
];
