import { NEWS_CATEGORIES } from '../../../data/news'

export const newsAdminConfig = {
  title: 'News',
  idField: 'title',
  listColumns: [
    { field: 'date', label: 'Date' },
    { field: 'category', label: 'Category' },
    { field: 'title', label: 'Title' },
  ],
  fields: [
    { field: 'title', label: 'Title', type: 'text' },
    { field: 'category', label: 'Category', type: 'select', options: NEWS_CATEGORIES },
    { field: 'tone', label: 'Card color', type: 'select', options: ['green', 'orange', 'neutral'] },
    { field: 'date', label: 'Date', type: 'date' },
    { field: 'author', label: 'Author', type: 'text' },
    { field: 'body', label: 'Body', type: 'textarea' },
    { field: 'badge_tone', label: 'Badge (optional)', type: 'select', options: ['', 'new', 'updated'], optional: true },
    { field: 'badge_label', label: 'Badge label', type: 'text', optional: true },
    { field: 'image_url', widthField: 'image_width_pct', label: 'Image', type: 'image' },
  ],
}
