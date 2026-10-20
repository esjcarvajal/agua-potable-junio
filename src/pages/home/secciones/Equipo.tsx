import { ArrowRight } from 'lucide-react'
import equipoGrande from '../imagenes/equipo-1200.webp'
import equipoMediana from '../imagenes/equipo-760.webp'
import { CIFRAS, EQUIPO } from '../contenido'

export default function Equipo() {
  return (
    <section id="equipo" aria-labelledby="lc-titulo-equipo" className="relative bg-white pb-20 lg:pb-0">
      <div className="relative mx-auto max-w-[1200px] px-5 pb-10 pt-16 lg:flex lg:min-h-[720px] lg:items-center lg:px-8 lg:py-24">
        <div className="relative z-10 lg:w-[40%] lg:max-w-[460px]">
          <p className="lc-antetitulo">{EQUIPO.antetitulo}</p>
          <h2 id="lc-titulo-equipo" className="lc-titulo mt-4">
            {EQUIPO.titulo}
          </h2>
          <p className="mt-5 text-[1.03rem] leading-relaxed">{EQUIPO.texto}</p>

          <ul className="mt-8 space-y-4">
            {EQUIPO.puntos.map(({ Icono, titulo, detalle }) => (
              <li key={titulo} className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1660d6] text-white shadow-[0_10px_20px_-10px_rgba(22,96,214,0.8)]">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="leading-snug">
                  <strong className="block font-bold text-[#0b2551]">{titulo}</strong>
                  {detalle && <span className="text-sm text-[#56657e]">{detalle}</span>}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-9 grid grid-cols-3 divide-x divide-[#1660d6]/15 rounded-2xl bg-[#f1f7ff] py-4">
            {CIFRAS.map((c) => (
              <div key={c.etiqueta} className="flex flex-col-reverse items-center justify-end px-2 text-center">
                <dt className="mt-1 text-[0.78rem] font-medium leading-tight text-[#56657e]">{c.etiqueta}</dt>
                <dd className="text-[1.65rem] font-extrabold leading-none tracking-tight text-[#0c47b0]">{c.valor}</dd>
              </div>
            ))}
          </dl>

          <a href="#nosotros" className="lc-btn lc-btn--azul mt-8">
            {EQUIPO.boton}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="lc-foto-lateral lc-foto-lateral--derecha lc-foto-equipo mx-5 aspect-[4/3] sm:mx-auto sm:max-w-[680px] lg:mx-0 lg:aspect-auto lg:max-w-none">
        <img
          src={equipoMediana}
          srcSet={`${equipoMediana} 760w, ${equipoGrande} 1200w`}
          sizes="(min-width: 1024px) 57vw, (min-width: 640px) 680px, 100vw"
          width={1200}
          height={898}
          alt="Equipo de Agua Potable La Campiña frente al local en Naguanagua"
          loading="lazy"
          decoding="async"
        />
      </div>
    </section>
  )
}
