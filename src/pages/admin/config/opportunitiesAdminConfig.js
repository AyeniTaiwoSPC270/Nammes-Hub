export const opportunitiesAdminConfig = {
  title: 'Opportunities',
  idField: 'title',
  listColumns: [
    { field: 'deadline', label: 'Deadline' },
    { field: 'type', label: 'Type' },
    { field: 'title', label: 'Title' },
  ],
  fields: [
    { field: 'title', label: 'Title', type: 'text' },
    { field: 'org', label: 'Organization', type: 'text' },
    { field: 'type', label: 'Type', type: 'select', options: ['Scholarship', 'Internship'] },
    { field: 'deadline', label: 'Deadline', type: 'date' },
    { field: 'link', label: 'Apply link', type: 'url' },
  ],
}
