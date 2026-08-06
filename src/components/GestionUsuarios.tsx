import { useState } from 'react'
import { useAuthStore, type Usuario, type Perfil } from '../store/useAuthStore'
import { Plus, Edit2, UserX, Check, X, Shield, DollarSign } from 'lucide-react'

export default function GestionUsuarios() {
  const store = useAuthStore()
  const { usuarios, agregarUsuario, editarUsuario, eliminarUsuario, sesion } = store

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formNombre, setFormNombre] = useState('')
  const [formPerfil, setFormPerfil] = useState<Perfil>('vendedor')
  const [formPin, setFormPin] = useState('')
  const [formActivo, setFormActivo] = useState(true)
  const [formSalario, setFormSalario] = useState('')

  const [errorMsg, setErrorMsg] = useState('')

  const abrirNuevo = () => {
    setEditingId(null)
    setFormNombre('')
    setFormPerfil('vendedor')
    setFormPin('')
    setFormActivo(true)
    setFormSalario('')
    setErrorMsg('')
    setShowModal(true)
  }

  const abrirEditar = (u: Usuario) => {
    setEditingId(u.id)
    setFormNombre(u.nombre)
    setFormPerfil(u.perfil)
    setFormPin(u.pin)
    setFormActivo(u.activo)
    setFormSalario(u.salarioMensualUsd !== undefined ? String(u.salarioMensualUsd) : '')
    setErrorMsg('')
    setShowModal(true)
  }

  const handleGuardar = () => {
    if (!formNombre) return setErrorMsg('El nombre es requerido')
    if (formPin.length !== 4) return setErrorMsg('El PIN debe ser de 4 dígitos')

    const salario = formSalario !== '' ? parseFloat(formSalario) : undefined

    if (editingId) {
      if (!formActivo || formPerfil !== 'administrador') {
        const adminActivos = usuarios.filter(u => u.perfil === 'administrador' && u.activo && u.id !== editingId)
        if (adminActivos.length === 0) {
          return setErrorMsg('Debe haber al menos un administrador activo en el sistema')
        }
      }
      editarUsuario(editingId, {
        nombre: formNombre,
        perfil: formPerfil,
        pin: formPin,
        activo: formActivo,
        salarioMensualUsd: salario,
      })
    } else {
      agregarUsuario({
        nombre: formNombre,
        perfil: formPerfil,
        pin: formPin,
        activo: formActivo,
        salarioMensualUsd: salario,
      })
    }
    setShowModal(false)
  }

  const handleEliminar = (u: Usuario) => {
    if (u.id === sesion?.usuarioId) {
      alert('No puedes eliminar tu propio usuario mientras tienes sesión iniciada')
      return
    }
    if (u.perfil === 'administrador' && u.activo) {
      const adminActivos = usuarios.filter(x => x.perfil === 'administrador' && x.activo)
      if (adminActivos.length <= 1) {
        alert('Debe haber al menos un administrador activo en el sistema')
        return
      }
    }
    if (confirm(`¿Estás seguro de eliminar a ${u.nombre}?`)) {
      eliminarUsuario(u.id)
    }
  }

  return (
    <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary dark:text-[#5bb3e8]" />
          <h3 className="font-manrope font-bold text-base text-[#191c1e] dark:text-[#e4e6f0]">
            Gestión de Usuarios
          </h3>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
        >
          <Plus size={14} /> Nuevo Usuario
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2d3148] font-manrope">
              <th className="py-2 px-3 font-medium">Nombre</th>
              <th className="py-2 px-3 font-medium">Perfil</th>
              <th className="py-2 px-3 font-medium text-right">Salario/mes</th>
              <th className="py-2 px-3 font-medium text-center">Estado</th>
              <th className="py-2 px-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-b border-gray-50 dark:border-[#2d3148]/50 last:border-0 hover:bg-[#f7f9fc] dark:hover:bg-[#1a1d27] transition-colors">
                <td className="py-2 px-3 font-inter font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                  {u.nombre} {u.id === sesion?.usuarioId && <span className="text-[10px] text-primary ml-1">(Tú)</span>}
                </td>
                <td className="py-2 px-3">
                  <span className={`text-[9px] font-grotesk font-bold px-2 py-0.5 rounded-full ${
                    u.perfil === 'administrador'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                  }`}>
                    {u.perfil.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  {u.salarioMensualUsd !== undefined && u.salarioMensualUsd > 0 ? (
                    <span className="font-grotesk font-bold text-sm text-[#16a34a]">
                      ${u.salarioMensualUsd.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center">
                  {u.activo ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-md">
                      <Check size={12} /> Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md">
                      <X size={12} /> Inactivo
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right">
                  <button onClick={() => abrirEditar(u)} className="text-gray-400 hover:text-primary dark:hover:text-[#5bb3e8] transition-colors p-1" title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleEliminar(u)} className="text-gray-400 hover:text-red-500 transition-colors p-1 ml-1" title="Eliminar">
                    <UserX size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-sm relative z-10 mx-4" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-manrope text-xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
            </div>

            {errorMsg && <p className="text-sm text-red-500 mb-3 font-bold">{errorMsg}</p>}

            <div className="space-y-4 mb-6 text-left">
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Nombre Completo</label>
                <input type="text" value={formNombre} onChange={e => setFormNombre(e.target.value)}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-2.5 text-sm outline-none focus:border-primary bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0]" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Perfil de Acceso</label>
                <select value={formPerfil} onChange={e => setFormPerfil(e.target.value as Perfil)}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-2.5 text-sm outline-none focus:border-primary bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0]">
                  <option value="vendedor">Vendedor</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">PIN de Acceso (4 dígitos)</label>
                <input type="password" maxLength={4} value={formPin} onChange={e => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-2.5 font-grotesk font-bold tracking-[0.5em] text-center outline-none focus:border-primary bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0]" />
              </div>

              {/* Salario mensual — solo visible para vendedores */}
              {formPerfil === 'vendedor' && (
                <div>
                  <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                    Salario Mensual (USD)
                  </label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formSalario}
                      onChange={e => setFormSalario(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-2.5 font-grotesk font-bold text-sm text-[#16a34a] outline-none focus:border-primary bg-white dark:bg-[#1a1d27]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 font-inter">
                    Se incluirá como egreso en el cierre mensual
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-[#2d3148]">
                <input type="checkbox" id="userActive" checked={formActivo} onChange={e => setFormActivo(e.target.checked)} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                <label htmlFor="userActive" className="text-sm font-bold text-gray-600 dark:text-gray-400">Usuario activo</label>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1a1d27]">Cancelar</button>
              <button onClick={handleGuardar} className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
