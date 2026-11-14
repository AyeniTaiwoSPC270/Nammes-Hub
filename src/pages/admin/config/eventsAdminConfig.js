export const eventsAdminConfig = {
  title: 'Events',
  idField: 'title',
  reviewGated: true,
  listColumns: [
    { field: 'date', label: 'Date' },
    { field: 'title', label: 'Title' },
  ],
  fields: [
    { field: 'title', label: 'Title', type: 'text' },
    { field: 'date', label: 'Date label', type: 'text' },
    { field: 'tone', label: 'Card color', type: 'select', options: ['green', 'orange'] },
    { field: 'meta', label: 'Location / time', type: 'text', optional: true },
    { field: 'description', label: 'Description', type: 'richtext', coverField: 'image_url' },
    { field: 'image_url', label: 'Photo', type: 'event-image' },
    {
      field: 'email_members',
      label: 'Email members about this',
      type: 'boolean',
      default: true,
      helper: 'Untick to publish the event without sending an alert email.',
    },
  ],
}
