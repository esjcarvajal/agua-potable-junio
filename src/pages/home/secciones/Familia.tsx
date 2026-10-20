import familiaGrande from '../imagenes/familia-896.webp'
import familiaMediana from '../imagenes/familia-560.webp'
import { FAMILIA } from '../contenido'

/** Gota decorativa de fondo (lado derecho). */
function GotaDecorativa() {
  return (
    <svg
      className="pointer-events-none absolute -right-16 top-10 hidden h-[420px] w-[320px] text-[#1660d6] opacity-[0.07] lg:block"
      viewBox="0 0 160 210"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M80 4C80 4 10 86 10 136a70 70 0 0 0 140 0C150 86 80 4 80 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
      <path d="M58 150c-14-14-12-40 6-62" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

export default function Familia() {
  return (
    <section
      id="nosotros"
      aria-labelledby="lc-titulo-familia"
      className="relative overflow-hidden bg-gradient-to-b from-white to-[#f2f7ff] pt-12 lg:pt-0"
    >
      <GotaDecorativa />

      <div className="lc-foto-lateral lc-foto-lateral--izquierda lc-foto-familia mx-5 aspect-[4/4.4] sm:mx-auto sm:max-w-[520px] lg:mx-0 lg:aspect-auto lg:max-w-none">
        <img
          src={familiaMediana}
          srcSet={`${familiaMediana} 560w, ${familiaGrande} 896w`}
          sizes="(min-width: 1024px) 50vw, (min-width: 640px) 520px, 100vw"
          width={896}
          height={1195}
          alt="La familia detrás de Agua Potable La Campiña"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-5 py-14 lg:flex lg:min-h-[680px] lg:items-center lg:justify-end lg:px-8 lg:py-24">
        <div className="relative z-10 lg:w-[46%] lg:max-w-[520px]">
          <p className="lc-antetitulo">{FAMILIA.antetitulo}</p>
          <h2 id="lc-titulo-familia" className="lc-titulo mt-4">
            {FAMILIA.titulo}
          </h2>
          <p className="mt-5 text-[1.03rem] leading-relaxed">{FAMILIA.texto}</p>

          <ul className="mt-9 grid grid-cols-3 gap-4">
            {FAMILIA.valores.map(({ Icono, titulo, detalle }) => (
              <li key={titulo} className="flex flex-col items-start gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#1660d6]/25 bg-white text-[#1660d6] shadow-[0_10px_22px_-14px_rgba(22,96,214,0.9)]">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="leading-snug">
                  <strong className="block text-[0.92rem] font-bold text-[#0b2551]">{titulo}</strong>
                  <span className="text-[0.82rem] text-[#56657e]">{detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
