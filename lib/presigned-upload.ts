/**
 * Client half of the presigned upload flow.
 *
 * The browser asks an API route for a short-lived PUT URL, uploads the file
 * straight to R2 (the bytes never touch the Next.js server), then hands the
 * resulting object key back to the app to be validated and recorded.
 *
 * Browser-safe: no server-only imports, so both client components and the
 * external booth client can reuse this.
 */

/** Response shape of every `…/presign` route. */
export type PresignedUpload = {
  /** Short-lived signed PUT URL — upload the file here. */
  uploadUrl : string
  /** The R2 object key the upload lands on; pass this back to finalise. */
  key : string
  /** Domain-less stored path (`/key`) used for DB rows. */
  mediaPath : string
  /** Absolute public URL, for immediate display after the upload. */
  publicUrl : string
  /** Must be sent verbatim as the PUT `Content-Type` — it is part of the signature. */
  contentType : string
  expiresIn : number
}

/** Pull `<Message>` out of an S3/R2 XML error body, when there is one. */
function r2ErrorMessage( body: string ): string | null {
  const message = /<Message>([^<]+)<\/Message>/i.exec( body )?.[1]

  return message?.trim() || null
}

/**
 * PUT a file to a presigned URL.
 *
 * `Content-Type` is always sent: R2 stores it as the object's content type and
 * does NOT infer one from the key extension, and the public URL serves it
 * verbatim (videos need it to play). It is not part of the signature in this SDK
 * version, but it does make the request non-simple — so the bucket's CORS rule
 * must allow the header, not just the PUT method.
 * Do not set `Content-Length` — the browser does that.
 */
export async function putFileToPresignedUrl( {
  uploadUrl,
  file,
  contentType,
}: {
  uploadUrl : string
  file : Blob
  contentType : string
} ): Promise<void> {
  let response : Response

  try {
    response = await fetch( uploadUrl, {
      method  : 'PUT',
      headers : { 'Content-Type' : contentType },
      body    : file,
    } )
  } catch {
    // The browser reports a blocked preflight as a plain failed fetch, so spell
    // out what the bucket rule has to contain — a rule that only allows the PUT
    // method still 403s the preflight and looks like a network error.
    throw new Error(
      'Blocked while uploading to storage — the bucket CORS rule must allow the PUT method and the "content-type" header from this origin',
    )
  }

  if ( response.ok ) return

  const body = await response.text().catch( () => '' )
  const detail = r2ErrorMessage( body )

  throw new Error( detail ?? `Upload rejected by storage (${response.status})` )
}

/** Presign + PUT in one step. Returns the presigned descriptor for finalising. */
export async function uploadFileWithPresign( {
  presign,
  file,
}: {
  presign : PresignedUpload
  file : Blob
} ): Promise<PresignedUpload> {
  await putFileToPresignedUrl( {
    uploadUrl   : presign.uploadUrl,
    file,
    contentType : presign.contentType,
  } )

  return presign
}
