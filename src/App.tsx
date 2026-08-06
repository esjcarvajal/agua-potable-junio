import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Inventario from './pages/Inventario'
import Clientes from './pages/Clientes'
import Reportes from './pages/Reportes'
import Admin from './pages/Admin'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── HOME PÚBLICA ─────────────────────────────────── */}
        <Route path="/" element={<Home />} />

        {/* ── APLICACIÓN (requiere autenticación) ──────────── */}
        <Route path="/app" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="reportes" element={
            <ProtectedRoute permiso="verReportes"><Reportes /></ProtectedRoute>
          } />
          <Route path="admin" element={
            <ProtectedRoute permiso="verAdmin"><Admin /></ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App