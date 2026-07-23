const variants = {
  primary: 'bg-green-700 border-green-700 text-white hover:bg-green-900 hover:border-green-900',
  secondary: 'bg-green-100 border-transparent text-green-700 hover:bg-green-100',
  accent: 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600 hover:border-orange-600',
  destructive: 'bg-danger border-danger text-white hover:bg-[#7d2015] hover:border-[#7d2015]',
  ghost: 'bg-transparent border-transparent text-ink hover:bg-green-100',
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
        'inline-flex items-center gap-2 rounded-full border-2 font-body font-semibold',
        'transition-[background-color,border-color,transform] duration-150 ease-out',
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.03]',
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
