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

      const input = await sharp( buf )
        .resize( w, h, { fit : "cover", position : "centre" } )
        .png()
        .toBuffer();

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
