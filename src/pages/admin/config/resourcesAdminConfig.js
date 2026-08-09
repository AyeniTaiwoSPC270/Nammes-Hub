export const resourcesAdminConfig = {
  title: 'Resources',
  idField: 'title',
  listColumns: [
    { field: 'level', label: 'Level' },
    { field: 'semester', label: 'Semester' },
    { field: 'category', label: 'Category' },
    { field: 'title', label: 'Title' },
  ],
  fields: [
    { field: 'level', label: 'Level (100-500)', type: 'number' },
    { field: 'semester', label: 'Semester (1 or 2)', type: 'number' },
    { field: 'category', label: 'Category', type: 'text' },
    { field: 'title', label: 'Title', type: 'text' },
    { field: 'updated', label: 'Updated date', type: 'date' },
    { field: 'link', label: 'Drive link', type: 'url' },
  ],
}
