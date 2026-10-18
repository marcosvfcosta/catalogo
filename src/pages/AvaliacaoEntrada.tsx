import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// WhatsApp da loja (só dígitos, com 55 + DDD). Se preencher, aparece o botão
// "Falar com a loja" depois do envio. Deixe '' para esconder.
const LOJA_WHATSAPP = ''

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
const ESTADOS = ['Seminovo', 'Vitrine']
const ACESSORIOS = ['Caixa', 'Cabo', 'Carregador']

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
            style={{ ...s.chip, ...(ativo ? s.chipAtivo : {}), borderColor: ativo ? '#ff6600' : erro ? '#ff4444' : '#2a2a2a' }}>
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
    if (!possuiDefeito) e.possuiDefeito = 'Responda se o aparelho possui defeito'
    if (possuiDefeito === 'Sim' && !defeito.trim()) e.defeito = 'Descreva o defeito'
    if (!interesse.trim()) e.interesse = 'Diga qual celular você quer comprar'
    if (!nome.trim()) e.nome = 'Digite seu nome'
    if (telefone.replace(/\D/g, '').length < 10) e.telefone = 'Digite um WhatsApp válido'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function enviar() {
    if (!validar()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setEnviando(true)
    const { error } = await supabase.from('entradas').insert([{
      nome: nome.trim(),
      telefone: telefone.trim(),
      modelo: modeloFinal,
      armazenamento,
      estado,
      possui_defeito: possuiDefeito === 'Sim',
      defeito: possuiDefeito === 'Sim' ? defeito.trim() : null,
      bateria,
      acessorios,
      interesse: interesse.trim(),
    }])
    setEnviando(false)
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
    setAcessorios([]); setInteresse(''); setErros({}); setEnviado(false)
  }

  function falarComLoja() {
    const msg = `Olá! Acabei de enviar a avaliação do meu ${modeloFinal} ${armazenamento} (${estado}) pelo catálogo. Tenho interesse no ${interesse.trim()}. Meu nome é ${nome.trim()}.`
    window.open(`https://wa.me/${LOJA_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (enviado) return (
    <div style={s.page}>
      <header style={s.header}>
        <a href="/" style={s.voltar}>← Catálogo</a>
        <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
      </header>
      <div style={{ ...s.content, textAlign: 'center', paddingTop: 60 }}>
        <div style={s.checkCircle}>✓</div>
        <h1 style={{ ...s.titulo, marginTop: 20 }}>Recebemos sua avaliação!</h1>
        <p style={{ color: '#aaa', fontSize: 15, marginTop: 8 }}>{modeloFinal} {armazenamento} · {estado}</p>
        <p style={{ color: '#ff6600', fontSize: 15, marginTop: 4, fontWeight: 700 }}>Interesse: {interesse.trim()}</p>
        <p style={{ color: '#777', fontSize: 14, marginTop: 16, lineHeight: 1.6 }}>
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
      <header style={s.header}>
        <a href="/" style={s.voltar}>← Catálogo</a>
        <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
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
            <input style={{ ...s.input, marginTop: 12, borderColor: erros.modelo ? '#ff4444' : '#2a2a2a' }} value={outroModelo}
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
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>4</span> Possui algum defeito?</h3>
          <Chips opcoes={['Não', 'Sim']} valor={possuiDefeito} erro={!!erros.possuiDefeito}
            onChange={v => { setPossuiDefeito(v); limparErro('possuiDefeito'); if (v === 'Não') { setDefeito(''); limparErro('defeito') } }} />
          {erros.possuiDefeito && <p style={s.erro}>{erros.possuiDefeito}</p>}
          {possuiDefeito === 'Sim' && (
            <>
              <textarea style={{ ...s.input, marginTop: 12, height: 80, resize: 'none', borderColor: erros.defeito ? '#ff4444' : '#2a2a2a' }}
                value={defeito} onChange={e => { setDefeito(e.target.value); limparErro('defeito') }}
                placeholder="Qual defeito? Ex: Face ID não funciona, tela trincada..." />
              {erros.defeito && <p style={s.erro}>{erros.defeito}</p>}
            </>
          )}
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>5</span> Saúde da bateria</h3>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Ajustes › Bateria › Saúde da Bateria</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input type="range" min={50} max={100} step={1} value={bateria} onChange={e => setBateria(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#ff6600' }} />
            <span style={{ color: '#ff6600', fontWeight: 900, fontSize: 22, minWidth: 60, textAlign: 'right' }}>{bateria}%</span>
          </div>
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}><span style={s.num}>6</span> Acompanha <span style={{ color: '#666', fontWeight: 400, fontSize: 13 }}>(opcional)</span></h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ACESSORIOS.map(a => {
              const ativo = acessorios.includes(a)
              return (
                <button key={a} type="button" onClick={() => toggleAcessorio(a)}
                  style={{ ...s.chip, ...(ativo ? s.chipAtivo : {}), borderColor: ativo ? '#ff6600' : '#2a2a2a' }}>
                  {ativo ? '✓ ' : ''}{a}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ ...s.section, borderColor: erros.interesse ? '#ff4444' : '#ff6600' }}>
          <h3 style={s.sectionTitle}><span style={{ ...s.num, background: '#ff6600', color: 'white' }}>7</span> Qual celular você quer comprar?</h3>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 12, marginTop: -6 }}>O aparelho que você quer levar usando o seu como entrada</p>
          <input style={{ ...s.input, borderColor: erros.interesse ? '#ff4444' : '#2a2a2a' }} value={interesse}
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
          <h3 style={s.sectionTitle}><span style={s.num}>8</span> Seus dados</h3>
          <label style={s.label}>Nome</label>
          <input style={{ ...s.input, borderColor: erros.nome ? '#ff4444' : '#2a2a2a' }} value={nome}
            onChange={e => { setNome(e.target.value); limparErro('nome') }} placeholder="Seu nome completo" />
          {erros.nome && <p style={s.erro}>{erros.nome}</p>}
          <label style={{ ...s.label, marginTop: 14 }}>WhatsApp</label>
          <input style={{ ...s.input, borderColor: erros.telefone ? '#ff4444' : '#2a2a2a' }} value={telefone} inputMode="tel"
            onChange={e => { setTelefone(mascaraTelefone(e.target.value)); limparErro('telefone') }} placeholder="(64) 9 9999-9999" />
          {erros.telefone && <p style={s.erro}>{erros.telefone}</p>}
        </div>

        <button onClick={enviar} disabled={enviando} style={{ ...s.btnEnviar, opacity: enviando ? 0.7 : 1 }}>
          {enviando ? 'Enviando...' : 'Enviar avaliação'}
        </button>
        <p style={{ color: '#555', fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 40 }}>
          A proposta final depende da análise do aparelho na loja.
        </p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'Poppins, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: '#080808', borderBottom: '1px solid #1a1a1a', position: 'sticky', top: 0, zIndex: 100 },
  voltar: { color: '#ccc', textDecoration: 'none', fontSize: 14, padding: '8px 14px', border: '1px solid #333', borderRadius: 10 },
  logo: { lineHeight: 1, marginLeft: 'auto' },
  logoM: { color: '#ff6600', fontSize: 24, fontWeight: 900, fontFamily: 'Nunito, sans-serif', display: 'block' },
  logoMag: { color: '#ff6600', fontSize: 12, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'right', opacity: 0.85 },
  content: { padding: '24px 16px', maxWidth: 640, margin: '0 auto' },
  titulo: { fontSize: 26, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', margin: 0 },
  subtitulo: { color: '#888', fontSize: 14, lineHeight: 1.6, marginTop: 8, marginBottom: 24 },
  alertaErro: { background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', color: '#ff6666', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16 },
  section: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 10 },
  num: { width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,102,0,0.15)', color: '#ff6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 },
  label: { display: 'block', color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0a0a0a', color: 'white', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  chip: { padding: '10px 16px', borderRadius: 22, border: '1px solid #2a2a2a', background: '#0a0a0a', color: '#bbb', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  chipAtivo: { background: 'rgba(255,102,0,0.15)', color: '#ff6600', fontWeight: 700 },
  erro: { color: '#ff4444', fontSize: 13, marginTop: 8, marginBottom: 0 },
  btnEnviar: { width: '100%', padding: 18, borderRadius: 14, border: 'none', background: '#ff6600', color: 'white', fontWeight: 800, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { display: 'block', padding: 14, borderRadius: 12, border: '1px solid #333', background: 'none', color: '#ccc', fontSize: 15, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
  checkCircle: { width: 80, height: 80, borderRadius: '50%', background: 'rgba(37,211,102,0.15)', border: '2px solid #25D366', color: '#25D366', fontSize: 40, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
}
