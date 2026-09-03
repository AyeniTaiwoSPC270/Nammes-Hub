import { DAYS } from '../../../data/timetables'

export const timetablesAdminConfig = {
  title: 'Timetable',
  idField: 'code',
  groupField: 'level',
  groupLabel: 'Level',
  listColumns: [
    { field: 'level', label: 'Level' },
    { field: 'semester', label: 'Semester' },
    { field: 'type', label: 'Type' },
    { field: 'code', label: 'Code' },
    { field: 'day', label: 'Day' },
    { field: 'date', label: 'Date' },
    { field: 'start_time', label: 'Start' },
  ],
  fields: [
    { field: 'level', label: 'Level (100-500)', type: 'number' },
    { field: 'semester', label: 'Semester (1 or 2)', type: 'number' },
    { field: 'type', label: 'Type', type: 'select', options: ['class', 'exam'] },
    { field: 'day', label: 'Day (class entries)', type: 'select', options: DAYS, optional: true },
    { field: 'date', label: 'Date (exam entries)', type: 'date', optional: true },
    { field: 'start_time', label: 'Start time', type: 'time' },
    { field: 'end_time', label: 'End time', type: 'time' },
    { field: 'code', label: 'Course code', type: 'text' },
    { field: 'title', label: 'Course title', type: 'text' },
    { field: 'venue', label: 'Venue', type: 'text' },
    { field: 'lecturer', label: 'Lecturer', type: 'text', optional: true },
    { field: 'notes', label: 'Notes (e.g. Practical Lab, Tutorial)', type: 'text', optional: true },
  ],
}
