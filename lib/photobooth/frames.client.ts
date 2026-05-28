/**
 * Client-safe frame metadata for the booth UI (thumbnails + slot counts).
 * Keep `key`, `label`, `publicUrl`, dimensions, and slot count in sync with
 * lib/photobooth/config.ts on the server.
 */

export type FrameKey = "summer-day" | "good-vibes";

export type ClientFrame = {
  key: FrameKey;
  label: string;
  publicUrl: string;
  width: number;
  height: number;
  photoCount: number;
};

export const CLIENT_FRAMES: ClientFrame[] = [
  {
    key        : "summer-day",
    label      : "Summer Day",
    publicUrl  : "/frames/summer-day.png",
    width      : 707,
    height     : 2000,
    photoCount : 4,
  },
  {
    key        : "good-vibes",
    label      : "Good Vibes",
    publicUrl  : "/frames/good-vibes.jpg",
    width      : 533,
    height     : 1600,
    photoCount : 3,
  },
];

export const DEFAULT_FRAME_KEY: FrameKey = "summer-day";

export function getClientFrame( key: FrameKey ): ClientFrame {
  const found = CLIENT_FRAMES.find( ( f ) => f.key === key );
  if ( !found ) throw new Error( `Unknown frame: ${key}` );

  return found;
}
