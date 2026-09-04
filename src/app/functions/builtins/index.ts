import { meta as writeMeta } from "./write";
import { meta as clickMeta } from "./click";
import type { FunctionMeta } from "../types";

export const BUILTIN_FUNCTIONS: FunctionMeta[] = [writeMeta, clickMeta];
