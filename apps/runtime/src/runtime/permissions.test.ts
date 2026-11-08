import { describe, expect, it } from 'vitest'
import { permissions } from './permissions'

const ME = 'u-me'
const OTHER = 'u-other'

// The same matrix as the M2 pgTAP tests for records
// (supabase/tests/03_app_data.test.sql): access × role × own/other's record.
describe('permissions', () => {
  it.each([
    // access, role,    record by, create, edit,  delete
    ['edit', 'member', ME, true, true, true],
    ['edit', 'member', OTHER, true, true, true],
    ['add', 'member', ME, true, true, false],
    ['add', 'member', OTHER, true, false, false],
    ['read', 'member', ME, false, false, false],
    ['read', 'member', OTHER, false, false, false],
    ['edit', 'admin', OTHER, true, true, true],
    ['add', 'admin', OTHER, true, true, true],
    ['read', 'admin', OTHER, true, true, true],
    ['read', 'admin', ME, true, true, true],
  ] as const)('%s as %s on a record by %s', (access, role, by, canCreate, canEdit, canDelete) => {
    expect(permissions(access, role, by, ME)).toEqual({ canCreate, canEdit, canDelete })
  })

  it('never lets a member edit a record whose creator is unknown under add', () => {
    expect(permissions('add', 'member', null, ME).canEdit).toBe(false)
  })
})
