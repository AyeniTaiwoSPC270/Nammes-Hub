import { Segmented } from '../forms/DesignControls'

// Phone-only switch between the controls and the live preview.
export default function MobilePaneToggle({ value, onChange }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'controls', label: 'Controls' },
        { value: 'preview', label: 'Preview' },
      ]}
    />
  )
}
