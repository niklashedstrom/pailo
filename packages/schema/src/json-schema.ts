import { z } from 'zod'
import { appDescriptionSchema } from './description'

/**
 * JSON Schema for the current version, used to constrain AI output. It covers
 * the shape only; cross-references are checked by parseAppDescription.
 */
export function appDescriptionJsonSchema() {
  return z.toJSONSchema(appDescriptionSchema)
}
