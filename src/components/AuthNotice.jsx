// One mention of a state the sign-in flow reached: a fresh account, a disabled one, a rejected password.
// Every auth screen says these the same way, and the role is what makes a screen reader announce the
// change instead of leaving the reader to go looking for it.
const TONES = {
  success: { role: 'status', box: 'bg-success-bg text-success', icon: 'check_circle' },
  danger: { role: 'alert', box: 'bg-danger-bg text-danger', icon: 'error' },
  info: { role: 'status', box: 'bg-surface-low text-ink', icon: 'info' },
}

export default function AuthNotice({ tone = 'info', icon, children, className = '' }) {
  const { role, box, icon: defaultIcon } = TONES[tone] ?? TONES.info
  return (
    <p role={role} className={['flex items-start gap-2 rounded-sm px-3 py-2 text-sm leading-relaxed', box, className].join(' ')}>
      <span className="material-symbols-outlined mt-px shrink-0 text-base" aria-hidden="true">
        {icon ?? defaultIcon}
      </span>
      <span>{children}</span>
    </p>
  )
}
