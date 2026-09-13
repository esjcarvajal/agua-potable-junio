export const permisos = {
  vendedor: {
    verDashboard: true,
    verPOS: true,
    verClientes: true,
    verInventario: true,
    verReportes: false,
    verAdmin: false,
    editarVentas: false,
    anularVentas: false,
    verCierreCaja: false,
    registrarInsumos: true,
    verNomina: false,
  },
  administrador: {
    verDashboard: true,
    verPOS: true,
    verClientes: true,
    verInventario: true,
    verReportes: true,
    verAdmin: true,
    editarVentas: true,
    anularVentas: true,
    verCierreCaja: true,
    registrarInsumos: true,
    verNomina: true,
  }
}

export function tienePermiso(perfil: 'vendedor' | 'administrador', permiso: keyof typeof permisos.administrador): boolean {
  return permisos[perfil][permiso] ?? false
}
