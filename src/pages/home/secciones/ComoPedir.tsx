import { Banknote, Smartphone, ArrowRightLeft } from 'lucide-react'
import { IconoWhatsApp } from '../iconos-marca'
import { COMO_PEDIR, enlaceWhatsApp } from '../contenido'

const ICONOS_PAGO = [Smartphone, ArrowRightLeft, Banknote]

export default function ComoPedir() {
  return (
    <section id="como-pedir" aria-labelledby="lc-titulo-como-pedir" className="lc-banda-azul relative overflow-hidden py-20 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="lc-antetitulo lc-antetitulo--claro">{COMO_PEDIR.antetitulo}</p>
          <h2 id="lc-titulo-como-pedir" className="lc-titulo mt-4 !text-white">
            {COMO_PEDIR.titulo}
          </h2>
        </div>

        <ol className="relative mt-12 grid gap-8 lg:grid-cols-5 lg:gap-6">
          {/* Línea que une los pasos (escritorio) */}
          <span
            className="absolute left-[10%] right-[10%] top-7 hidden h-[2px] bg-[linear-gradient(90deg,rgba(255,255,255,0.15),rgba(255,255,255,0.55),rgba(255,255,255,0.15))] lg:block"
            aria-hidden="true"
          />
          {/* Línea vertical (móvil) */}
          <span className="absolute bottom-6 left-7 top-6 w-[2px] bg-white/20 lg:hidden" aria-hidden="true" />

          {COMO_PEDIR.pasos.map((paso, i) => (
            <li key={paso.titulo} className="relative flex gap-5 lg:flex-col lg:items-center lg:gap-4 lg:text-center">
              <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-xl font-extrabold text-[#0c47b0] shadow-[0_12px_26px_-12px_rgba(0,0,0,0.55)]">
                {i + 1}
              </span>
              <div className="pt-1 lg:pt-0">
                <h3 className="text-lg font-extrabold text-white">{paso.titulo}</h3>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-[#d6e6ff]">{paso.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-14 flex flex-col gap-6 rounded-[1.25rem] bg-white/10 p-6 ring-1 ring-white/15 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between lg:p-7">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#9fd0ff]">Formas de pago</p>
            <ul className="mt-3 flex flex-wrap gap-2.5">
              {COMO_PEDIR.pagos.map((pago, i) => {
                const Icono = ICONOS_PAGO[i % ICONOS_PAGO.length]
                return (
                  <li
                    key={pago}
                    className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[0.95rem] font-semibold text-white ring-1 ring-white/20"
                  >
                    <Icono className="h-4 w-4 text-[#9fd0ff]" aria-hidden="true" />
                    {pago}
                  </li>
                )
              })}
            </ul>
          </div>
          <a href={enlaceWhatsApp()} target="_blank" rel="noopener noreferrer" className="lc-btn lc-btn--wa shrink-0 self-start lg:self-auto">
            <IconoWhatsApp className="h-5 w-5" />
            Hacer mi pedido
          </a>
        </div>
      </div>
    </section>
  )
}
