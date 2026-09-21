export {};

export type CapturedWindow = {
  title: string;
  owner: string | null;
  bounds: { x: number; y: number; width: number; height: number };
  relative: { x: number; y: number };
};

export type CapturedPosition = {
  point: { x: number; y: number };
  window: CapturedWindow | null;
  /** Screen pixel under the cursor as "0xRRGGBB" — only present when the capture asked for it, and null if the screen couldn't be sampled. */
  color: string | null;
  /** ClassNN of the control under the cursor — only present when the capture asked for it, and null if AutoHotkey couldn't be reached or there is no control there. */
  control: string | null;
};

export type SaveScriptResult =
  | { status: "saved"; path: string }
  | { status: "error"; error: string }
  | { status: "canceled" };

export type RunScriptResult = { status: "ok" } | { status: "error"; error: string };

export type LoadScriptResult =
  | { status: "loaded"; path: string; content: string }
  | { status: "error"; error: string }
  | { status: "canceled" };

export type RecordedClickEvent = {
  kind: "click";
  /** Position where the button was released. */
  point: { x: number; y: number };
  /** Position where the button was originally pressed — same as `point` for a click with no movement. */
  downPoint: { x: number; y: number };
  window: CapturedWindow | null;
  button: "Left" | "Right" | "Middle";
  doubleClick: boolean;
  /** Milliseconds the button was held down before being released. */
  heldMs: number;
};

export type RecordedKeyEvent = {
  kind: "key";
  combo: string;
  /** Milliseconds the key (or standalone modifier) was held down before being released. */
  heldMs: number;
};

export type RecordedEvent = RecordedClickEvent | RecordedKeyEvent;

declare global {
  interface Window {
    desktop?: {
      platform: string;
      startCapturePosition: (options?: { withColor?: boolean; withControl?: boolean }) => void;
      cancelCapturePosition: () => void;
      onPositionCaptured: (
        callback: (result: CapturedPosition) => void
      ) => () => void;
      saveScript: (content: string, path?: string) => Promise<SaveScriptResult>;
      runScript: (path: string) => Promise<RunScriptResult>;
      loadScript: () => Promise<LoadScriptResult>;
      startRecording: () => void;
      stopRecording: () => void;
      onRecordedEvent: (callback: (event: RecordedEvent) => void) => () => void;
    };
  }
}
