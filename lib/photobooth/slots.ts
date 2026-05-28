import "server-only";

import sharp from "sharp";

import type { FrameSlot } from "./config";

/**
 * Treat a pixel as "slot green" when it's clearly green-dominant. Matches the
 * solid greens used by the bundled summer-day and good-vibes templates and
 * what a user is expected to paint over their slots.
 */
export function isGreen( r: number, g: number, b: number ): boolean {
  return g > 80 && g > r * 1.2 && g > b * 1.2 && r < 130 && b < 130;
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
