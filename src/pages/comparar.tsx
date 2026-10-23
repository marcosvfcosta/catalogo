import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// WhatsApp da loja (55 + DDD + número, só dígitos)
const LOJA_WHATSAPP = '5564993374281'
const URL_FUNCAO = 'https://bahcoajavayvdfavdhpg.supabase.co/functions/v1/comparar-celulares'

type Lado = 0 | 1 | 2
type SpecItem = { nome: string; valor1: string; valor2: string; melhor: Lado }
type SpecGrupo = { categoria: string; specs: SpecItem[] }
type Uso = { uso: string; vencedor: Lado; motivo?: string }
type Pontos = { fortes?: string[]; fracos?: string[] }
type Resultado = {
  modelo1?: { nome?: string; lancamento?: string }
  modelo2?: { nome?: string; lancamento?: string }
  specs?: SpecGrupo[]
  usos?: Uso[]
  pontos?: { modelo1?: Pontos; modelo2?: Pontos }
  veredito_detalhado?: { modelo1?: string; modelo2?: string }
  veredito?: string
  fontes?: string[]
  aviso?: string | null
  error?: string
}

const COR1 = '#ff6600'
const COR2 = '#1a73e8'

const ETAPAS = [
  '🔎 Pesquisando o primeiro celular...',
  '🔎 Pesquisando o segundo celular...',
  '📋 Conferindo a ficha técnica...',
  '📊 Comparando ponto a ponto...',
  '✍️ Montando o resultado...',
]

const ICONE_USO: Record<string, string> = {
  'Fotos e vídeos': '📸', 'Jogos e desempenho': '🎮', 'Bateria no dia a dia': '🔋', 'Custo-benefício': '💰',
}

function dominio(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function Comparar() {
  const navigate = useNavigate()
  const [modelo1, setModelo1] = useState('')
  const [modelo2, setModelo2] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [etapa, setEtapa] = useState(0)
  const [erro, setErro] = useState('')

  // Troca a mensagem de espera a cada poucos segundos (a pesquisa demora)
  useEffect(() => {
    if (!carregando) return
    setEtapa(0)
    const t = setInterval(() => setEtapa(e => Math.min(e + 1, ETAPAS.length - 1)), 6000)
    return () => clearInterval(t)
  }, [carregando])

  async function comparar() {
    if (!modelo1.trim() || !modelo2.trim()) { setErro('Preencha os dois modelos!'); return }
    setErro('')
    setRes(null)
    setCarregando(true)
    try {
      const response = await fetch(URL_FUNCAO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo1: modelo1.trim(), modelo2: modelo2.trim() }),
      })
      const dados: Resultado = await response.json()
      if (!response.ok || dados.error || !dados.specs) {
        setErro('Não foi possível comparar agora. Confira os nomes dos modelos e tente de novo.')
        console.error(dados.error)
        return
      }
      setRes(dados)
    } catch (e) {
      setErro('Erro de conexão. Verifique a internet e tente de novo.')
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  function novaComparacao() {
    setRes(null)
    setModelo1('')
    setModelo2('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function tenhoInteresse(nome: string) {
    const msg = `Olá! Vi a comparação no catálogo da Marcos Magazine e tenho interesse no *${nome}*. Pode me passar mais informações? 😊`
    window.open(`https://wa.me/${LOJA_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const nome1 = res?.modelo1?.nome || modelo1
  const nome2 = res?.modelo2?.nome || modelo2
  const nomeDo = (l: Lado) => (l === 1 ? nome1 : l === 2 ? nome2 : 'Empate')
  const corDo = (l: Lado) => (l === 1 ? COR1 : l === 2 ? COR2 : '#86868b')

  return (
    <div style={s.page}>
      <style>{`@keyframes mmSpin { to { transform: rotate(360deg) } } html, body { background: #fff !important; } body { display: block !important; place-items: normal !important; } #root { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }`}</style>
      <button style={s.back} onClick={() => navigate('/')}>← Voltar</button>

      <div style={s.header}>
        <div style={s.vsTopo}>
          <img src="/comparar-iphone.png" alt="" style={{ ...s.vsImg, transform: 'rotate(-6deg)' }} />
          <span style={s.vsBola}>VS</span>
          <img src="/comparar-samsung.png" alt="" style={{ ...s.vsImg, transform: 'rotate(6deg)' }} />
        </div>
        <h1 style={s.titulo}>Comparar Celulares</h1>
        <p style={s.subtitulo}>Digite dois modelos e veja qual é o melhor pra você</p>
      </div>

      <div style={s.inputRow}>
        <div style={s.inputBox}>
          <p style={{ ...s.inputLabel, color: COR1 }}>📱 Celular 1</p>
          <input style={{ ...s.input, borderColor: '#ffc9a3' }} placeholder="Ex: iPhone 16" value={modelo1}
            onChange={e => setModelo1(e.target.value)} onKeyDown={e => e.key === 'Enter' && comparar()} />
        </div>
        <div style={s.vs}>VS</div>
        <div style={s.inputBox}>
          <p style={{ ...s.inputLabel, color: COR2 }}>📱 Celular 2</p>
          <input style={{ ...s.input, borderColor: '#b9d4f7' }} placeholder="Ex: Galaxy S25" value={modelo2}
            onChange={e => setModelo2(e.target.value)} onKeyDown={e => e.key === 'Enter' && comparar()} />
        </div>
      </div>

      {erro && <p style={s.erro}>{erro}</p>}

      {!res && (
        <button style={{ ...s.btnComparar, opacity: carregando ? 0.7 : 1 }} onClick={comparar} disabled={carregando}>
          {carregando ? '⏳ Comparando...' : 'Comparar agora'}
        </button>
      )}

      {carregando && (
        <div style={s.loading}>
          <div style={s.spinner} />
          <p style={{ color: '#1d1d1f', marginTop: 16, fontWeight: 600 }}>{ETAPAS[etapa]}</p>
          <p style={{ color: '#86868b', fontSize: 12, marginTop: 6 }}>Estamos pesquisando os dados atualizados. Pode levar até 1 minuto.</p>
        </div>
      )}

      {res && (
        <>
          {/* Cabeçalho VS */}
          <div style={s.vsCard}>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <p style={{ ...s.vsNome, color: COR1 }}>{nome1}</p>
              {res.modelo1?.lancamento && <p style={s.vsData}>Lançado em {res.modelo1.lancamento}</p>}
            </div>
            <div style={s.vsMeio}>VS</div>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <p style={{ ...s.vsNome, color: COR2 }}>{nome2}</p>
              {res.modelo2?.lancamento && <p style={s.vsData}>Lançado em {res.modelo2.lancamento}</p>}
            </div>
          </div>
          <p style={s.pesquisado}>🔎 Dados pesquisados na internet agora</p>

          {res.aviso && <div style={s.aviso}>⚠️ {res.aviso}</div>}

          {/* Ficha técnica */}
          <h2 style={s.secao}>📋 Ficha técnica</h2>
          <div style={s.tabela}>
            <div style={s.headerRow}>
              <div style={s.colSpec}></div>
              <div style={{ ...s.colVal, color: COR1, fontWeight: 700 }}>{nome1}</div>
              <div style={{ ...s.colVal, color: COR2, fontWeight: 700 }}>{nome2}</div>
            </div>
            {(res.specs || []).map(grupo => (
              <div key={grupo.categoria}>
                <div style={s.grupoTitulo}>{grupo.categoria}</div>
                {(grupo.specs || []).map(spec => (
                  <div key={spec.nome} style={s.linha}>
                    <div style={s.colSpec}>{spec.nome}</div>
                    {([1, 2] as const).map(lado => {
                      const ganhou = spec.melhor === lado
                      const cor = lado === 1 ? COR1 : COR2
                      const rgb = lado === 1 ? '255,102,0' : '26,115,232'
                      return (
                        <div key={lado} style={{
                          ...s.colVal,
                          background: ganhou ? `rgba(${rgb},0.1)` : 'transparent',
                          border: ganhou ? `1px solid rgba(${rgb},0.5)` : '1px solid transparent',
                          color: ganhou ? cor : '#333',
                          fontWeight: ganhou ? 700 : 400,
                          borderRadius: 6,
                        }}>
                          {ganhou ? '👑 ' : ''}{lado === 1 ? spec.valor1 : spec.valor2}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Quem ganha em cada uso */}
          {res.usos && res.usos.length > 0 && (
            <>
              <h2 style={s.secao}>🏆 Quem ganha em cada uso</h2>
              <div style={s.usosGrid}>
                {res.usos.map(u => (
                  <div key={u.uso} style={{ ...s.usoCard, borderColor: u.vencedor ? corDo(u.vencedor) + '66' : '#ececf0' }}>
                    <p style={s.usoTitulo}>{ICONE_USO[u.uso] || '⭐'} {u.uso}</p>
                    <p style={{ ...s.usoVencedor, color: corDo(u.vencedor) }}>{nomeDo(u.vencedor)}</p>
                    {u.motivo && <p style={s.usoMotivo}>{u.motivo}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pontos fortes e fracos */}
          {res.pontos && (
            <>
              <h2 style={s.secao}>👍👎 Pontos fortes e fracos</h2>
              {([1, 2] as const).map(lado => {
                const p = lado === 1 ? res.pontos?.modelo1 : res.pontos?.modelo2
                if (!p) return null
                return (
                  <div key={lado} style={{ ...s.pontosCard, borderLeftColor: corDo(lado) }}>
                    <p style={{ fontWeight: 800, color: corDo(lado), margin: '0 0 8px' }}>{nomeDo(lado)}</p>
                    {(p.fortes || []).map(f => <p key={f} style={s.ponto}><span style={{ color: '#25D366' }}>👍</span> {f}</p>)}
                    {(p.fracos || []).map(f => <p key={f} style={s.ponto}><span style={{ color: '#ff4444' }}>👎</span> {f}</p>)}
                  </div>
                )
              })}
            </>
          )}

          {/* Veredito */}
          <h2 style={s.secao}>💡 Veredito</h2>
          <div style={s.veredito}>
            {res.veredito_detalhado?.modelo1 && (
              <p style={s.vereditoTexto}><b style={{ color: COR1 }}>{nome1}</b>: {res.veredito_detalhado.modelo1}</p>
            )}
            {res.veredito_detalhado?.modelo2 && (
              <p style={s.vereditoTexto}><b style={{ color: COR2 }}>{nome2}</b>: {res.veredito_detalhado.modelo2}</p>
            )}
            {res.veredito && <p style={{ ...s.vereditoTexto, color: '#1d1d1f', fontWeight: 600, marginBottom: 0 }}>{res.veredito}</p>}
          </div>

          {/* Ações */}
          <button style={s.btnZap} onClick={() => tenhoInteresse(nome1)}>💬 Tenho interesse no {nome1}</button>
          <button style={s.btnZap} onClick={() => tenhoInteresse(nome2)}>💬 Tenho interesse no {nome2}</button>
          <button style={s.btnNova} onClick={novaComparacao}>Comparar outros celulares</button>

          {res.fontes && res.fontes.length > 0 && (
            <p style={s.fontes}>
              Fontes: {Array.from(new Set(res.fontes.map(dominio))).join(', ')}<br />
              Informações pesquisadas automaticamente. Confirme os detalhes na loja.
            </p>
          )}
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  vsTopo: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, marginBottom: 14 },
  vsImg: { height: '100%', width: 'auto', maxWidth: '40%', objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.15))' },
  vsBola: { position: 'relative', zIndex: 1, margin: '0 -12px', width: 44, height: 44, flexShrink: 0, borderRadius: '50%', background: '#ff6600', color: '#fff', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #fff' },
  page: { minHeight: '100vh', background: '#fff', color: '#1d1d1f', fontFamily: 'Poppins, -apple-system, sans-serif', padding: '20px 16px 60px', width: '100%', maxWidth: 720, margin: '0 auto', boxSizing: 'border-box', overflowX: 'hidden', textAlign: 'left' },
  back: { background: '#f5f5f7', border: 'none', color: '#ff6600', padding: '11px 20px', borderRadius: 22, cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 24, display: 'block', fontFamily: 'inherit' },
  header: { textAlign: 'center', marginBottom: 26 },
  titulo: { fontSize: 28, fontWeight: 800, color: '#1d1d1f', fontFamily: 'Poppins, sans-serif', margin: 0, letterSpacing: -0.6 },
  subtitulo: { fontSize: 15, color: '#6e6e73', marginTop: 8 },
  inputRow: { display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 },
  inputBox: { flex: 1, minWidth: 0 },
  inputLabel: { fontSize: 11, fontWeight: 800, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { width: '100%', padding: '13px 12px', borderRadius: 14, border: '1.5px solid #e5e5ea', background: '#f5f5f7', color: '#1d1d1f', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  vs: { fontSize: 16, fontWeight: 900, color: '#ff6600', paddingBottom: 14, flexShrink: 0 },
  btnComparar: { width: '100%', padding: 16, borderRadius: 16, border: 'none', background: '#ff6600', color: 'white', fontWeight: 800, fontSize: 17, cursor: 'pointer', marginBottom: 20, fontFamily: 'inherit' },
  erro: { color: '#d93025', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 10px', textAlign: 'center' },
  spinner: { width: 40, height: 40, border: '3px solid #eee', borderTop: '3px solid #ff6600', borderRadius: '50%', animation: 'mmSpin 0.8s linear infinite' },
  vsCard: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 8, background: '#f5f5f7', borderRadius: 20, padding: '18px 12px', marginTop: 8 },
  vsNome: { fontWeight: 800, fontSize: 16, margin: 0, lineHeight: 1.25, wordBreak: 'break-word' },
  vsData: { color: '#86868b', fontSize: 12, margin: '4px 0 0' },
  vsMeio: { fontWeight: 900, fontSize: 16, color: '#fff', background: '#1d1d1f', borderRadius: 20, padding: '6px 11px' },
  pesquisado: { color: '#86868b', fontSize: 12, textAlign: 'center', margin: '8px 0 0' },
  aviso: { background: '#fff8e1', border: '1px solid #ffd54f', color: '#8a6100', borderRadius: 14, padding: 12, fontSize: 14, marginTop: 14, lineHeight: 1.5 },
  secao: { color: '#1d1d1f', fontSize: 20, fontWeight: 800, letterSpacing: -0.3, margin: '30px 0 12px' },
  tabela: { width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid #ececf0' },
  headerRow: { display: 'grid', gridTemplateColumns: '32% minmax(0,1fr) minmax(0,1fr)', background: '#f5f5f7', padding: '12px 8px', borderBottom: '1px solid #ececf0', gap: 4 },
  colSpec: { fontSize: 12.5, color: '#6e6e73', display: 'flex', alignItems: 'center', paddingRight: 4, wordBreak: 'break-word' },
  colVal: { fontSize: 13, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 4px', wordBreak: 'break-word', lineHeight: 1.3 },
  grupoTitulo: { background: '#fff3ea', padding: '9px 10px', fontSize: 12, fontWeight: 800, color: '#d4560a', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #ececf0' },
  linha: { display: 'grid', gridTemplateColumns: '32% minmax(0,1fr) minmax(0,1fr)', padding: '8px 8px', background: '#fff', borderBottom: '1px solid #f0f0f3', alignItems: 'center', gap: 4 },
  usosGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 },
  usoCard: { background: '#fff', border: '1.5px solid #ececf0', borderRadius: 16, padding: 14 },
  usoTitulo: { color: '#6e6e73', fontSize: 13, margin: 0 },
  usoVencedor: { fontWeight: 800, fontSize: 15, margin: '4px 0 0', lineHeight: 1.25 },
  usoMotivo: { color: '#6e6e73', fontSize: 12.5, margin: '6px 0 0', lineHeight: 1.45 },
  pontosCard: { background: '#f5f5f7', borderLeft: '4px solid', borderRadius: 14, padding: 14, marginBottom: 10 },
  ponto: { fontSize: 14, color: '#333', margin: '0 0 6px', lineHeight: 1.5 },
  veredito: { background: '#fff3ea', borderRadius: 18, padding: 18 },
  vereditoTexto: { color: '#444', fontSize: 15, lineHeight: 1.65, margin: '0 0 12px' },
  btnZap: { width: '100%', padding: 15, borderRadius: 16, border: 'none', background: '#25D366', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 12, fontFamily: 'inherit' },
  btnNova: { width: '100%', padding: 15, borderRadius: 16, border: '1.5px solid #ececf0', background: '#fff', color: '#1d1d1f', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 12, fontFamily: 'inherit' },
  fontes: { color: '#86868b', fontSize: 12, lineHeight: 1.6, marginTop: 18, textAlign: 'center' },
}
