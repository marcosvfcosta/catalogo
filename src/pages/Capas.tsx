import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

// WhatsApp da loja (55 + DDD + número, só dígitos)
const LOJA_WHATSAPP = '5564993374281'

const MARCAS = ['Todos', 'iPhone', 'Samsung', 'Xiaomi', 'Motorola', 'Outras']
const TIPOS = ['Feminino', 'Masculino', 'Transparente', 'Decorado', 'Case']

type CapaModelo = { id: string; marca: string; modelo: string; foto_url: string | null; ordem: number }
type CapaFoto = { id: string; modelo_id: string; tipo: string; url: string }

function marcaDoFiltro(m: CapaModelo) {
  const marca = (m.marca || '').toLowerCase()
  if (marca === 'apple' || marca === 'iphone') return 'iPhone'
  if (['samsung', 'xiaomi', 'motorola'].includes(marca)) return m.marca.charAt(0).toUpperCase() + m.marca.slice(1).toLowerCase()
  return 'Outras'
}

export default function Capas() {
  const navigate = useNavigate()
  const [modelos, setModelos] = useState<CapaModelo[]>([])
  const [fotos, setFotos] = useState<CapaFoto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [marca, setMarca] = useState('Todos')
  const [aberto, setAberto] = useState<CapaModelo | null>(null)
  const [tipo, setTipo] = useState('')
  const [fotoGrande, setFotoGrande] = useState<string | null>(null)

  // Fundo branco também fora da tela (ao puxar a página)
  useEffect(() => {
    const antes = document.body.style.background
    document.body.style.background = '#ffffff'
    return () => { document.body.style.background = antes }
  }, [])

  useEffect(() => {
    async function carregar() {
      const [m, f] = await Promise.all([
        supabase.from('capas_modelos').select('*').order('ordem').order('modelo'),
        supabase.from('capas_fotos').select('*').order('created_at', { ascending: false }),
      ])
      setModelos(m.data || [])
      setFotos(f.data || [])
      setCarregando(false)
    }
    carregar()
  }, [])

  const contagem = (id: string) => fotos.filter(f => f.modelo_id === id).length

  const lista = modelos
    .filter(m => contagem(m.id) > 0)
    .filter(m => marca === 'Todos' || marcaDoFiltro(m) === marca)
    .filter(m => !busca.trim() || m.modelo.toLowerCase().includes(busca.toLowerCase().trim()))

  function abrirModelo(m: CapaModelo) {
    const tiposComFoto = TIPOS.filter(t => fotos.some(f => f.modelo_id === m.id && f.tipo === t))
    setAberto(m)
    setTipo(tiposComFoto[0] || TIPOS[0])
    window.scrollTo({ top: 0 })
  }

  function euQuero(foto: CapaFoto) {
    if (!aberto) return
    let cupom = ''
    try {
      const c = JSON.parse(localStorage.getItem('mm-cupom') || 'null')
      if (c?.codigo && c.validade >= new Date().toISOString().slice(0, 10)) cupom = `\n\n🎟 Tenho o cupom *#${c.codigo}* (${c.pct}% de desconto)`
    } catch { /* ok */ }
    const msg = `Olá! Vi no catálogo e quero essa capinha 😍\n\n📱 Modelo: *${aberto.modelo}*\n🏷 ${foto.tipo}\n\n📷 Foto da capinha:\n${foto.url}${cupom}`
    window.open(`https://api.whatsapp.com/send?phone=${LOJA_WHATSAPP}&text=${encodeURIComponent(msg)}`, '_blank')
  }

  const cabecalho = (
    <header style={s.header}>
      <button style={s.btnVoltar} onClick={() => aberto ? setAberto(null) : navigate('/')}>
        ← {aberto ? 'Voltar' : 'Catálogo'}
      </button>
      <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
    </header>
  )

  // ─── GALERIA DO MODELO ───────────────────────
  if (aberto) {
    const doModelo = fotos.filter(f => f.modelo_id === aberto.id)
    const tiposComFoto = TIPOS.filter(t => doModelo.some(f => f.tipo === t))
    const doTipo = doModelo.filter(f => f.tipo === tipo)
    return (
      <div style={s.page}>
        {cabecalho}
        <div style={s.content}>
          <h1 style={s.tituloModelo}>{aberto.modelo}</h1>
          <p style={s.subtitulo}>Galeria de capinhas</p>

          <div style={{ ...s.chips, justifyContent: 'center', flexWrap: 'wrap' }}>
            {tiposComFoto.map(t => (
              <button key={t} style={t === tipo ? s.chipAtivo : s.chip} onClick={() => setTipo(t)}>{t}</button>
            ))}
          </div>

          <div style={s.linhaInfo}>
            <span style={{ fontWeight: 700 }}>{tipo}</span>
            <span style={{ color: '#ff6600', fontWeight: 700 }}>{doTipo.length} {doTipo.length === 1 ? 'capinha' : 'capinhas'}</span>
          </div>

          <div style={s.grade}>
            {doTipo.map(f => (
              <div key={f.id} style={s.capaCard}>
                <img src={f.url} alt={`Capinha ${f.tipo}`} style={s.capaFoto} loading="lazy" onClick={() => setFotoGrande(f.url)} />
                <button style={s.btnQuero} onClick={() => euQuero(f)}>💬 Eu quero</button>
              </div>
            ))}
          </div>
        </div>

        {fotoGrande && (
          <div style={s.zoomFundo} onClick={() => setFotoGrande(null)}>
            <img src={fotoGrande} alt="Capinha" style={s.zoomFoto} />
            <p style={{ color: '#ddd', fontSize: 13, marginTop: 12 }}>Toque para fechar</p>
          </div>
        )}
      </div>
    )
  }

  // ─── LISTA DE MODELOS ───────────────────────
  return (
    <div style={s.page}>
      {cabecalho}
      <div style={s.content}>
        <h1 style={s.titulo}>Capas</h1>
        <div style={s.barra} />

        <div style={s.busca}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6600" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input style={s.buscaInput} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar modelo de celular..." />
          {busca && <button style={s.buscaLimpar} onClick={() => setBusca('')}>×</button>}
        </div>

        <div style={s.chips}>
          {MARCAS.map(m => (
            <button key={m} style={m === marca ? s.chipAtivo : s.chip} onClick={() => setMarca(m)}>{m}</button>
          ))}
        </div>

        <div style={s.linhaInfo}>
          <span style={{ color: '#6e6e73' }}>Escolha o modelo do seu celular</span>
          <span style={{ color: '#6e6e73' }}>{lista.length} {lista.length === 1 ? 'modelo' : 'modelos'}</span>
        </div>

        {carregando ? (
          <p style={s.vazio}>Carregando...</p>
        ) : lista.length === 0 ? (
          <p style={s.vazio}>Nenhum modelo encontrado.<br />Chama a gente no WhatsApp que a gente te ajuda!</p>
        ) : (
          lista.map(m => (
            <div key={m.id} style={s.modeloCard} onClick={() => abrirModelo(m)}>
              {m.foto_url
                ? <img src={m.foto_url} alt={m.modelo} style={s.modeloFoto} loading="lazy" />
                : <div style={{ ...s.modeloFoto, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📱</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.modeloNome}>{m.modelo}</p>
                <p style={{ color: '#6e6e73', fontSize: 13, margin: '2px 0 0' }}>{contagem(m.id)} capinhas</p>
              </div>
              <span style={{ color: '#ff6600', fontSize: 26, fontWeight: 900 }}>›</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#ffffff', color: '#1d1d1f', fontFamily: 'Poppins, sans-serif', textAlign: 'left' },
  header: { display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.94)', backdropFilter: 'saturate(180%) blur(14px)', WebkitBackdropFilter: 'saturate(180%) blur(14px)', borderBottom: '1px solid #ececf0', position: 'sticky', top: 0, zIndex: 100 },
  btnVoltar: { background: '#f5f5f7', border: 'none', color: '#ff6600', padding: '10px 16px', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  logo: { lineHeight: 1, marginLeft: 'auto' },
  logoM: { color: '#ff6600', fontSize: 26, fontWeight: 900, fontFamily: 'Poppins, sans-serif', display: 'block', letterSpacing: -0.5 },
  logoMag: { color: '#ff6600', fontSize: 12, fontWeight: 700, fontFamily: 'Poppins, sans-serif', display: 'block', textAlign: 'right' },
  content: { padding: '20px 16px 50px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' },
  titulo: { color: '#1d1d1f', fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -0.6 },
  barra: { width: 60, height: 4, borderRadius: 4, background: '#ff6600', margin: '6px 0 18px' },
  tituloModelo: { textAlign: 'center', fontSize: 28, fontWeight: 800, margin: '4px 0 4px', lineHeight: 1.2, color: '#1d1d1f', letterSpacing: -0.5 },
  subtitulo: { textAlign: 'center', color: '#6e6e73', fontSize: 15, margin: '0 0 18px' },
  busca: { display: 'flex', alignItems: 'center', gap: 10, background: '#f5f5f7', border: 'none', borderRadius: 16, padding: '4px 12px', marginBottom: 14 },
  buscaInput: { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#1d1d1f', fontSize: 17, padding: '11px 0', fontFamily: 'inherit', minWidth: 0 },
  buscaLimpar: { background: '#e5e5ea', border: 'none', color: '#6e6e73', width: 26, height: 26, borderRadius: '50%', fontSize: 16, cursor: 'pointer' },
  chips: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 },
  chip: { flexShrink: 0, padding: '10px 18px', borderRadius: 20, border: 'none', background: '#f5f5f7', color: '#1d1d1f', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  chipAtivo: { flexShrink: 0, padding: '10px 18px', borderRadius: 20, border: 'none', background: '#1d1d1f', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  linhaInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, margin: '4px 0 12px' },
  modeloCard: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #ececf0', borderRadius: 20, padding: 12, marginBottom: 12, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' },
  modeloFoto: { width: 64, height: 76, objectFit: 'contain', borderRadius: 14, background: '#f5f5f7', flexShrink: 0 },
  modeloNome: { fontWeight: 700, fontSize: 17, margin: 0, color: '#1d1d1f' },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  capaCard: { background: '#fff', border: '1px solid #ececf0', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' },
  capaFoto: { width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block', cursor: 'zoom-in', background: '#f5f5f7' },
  btnQuero: { border: 'none', background: '#25D366', color: 'white', fontWeight: 800, fontSize: 15, padding: '13px 0', cursor: 'pointer', fontFamily: 'inherit' },
  vazio: { color: '#6e6e73', textAlign: 'center', padding: '40px 10px', lineHeight: 1.6 },
  zoomFundo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  zoomFoto: { maxWidth: '100%', maxHeight: '80vh', borderRadius: 16, objectFit: 'contain' },
}
