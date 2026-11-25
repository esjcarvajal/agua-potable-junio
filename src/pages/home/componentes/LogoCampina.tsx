import emblema112 from '../imagenes/emblema-112.webp'
import emblema192 from '../imagenes/emblema-192.webp'

interface Props {
  /** 'oscuro' = texto claro, para fondos azul marino (pie de página). */
  variante?: 'claro' | 'oscuro'
  grande?: boolean
}

/** Versión horizontal del logo: emblema del paisaje + "Agua Potable / la Campiña". */
export default function LogoCampina({ variante = 'claro', grande = false }: Props) {
  const clases = ['lc-logo', variante === 'oscuro' ? 'lc-logo--oscuro' : '', grande ? 'lc-logo--grande' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <span className={clases}>
      <img
        src={emblema112}
        srcSet={`${emblema112} 112w, ${emblema192} 192w`}
        sizes="58px"
        width={58}
        height={58}
        alt=""
        className="lc-logo__emblema"
      />
      <span className="lc-logo__texto">
        <span className="lc-logo__agua">Agua Potable</span>
        <span className="lc-logo__campina">la Campiña</span>
      </span>
    </span>
  )
}
