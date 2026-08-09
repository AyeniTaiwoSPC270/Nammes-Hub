export const eventsAdminConfig = {
  title: 'Events',
  idField: 'title',
  listColumns: [
    { field: 'date', label: 'Date' },
    { field: 'title', label: 'Title' },
  ],
  fields: [
    { field: 'title', label: 'Title', type: 'text' },
    { field: 'date', label: 'Date label', type: 'text' },
    { field: 'tone', label: 'Card color', type: 'select', options: ['green', 'orange'] },
    { field: 'meta', label: 'Location / time', type: 'text', optional: true },
    { field: 'description', label: 'Description', type: 'textarea' },
  ],
}
