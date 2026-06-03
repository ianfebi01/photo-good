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
  slots: Array<{ left: number; top: number; width: number; height: number }>;
  builtIn: boolean;
};

export const DEFAULT_FRAME_KEY = "summer-day";

export const FALLBACK_FRAMES: ClientFrame[] = [
  {
    key        : "summer-day",
    label      : "Summer Day",
    publicUrl  : "/frames/summer-day.png",
    width      : 1414,
    height     : 4000,
    photoCount : 4,
    builtIn    : true,
    slots      : [
      { left : 76, top : 142,  width : 1262, height : 720 },
      { left : 76, top : 952,  width : 1262, height : 721 },
      { left : 76, top : 1762, width : 1262, height : 721 },
      { left : 76, top : 2573, width : 1262, height : 720 },
    ],
  },
  {
    key        : "memory-sender",
    label      : "Memory Sender",
    publicUrl  : "/frames/memory-sender.png",
    width      : 1414,
    height     : 4000,
    photoCount : 4,
    builtIn    : true,
    slots      : [
      { left : 86, top : 142,  width : 1243, height : 747 },
      { left : 86, top : 937,  width : 1243, height : 748 },
      { left : 86, top : 1732, width : 1243, height : 748 },
      { left : 86, top : 2528, width : 1243, height : 748 },
    ],
  },
  {
    key        : "multicolor-photography",
    label      : "Multicolor Photography",
    publicUrl  : "/frames/multicolor-photography.png",
    width      : 1600,
    height     : 4000,
    photoCount : 3,
    builtIn    : true,
    slots      : [
      { left : 159, top : 392,  width : 1441, height : 716 },
      { left : 173, top : 1114, width : 1427, height : 1243 },
      { left : 188, top : 2364, width : 1412, height : 1242 },
    ],
  },
  {
    key        : "retro-portraits",
    label      : "Retro Portraits",
    publicUrl  : "/frames/retro-portraits.png",
    width      : 1200,
    height     : 3600,
    photoCount : 3,
    builtIn    : true,
    slots      : [
      { left : 359, top : 126,  width : 715, height : 1077 },
      { left : 359, top : 1260, width : 715, height : 1077 },
      { left : 359, top : 2397, width : 715, height : 1077 },
    ],
  },
  {
    key        : "family-polaroid",
    label      : "Family Polaroid",
    publicUrl  : "/frames/family-polaroid.png",
    width      : 1200,
    height     : 3600,
    photoCount : 3,
    builtIn    : true,
    slots      : [
      { left : 202, top : 206,  width : 776, height : 718 },
      { left : 210, top : 942,  width : 786, height : 769 },
      { left : 206, top : 1824, width : 777, height : 1463 },
    ],
  },
  {
    key        : "red-friendship",
    label      : "Red Friendship",
    publicUrl  : "/frames/red-friendship.png",
    width      : 1200,
    height     : 3600,
    photoCount : 3,
    builtIn    : true,
    slots      : [
      { left : 126, top : 102,  width : 948, height : 803 },
      { left : 127, top : 1008, width : 946, height : 703 },
      { left : 143, top : 1826, width : 914, height : 906 },
    ],
  },
  {
    key        : "red-white-friends",
    label      : "Red & White Friends",
    publicUrl  : "/frames/red-white-friends.png",
    width      : 1200,
    height     : 3600,
    photoCount : 2,
    builtIn    : true,
    slots      : [
      { left : 125, top : 436,  width : 948, height : 948 },
      { left : 125, top : 1663, width : 948, height : 948 },
    ],
  },
  {
    key        : "white-pink",
    label      : "White & Pink",
    publicUrl  : "/frames/white-pink.png",
    width      : 1181,
    height     : 3543,
    photoCount : 3,
    builtIn    : true,
    slots      : [
      { left : 177, top : 192,  width : 827, height : 755 },
      { left : 177, top : 1317, width : 827, height : 754 },
      { left : 177, top : 2442, width : 827, height : 754 },
    ],
  },
];
