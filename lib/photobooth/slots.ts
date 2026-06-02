import "server-only";

import sharp from "sharp";

import type { FrameSlot } from "./config";

export function isGreen( r: number, g: number, b: number ): boolean {
  // Fast RGB pre-filter for performance and slot intensity
  if ( g <= r || g <= b || g < 95 ) return false;

  const max = g;
  const min = Math.min( r, b );
  const d = max - min;
  const l = ( max + min ) / 510;

  // Avoid near-neutrals (gray, white, black)
  if ( d < 8 ) return false;

  let h = ( b - r ) / d + 2;
  h = ( h * 60 ) % 360;
  if ( h < 0 ) h += 360;

  // Strict green hue (70..175), minimum saturation (0.15) and lightness range (0.20..0.82)
  // - l < 0.82 prevents matching bright white elements (like flower petals) with JPEG noise.
  // - l > 0.20 and g >= 95 protects dark anti-aliased outlines/black borders from becoming transparent.
  return h >= 70 && h <= 175 && ( d / max ) > 0.15 && l < 0.82 && l > 0.20;
}

export type DetectResult = {
  width: number;
  height: number;
  slots: FrameSlot[];
};

/**
 * Scan an image for vertically-stacked green panels and return each one's
 * pixel bounding box (left/top/width/height). Bands are found by counting
 * green pixels per row, then per column within each band. `rowMinPixels` and
 * `colMinPixels` filter out noise from anti-aliased edges and stray pixels.
 */
export async function detectGreenSlots(
  imageBuffer: Buffer,
  opts: { rowMinPixels?: number; colMinPixels?: number } = {},
): Promise<DetectResult> {
  const { data, info } = await sharp( imageBuffer )
    .ensureAlpha()
    .raw()
    .toBuffer( { resolveWithObject : true } );

  const { width, height, channels } = info;
  const rowMin = opts.rowMinPixels ?? Math.max( 30, Math.floor( width * 0.08 ) );
  const colMin = opts.colMinPixels ?? Math.max( 5, Math.floor( height * 0.01 ) );

  const rowCount = new Array<number>( height ).fill( 0 );
  for ( let y = 0; y < height; y++ ) {
    let count = 0;
    const rowStart = y * width * channels;
    for ( let x = 0; x < width; x++ ) {
      const i = rowStart + x * channels;
      if ( isGreen( data[i], data[i + 1], data[i + 2] ) ) count++;
    }
    rowCount[y] = count;
  }

  const bands: Array<[number, number]> = [];
  let start = -1;
  for ( let y = 0; y < height; y++ ) {
    if ( rowCount[y] > rowMin ) {
      if ( start === -1 ) start = y;
    } else if ( start !== -1 ) {
      bands.push( [start, y - 1] );
      start = -1;
    }
  }
  if ( start !== -1 ) bands.push( [start, height - 1] );

  const slots: FrameSlot[] = bands.map( ( [top, bottom] ) => {
    let left = -1;
    let right = -1;
    for ( let x = 0; x < width; x++ ) {
      let count = 0;
      for ( let y = top; y <= bottom; y++ ) {
        const i = ( y * width + x ) * channels;
        if ( isGreen( data[i], data[i + 1], data[i + 2] ) ) count++;
      }
      if ( count > colMin ) {
        if ( left === -1 ) left = x;
        right = x;
      }
    }

    return {
      left,
      top,
      width  : right - left + 1,
      height : bottom - top + 1,
    };
  } ).filter( ( s ) => s.left >= 0 && s.width > 10 && s.height > 10 );

  return { width, height, slots };
}
