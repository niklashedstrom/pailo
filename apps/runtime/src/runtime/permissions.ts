import type { AccessLevel } from '@pailo/schema'
import type { Role } from '../api'

export interface Permissions {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * What the person may do with records in a collection, mirroring the RLS
 * policies on `records` (M2). Only hides buttons: the database decides.
 * - admin: everything
 * - edit: create, change and delete all records
 * - add: create, and change own records (not delete)
 * - read: nothing
 */
export function permissions(
  access: AccessLevel,
  role: Role,
  createdBy: string | null,
  userId: string,
): Permissions {
  if (role === 'admin') return { canCreate: true, canEdit: true, canDelete: true }
  switch (access) {
    case 'edit':
      return { canCreate: true, canEdit: true, canDelete: true }
    case 'add':
      return { canCreate: true, canEdit: createdBy !== null && createdBy === userId, canDelete: false }
    case 'read':
      return { canCreate: false, canEdit: false, canDelete: false }
    default: {
      const unknownAccess: never = access
      throw new Error(`Unknown access: ${String(unknownAccess)}`)
    }
  }
}
