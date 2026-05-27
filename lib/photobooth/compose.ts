import "server-only";

import sharp from "sharp";

import { FRAME, PHOTO_COUNT, cellPosition, frameSize } from "./config";

/**
 * Compose up to PHOTO_COUNT photos into the branded 2x3 vertical strip.
 * Each photo is cover-fitted into its cell with rounded corners; a footer
 * with the title + date is drawn beneath the grid.
 */
export async function composeStrip( photos: Buffer[] ): Promise<Buffer> {
  const { width, height } = frameSize();

  // Rounded-corner mask reused for every cell.
  const mask = Buffer.from(
    `<svg width="${FRAME.cellWidth}" height="${FRAME.cellHeight}">
       <rect width="${FRAME.cellWidth}" height="${FRAME.cellHeight}"
             rx="${FRAME.radius}" ry="${FRAME.radius}" fill="#fff"/>
     </svg>`,
  );

  const cells = await Promise.all(
    photos.slice( 0, PHOTO_COUNT ).map( async ( buf ) => {
      return sharp( buf )
        .resize( FRAME.cellWidth, FRAME.cellHeight, { fit : "cover", position : "centre" } )
        .composite( [{ input : mask, blend : "dest-in" }] )
        .png()
        .toBuffer();
    } ),
  );

  const overlays = cells.map( ( input, i ) => {
    const { left, top } = cellPosition( i );
    
    return { input, left, top };
  } );

  // Footer band with title + timestamp, drawn as one SVG overlay.
  const footerTop = height - FRAME.footer;
  const date = new Date().toLocaleDateString( undefined, {
    year  : "numeric",
    month : "long",
    day   : "numeric",
  } );
  const footer = Buffer.from(
    `<svg width="${width}" height="${FRAME.footer}" xmlns="http://www.w3.org/2000/svg">
       <text x="${width / 2}" y="${FRAME.footer * 0.5}" text-anchor="middle"
             font-family="Georgia, 'Times New Roman', serif" font-size="48"
             font-weight="700" fill="${FRAME.accent}">${FRAME.title}</text>
       <text x="${width / 2}" y="${FRAME.footer * 0.82}" text-anchor="middle"
             font-family="Arial, sans-serif" font-size="24"
             fill="${FRAME.textDark}" opacity="0.7">${date}</text>
     </svg>`,
  );
  overlays.push( { input : footer, left : 0, top : footerTop } );

  // Outer accent border drawn as a stroked rect overlay.
  const border = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="26" ry="26"
             fill="none" stroke="${FRAME.accentSoft}" stroke-width="8"/>
     </svg>`,
  );
  overlays.push( { input : border, left : 0, top : 0 } );

  return sharp( {
    create : {
      width,
      height,
      channels   : 4,
      background : FRAME.background,
    },
  } )
    .composite( overlays )
    .jpeg( { quality : 92 } )
    .toBuffer();
}
