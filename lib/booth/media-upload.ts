import 'server-only'

/**
 * Shared rules for the booth media presigned upload flow.
 *
 * POST /api/booth/media/presign signs a PUT URL and picks the object key;
 * POST /api/booth/media then reads the object back from R2 to finalise it. Both
 * sides must agree on the prefix, the size cap and which MIME types are allowed,
 * so those live here.
 */

/** Where every booth upload lands. */
export const MEDIA_OBJECT_PREFIX = 'captures/'

/** Prefixes a media finalise request may reference. */
export const MEDIA_OBJECT_PREFIXES = [MEDIA_OBJECT_PREFIX] as const

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/** Canonical extension per mime type — the format the bytes actually are. */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg'      : '.jpg',
  'image/png'       : '.png',
  'image/webp'      : '.webp',
  'image/gif'       : '.gif',
  'image/heic'      : '.heic',
  'video/mp4'       : '.mp4',
  'video/quicktime' : '.mov',
}

/**
 * Extension for a stored upload.
 *
 * The mime type wins, because the uploaded filename can lie (and the booth
 * sends names like `countdown-abc-0.mp4` that we must not trust blindly).
 * Only when the mime is unknown do we fall back to the original filename's
 * extension, then to a format-appropriate default. WebM is not part of the
 * pipeline, so a `.webm` name never decides the stored extension either —
 * videos land as `.mp4`.
 */
export function extensionFor( mime: string, originalName: string ): string {
  const normalized = mime.toLowerCase().split( ';' )[0].trim()
  const known = EXT_BY_MIME[normalized]
  if ( known ) return known

  const isVideo = normalized.startsWith( 'video/' )
  const fromName = /\.([a-z0-9]{2,4})$/i.exec( originalName )?.[1]?.toLowerCase()
  if ( fromName && fromName !== 'webm' ) return `.${fromName}`

  return isVideo ? '.mp4' : '.jpg'
}

/**
 * Validate a client-declared MIME type. Returns an error message, or null when
 * the type is acceptable. WebM is rejected: every booth video is MP4/H.264, so
 * a VP9/VP8 upload would only break playback and downloads.
 */
export function validateMediaMime( mime: unknown ): string | null {
  if ( typeof mime !== 'string' || !mime ) return 'Missing mimeType'

  const normalized = mime.toLowerCase().split( ';' )[0].trim()
  if ( normalized === 'video/webm' ) {
    return 'WebM is not supported — upload MP4/H.264 video'
  }
  if ( !normalized.startsWith( 'image/' ) && !normalized.startsWith( 'video/' ) ) {
    return 'File must be an image or video'
  }

  return null
}

/** Normalise a declared MIME type the same way `validateMediaMime` reads it. */
export function normalizeMediaMime( mime: string ): string {
  return mime.toLowerCase().split( ';' )[0].trim()
}

/** Reverse of `EXT_BY_MIME`: the type our own generated extension implies. */
const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries( EXT_BY_MIME ).map( ( [ mime, ext ] ) => [ ext, mime ] ),
)

/**
 * MIME type implied by a stored object's extension.
 *
 * The presign route picks that extension from the declared type, so this is the
 * accurate fallback when R2 reports a generic type (`application/octet-stream`)
 * or none at all — which is what happens when a client uploads without a
 * `Content-Type` header. Returns null for extensions we never generate.
 */
export function mimeForObjectKey( key: string ): string | null {
  const ext = /\.([a-z0-9]{2,5})$/i.exec( key )?.[1]?.toLowerCase()
  if ( !ext ) return null

  return MIME_BY_EXT[`.${ext}`] ?? null
}

/** True for the type families this pipeline accepts. */
export function isMediaMime( mime: string ): boolean {
  return mime.startsWith( 'image/' ) || mime.startsWith( 'video/' )
}

/**
 * Object key + filename for a new booth upload, e.g.
 * `captures/booth-9f1c2a3b4d5e-lx8k2p.mp4`.
 *
 * The filename is what the DB stores and what the key is built from, so a
 * client can never pick a path outside `captures/`.
 */
export function boothMediaObject( {
  boothId,
  mime,
  originalName,
}: {
  boothId : string
  mime : string
  originalName : string
} ): { filename: string; key: string } {
  const boothShort = boothId.replace( /-/g, '' ).slice( 0, 12 )
  const ext = extensionFor( mime, originalName )
  const filename = `booth-${boothShort}-${Date.now()}${ext}`

  return { filename, key : `${MEDIA_OBJECT_PREFIX}${filename}` }
}
