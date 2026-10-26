import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// WhatsApp da loja (só dígitos, com 55 + DDD). Se preencher, aparece o botão
// "Falar com a loja" depois do envio. Deixe '' para esconder.
const LOJA_WHATSAPP = ''

const FUNDO_BRANCO = `html, body { background: #fff !important; } body { display: block !important; place-items: normal !important; color: #1d1d1f !important; } #root { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; text-align: left !important; }`

const MODELOS = [
  'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max', 'iPhone SE',
  'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
  'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16e', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
  'iPhone 17', 'iPhone Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max',
  'Outro',
]

const ARMAZENAMENTOS = ['64GB', '128GB', '256GB', '512GB', '1TB']
const LADOS_FOTO = [
  { k: 'frente', l: 'Frente', d: 'Tela' },
  { k: 'verso', l: 'Verso', d: 'Traseira' },
  { k: 'esquerda', l: 'Lateral esquerda', d: 'Botões de volume' },
  { k: 'direita', l: 'Lateral direita', d: 'Botão lateral' },
  { k: 'cima', l: 'Em cima', d: 'Topo' },
  { k: 'baixo', l: 'Embaixo', d: 'Entrada do carregador' },
]

// Reduz a foto antes de enviar (mais rápido no 4G)
function comprimir(arquivo: File): Promise<Blob> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, 1600 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala)
      const ctx = c.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) { resolve(arquivo); return }
      ctx.drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(b => resolve(b || arquivo), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(arquivo) }
    img.src = url
  })
}
const ESTADOS = ['Seminovo', 'Vitrine']
const ACESSORIOS = ['Cabo', 'Carregador']
const POLITICA = 'A política da loja não permite a avaliação em celulares de vitrine ou sem caixa.'

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}

function Chips({ opcoes, valor, onChange, erro }: { opcoes: string[]; valor: string; onChange: (v: string) => void; erro?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.map(o => {
        const ativo = valor === o
        return (
          <button key={o} type="button" onClick={() => onChange(o)}
            style={{ ...s.chip, ...(ativo ? s.chipAtivo : {}), borderColor: ativo ? '#ff6600' : erro ? '#ff4444' : '#e5e5ea' }}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export default function AvaliacaoEntrada() {
  const [buscaModelo, setBuscaModelo] = useState('')
  const [modelo, setModelo] = useState('')
  const [outroModelo, setOutroModelo] = useState('')
  const [armazenamento, setArmazenamento] = useState('')
  const [estado, setEstado] = useState('')
  const [possuiDefeito, setPossuiDefeito] = useState('')
  const [defeito, setDefeito] = useState('')
  const [bateria, setBateria] = useState(85)
  const [acessorios, setAcessorios] = useState<string[]>([])
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [interesse, setInteresse] = useState('')
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [fotos, setFotos] = useState<Record<string, { arquivo: File; previa: string }>>({})
  const [progresso, setProgresso] = useState('')

  // Sugestões de "celular de interesse" a partir dos produtos do catálogo
  useEffect(() => {
    supabase.from('produtos_catalogo').select('modelo, memoria, disponivel, categoria')
      .then(({ data }: { data: any[] | null }) => {
        const nomes = (data || [])
          .filter(p => p.disponivel !== false && (!p.categoria || p.categoria === 'Celulares'))
          .map(p => `${p.modelo}${p.memoria ? ' ' + p.memoria : ''}`.trim())
        setSugestoes(Array.from(new Set(nomes)))
      })
  }, [])

  const sugestoesFiltradas = interesse.trim().length >= 2
    ? sugestoes.filter(n => n.toLowerCase().includes(interesse.toLowerCase()) && n.toLowerCase() !== interesse.trim().toLowerCase()).slice(0, 6)
    : []

  const modeloFinal = modelo === 'Outro' ? outroModelo.trim() : modelo
  const modelosFiltrados = buscaModelo.trim()
    ? MODELOS.filter(m => m === 'Outro' || m.toLowerCase().includes(buscaModelo.toLowerCase()))
    : MODELOS

  function limparErro(campo: string) {
    if (erros[campo]) setErros({ ...erros, [campo]: '' })
  }

  function toggleAcessorio(a: string) {
    setAcessorios(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function validar() {
    const e: Record<string, string> = {}
    if (!modeloFinal) e.modelo = modelo === 'Outro' ? 'Digite o modelo do aparelho' : 'Escolha o modelo'
    if (!armazenamento) e.armazenamento = 'Escolha o armazenamento'
    if (!estado) e.estado = 'Escolha Seminovo ou Vitrine'
    if (!temCaixa) e.temCaixa = 'Responda se o aparelho tem a caixa'
    if (!possuiDefeito) e.possuiDefeito = 'Responda se o aparelho possui defeito'
    if (possuiDefeito === 'Sim' && !defeito.trim()) e.defeito = 'Descreva o defeito'
    if (!interesse.trim()) e.interesse = 'Diga qual celular você quer comprar'
    if (!nome.trim()) e.nome = 'Digite seu nome'
    if (telefone.replace(/\D/g, '').length < 10) e.telefone = 'Digite um WhatsApp válido'
    setErros(e)
    return Object.keys(e).length === 0
  }

  const [temCaixa, setTemCaixa] = useState('')
  const semCaixa = temCaixa === 'Não'
  const bloqueado = estado === 'Vitrine' || semCaixa
  const [tentouEnviar, setTentouEnviar] = useState(false)

  async function enviar() {
    setTentouEnviar(true)
    const ok = validar()
    if (bloqueado) return
    if (!ok) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setEnviando(true)

    // Envia as fotos (opcionais) antes de salvar a avaliação
    const enviadas: { lado: string; url: string }[] = []
    const lados = LADOS_FOTO.filter(l => fotos[l.k])
    const pasta = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    for (let i = 0; i < lados.length; i++) {
      setProgresso(`Enviando fotos ${i + 1} de ${lados.length}...`)
      try {
        const blob = await comprimir(fotos[lados[i].k].arquivo)
        const caminho = `${pasta}/${lados[i].k}.jpg`
        const up = await supabase.storage.from('entradas').upload(caminho, blob, { contentType: 'image/jpeg' })
        if (!up.error) enviadas.push({ lado: lados[i].l, url: supabase.storage.from('entradas').getPublicUrl(caminho).data.publicUrl })
      } catch (e) { console.error(e) }
    }
    setProgresso('')

    const idEntrada = (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() || undefined
    const dados = {
      ...(idEntrada ? { id: idEntrada } : {}),
      nome: nome.trim(),
      telefone: telefone.trim(),
      modelo: modeloFinal,
      armazenamento,
      estado,
      possui_defeito: possuiDefeito === 'Sim',
      defeito: possuiDefeito === 'Sim' ? defeito.trim() : null,
      bateria,
      acessorios: temCaixa === 'Sim' ? ['Caixa', ...acessorios] : acessorios,
      interesse: interesse.trim(),
    }
    let { error } = await supabase.from('entradas').insert([{ ...dados, fotos: enviadas.length ? enviadas : null }])
    if (error && enviadas.length === 0) ({ error } = await supabase.from('entradas').insert([dados]))
    setEnviando(false)
    // Avisa a loja (notificação no celular/iPad da equipe)
    if (!error && idEntrada) supabase.functions.invoke('push', { body: { acao: 'avisar', id: idEntrada } }).catch(() => {})
    if (error) {
      alert('Não foi possível enviar agora. Tente de novo em instantes.')
      return
    }
    setEnviado(true)
    window.scrollTo({ top: 0 })
  }

  function novaAvaliacao() {
    setBuscaModelo(''); setModelo(''); setOutroModelo(''); setArmazenamento('')
    setEstado(''); setPossuiDefeito(''); setDefeito(''); setBateria(85)
    setAcessorios([]); setTemCaixa(''); setInteresse(''); setErros({}); setEnviado(false); setFotos({})
  }

  function falarComLoja() {
    const msg = `Olá! Acabei de enviar a avaliação do meu ${modeloFinal} ${armazenamento} (${estado}) pelo catálogo. Tenho interesse no ${interesse.trim()}. Meu nome é ${nome.trim()}.`
    window.open(`https://api.whatsapp.com/send?phone=${LOJA_WHATSAPP}&text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (enviado) return (
    <div style={s.page}>
      <style>{FUNDO_BRANCO}</style>
      <header style={s.header}>
        <a href="/" style={s.voltar}>‹ Catálogo</a>
        <a href="/" style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></a>
      </header>
      <div style={{ ...s.content, textAlign: 'center', paddingTop: 60 }}>
        <div style={s.checkCircle}>✓</div>
        <h1 style={{ ...s.titulo, marginTop: 20 }}>Recebemos sua avaliação!</h1>
        <p style={{ color: '#6e6e73', fontSize: 15, marginTop: 8 }}>{modeloFinal} {armazenamento} · {estado}</p>
        <p style={{ color: '#ff6600', fontSize: 15, marginTop: 4, fontWeight: 700 }}>Interesse: {interesse.trim()}</p>
        <p style={{ color: '#6e6e73', fontSize: 14, marginTop: 16, lineHeight: 1.6 }}>
          Nossa equipe vai analisar e te chamar no WhatsApp<br />com a proposta para usar como entrada.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          {LOJA_WHATSAPP && <button onClick={falarComLoja} style={{ ...s.btnEnviar, background: '#25D366' }}>Falar com a loja no WhatsApp</button>}
          <a href="/" style={s.btnSecundario}>Ver o catálogo</a>
          <button onClick={novaAvaliacao} style={{ ...s.btnSecundario, border: 'none' }}>Avaliar outro aparelho</button>
        </div>
      </div>
    </div>
  )

  const temErros = Object.values(erros).some(Boolean)

  return (
    <div style={s.page}>
      <style>{FUNDO_BRANCO}</style>
      <header style={s.header}>
        <a href="/" style={s.voltar}>‹ Catálogo</a>
        <a href="/" style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></a>
      </header>

      <div style={s.content}>
        <h1 style={s.titulo}>Avalie seu aparelho usado</h1>
        <p style={s.subtitulo}>Responda algumas perguntas e use seu iPhone como entrada na compra de um novo. A loja te chama no WhatsApp com a proposta.</p>

        {temErros && <div style={s.alertaErro}>Confira os campos marcados em vermelho.</div>}

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>1</span> Qual é o modelo?</h3>
          <input style={s.input} value={buscaModelo} onChange={e => setBuscaModelo(e.target.value)} placeholder="Buscar modelo, ex: 13 Pro" />
          <div style={{ marginTop: 12 }}>
            <Chips opcoes={modelosFiltrados} valor={modelo} erro={!!erros.modelo && !modelo}
              onChange={v => { setModelo(v); limparErro('modelo') }} />
          </div>
          {modelo === 'Outro' && (
            <input style={{ ...s.input, marginTop: 12, borderColor: erros.modelo ? '#ff4444' : '#e5e5ea' }} value={outroModelo}
              onChange={e => { setOutroModelo(e.target.value); limparErro('modelo') }} placeholder="Ex: Samsung Galaxy S23" />
          )}
          {erros.modelo && <p style={s.erro}>{erros.modelo}</p>}
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>2</span> Armazenamento</h3>
          <Chips opcoes={ARMAZENAMENTOS} valor={armazenamento} erro={!!erros.armazenamento}
            onChange={v => { setArmazenamento(v); limparErro('armazenamento') }} />
          {erros.armazenamento && <p style={s.erro}>{erros.armazenamento}</p>}
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>3</span> Estado do aparelho</h3>
          <Chips opcoes={ESTADOS} valor={estado} erro={!!erros.estado}
            onChange={v => { setEstado(v); limparErro('estado') }} />
          {erros.estado && <p style={s.erro}>{erros.estado}</p>}
          <p style={{ ...s.sectionTitle, fontSize: 15, marginTop: 18, marginBottom: 10 }}>Tem a caixa do aparelho?</p>
          <Chips opcoes={['Sim', 'Não']} valor={temCaixa} erro={!!erros.temCaixa}
            onChange={v => { setTemCaixa(v); limparErro('temCaixa') }} />
          {erros.temCaixa && <p style={s.erro}>{erros.temCaixa}</p>}
          {bloqueado && <div style={s.politica}>🚫 {POLITICA}</div>}
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>4</span> Possui algum defeito?</h3>
          <Chips opcoes={['Não', 'Sim']} valor={possuiDefeito} erro={!!erros.possuiDefeito}
            onChange={v => { setPossuiDefeito(v); limparErro('possuiDefeito'); if (v === 'Não') { setDefeito(''); limparErro('defeito') } }} />
          {erros.possuiDefeito && <p style={s.erro}>{erros.possuiDefeito}</p>}
          {possuiDefeito === 'Sim' && (
            <>
              <textarea style={{ ...s.input, marginTop: 12, height: 80, resize: 'none', borderColor: erros.defeito ? '#ff4444' : '#e5e5ea' }}
                value={defeito} onChange={e => { setDefeito(e.target.value); limparErro('defeito') }}
                placeholder="Qual defeito? Ex: Face ID não funciona, tela trincada..." />
              {erros.defeito && <p style={s.erro}>{erros.defeito}</p>}
            </>
          )}
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>5</span> Saúde da bateria</h3>
          <p style={{ color: '#6e6e73', fontSize: 13, marginBottom: 12 }}>Ajustes › Bateria › Saúde da Bateria</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input type="range" min={50} max={100} step={1} value={bateria} onChange={e => setBateria(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#ff6600' }} />
            <span style={{ color: '#ff6600', fontWeight: 900, fontSize: 22, minWidth: 60, textAlign: 'right' }}>{bateria}%</span>
          </div>
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>6</span> Acompanha <span style={{ color: '#86868b', fontWeight: 400, fontSize: 13 }}>(opcional)</span></h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ACESSORIOS.map(a => {
              const ativo = acessorios.includes(a)
              return (
                <button key={a} type="button" onClick={() => toggleAcessorio(a)}
                  style={{ ...s.chip, ...(ativo ? s.chipAtivo : {}), borderColor: ativo ? '#ff6600' : '#e5e5ea' }}>
                  {ativo ? '✓ ' : ''}{a}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ ...s.section, borderColor: erros.interesse ? '#ff4444' : '#ff6600' }}>
          <h3 style={s.sectionTitle}><span style={{ ...s.num, background: '#ff6600', color: 'white' }}>7</span> Qual celular você quer comprar?</h3>
          <p style={{ color: '#6e6e73', fontSize: 13, marginBottom: 12, marginTop: -6 }}>O aparelho que você quer levar usando o seu como entrada</p>
          <input style={{ ...s.input, borderColor: erros.interesse ? '#ff4444' : '#e5e5ea' }} value={interesse}
            onChange={e => { setInteresse(e.target.value); limparErro('interesse') }} placeholder="Ex: iPhone 16 Pro Max 256GB" />
          {sugestoesFiltradas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {sugestoesFiltradas.map(n => (
                <button key={n} type="button" style={s.chip} onClick={() => { setInteresse(n); limparErro('interesse') }}>{n}</button>
              ))}
            </div>
          )}
          {erros.interesse && <p style={s.erro}>{erros.interesse}</p>}
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>8</span> Fotos do aparelho <span style={{ color: '#86868b', fontWeight: 400, fontSize: 13 }}>(opcional)</span></h3>
          <p style={{ color: '#6e6e73', fontSize: 13, marginTop: -6, marginBottom: 14, lineHeight: 1.5 }}>Com fotos a proposta sai mais rápida e mais certa. Toque em cada quadrado para tirar ou escolher a foto.</p>
          <div style={s.gradeFotos}>
            {LADOS_FOTO.map(l => {
              const f = fotos[l.k]
              return (
                <label key={l.k} style={{ ...s.fotoSlot, ...(f ? { borderStyle: 'solid', borderColor: '#25D366' } : {}) }}>
                  {f ? (
                    <>
                      <img src={f.previa} alt={l.l} style={s.fotoPrevia} />
                      <button type="button" style={s.fotoRemover}
                        onClick={ev => { ev.preventDefault(); setFotos(prev => { const n = { ...prev }; delete n[l.k]; return n }) }}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 26 }}>📷</span>
                      <span style={{ fontSize: 10.5, color: '#86868b', marginTop: 2, lineHeight: 1.25 }}>{l.d}</span>
                    </>
                  )}
                  <span style={s.fotoNome}>{l.l}</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={ev => {
                      const arq = ev.target.files?.[0]; ev.target.value = ''
                      if (arq) setFotos(prev => ({ ...prev, [l.k]: { arquivo: arq, previa: URL.createObjectURL(arq) } }))
                    }} />
                </label>
              )
            })}
          </div>
          {Object.keys(fotos).length > 0 && <p style={{ color: '#1a9e4a', fontSize: 13, marginTop: 10, marginBottom: 0 }}>✓ {Object.keys(fotos).length} de 6 fotos</p>}
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>9</span> Seus dados</h3>
          <label style={s.label}>Nome</label>
          <input style={{ ...s.input, borderColor: erros.nome ? '#ff4444' : '#e5e5ea' }} value={nome}
            onChange={e => { setNome(e.target.value); limparErro('nome') }} placeholder="Seu nome completo" />
          {erros.nome && <p style={s.erro}>{erros.nome}</p>}
          <label style={{ ...s.label, marginTop: 14 }}>WhatsApp</label>
          <input style={{ ...s.input, borderColor: erros.telefone ? '#ff4444' : '#e5e5ea' }} value={telefone} inputMode="tel"
            onChange={e => { setTelefone(mascaraTelefone(e.target.value)); limparErro('telefone') }} placeholder="(64) 9 9999-9999" />
          {erros.telefone && <p style={s.erro}>{erros.telefone}</p>}
        </div>

        {bloqueado && tentouEnviar && (
          <div style={{ ...s.politica, marginBottom: 12, fontSize: 15 }}>
            🚫 <b>Não é possível enviar.</b><br />{POLITICA}
          </div>
        )}
        <button onClick={enviar} disabled={enviando} style={{ ...s.btnEnviar, opacity: enviando || (bloqueado && tentouEnviar) ? 0.5 : 1 }}>
          {enviando ? (progresso || 'Enviando...') : 'Enviar avaliação'}
        </button>
        <p style={{ color: '#86868b', fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 40 }}>
          A proposta final depende da análise do aparelho na loja.
        </p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#fff', color: '#1d1d1f', fontFamily: 'Poppins, -apple-system, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid #ececf0', position: 'sticky', top: 0, zIndex: 100 },
  voltar: { color: '#ff6600', textDecoration: 'none', fontSize: 16, fontWeight: 600, padding: '8px 4px' },
  logo: { lineHeight: 1, marginLeft: 'auto', textDecoration: 'none' },
  logoM: { color: '#ff6600', fontSize: 26, fontWeight: 900, fontFamily: 'Nunito, Poppins, sans-serif', display: 'block' },
  logoMag: { color: '#ff6600', fontSize: 12, fontWeight: 700, fontFamily: 'Nunito, Poppins, sans-serif', display: 'block', textAlign: 'right', marginTop: -2 },
  content: { padding: '24px 16px', maxWidth: 640, margin: '0 auto', boxSizing: 'border-box' },
  titulo: { fontSize: 30, fontWeight: 800, color: '#1d1d1f', letterSpacing: -0.6, lineHeight: 1.15, margin: 0 },
  subtitulo: { color: '#6e6e73', fontSize: 15, lineHeight: 1.6, marginTop: 10, marginBottom: 24 },
  alertaErro: { background: '#fff0f0', border: '1px solid #ffb3b3', color: '#d93025', borderRadius: 14, padding: '12px 14px', fontSize: 14, marginBottom: 16 },
  section: { background: '#f5f5f7', border: '2px solid transparent', borderRadius: 22, padding: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 800, color: '#1d1d1f', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  num: { width: 28, height: 28, borderRadius: '50%', background: '#ff6600', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 },
  label: { display: 'block', color: '#6e6e73', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { width: '100%', padding: '14px 14px', borderRadius: 14, border: '1.5px solid #e5e5ea', background: '#fff', color: '#1d1d1f', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  chip: { padding: '11px 17px', borderRadius: 22, border: '1.5px solid #e5e5ea', background: '#fff', color: '#333', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  chipAtivo: { background: '#fff1e6', color: '#ff6600', fontWeight: 800 },
  erro: { color: '#d93025', fontSize: 13, marginTop: 8, marginBottom: 0 },
  politica: { marginTop: 12, padding: '12px 14px', borderRadius: 14, background: '#fff1f0', border: '1px solid #ffccc7', color: '#c4271b', fontSize: 14, fontWeight: 600, lineHeight: 1.45 },
  btnEnviar: { width: '100%', padding: 18, borderRadius: 18, border: 'none', background: '#ff6600', color: 'white', fontWeight: 800, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { display: 'block', padding: 15, borderRadius: 16, border: '1.5px solid #e5e5ea', background: '#fff', color: '#1d1d1f', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
  checkCircle: { width: 84, height: 84, borderRadius: '50%', background: '#e9f9ef', color: '#1a9e4a', fontSize: 42, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
  gradeFotos: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
  fotoSlot: { position: 'relative', aspectRatio: '3 / 4', borderRadius: 16, border: '2px dashed #d2d2d7', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', padding: '0 4px 40px', boxSizing: 'border-box', textAlign: 'center' },
  fotoPrevia: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  fotoNome: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '5px 4px', background: 'rgba(29,29,31,0.78)', color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'center' },
  fotoRemover: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, cursor: 'pointer', zIndex: 1 },
}
