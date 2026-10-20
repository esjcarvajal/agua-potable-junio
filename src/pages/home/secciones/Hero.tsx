import { ArrowRight } from 'lucide-react'
import heroGrande from '../imagenes/hero-1600.webp'
import heroMediana from '../imagenes/hero-960.webp'
import Ola from '../componentes/Ola'
import { IconoWhatsApp } from '../iconos-marca'
import { HERO, enlaceWhatsApp } from '../contenido'

/** Burbujas decorativas alrededor de la foto (solo escritorio). */
const BURBUJAS = [
  { tam: 30, left: '53%', top: '13%' },
  { tam: 14, left: '56.5%', top: '27%' },
  { tam: 10, left: '52%', top: '44%' },
  { tam: 22, left: '55%', top: '73%' },
  { tam: 13, left: '91%', top: '10%' },
  { tam: 19, left: '96%', top: '56%' },
]

export default function Hero() {
  return (
    <section id="inicio" aria-labelledby="lc-titulo-inicio" className="lc-hero relative overflow-hidden">
      <div className="lc-hero__foto">
        <img
          src={heroMediana}
          srcSet={`${heroMediana} 960w, ${heroGrande} 1600w`}
          sizes="(min-width: 1280px) 58vw, (min-width: 1024px) 54vw, 100vw"
          width={1600}
          height={900}
          alt="Integrante del equipo llenando un botellón de agua purificada en el local de Agua Potable La Campiña"
          fetchPriority="high"
          decoding="async"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        {BURBUJAS.map((b, i) => (
          <span key={i} className="lc-burbuja" style={{ width: b.tam, height: b.tam, left: b.left, top: b.top }} />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1200px] px-5 pb-24 pt-1 sm:pb-28 lg:flex lg:min-h-[610px] lg:items-center lg:px-8 lg:pb-32 lg:pt-12 xl:min-h-[650px]">
        <div className="max-w-xl lg:max-w-[440px] xl:max-w-[545px]">
          <h1 id="lc-titulo-inicio">
            <span className="lc-antetitulo">{HERO.antetitulo}</span>
            <span className="lc-display mt-4">
              {HERO.titular} <span className="lc-texto-degradado">{HERO.destacado}</span>
            </span>
          </h1>

          <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-relaxed sm:text-lg">{HERO.texto}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={enlaceWhatsApp()} target="_blank" rel="noopener noreferrer" className="lc-btn lc-btn--wa">
              <IconoWhatsApp className="h-5 w-5" />
              Pedir por WhatsApp
            </a>
            <a href="#equipo" className="lc-btn lc-btn--contorno">
              Conoce el equipo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <ul className="mt-10 grid grid-cols-3 gap-3 sm:gap-5">
            {HERO.ventajas.map(({ Icono, titulo, detalle }) => (
              <li
                key={titulo}
                className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 lg:flex-col lg:items-start lg:gap-2 xl:flex-row xl:items-center xl:gap-3"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e3eeff] text-[#1660d6]">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="leading-tight">
                  <strong className="block text-[0.86rem] font-bold text-[#0b2551] sm:whitespace-nowrap">{titulo}</strong>
                  <span className="text-[0.8rem] text-[#56657e]">{detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Ola className="absolute inset-x-0 bottom-0 h-12 sm:h-16 lg:h-24" />
    </section>
  )
}
