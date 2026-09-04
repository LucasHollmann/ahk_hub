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
};

declare global {
  interface Window {
    desktop?: {
      platform: string;
      startCapturePosition: () => void;
      cancelCapturePosition: () => void;
      onPositionCaptured: (
        callback: (result: CapturedPosition) => void
      ) => () => void;
    };
  }
}
