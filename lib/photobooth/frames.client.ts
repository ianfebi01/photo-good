/**
 * Client-safe frame metadata for the booth UI.
 *
 * The full catalog is fetched from /api/frames at runtime (built-in + user
 * uploads). These constants provide the initial selection key and a tiny
 * fallback list so the selector renders before the fetch resolves.
 */

export type ClientFrame = {
  key: string;
  label: string;
  publicUrl: string;
  width: number;
  height: number;
  photoCount: number;
  builtIn: boolean;
};

export const DEFAULT_FRAME_KEY = "summer-day";

export const FALLBACK_FRAMES: ClientFrame[] = [
  {
    key        : "summer-day",
    label      : "Summer Day",
    publicUrl  : "/frames/summer-day.png",
    width      : 707,
    height     : 2000,
    photoCount : 4,
    builtIn    : true,
  },
  {
    key        : "good-vibes",
    label      : "Good Vibes",
    publicUrl  : "/frames/good-vibes.jpg",
    width      : 533,
    height     : 1600,
    photoCount : 3,
    builtIn    : true,
  },
];
