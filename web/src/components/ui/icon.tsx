interface IconProps {
  name: string
  size?: number
  className?: string
}

export function Icon({ name, size = 24, className = '' }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: size,
        width: size,
        height: size,
        overflow: 'hidden',
        lineHeight: `${size}px`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
