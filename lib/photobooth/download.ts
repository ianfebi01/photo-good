/**
 * Save a booth media file to disk as a real download.
 *
 * The `download` attribute on an anchor is ignored for cross-origin URLs, so
 * browsers open R2 media in a new tab instead of saving it (Safari does this
 * most aggressively). Fetching the bytes ourselves and clicking a same-origin
 * `blob:` URL makes the download attribute work in every browser.
 *
 * The fetch goes through `/api/captures/<file>` rather than the R2 domain
 * because R2 sends no CORS headers — a direct cross-origin fetch is blocked.
 */

/** Same-origin proxy URL for a stored media URL (`…/captures/<file>`). */
export function captureProxyUrl( url: string ): string | null {
  try {
    const name = new URL( url, window.location.origin ).pathname.split( '/' ).pop()

    return name ? `/api/captures/${encodeURIComponent( name )}` : null
  } catch {
    return null
  }
}

/** Download `url` as `filename`. Throws when the bytes can't be fetched. */
export async function downloadMedia( url: string, filename: string ): Promise<void> {
  const response = await fetch( captureProxyUrl( url ) ?? url )
  if ( !response.ok ) throw new Error( `Download failed (${response.status})` )

  const objectUrl = URL.createObjectURL( await response.blob() )

  try {
    const link = document.createElement( 'a' )

    link.href = objectUrl
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild( link )
    link.click()
    link.remove()
  } finally {
    // Revoke on a later tick — revoking too early cancels the save in Safari.
    window.setTimeout( () => URL.revokeObjectURL( objectUrl ), 10000 )
  }
}
