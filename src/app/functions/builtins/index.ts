import { meta as keyPressMeta } from "./keypress";
import { meta as writeMeta } from "./write";
import { meta as clickMeta } from "./click";
import { meta as openMeta } from "./open";
import { meta as waitMeta } from "./wait";
import { meta as activateWindowMeta } from "./activateWindow";
import { meta as showMessageMeta } from "./showMessage";
import { meta as manageWindowMeta } from "./manageWindow";
import { meta as toggleAlwaysOnTopMeta } from "./toggleAlwaysOnTop";
import { meta as moveMouseMeta } from "./moveMouse";
import { meta as scrollMeta } from "./scroll";
import { meta as dragMeta } from "./drag";
import { meta as systemActionMeta } from "./systemAction";
import { meta as mediaMeta } from "./media";
import { meta as loopMeta } from "./loop";
import { meta as conditionalMeta } from "./conditional";
import type { FunctionMeta } from "../types";

export const BUILTIN_FUNCTIONS: FunctionMeta[] = [
  keyPressMeta,
  writeMeta,
  clickMeta,
  openMeta,
  waitMeta,
  activateWindowMeta,
  showMessageMeta,
  manageWindowMeta,
  toggleAlwaysOnTopMeta,
  moveMouseMeta,
  scrollMeta,
  dragMeta,
  systemActionMeta,
  mediaMeta,
  loopMeta,
  conditionalMeta,
];
