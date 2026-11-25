interface Props {
  /** Color de relleno: el fondo de la sección que viene después. */
  color?: string
  className?: string
}

/** Borde ondulado para pasar de una sección a otra. */
export default function Ola({ color = '#ffffff', className = '' }: Props) {
  return (
    <svg
      className={`pointer-events-none block w-full ${className}`}
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 70C160 104 330 112 520 86C710 60 860 18 1060 26C1220 32 1340 64 1440 84V120H0Z"
        fill={color}
        opacity="0.55"
      />
      <path d="M0 88C190 118 380 112 580 92C780 72 930 46 1110 52C1260 57 1370 80 1440 96V120H0Z" fill={color} />
    </svg>
  )
}
