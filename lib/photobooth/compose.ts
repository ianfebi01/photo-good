import "server-only";

import sharp from "sharp";

import {
  FRAME_HEIGHT,
  FRAME_IMAGE,
  FRAME_SLOTS,
  FRAME_WIDTH,
  PHOTO_COUNT,
} from "./config";

/**
 * Cached frame overlay: the source PNG with all green panel pixels turned
 * transparent so captured photos placed underneath show through, while the
 * decorations (sun, starfish, crab, title) that overlap the panels stay on top.
 */
let cachedOverlay: Buffer | null = null;

function isGreen( r: number, g: number, b: number ) {
  return g > 80 && g > r * 1.2 && g > b * 1.2 && r < 130 && b < 130;
}

async function buildFrameOverlay(): Promise<Buffer> {
  if ( cachedOverlay ) return cachedOverlay;

  const { data, info } = await sharp( FRAME_IMAGE )
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

  cachedOverlay = await sharp( pixels, {
    raw : { width : info.width, height : info.height, channels },
  } )
    .png()
    .toBuffer();

  return cachedOverlay;
}

/**
 * Compose up to PHOTO_COUNT photos into the summer-day frame. Photos are
 * cover-fitted into each green slot, then the frame (with green made
 * transparent) is laid on top so decorative artwork stays visible.
 */
export async function composeStrip( photos: Buffer[] ): Promise<Buffer> {
  const overlay = await buildFrameOverlay();

  const photoOverlays = await Promise.all(
    photos.slice( 0, PHOTO_COUNT ).map( async ( buf, i ) => {
      const slot = FRAME_SLOTS[i];
      const input = await sharp( buf )
        .resize( slot.width, slot.height, { fit : "cover", position : "centre" } )
        .png()
        .toBuffer();

      return { input, left : slot.left, top : slot.top };
    } ),
  );

  return sharp( {
    create : {
      width      : FRAME_WIDTH,
      height     : FRAME_HEIGHT,
      channels   : 4,
      background : { r : 255, g : 255, b : 255, alpha : 1 },
    },
  } )
    .composite( [...photoOverlays, { input : overlay, left : 0, top : 0 }] )
    .jpeg( { quality : 92 } )
    .toBuffer();
}
