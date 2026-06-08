import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type SpecItem = { nome: string; valor1: string; valor2: string; melhor: 0 | 1 | 2 }
type SpecGrupo = { categoria: string; specs: SpecItem[] }

export default function Comparar() {
  const navigate = useNavigate()
  const [modelo1, setModelo1] = useState('')
  const [modelo2, setModelo2] = useState('')
  const [resultado, setResultado] = useState<SpecGrupo[] | null>(null)
  const [veredito, setVeredito] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function comparar() {
    if (!modelo1.trim() || !modelo2.trim()) {
      setErro('Preencha os dois modelos!'); return
    }
    setErro('')
    setCarregando(true)
    setResultado(null)
    setVeredito('')

    try {
      const response = await fetch(
        'https://bahcoajavayvdfavdhpg.supabase.co/functions/v1/comparar-celulares',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelo1, modelo2 })
        }
      )
      const parsed = await response.json()
      setResultado(parsed.specs)
      setVeredito(parsed.veredito)
    } catch (e) {
      setErro('Erro ao buscar comparação. Tente novamente.')
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={s.page}>
      <button style={s.back} onClick={() => navigate('/')}>← Voltar</button>

      <div style={s.header}>
        <h1 style={s.titulo}>⚖ Comparar Celulares</h1>
        <p style={s.subtitulo}>Digite dois modelos e veja qual é o melhor</p>
      </div>

      <div style={s.inputRow}>
        <div style={s.inputBox}>
          <p style={s.inputLabel}>📱 Celular 1</p>
          <input style={s.input} placeholder="Ex: iPhone 15" value={modelo1} onChange={(e) => setModelo1(e.target.value)} />
        </div>
        <div style={s.vs}>VS</div>
        <div style={s.inputBox}>
          <p style={s.inputLabel}>📱 Celular 2</p>
          <input style={s.input} placeholder="Ex: Samsung S25" value={modelo2} onChange={(e) => setModelo2(e.target.value)} />
        </div>
      </div>

      {erro && <p style={s.erro}>{erro}</p>}

      <button style={s.btnComparar} onClick={comparar} disabled={carregando}>
        {carregando ? '⏳ Comparando...' : '⚖ Comparar agora'}
      </button>

      {carregando && (
        <div style={s.loading}>
          <div style={s.spinner} />
          <p style={{ color: '#aaa', marginTop: 16 }}>Buscando especificações...</p>
        </div>
      )}

      {resultado && (
        <div style={s.tabela}>
          {/* Header */}
          <div style={s.headerRow}>
            <div style={s.colSpec}></div>
            <div style={{ ...s.colVal, color: '#ff6600', fontWeight: 700, fontSize: 11 }}>
              {modelo1.length > 12 ? modelo1.substring(0, 12) + '…' : modelo1}
            </div>
            <div style={{ ...s.colVal, color: '#4fc3f7', fontWeight: 700, fontSize: 11 }}>
              {modelo2.length > 12 ? modelo2.substring(0, 12) + '…' : modelo2}
            </div>
          </div>

          {resultado.map((grupo) => (
            <div key={grupo.categoria}>
              <div style={s.grupoTitulo}>{grupo.categoria}</div>
              {grupo.specs.map((spec) => (
                <div key={spec.nome} style={s.linha}>
                  <div style={s.colSpec}>{spec.nome}</div>
                  <div style={{
                    ...s.colVal,
                    background: spec.melhor === 1 ? 'rgba(255,102,0,0.2)' : 'transparent',
                    border: spec.melhor === 1 ? '1px solid rgba(255,102,0,0.5)' : '1px solid transparent',
                    color: spec.melhor === 1 ? '#ff8833' : '#bbb',
                    fontWeight: spec.melhor === 1 ? 700 : 400,
                    borderRadius: 6,
                  }}>
                    {spec.melhor === 1 ? '👑 ' : ''}{spec.valor1}
                  </div>
                  <div style={{
                    ...s.colVal,
                    background: spec.melhor === 2 ? 'rgba(79,195,247,0.2)' : 'transparent',
                    border: spec.melhor === 2 ? '1px solid rgba(79,195,247,0.5)' : '1px solid transparent',
                    color: spec.melhor === 2 ? '#4fc3f7' : '#bbb',
                    fontWeight: spec.melhor === 2 ? 700 : 400,
                    borderRadius: 6,
                  }}>
                    {spec.melhor === 2 ? '👑 ' : ''}{spec.valor2}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Veredito */}
          <div style={s.veredito}>
            <p style={s.vereditoTitulo}>🏆 Veredito</p>
            <p style={s.vereditoTexto}>{veredito}</p>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#050505',
    color: 'white',
    fontFamily: 'Poppins, sans-serif',
    padding: '20px 12px 60px',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  back: {
    background: '#ff6600', border: 'none', color: 'white',
    padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
    fontWeight: 700, fontSize: 14, marginBottom: 24, display: 'block',
  },
  header: { textAlign: 'center', marginBottom: 24 },
  titulo: { fontSize: 22, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', margin: 0 },
  subtitulo: { fontSize: 13, color: '#aaa', marginTop: 6 },
  inputRow: { display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 },
  inputBox: { flex: 1, minWidth: 0 },
  inputLabel: { fontSize: 10, color: '#ff6600', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    width: '100%', padding: '10px 10px', borderRadius: 10,
    border: '1px solid #333', background: '#111', color: 'white',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  vs: { fontSize: 16, fontWeight: 900, color: '#ff6600', paddingBottom: 10, flexShrink: 0 },
  btnComparar: {
    width: '100%', padding: 14, borderRadius: 12, border: 'none',
    background: '#ff6600', color: 'white', fontWeight: 700, fontSize: 15,
    cursor: 'pointer', marginBottom: 28,
  },
  erro: { color: '#ff4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40 },
  spinner: {
    width: 36, height: 36, border: '3px solid #222',
    borderTop: '3px solid #ff6600', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  tabela: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #1a1a1a',
  },
  headerRow: {
    display: 'grid',
    gridTemplateColumns: '35% 32.5% 32.5%',
    background: '#111',
    padding: '10px 8px',
    borderBottom: '1px solid #222',
  },
  colSpec: {
    fontSize: 11,
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    paddingRight: 4,
    wordBreak: 'break-word',
  },
  colVal: {
    fontSize: 11,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 4px',
    wordBreak: 'break-word',
    lineHeight: 1.3,
  },
  grupoTitulo: {
    background: '#111',
    padding: '7px 8px',
    fontSize: 11,
    fontWeight: 700,
    color: '#ff6600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid #1a1a1a',
  },
  linha: {
    display: 'grid',
    gridTemplateColumns: '35% 32.5% 32.5%',
    padding: '7px 8px',
    background: '#0a0a0a',
    borderBottom: '1px solid #111',
    alignItems: 'center',
    gap: 4,
  },
  veredito: {
    background: '#0f0f0f',
    borderTop: '1px solid #ff6600',
    padding: '16px 12px',
    textAlign: 'center',
  },
  vereditoTitulo: { color: '#ff6600', fontWeight: 700, fontSize: 15, marginBottom: 8 },
  vereditoTexto: { color: '#ccc', fontSize: 13, lineHeight: 1.7 },
}