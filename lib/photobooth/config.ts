import path from "node:path";

/** Number of shots that make up one photo strip. */
export const PHOTO_COUNT = 6;

/** Absolute directory where captures and composed strips are written. */
export const CAPTURES_DIR = path.join( process.cwd(), "captures" );

/**
 * Set PHOTOBOOTH_MOCK=1 to force the simulated camera even when a real one is
 * attached. Useful for development and demos.
 */
export const FORCE_MOCK = process.env.PHOTOBOOTH_MOCK === "1";

/** Single source photo aspect (3:2, typical of DSLR/mirrorless). */
export const PHOTO_WIDTH = 1200;
export const PHOTO_HEIGHT = 800;

/**
 * Layout of the composed strip: a classic 2-column x 3-row vertical strip with
 * a branded footer. All values are in pixels of the final image.
 */
export const FRAME = {
  columns    : 2,
  rows       : 3,
  cellWidth  : 600,
  cellHeight : 400,
  padding    : 44,
  gap        : 20,
  footer     : 132,
  radius     : 16,
  // Palette: white card, cream backdrop, red accent.
  background : "#FFFFFF",
  matte      : "#FFEDC7",
  accent     : "#EB4C4C",
  accentSoft : "#FFA6A6",
  textDark   : "#3a2222",
  title      : "photo•good",
} as const;

export function frameSize() {
  const w =
    FRAME.padding * 2 +
    FRAME.columns * FRAME.cellWidth +
    ( FRAME.columns - 1 ) * FRAME.gap;
  const h =
    FRAME.padding * 2 +
    FRAME.rows * FRAME.cellHeight +
    ( FRAME.rows - 1 ) * FRAME.gap +
    FRAME.footer;
  
  return { width : w, height : h };
}

/** Pixel position of cell `index` (0-based, row-major) inside the strip. */
export function cellPosition( index: number ) {
  const col = index % FRAME.columns;
  const row = Math.floor( index / FRAME.columns );
  const left = FRAME.padding + col * ( FRAME.cellWidth + FRAME.gap );
  const top = FRAME.padding + row * ( FRAME.cellHeight + FRAME.gap );
  
  return { left, top };
}
