import FormField from '../ui/FormField'

export default function NominationCategoryField({ category, value, onChange }) {
  return (
    <FormField
      label={category.title}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={category.description || `Who do you nominate for ${category.title}?`}
    />
  )
}
