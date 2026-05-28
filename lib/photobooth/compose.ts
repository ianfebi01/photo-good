import "server-only";

import sharp from "sharp";

import {
  type FrameKey,
  getFrame,
} from "./config";

/**
 * Cached frame overlays: each source image with its green panel pixels turned
 * transparent, so captured photos placed underneath show through while
 * decorations (sun, starfish, sparkles, title, etc.) that overlap stay on top.
 */
const overlayCache = new Map<FrameKey, Buffer>();

function isGreen( r: number, g: number, b: number ) {
  return g > 80 && g > r * 1.2 && g > b * 1.2 && r < 130 && b < 130;
}

async function buildFrameOverlay( key: FrameKey ): Promise<Buffer> {
  const cached = overlayCache.get( key );
  if ( cached ) return cached;

  const frame = getFrame( key );
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

  overlayCache.set( key, overlay );

  return overlay;
}

/**
 * Compose photos into the chosen frame. Each photo is cover-fitted into a
 * slot's bounding box, then the frame (with green made transparent) is laid
 * on top so the green-area shape masks the photo and decorations stay visible.
 */
export async function composeStrip(
  photos: Buffer[],
  frameKey: FrameKey,
): Promise<Buffer> {
  const frame = getFrame( frameKey );
  const overlay = await buildFrameOverlay( frameKey );

  const photoOverlays = await Promise.all(
    photos.slice( 0, frame.slots.length ).map( async ( buf, i ) => {
      const slot = frame.slots[i];
      const input = await sharp( buf )
        .resize( slot.width, slot.height, { fit : "cover", position : "centre" } )
        .png()
        .toBuffer();

      return { input, left : slot.left, top : slot.top };
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
