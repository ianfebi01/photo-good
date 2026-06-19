/** A slot defines where a captured photo is placed on a frame. */
export type BoothFrameSlot = {
  left : number
  top : number
  width : number
  height : number
}

/** A frame returned by the booth-facing frames API. */
export type BoothFrame = {
  key : string
  label : string
  imageUrl : string
  width : number
  height : number
  slots : BoothFrameSlot[]
  builtIn : boolean
}

/** GET /api/booth/frames response. */
export type BoothFramesResponse = {
  frames : BoothFrame[]
}
