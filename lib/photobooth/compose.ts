import "server-only";

import sharp from "sharp";

import { type FrameDef, getFrame } from "./config";
import { isGreen } from "./slots";

/**
 * Cached frame overlays keyed by frame key + image-path mtime fingerprint.
 * Each entry is the frame image with its green panel pixels turned
 * transparent, so captured photos placed underneath show through while the
 * surrounding artwork stays on top.
 */
const overlayCache = new Map<string, Buffer>();

async function buildFrameOverlay( frame: FrameDef ): Promise<Buffer> {
  const cached = overlayCache.get( frame.key );
  if ( cached ) return cached;

  const { data, info } = await sharp( frame.image )
    .ensureAlpha()
    .raw()
    .toBuffer( { resolveWithObject : true } );

  const channels = info.channels;
  const pixels = Buffer.from( data );
  for ( let i = 0; i < pixels.length; i += channels ) {
    if ( isGreen( pixels[i], pixels[i + 1], pixels[i + 2] ) ) {
      pixels[i + 3] = 0;
    }
  }

  const overlay = await sharp( pixels, {
    raw : { width : info.width, height : info.height, channels },
  } )
    .png()
    .toBuffer();

  overlayCache.set( frame.key, overlay );

  return overlay;
}

/**
 * Compose photos into the chosen frame. Each photo is cover-fitted into a
 * slot's bounding box, then the frame (with green made transparent) is laid
 * on top so the green-area shape masks the photo and decorations stay visible.
 */
export async function composeStrip(
  photos: Buffer[],
  frameKey: string,
  adjustments?: { x: number; y: number; zoom: number; filter: string }[],
): Promise<Buffer> {
  const frame = await getFrame( frameKey );
  if ( !frame ) throw new Error( `Unknown frame: ${frameKey}` );
  const overlay = await buildFrameOverlay( frame );

  const photoOverlays = await Promise.all(
    photos.slice( 0, frame.slots.length ).map( async ( buf, i ) => {
      const slot = frame.slots[i];
      const padding = 8;
      const w = slot.width + padding * 2;
      const h = slot.height + padding * 2;

      // Retrieve custom adjustments
      const adj = adjustments?.[i] || { x : 0, y : 0, zoom : 1, filter : "none" };
      const zoom = adj.zoom || 1.0;
      const dx = adj.x || 0;
      const dy = adj.y || 0;
      const filter = adj.filter || "none";

      const meta = await sharp( buf ).metadata();
      const origW = meta.width ?? 1;
      const origH = meta.height ?? 1;

      // Base cover scale factor
      const coverScale = Math.max( w / origW, h / origH );
      const coverW = origW * coverScale;
      const coverH = origH * coverScale;

      const zoomedW = coverW * zoom;
      const zoomedH = coverH * zoom;

      // Position of top-left corner of zoomed image relative to container slot
      const posX = ( w - zoomedW ) / 2 + dx;
      const posY = ( h - zoomedH ) / 2 + dy;

      // Position to extract (crop) inside the zoomed image
      let left = -posX;
      let top = -posY;

      left = Math.max( 0, Math.min( left, zoomedW - w ) );
      top = Math.max( 0, Math.min( top, zoomedH - h ) );

      let img = sharp( buf )
        .resize( Math.round( zoomedW ), Math.round( zoomedH ) )
        .extract( {
          left   : Math.round( left ),
          top    : Math.round( top ),
          width  : w,
          height : h,
        } );

      // Apply color filter transformations
      if ( filter === "grayscale" ) {
        img = img.grayscale();
      } else if ( filter === "sepia" ) {
        img = img.recomb( [
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131],
        ] );
      } else if ( filter === "warm" ) {
        img = img.recomb( [
          [1.1, 0, 0],
          [0, 1.0, 0],
          [0, 0, 0.9],
        ] );
      } else if ( filter === "cool" ) {
        img = img.recomb( [
          [0.9, 0, 0],
          [0, 1.0, 0],
          [0, 0, 1.15],
        ] );
      } else if ( filter === "vintage" ) {
        img = img.recomb( [
          [0.95, 0.05, 0],
          [0, 0.9, 0.1],
          [0.05, 0, 0.85],
        ] ).modulate( { brightness : 1.05, saturation : 0.85 } );
      }

      const input = await img.png().toBuffer();

      return { input, left : slot.left - padding, top : slot.top - padding };
    } ),
  );

  return sharp( {
    create : {
      width      : frame.width,
      height     : frame.height,
      channels   : 4,
      background : { r : 255, g : 255, b : 255, alpha : 1 },
    },
  } )
    .composite( [...photoOverlays, { input : overlay, left : 0, top : 0 }] )
    .jpeg( { quality : 92 } )
    .toBuffer();
}
