export const excosAdminConfig = {
  title: 'Excos',
  idField: 'role',
  listColumns: [
    { field: 'sort_order', label: 'Order' },
    { field: 'role', label: 'Role' },
    { field: 'name', label: 'Name' },
  ],
  fields: [
    { field: 'role', label: 'Role', type: 'text' },
    { field: 'name', label: 'Name', type: 'text' },
    { field: 'sort_order', label: 'Display order', type: 'number' },
    { field: 'photo_url', label: 'Photo', type: 'avatar' },
  ],
}
