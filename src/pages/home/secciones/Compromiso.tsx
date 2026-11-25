import { COMPROMISO } from '../contenido'

const TONOS = {
  azul: { tarjeta: 'bg-[#eef5ff]', icono: 'bg-[#1660d6]', borde: 'border-[#1660d6]/10' },
  verde: { tarjeta: 'bg-[#ecf8f0]', icono: 'bg-[#12873d]', borde: 'border-[#12873d]/15' },
} as const

export default function Compromiso() {
  return (
    <section
      id="compromiso"
      aria-labelledby="lc-titulo-compromiso"
      className="relative overflow-hidden bg-gradient-to-b from-[#f2f7ff] via-[#f6faff] to-white py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="lc-antetitulo lc-antetitulo--centro">{COMPROMISO.antetitulo}</p>
          <h2 id="lc-titulo-compromiso" className="lc-titulo mt-4">
            {COMPROMISO.titulo}
          </h2>
          <p className="mt-4 text-[1.03rem] text-[#56657e]">{COMPROMISO.texto}</p>
        </div>

        <ul className="mt-12 grid gap-5 md:grid-cols-3 lg:gap-7">
          {COMPROMISO.tarjetas.map(({ Icono, titulo, texto, tono }) => {
            const t = TONOS[tono]
            return (
              <li key={titulo} className={`rounded-[1.25rem] border p-7 lg:p-8 ${t.tarjeta} ${t.borde}`}>
                <div className="flex items-center gap-4">
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-[0_10px_22px_-12px_rgba(11,37,81,0.6)] ${t.icono}`}
                  >
                    <Icono className="h-[22px] w-[22px]" aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-extrabold text-[#0b2551]">{titulo}</h3>
                </div>
                <p className="mt-5 text-[0.98rem] leading-relaxed">{texto}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
