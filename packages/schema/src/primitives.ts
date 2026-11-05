import { z } from 'zod'

/**
 * Size limits for one app description. They are starting values and can be
 * raised without a migration.
 */
export const LIMITS = {
  idLength: 40,
  nameLength: 80,
  descriptionLength: 500,
  collections: 20,
  fieldsPerCollection: 40,
  optionsPerChoice: 50,
  views: 20,
  fieldsPerView: 40,
  sectionsPerOverview: 10,
  itemsPerSection: 50,
  inputs: 10,
  reminders: 20,
  people: 30,
  daysBefore: 365,
} as const

/** Stable key: lowercase a–z, digits and hyphens, starting with a letter. */
export const idSchema = z
  .string()
  .max(LIMITS.idLength)
  .regex(/^[a-z][a-z0-9-]*$/, 'Id must use lowercase a-z, digits or hyphens and start with a letter')

/** A name or label shown to the user. */
export const nameSchema = z.string().min(1).max(LIMITS.nameLength)

/** A longer text shown to the user. */
export const descriptionSchema = z.string().min(1).max(LIMITS.descriptionLength)
