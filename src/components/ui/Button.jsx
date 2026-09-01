const variants = {
  primary: 'bg-green-900 border-green-900 text-white hover:opacity-90',
  secondary: 'bg-surface-low border-transparent text-green-900 hover:bg-hairline/40',
  accent: 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600 hover:border-orange-600',
  destructive: 'bg-danger border-danger text-white hover:bg-[#93000a] hover:border-[#93000a]',
  ghost: 'bg-transparent border-transparent text-ink hover:bg-surface-low',
}

const sizes = {
  md: 'px-7 py-3.5 text-base',
  sm: 'px-4.5 py-2 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={[
        'inline-flex items-center gap-2 rounded-md border font-body font-bold',
        'transition-[background-color,border-color,transform] duration-150 ease-out',
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? 'Loading…' : children}
    </button>
  )
}
