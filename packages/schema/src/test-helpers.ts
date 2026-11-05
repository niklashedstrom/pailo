// Shared fixtures for tests. Returns a fresh, valid description each call so
// tests can break one thing at a time.
// oxlint-disable-next-line typescript/no-explicit-any
export type Draft = any

export function validDescription(): Draft {
  return {
    schemaVersion: 1,
    name: 'Testapp',
    collections: [
      {
        id: 'items',
        name: 'Saker',
        access: 'edit',
        fields: [
          { id: 'title', label: 'Titel', type: 'text' },
          { id: 'when', label: 'När', type: 'date' },
          { id: 'url', label: 'Länk', type: 'link' },
        ],
      },
    ],
    views: [{ id: 'all', name: 'Alla', type: 'list', collection: 'items' }],
    inputs: [],
    people: { others: [] },
    reminders: [],
    theme: { preset: 'calm' },
  }
}
