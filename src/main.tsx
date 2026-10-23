import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import Admin from './pages/Admin.tsx'
import Comparar from './pages/comparar.tsx'
import Loja from './pages/Loja.tsx'
import Negociacao from './pages/Negociacao'
import AvaliacaoEntrada from './pages/AvaliacaoEntrada'
import Capas from './pages/Capas'
import Protegido from './components/Protegido'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<Protegido papel="admin"><Admin /></Protegido>} />
        <Route path="/comparar" element={<Comparar />} />
        <Route path="/loja" element={<Loja />} />
        <Route path="/negociacao" element={<Protegido papel="negociacao"><Negociacao /></Protegido>} />
        <Route path="/entrada" element={<AvaliacaoEntrada />} />
        <Route path="/capas" element={<Capas />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
