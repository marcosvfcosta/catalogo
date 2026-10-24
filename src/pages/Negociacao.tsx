import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

type Negociacao = {
  id: string; nome: string; telefone: string; instagram: string
  modelo: string; cor: string; valor_aparelho: number; valor_entrada: number
  parcelas: number; taxa: number; valor_parcela: number; valor_total: number
  observacoes: string; status: string; vendedor: string; created_at: string
  forma_pagamento?: string | null
  lucro?: number | null
}

type Aparelho = {
  id: string; modelo: string; cores: string[]; fotos: Record<string, string[]>
  preco?: number | null; disponivel?: boolean | null
}

type Entrada = {
  id: string; created_at: string; nome: string; telefone: string
  modelo: string; armazenamento: string; estado: string
  possui_defeito: boolean; defeito: string | null; bateria: number | null
  acessorios: string[] | null; status: string
  interesse?: string | null
  fotos?: { lado: string; url: string }[] | null
}

const TAXAS = [
  { label: 'À vista sem juros', parcelas: 1, taxa: 0 },
  { label: 'Débito sem juros', parcelas: 1, taxa: 0 },
  { label: 'Crédito 1x', parcelas: 1, taxa: 4.10 },
  { label: '2x', parcelas: 2, taxa: 5.37 },
  { label: '3x', parcelas: 3, taxa: 6.25 },
  { label: '4x', parcelas: 4, taxa: 7.13 },
  { label: '5x', parcelas: 5, taxa: 8.01 },
  { label: '6x', parcelas: 6, taxa: 8.89 },
  { label: '7x', parcelas: 7, taxa: 9.77 },
  { label: '8x', parcelas: 8, taxa: 10.65 },
  { label: '9x', parcelas: 9, taxa: 11.53 },
  { label: '10x', parcelas: 10, taxa: 12.41 },
  { label: '11x', parcelas: 11, taxa: 13.29 },
  { label: '12x', parcelas: 12, taxa: 14.17 },
  { label: '13x', parcelas: 13, taxa: 15.05 },
  { label: '14x', parcelas: 14, taxa: 15.93 },
  { label: '15x', parcelas: 15, taxa: 16.81 },
  { label: '16x', parcelas: 16, taxa: 17.69 },
  { label: '17x', parcelas: 17, taxa: 18.57 },
  { label: '18x', parcelas: 18, taxa: 19.45 },
]

const CORES_LISTA = [
  { nome: 'Preto', hex: '#1a1a1a' },
  { nome: 'Branco', hex: '#f0f0f0' },
  { nome: 'Vermelho (RED)', hex: '#cc0000' },
  { nome: 'Estelar', hex: '#f5e6c8' },
  { nome: 'Meia-Noite', hex: '#1c2026' },
  { nome: 'Titânio Natural', hex: '#c4b49a' },
  { nome: 'Titânio Preto', hex: '#2c2c2c' },
  { nome: 'Titânio Branco', hex: '#e8e4dc' },
  { nome: 'Titânio Desert', hex: '#c8a97a' },
  { nome: 'Titânio Rosa', hex: '#e8b4a0' },
  { nome: 'Azul', hex: '#4a90d9' },
  { nome: 'Azul Sierra', hex: '#5b7fa6' },
  { nome: 'Azul Alpino', hex: '#2d5f8a' },
  { nome: 'Verde', hex: '#5ab878' },
  { nome: 'Verde Alpino', hex: '#4a7c59' },
  { nome: 'Verde Floresta', hex: '#2d5c3a' },
  { nome: 'Rosa', hex: '#e8799e' },
  { nome: 'Roxo', hex: '#7b5ea7' },
  { nome: 'Violeta', hex: '#9b59b6' },
  { nome: 'Amarelo', hex: '#f5c842' },
  { nome: 'Coral', hex: '#ff6b5b' },
  { nome: 'Laranja', hex: '#ff8c00' },
  { nome: 'Ciano', hex: '#00bcd4' },
  { nome: 'Dourado', hex: '#c9a84c' },
  { nome: 'Prateado', hex: '#b0b8c1' },
  { nome: 'Grafite', hex: '#4a4a4a' },
  { nome: 'Azul Pacífico', hex: '#1a4a6b' },
  { nome: 'Luz das Estrelas', hex: '#f0e8d0' },
]

const CORES_HEX: Record<string, string> = {"Prata":"#c0c0c0","Lilás":"#c8a2c8","Cinza":"#7f8c8d","Preto":"#1a1a1a","Branco":"#f0f0f0","Vermelho (RED)":"#cc0000","Estelar":"#f5e6c8","Meia-Noite":"#1c2026","Titânio Natural":"#c4b49a","Titânio Preto":"#2c2c2c","Titânio Branco":"#e8e4dc","Titânio Desert":"#c8a97a","Titânio Rosa":"#e8b4a0","Azul":"#4a90d9","Azul Sierra":"#5b7fa6","Azul Alpino":"#2d5f8a","Verde":"#5ab878","Verde Alpino":"#4a7c59","Verde Floresta":"#2d5c3a","Rosa":"#e8799e","Roxo":"#7b5ea7","Violeta":"#9b59b6","Amarelo":"#f5c842","Coral":"#ff6b5b","Laranja":"#ff8c00","Ciano":"#00bcd4","Dourado":"#c9a84c","Prateado":"#b0b8c1","Grafite":"#4a4a4a","Azul Pacífico":"#1a4a6b","Luz das Estrelas":"#f0e8d0"}

const PERIODOS = [
  { k: 'hoje', l: 'Hoje' },
  { k: '7d', l: '7 dias' },
  { k: 'mes', l: 'Este mês' },
  { k: 'todos', l: 'Tudo' },
] as const
type Periodo = typeof PERIODOS[number]['k']

// Texto da forma de pagamento (funciona com negociações antigas, sem forma_pagamento)
function textoPagamento(c: { forma_pagamento?: string | null; parcelas: number }) {
  if (c.forma_pagamento && c.forma_pagamento.includes('sem juros')) return c.forma_pagamento
  return c.parcelas === 1 ? 'Crédito 1x' : c.parcelas + 'x'
}

// Converte valor digitado em reais ("1.500", "1500,50", "1.234,56") para número
function parseValor(v: string) {
  const t = (v || '').replace(/[^\d.,-]/g, '').trim()
  if (!t) return 0
  if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return parseFloat(t.replace(/\./g, '')) || 0
  return parseFloat(t) || 0
}

const fmt = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const norm = (t: string | null | undefined) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function noPeriodo(data: string, periodo: Periodo) {
  if (periodo === 'todos') return true
  const d = new Date(data)
  const agora = new Date()
  if (periodo === 'hoje') return d.toDateString() === agora.toDateString()
  if (periodo === '7d') return agora.getTime() - d.getTime() <= 7 * 24 * 60 * 60 * 1000
  return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
}

function resumoEntrada(e: Entrada) {
  return [
    `${e.modelo} ${e.armazenamento || ''}`.trim(),
    e.estado,
    e.possui_defeito ? `Defeito: ${e.defeito || 'não informado'}` : 'Sem defeito',
    e.bateria != null ? `Bateria ${e.bateria}%` : '',
    e.acessorios && e.acessorios.length ? `Acompanha: ${e.acessorios.join(', ')}` : '',
  ].filter(Boolean).join(' · ')
}

function linkWhatsApp(telefone: string, msg: string) {
  const d = telefone.replace(/\D/g, '')
  const numero = d.startsWith('55') && d.length > 11 ? d : `55${d}`
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`
}

// Detecta tela de celular (largura menor que 700px) e acompanha giro de tela
function useCelular() {
  const [celular, setCelular] = useState(typeof window !== 'undefined' && window.innerWidth < 700)
  useEffect(() => {
    const atualizar = () => setCelular(window.innerWidth < 700)
    window.addEventListener('resize', atualizar)
    return () => window.removeEventListener('resize', atualizar)
  }, [])
  return celular
}

// Neutraliza estilos globais do index.css/App.css que alargam a tela no celular
const AJUSTE_CELULAR = `
  html, body { width: 100%; max-width: 100%; overflow-x: hidden; margin: 0; }
  body { display: block !important; min-width: 0 !important; }
  #root { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
  *, *::before, *::after { box-sizing: border-box; }
`

// No celular, troca as grades de várias colunas por uma coluna só
function estilos(celular: boolean): Record<string, React.CSSProperties> {
  if (!celular) return base
  return {
    ...base,
    page: { ...base.page, maxWidth: '100vw' },
    header: { ...base.header, flexWrap: 'wrap', padding: '12px 14px', gap: 10, maxWidth: '100vw', boxSizing: 'border-box' },
    logoM: { ...base.logoM, fontSize: 22 },
    logoMag: { ...base.logoMag, fontSize: 11 },
    abas: { ...base.abas, width: '100%', maxWidth: 'calc(100vw - 28px)', order: 3, paddingBottom: 2, WebkitOverflowScrolling: 'touch' },
    abaAtiva: { ...base.abaAtiva, padding: '9px 14px', flexShrink: 0 },
    abaInativa: { ...base.abaInativa, padding: '9px 14px', flexShrink: 0 },
    content: { ...base.content, padding: '18px 12px', maxWidth: '100vw' },
    pageTitle: { ...base.pageTitle, fontSize: 24 },
    pageSubtitle: { ...base.pageSubtitle, marginBottom: 18 },
    section: { ...base.section, padding: 16, marginBottom: 14 },
    formGrid2: { ...base.formGrid2, gridTemplateColumns: '1fr', gap: 12 },
    formGrid3: { ...base.formGrid3, gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 },
    input: { ...base.input, fontSize: 16 },
    parcelasGrid: { ...base.parcelasGrid, gridTemplateColumns: 'minmax(0, 1fr)' },
    parcelaCard: { ...base.parcelaCard, padding: '12px 14px', minWidth: 0 },
    resumoFinal: { ...base.resumoFinal, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', padding: 16, gap: 14 },
    botoesRow: { ...base.botoesRow, flexDirection: 'column', alignItems: 'stretch' },
    btnPendente: { ...base.btnPendente, flex: 1, padding: '14px 12px' },
    btnFechar: { ...base.btnFechar, flex: 1, padding: '14px 12px' },
    clientesGrid: { ...base.clientesGrid, gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 },
    clienteCard: { ...base.clienteCard, padding: 16 },
    detalheContainer: { ...base.detalheContainer, padding: '18px 12px', maxWidth: '100vw' },
    detalheTitle: { ...base.detalheTitle, fontSize: 22, marginBottom: 16 },
    detalheGrid: { ...base.detalheGrid, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 },
    detalheCard: { ...base.detalheCard, padding: 12 },
    relGrid: { ...base.relGrid, gridTemplateColumns: '1fr', gap: 12 },
    relCard: { ...base.relCard, padding: 18 },
    relNumero: { ...base.relNumero, fontSize: 40 },
    vendedorCard: { ...base.vendedorCard, padding: 14 },
    vendedorStats: { ...base.vendedorStats, gap: 12, width: '100%', justifyContent: 'space-between' },
    vendedorStat: { ...base.vendedorStat, minWidth: 0 },
    entradaBanner: { ...base.entradaBanner, flexDirection: 'column', padding: 14 },
    listaGrid: { ...base.listaGrid, gridTemplateColumns: 'minmax(0, 1fr)' },
  }
}

// ─── Notificações push ───
type EstadoAviso = 'verificando' | 'sem-suporte' | 'instalar' | 'desligado' | 'ligado' | 'negado'
const ehIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1))
const instalado = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
function chaveParaBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}

export default function Negociacao() {
  const celular = useCelular()
  const s = estilos(celular)
  const [aba, setAba] = useState<'negociacao' | 'clientes' | 'relatorios' | 'entradas' | 'admin'>('negociacao')
  const [menuAberto, setMenuAberto] = useState(false)
  const [clientes, setClientes] = useState<Negociacao[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Negociacao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [opcaoPagamento, setOpcaoPagamento] = useState<string | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([])
  const [buscaModelo, setBuscaModelo] = useState('')
  const [modeloSugestoes, setModeloSugestoes] = useState<Aparelho[]>([])
  const [filtro, setFiltro] = useState('Todos')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [relAberto, setRelAberto] = useState<string | null>(null)
  const [vendedorAberto, setVendedorAberto] = useState<string | null>(null)
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [avisoEntrada, setAvisoEntrada] = useState<Entrada | null>(null)
  const [zoomFotos, setZoomFotos] = useState<{ fotos: { lado: string; url: string }[]; i: number } | null>(null)
  const idsVistos = useRef<Set<string> | null>(null)
  const [estadoAviso, setEstadoAviso] = useState<EstadoAviso>('verificando')
  const [msgAviso, setMsgAviso] = useState('')

  // Abre direto em "Entradas" quando vem da notificação
  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get('aba') === 'entradas') setAba('entradas') } catch { /* ok */ }
    verificarAvisos()
  }, [])

  async function verificarAvisos() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstadoAviso(ehIOS && !instalado() ? 'instalar' : 'sem-suporte'); return
    }
    if (Notification.permission === 'denied') { setEstadoAviso('negado'); return }
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    setEstadoAviso(sub ? 'ligado' : 'desligado')
  }

  async function ativarAvisos() {
    setMsgAviso('')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') { setEstadoAviso(permissao === 'denied' ? 'negado' : 'desligado'); return }
      const { data, error } = await supabase.functions.invoke('push', { body: { acao: 'chave' } })
      if (error || !data?.chave) throw new Error(data?.error || 'Função push não encontrada no Supabase')
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(data.chave) })
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const { data: u } = await supabase.auth.getUser()
      const { error: e2 } = await supabase.from('push_inscricoes').upsert([{
        endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
        email: u?.user?.email || null, aparelho: navigator.userAgent.slice(0, 180),
      }], { onConflict: 'endpoint' })
      if (e2) throw e2
      setEstadoAviso('ligado')
      setMsgAviso('✅ Avisos ativados neste aparelho!')
    } catch (e) {
      console.error(e)
      setMsgAviso('Não foi possível ativar: ' + (e instanceof Error ? e.message : 'erro'))
    }
  }

  async function testarAvisos() {
    setMsgAviso('Enviando teste...')
    const { data, error } = await supabase.functions.invoke('push', { body: { acao: 'teste' } })
    setMsgAviso(error || data?.error ? 'Erro no teste: ' + (data?.error || 'confira a função push') : `Teste enviado para ${data?.enviados ?? 0} aparelho(s). Bloqueie a tela e aguarde.`)
  }

  async function desativarAvisos() {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      await supabase.from('push_inscricoes').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    setEstadoAviso('desligado'); setMsgAviso('Avisos desligados neste aparelho.')
  }
  const [filtroEntradas, setFiltroEntradas] = useState('Nova')
  const [entradaVinculada, setEntradaVinculada] = useState<Entrada | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [painelLucro, setPainelLucro] = useState(false)
  const [lucrosEdit, setLucrosEdit] = useState<Record<string, string>>({})
  const [salvandoLucroId, setSalvandoLucroId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '', telefone: '', instagram: '',
    modelo: '', cor: '',
    valor_aparelho: '', valor_entrada: '', lucro: '',
    observacoes: '', vendedor: '',
  })

  const [adminModelo, setAdminModelo] = useState('')
  const [adminCoresSelecionadas, setAdminCoresSelecionadas] = useState<string[]>([])
  const [adminCorAtiva, setAdminCorAtiva] = useState<string | null>(null)
  const [adminFotos, setAdminFotos] = useState<Record<string, string[]>>({})
  const [adminSalvando, setAdminSalvando] = useState(false)
  const [aparelhoEditandoId, setAparelhoEditandoId] = useState<string | null>(null)

  useEffect(() => {
    if (aba === 'clientes' || aba === 'relatorios') carregarClientes()
    if (aba === 'negociacao' || aba === 'admin') carregarAparelhos()
    carregarEntradas()
  }, [aba])

  async function carregarClientes() {
    const { data } = await supabase.from('negociacoes').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
  }

  async function carregarAparelhos() {
    const { data } = await supabase.from('aparelhos').select('*').order('modelo')
    setAparelhos(data || [])
  }

  async function carregarEntradas() {
    const { data } = await supabase.from('entradas').select('*').order('created_at', { ascending: false })
    const lista = (data || []) as Entrada[]
    setEntradas(lista)
    // Avisa quando chega avaliação nova (compara com as que já tinham aparecido)
    if (idsVistos.current) {
      const nova = lista.find(e => !idsVistos.current!.has(e.id) && e.status === 'Nova')
      if (nova) avisarNovaEntrada(nova)
    }
    idsVistos.current = new Set(lista.map(e => e.id))
  }

  function avisarNovaEntrada(e: Entrada) {
    setAvisoEntrada(e)
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      ;[0, 0.18].forEach((t, k) => {
        const o = ctx.createOscillator(); const g = ctx.createGain()
        o.frequency.value = k ? 1175 : 880; o.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16)
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18)
      })
    } catch { /* sem som */ }
    try { navigator.vibrate?.(200) } catch { /* sem vibração */ }
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('📲 Nova avaliação de usado', { body: `${e.nome}: ${e.modelo} ${e.armazenamento}${e.interesse ? ` → quer ${e.interesse}` : ''}` })
      }
    } catch { /* sem notificação do sistema */ }
  }

  // Tempo real: o Supabase avisa na hora que alguém envia; e a cada 30s confere de novo (garantia)
  useEffect(() => {
    const canal = supabase.channel('entradas-novas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entradas' }, () => carregarEntradas())
      .subscribe()
    const t = setInterval(carregarEntradas, 30000)
    return () => { clearInterval(t); supabase.removeChannel(canal) }
  }, [])

  // Mostra a quantidade de novas no título da aba do navegador
  useEffect(() => {
    const n = entradas.filter(e => e.status === 'Nova').length
    document.title = n ? `(${n}) Negociação · Marcos Magazine` : 'Negociação · Marcos Magazine'
  }, [entradas])

  function buscarModelo(texto: string) {
    setBuscaModelo(texto)
    setForm({ ...form, modelo: texto, cor: '' })
    if (texto.length < 2) { setModeloSugestoes([]); return }
    const sugestoes = aparelhos.filter(a => a.disponivel !== false && a.modelo.toLowerCase().includes(texto.toLowerCase()))
    setModeloSugestoes(sugestoes)
  }

  function selecionarAparelho(a: Aparelho) {
    setBuscaModelo(a.modelo)
    // Preço de venda vem do cadastro (custo do fornecedor + lucro)
    const valor = a.preco != null ? String(a.preco).replace('.', ',') : form.valor_aparelho
    setForm({ ...form, modelo: a.modelo, cor: '', valor_aparelho: valor })
    setErros({ ...erros, valor_aparelho: '' })
    setModeloSugestoes([])
  }

  function toggleCorAdmin(nome: string) {
    setAdminCoresSelecionadas(prev =>
      prev.includes(nome) ? prev.filter(c => c !== nome) : [...prev, nome]
    )
    if (!adminCoresSelecionadas.includes(nome)) setAdminCorAtiva(nome)
  }

  async function uploadFoto(file: File, modelo: string, cor: string): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `aparelhos/${modelo.replace(/\s+/g, '_')}/${cor.replace(/\s+/g, '_')}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('fotos').getPublicUrl(path)
    return data.publicUrl
  }

  async function salvarAparelho() {
    if (!adminModelo.trim()) { alert('Digite o modelo!'); return }
    if (adminCoresSelecionadas.length === 0) { alert('Selecione pelo menos uma cor!'); return }
    setAdminSalvando(true)
    try {
      const fotosUrls: Record<string, string[]> = {}
      for (const cor of adminCoresSelecionadas) {
        const arquivos = adminFotos[cor] || []
        const urls: string[] = []
        for (const dataUrl of arquivos) {
          if (dataUrl.startsWith('http')) { urls.push(dataUrl); continue }
          const res = await fetch(dataUrl)
          const blob = await res.blob()
          const file = new File([blob], 'foto.jpg', { type: blob.type })
          const url = await uploadFoto(file, adminModelo, cor)
          urls.push(url)
        }
        fotosUrls[cor] = urls
      }
      const dados = { modelo: adminModelo, cores: adminCoresSelecionadas, fotos: fotosUrls }
      if (aparelhoEditandoId) {
        await supabase.from('aparelhos').update(dados).eq('id', aparelhoEditandoId)
      } else {
        await supabase.from('aparelhos').insert([dados])
      }
      alert(aparelhoEditandoId ? 'Aparelho atualizado!' : 'Aparelho cadastrado!')
      setAdminModelo(''); setAdminCoresSelecionadas([]); setAdminCorAtiva(null)
      setAdminFotos({}); setAparelhoEditandoId(null)
      carregarAparelhos()
    } catch(e: any) {
      alert('Erro: ' + e.message)
    }
    setAdminSalvando(false)
  }

  function editarAparelho(a: Aparelho) {
    setAdminModelo(a.modelo)
    setAdminCoresSelecionadas(a.cores)
    setAdminFotos(a.fotos || {})
    setAdminCorAtiva(a.cores[0] || null)
    setAparelhoEditandoId(a.id)
  }

  async function excluirAparelho(id: string) {
    if (!confirm('Excluir este aparelho?')) return
    await supabase.from('aparelhos').delete().eq('id', id)
    carregarAparelhos()
  }

  const taxaSelecionada = TAXAS.find(t => t.label === opcaoPagamento) || null
  const taxaAtual = taxaSelecionada || TAXAS[0]
  const parcelaSelecionada = taxaSelecionada ? taxaSelecionada.parcelas : null
  const valorAparelho = parseValor(form.valor_aparelho)
  const valorEntrada = parseValor(form.valor_entrada)
  const valorFinanciar = Math.max(0, valorAparelho - valorEntrada)
  const valorComTaxa = parcelaSelecionada ? valorFinanciar / (1 - taxaAtual.taxa / 100) : valorFinanciar
  const valorParcela = !parcelaSelecionada ? 0 : parcelaSelecionada === 1 ? valorComTaxa : valorComTaxa / parcelaSelecionada
  const valorTotal = valorComTaxa + valorEntrada

  function validar() {
    const e: Record<string, string> = {}
    if (!form.nome.trim()) e.nome = 'Nome do cliente obrigatório'
    if (!form.telefone.trim()) e.telefone = 'WhatsApp obrigatório'
    if (!form.vendedor.trim()) e.vendedor = 'Nome do vendedor obrigatório'
    if (!valorAparelho) e.valor_aparelho = 'Valor obrigatório'
    if (!parcelaSelecionada) e.parcelas = 'Selecione o parcelamento'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar(status: string) {
    if (!validar()) return
    setSalvando(true)
    const dados = {
      nome: form.nome, telefone: form.telefone, instagram: form.instagram,
      modelo: form.modelo, cor: form.cor,
      valor_aparelho: valorAparelho, valor_entrada: valorEntrada,
      parcelas: parcelaSelecionada, taxa: taxaAtual.taxa, forma_pagamento: taxaAtual.label,
      valor_parcela: valorParcela, valor_total: valorTotal,
      observacoes: form.observacoes, vendedor: form.vendedor.trim(), status,
    }
    let error
    if (editandoId) {
      const res = await supabase.from('negociacoes').update(dados).eq('id', editandoId)
      error = res.error
    } else {
      const res = await supabase.from('negociacoes').insert([dados])
      error = res.error
    }
    if (!error && entradaVinculada) {
      await supabase.from('entradas').update({ status: 'Usada' }).eq('id', entradaVinculada.id)
      carregarEntradas()
    }
    setSalvando(false)
    if (error) { alert('Erro: ' + JSON.stringify(error)); return }
    alert(editandoId ? 'Negociação atualizada!' : 'Negociação salva!')
    limpar()
  }

  function limpar() {
    setForm({ nome: '', telefone: '', instagram: '', modelo: '', cor: '', valor_aparelho: '', valor_entrada: '', lucro: '', observacoes: '', vendedor: '' })
    setOpcaoPagamento(null)
    setErros({})
    setEditandoId(null)
    setBuscaModelo('')
    setEntradaVinculada(null)
  }

  function editarNegociacao(c: Negociacao) {
    setForm({
      nome: c.nome, telefone: c.telefone, instagram: c.instagram || '',
      modelo: c.modelo || '', cor: c.cor || '',
      valor_aparelho: String(c.valor_aparelho), valor_entrada: String(c.valor_entrada || 0),
      lucro: c.lucro != null ? String(c.lucro).replace('.', ',') : '',
      observacoes: c.observacoes || '', vendedor: c.vendedor || '',
    })
    setBuscaModelo(c.modelo || '')
    const opcao = TAXAS.find(t => t.label === c.forma_pagamento)
      || TAXAS.find(t => t.parcelas === c.parcelas && Number(t.taxa) === Number(c.taxa))
      || TAXAS.find(t => t.parcelas === c.parcelas)
    setOpcaoPagamento(opcao ? opcao.label : null)
    setEditandoId(c.id)
    setEntradaVinculada(null)
    setClienteSelecionado(null)
    setAba('negociacao')
  }

  function valorLucroEdit(c: Negociacao) {
    if (lucrosEdit[c.id] !== undefined) return lucrosEdit[c.id]
    return c.lucro != null ? String(c.lucro).replace('.', ',') : ''
  }

  async function salvarLucro(c: Negociacao) {
    setSalvandoLucroId(c.id)
    const txt = valorLucroEdit(c)
    const lucro = txt.trim() ? parseValor(txt) : null
    const { error } = await supabase.from('negociacoes').update({ lucro }).eq('id', c.id)
    setSalvandoLucroId(null)
    if (error) { alert('Erro ao salvar o lucro: ' + error.message); return }
    setLucrosEdit(prev => { const n = { ...prev }; delete n[c.id]; return n })
    // Fecha o painel sozinho quando não sobrar venda sem lucro no período
    const faltam = clientesPeriodo.filter(x => x.status === 'Venda Fechada' && x.id !== c.id && x.lucro == null).length
    if (faltam === 0) setPainelLucro(false)
    carregarClientes()
  }

  async function alterarStatus(id: string, status: string) {
    await supabase.from('negociacoes').update({ status }).eq('id', id)
    carregarClientes(); setClienteSelecionado(null)
  }

  async function excluirNegociacao(id: string) {
    if (!confirm('Excluir esta negociação?')) return
    await supabase.from('negociacoes').delete().eq('id', id)
    carregarClientes(); setClienteSelecionado(null)
  }

  function enviarWhatsApp(c: Negociacao) {
    const tel = c.telefone.replace(/\D/g, '')
    const modelo = c.modelo || ''
    const cor = c.cor ? ` ${c.cor}` : ''
    const parcelas = c.forma_pagamento && c.forma_pagamento.includes('sem juros') ? c.forma_pagamento.toLowerCase()
      : c.parcelas === 1 ? 'no crédito 1x' : `em ${c.parcelas}x de ${fmt(c.valor_parcela)}`
    const msg = `Olá ${c.nome}! 👋\n\nSegue o resumo da sua negociação:\n\n📱 *${modelo}${cor}*\n💰 Valor: ${fmt(c.valor_aparelho)}\n📋 Pagamento: ${parcelas}\n💵 Total: ${fmt(c.valor_total)}\n\nQualquer dúvida estou à disposição! 😊\n\n_Marcos Magazine_`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // ---------- Entradas (aparelhos enviados pelo catálogo) ----------

  function usarEntrada(e: Entrada) {
    setForm({
      nome: e.nome, telefone: e.telefone, instagram: '',
      modelo: e.interesse || '', cor: '',
      valor_aparelho: '', valor_entrada: '', lucro: '',
      observacoes: `Aparelho de entrada: ${resumoEntrada(e)}`,
      vendedor: form.vendedor,
    })
    setBuscaModelo(e.interesse || '')
    setOpcaoPagamento(null)
    setErros({})
    setEditandoId(null)
    setEntradaVinculada(e)
    setAba('negociacao')
    window.scrollTo({ top: 0 })
  }

  async function alterarStatusEntrada(id: string, status: string) {
    await supabase.from('entradas').update({ status }).eq('id', id)
    carregarEntradas()
  }

  async function excluirEntrada(e: Entrada) {
    if (!confirm(`Excluir a avaliação de ${e.nome}?\n\nIsso não pode ser desfeito.`)) return
    const { error } = await supabase.from('entradas').delete().eq('id', e.id)
    if (error) { alert('Não foi possível excluir: ' + error.message); return }
    if (entradaVinculada?.id === e.id) setEntradaVinculada(null)
    carregarEntradas()
  }

  function whatsAppEntrada(e: Entrada) {
    const interesse = e.interesse ? ` na compra do *${e.interesse}*` : ''
    const msg = `Olá ${e.nome}! 👋\n\nRecebemos a avaliação do seu *${e.modelo} ${e.armazenamento}* (${e.estado}).\n\nVamos conversar sobre a proposta para usar como entrada${interesse}? 😊\n\n_Marcos Magazine_`
    window.open(linkWhatsApp(e.telefone, msg), '_blank')
  }

  async function copiarLinkEntrada() {
    const link = `${window.location.origin}/entrada`
    try {
      await navigator.clipboard.writeText(link)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    } catch {
      prompt('Copie o link:', link)
    }
  }

  // ---------- Dados derivados ----------

  const aparelhoSelecionado = aparelhos.find(a => a.modelo === form.modelo)
  const coresDisponiveis = aparelhoSelecionado?.cores || []
  const fotoAtual = form.cor && aparelhoSelecionado?.fotos?.[form.cor]?.[0] || null

  const entradasNovas = entradas.filter(e => e.status === 'Nova').length
  const clientesPeriodo = clientes.filter(c => noPeriodo(c.created_at, periodo))

  const porVendedor = Object.values(
    clientesPeriodo.reduce((acc, c) => {
      const chave = norm(c.vendedor) || '__sem_vendedor'
      if (!acc[chave]) acc[chave] = { chave, nome: (c.vendedor || '').trim() || 'Sem vendedor', lista: [] as Negociacao[] }
      acc[chave].lista.push(c)
      return acc
    }, {} as Record<string, { chave: string; nome: string; lista: Negociacao[] }>)
  ).map(v => {
    const fechadas = v.lista.filter(c => c.status === 'Venda Fechada')
    const pendentes = v.lista.filter(c => c.status === 'Venda Pendente').length
    const desistiram = v.lista.filter(c => c.status === 'Desistiram').length
    const vendido = fechadas.reduce((soma, c) => soma + (Number(c.valor_aparelho) || 0), 0)
    const lucro = fechadas.reduce((soma, c) => soma + (Number(c.lucro) || 0), 0)
    const semLucro = fechadas.filter(c => c.lucro == null).length
    const conversao = v.lista.length ? Math.round((fechadas.length / v.lista.length) * 100) : 0
    const ticket = fechadas.length ? vendido / fechadas.length : 0
    return { ...v, fechadas: fechadas.length, pendentes, desistiram, vendido, lucro, semLucro, conversao, ticket }
  }).sort((a, b) => b.vendido - a.vendido || b.fechadas - a.fechadas || b.lista.length - a.lista.length)

  const totalVendidoPeriodo = porVendedor.reduce((soma, v) => soma + v.vendido, 0)
  const totalLucroPeriodo = porVendedor.reduce((soma, v) => soma + v.lucro, 0)
  const totalSemLucro = porVendedor.reduce((soma, v) => soma + v.semLucro, 0)

  function miniCard(c: Negociacao) {
    return (
      <div key={c.id} style={{ ...s.clienteCard, cursor: 'pointer' }} onClick={() => setClienteSelecionado(c)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={s.clienteNome}>{c.nome}</p>
            <p style={s.clienteModelo}>{c.modelo || '-'}{c.cor ? ' · ' + c.cor : ''}</p>
            <p style={s.clienteTel}>📱 {c.telefone || '-'}{c.vendedor ? ' · ' + c.vendedor : ''}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#ff6600', fontWeight: 900, fontSize: 18 }}>{fmt(c.valor_parcela)}</p>
            <p style={{ color: '#888', fontSize: 12 }}>{textoPagamento(c)}</p>
            <p style={{ color: '#555', fontSize: 11 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (clienteSelecionado) return (
    <div style={s.page}>
      {celular && <style>{AJUSTE_CELULAR}</style>}
      <header style={s.header}>
        <button style={s.btnBack} onClick={() => setClienteSelecionado(null)}>← Voltar</button>
        <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
      </header>
      <div style={s.detalheContainer}>
        <h2 style={s.detalheTitle}>Detalhes da Negociação</h2>
        <div style={s.detalheGrid}>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Cliente</p><p style={s.detalheValor}>{clienteSelecionado.nome}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>WhatsApp</p><p style={s.detalheValor}>{clienteSelecionado.telefone || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Instagram</p><p style={s.detalheValor}>{clienteSelecionado.instagram || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Modelo</p><p style={s.detalheValor}>{clienteSelecionado.modelo || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Cor</p><p style={s.detalheValor}>{clienteSelecionado.cor || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Vendedor</p><p style={s.detalheValor}>{clienteSelecionado.vendedor || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Valor</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_aparelho)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Entrada</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_entrada || 0)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Parcelas</p><p style={s.detalheValor}>{textoPagamento(clienteSelecionado)} ({clienteSelecionado.taxa}%)</p></div>
          <div style={{ ...s.detalheCard, background: 'rgba(255,102,0,0.1)', border: '1px solid #ff6600' }}>
            <p style={s.detalheLabel}>Parcela</p>
            <p style={{ ...s.detalheValor, color: '#ff6600', fontSize: 24, fontWeight: 900 }}>{fmt(clienteSelecionado.valor_parcela)}</p>
          </div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Total</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_total)}</p></div>

          <div style={s.detalheCard}><p style={s.detalheLabel}>Data</p><p style={s.detalheValor}>{new Date(clienteSelecionado.created_at).toLocaleDateString('pt-BR')}</p></div>
        </div>
        {clienteSelecionado.observacoes && <div style={{ ...s.detalheCard, marginTop: 12 }}><p style={s.detalheLabel}>Obs</p><p style={s.detalheValor}>{clienteSelecionado.observacoes}</p></div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={() => enviarWhatsApp(clienteSelecionado)} style={{ ...s.btnFechar, flex: 1, background: '#25D366' }}>📲 WhatsApp</button>
          <button onClick={() => editarNegociacao(clienteSelecionado)} style={{ ...s.btnAlterar, flex: 1 }}>✏️ Alterar</button>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Venda Fechada')} style={{ ...s.btnFechar, flex: 1 }}>Fechada</button>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Venda Pendente')} style={{ ...s.btnPendente, flex: 1 }}>Pendente</button>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Desistiram')} style={{ ...s.btnDesistiram, flex: 1 }}>Desistiram</button>
          <button onClick={() => excluirNegociacao(clienteSelecionado.id)} style={{ ...s.btnExcluir, flex: 1 }}>Excluir</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      {celular && <style>{AJUSTE_CELULAR}</style>}
      <style>{`@keyframes mmDesce { from { transform: translate(-50%, -140%) } to { transform: translate(-50%, 0) } }`}</style>
      {avisoEntrada && (
        <div style={s.avisoEntrada}>
          <div style={{ fontSize: 28 }}>📲</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, color: '#fff', fontSize: 15 }}>Nova avaliação de usado!</p>
            <p style={{ margin: '2px 0 0', color: '#ffd2b3', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {avisoEntrada.nome} · {avisoEntrada.modelo} {avisoEntrada.armazenamento}{avisoEntrada.interesse ? ` → ${avisoEntrada.interesse}` : ''}
            </p>
          </div>
          <button style={s.avisoVer} onClick={() => { setAba('entradas'); setFiltroEntradas('Nova'); setAvisoEntrada(null) }}>Ver</button>
          <button style={s.avisoFechar} onClick={() => setAvisoEntrada(null)}>✕</button>
        </div>
      )}
      {zoomFotos && (
        <div style={s.zoomFundo} onClick={() => setZoomFotos(null)}>
          <img src={zoomFotos.fotos[zoomFotos.i].url} alt="" style={{ maxWidth: '94vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12 }} onClick={ev => ev.stopPropagation()} />
          <p style={{ color: '#fff', fontWeight: 700, margin: '12px 0 0' }}>{zoomFotos.fotos[zoomFotos.i].lado} · {zoomFotos.i + 1}/{zoomFotos.fotos.length}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }} onClick={ev => ev.stopPropagation()}>
            <button style={s.zoomBtn} onClick={() => setZoomFotos({ ...zoomFotos, i: (zoomFotos.i + zoomFotos.fotos.length - 1) % zoomFotos.fotos.length })}>‹ Anterior</button>
            <button style={s.zoomBtn} onClick={() => setZoomFotos({ ...zoomFotos, i: (zoomFotos.i + 1) % zoomFotos.fotos.length })}>Próxima ›</button>
            <button style={s.zoomBtn} onClick={() => setZoomFotos(null)}>Fechar</button>
          </div>
        </div>
      )}
      {menuAberto && <div style={s.overlay} onClick={() => setMenuAberto(false)} />}
      <aside style={{ ...s.sidebar, left: menuAberto ? 0 : -280 }}>
        <div style={s.sidebarLogo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
        <nav>
          <p style={{ ...s.navItem, ...(aba === 'negociacao' ? s.navAtivo : {}) }} onClick={() => { setAba('negociacao'); setMenuAberto(false) }}>Negociação</p>
          <p style={{ ...s.navItem, ...(aba === 'clientes' ? s.navAtivo : {}) }} onClick={() => { setAba('clientes'); setMenuAberto(false) }}>Clientes</p>
          <p style={{ ...s.navItem, ...(aba === 'relatorios' ? s.navAtivo : {}) }} onClick={() => { setAba('relatorios'); setMenuAberto(false) }}>Relatórios</p>
          <p style={{ ...s.navItem, ...(aba === 'entradas' ? s.navAtivo : {}) }} onClick={() => { setAba('entradas'); setMenuAberto(false) }}>
            Entradas {entradasNovas > 0 && <span style={s.badgeNovas}>{entradasNovas}</span>}
          </p>
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%' }}>
        <header style={s.header}>
          <button style={s.hamburger} onClick={() => setMenuAberto(!menuAberto)}>☰</button>
          <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
          <div style={s.abas}>
            <button style={aba === 'negociacao' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('negociacao')}>{editandoId ? '✏️' : 'Negociação'}</button>
            <button style={aba === 'clientes' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('clientes')}>Clientes</button>
            <button style={aba === 'relatorios' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('relatorios')}>Relatórios</button>
            <button style={aba === 'entradas' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('entradas')}>
              Entradas{entradasNovas > 0 && <span style={{ ...s.badgeNovas, background: aba === 'entradas' ? 'white' : '#ff6600', color: aba === 'entradas' ? '#ff6600' : 'white' }}>{entradasNovas}</span>}
            </button>
          </div>
        </header>
        {aba === 'negociacao' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>{editandoId ? 'Alterar Negociação' : 'Nova Negociação'}</h1>
            <p style={s.pageSubtitle}>{editandoId ? 'Edite os dados e salve para atualizar' : 'Cadastre os dados e calcule o valor da venda'}</p>
            {entradaVinculada && (
              <div style={s.entradaBanner}>
                <div style={{ flex: 1 }}>
                  {entradaVinculada.interesse && <p style={{ color: 'white', fontSize: 14, marginBottom: 8 }}>Quer comprar: <b style={{ color: '#ff6600' }}>{entradaVinculada.interesse}</b></p>}
                  <p style={{ color: '#ff6600', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Aparelho de entrada do cliente</p>
                  <p style={{ color: 'white', fontSize: 15, marginTop: 4 }}>{entradaVinculada.modelo} {entradaVinculada.armazenamento} · {entradaVinculada.estado} · {entradaVinculada.bateria != null ? `Bateria ${entradaVinculada.bateria}%` : ''}</p>
                  {entradaVinculada.possui_defeito
                    ? <p style={{ color: '#ff4444', fontWeight: 700, fontSize: 14, marginTop: 4 }}>⚠ Defeito: {entradaVinculada.defeito}</p>
                    : <p style={{ color: '#25D366', fontSize: 13, marginTop: 4 }}>Sem defeito informado</p>}
                  <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>Coloque o valor que a loja paga no campo "Entrada". Ao salvar, a entrada é marcada como usada.</p>
                </div>
                <button style={{ ...s.btnLimpar, padding: '8px 14px', fontSize: 13 }} onClick={() => setEntradaVinculada(null)}>Desvincular</button>
              </div>
            )}
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Cliente</h3>
              <div style={s.formGrid3}>
                <div>
                  <label style={s.label}>Nome do Cliente *</label>
                  <input style={{ ...s.input, borderColor: erros.nome ? '#ff4444' : '#2a2a2a' }} value={form.nome} onChange={e => { setForm({ ...form, nome: e.target.value }); setErros({...erros, nome: ''}) }} placeholder="Nome completo" />
                  {erros.nome && <p style={s.erro}>{erros.nome}</p>}
                </div>
                <div>
                  <label style={s.label}>WhatsApp *</label>
                  <input style={{ ...s.input, borderColor: erros.telefone ? '#ff4444' : '#2a2a2a' }} value={form.telefone} onChange={e => { setForm({ ...form, telefone: e.target.value }); setErros({...erros, telefone: ''}) }} placeholder="(64) 9 9999-9999" />
                  {erros.telefone && <p style={s.erro}>{erros.telefone}</p>}
                </div>
                <div>
                  <label style={s.label}>Instagram</label>
                  <input style={s.input} value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" />
                </div>
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Aparelho</h3>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Modelo</label>
                <div style={{ position: 'relative' }}>
                  <input style={s.input} value={buscaModelo} onChange={e => buscarModelo(e.target.value)} placeholder="Buscar modelo cadastrado..." />
                  {modeloSugestoes.length > 0 && (
                    <div style={s.sugestoesBox}>
                      {modeloSugestoes.map(a => (
                        <div key={a.id} style={s.sugestaoItem} onClick={() => selecionarAparelho(a)}>
                          <span style={{ color: 'white', fontWeight: 600 }}>{a.modelo}</span>
                          <span style={{ color: a.preco != null ? '#25D366' : '#666', fontSize: 12, fontWeight: a.preco != null ? 700 : 400, whiteSpace: 'nowrap' }}>{a.preco != null ? fmt(Number(a.preco)) : `${a.cores.length} cor(es)`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {coresDisponiveis.length > 0 && (
                <div>
                  <label style={{ ...s.label, textAlign: 'center', display: 'block' }}>Cor</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, justifyContent: 'center' }}>
                    {coresDisponiveis.map(cor => (
                      <div key={cor} onClick={() => setForm({ ...form, cor })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: CORES_HEX[cor] || '#888', border: form.cor === cor ? '3px solid #ff6600' : '3px solid transparent', boxShadow: form.cor === cor ? '0 0 0 2px rgba(255,102,0,0.4)' : 'none', outline: cor === 'Branco' ? '1px solid #444' : 'none', transition: 'all 0.2s' }} />
                        <span style={{ fontSize: 10, color: form.cor === cor ? '#ff6600' : '#666', textAlign: 'center', maxWidth: 60 }}>{cor}</span>
                      </div>
                    ))}
                  </div>
                  {form.cor && <p style={{ color: '#ff6600', fontSize: 13, marginTop: 10, textAlign: 'center' }}>✓ {form.cor}</p>}
                  {fotoAtual && (
                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                      <img src={fotoAtual} alt={form.cor} onClick={() => window.open(fotoAtual, '_blank')}
                        style={{ width: 200, height: 200, objectFit: 'contain', borderRadius: 16, border: '1px solid #2a2a2a', background: '#0a0a0a', cursor: 'zoom-in' }} />
                    </div>
                  )}
                </div>
              )}
              {coresDisponiveis.length === 0 && (
                <div>
                  <label style={s.label}>Cor</label>
                  <input style={s.input} value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} placeholder="Ex: Preto Titânio" />
                </div>
              )}
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Valores</h3>
              <div style={s.formGrid3}>
                <div>
                  <label style={s.label}>Valor do Aparelho *</label>
                  <div style={s.inputPrefix}><span style={s.prefix}>R$</span><input style={{ ...s.input, borderRadius: '0 10px 10px 0', borderColor: erros.valor_aparelho ? '#ff4444' : '#2a2a2a' }} value={form.valor_aparelho} onChange={e => { setForm({ ...form, valor_aparelho: e.target.value }); setErros({...erros, valor_aparelho: ''}) }} placeholder="0,00" /></div>
                  {erros.valor_aparelho && <p style={s.erro}>{erros.valor_aparelho}</p>}
                </div>
                <div>
                  <label style={s.label}>Entrada{entradaVinculada ? ' (aparelho do cliente)' : ''}</label>
                  <div style={{ ...s.inputPrefix, borderColor: entradaVinculada ? '#ff6600' : '#2a2a2a' }}><span style={s.prefix}>R$</span><input style={{ ...s.input, borderRadius: '0 10px 10px 0' }} value={form.valor_entrada} onChange={e => setForm({ ...form, valor_entrada: e.target.value })} placeholder="0,00" /></div>
                </div>
                <div style={s.resumoBox}><p style={s.resumoLabel}>A Financiar</p><p style={s.resumoValor}>{fmt(valorFinanciar)}</p></div>
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Parcelamento {erros.parcelas && <span style={{ color: '#ff4444', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>{erros.parcelas}</span>}</h3>
              <div style={s.parcelasGrid}>
                {TAXAS.map(t => {
                  const vC = valorFinanciar / (1 - t.taxa / 100)
                  const vP = t.parcelas === 1 ? vC : vC / t.parcelas
                  const ativo = opcaoPagamento === t.label
                  const semJuros = t.taxa === 0
                  return (
                    <div key={t.label} onClick={() => { setOpcaoPagamento(t.label); setErros({...erros, parcelas: ''}) }} style={{ ...s.parcelaCard, border: ativo ? '1px solid #ff6600' : erros.parcelas ? '1px solid #ff4444' : '1px solid #1e1e1e', ...(ativo ? s.parcelaAtiva : {}) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid ' + (ativo ? '#ff6600' : '#555'), background: ativo ? '#ff6600' : 'transparent', flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, color: ativo ? '#ff6600' : '#fff' }}>{t.label}</span>
                          {semJuros
                            ? <span style={{ color: '#25D366', fontSize: 11, fontWeight: 700, border: '1px solid #25D366', borderRadius: 10, padding: '1px 8px' }}>0%</span>
                            : <span style={{ color: '#888', fontSize: 12 }}>{t.taxa}%</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ color: ativo ? '#ff6600' : '#fff', fontWeight: 700, margin: 0 }}>{fmt(vP)}</p>
                          <p style={{ color: '#888', fontSize: 11, margin: 0 }}>Total: {fmt(vC + valorEntrada)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {parcelaSelecionada && (
              <div style={s.resumoFinal}>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Parcelas</span><span style={s.resumoItemValor}>{taxaAtual.taxa === 0 ? taxaAtual.label : parcelaSelecionada === 1 ? 'Crédito 1x' : parcelaSelecionada + 'x'}</span></div>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Taxa</span><span style={s.resumoItemValor}>{taxaAtual.taxa}%</span></div>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Parcela</span><span style={{ ...s.resumoItemValor, color: '#ff6600', fontSize: 26, fontWeight: 900 }}>{fmt(valorParcela)}</span></div>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Total</span><span style={s.resumoItemValor}>{fmt(valorTotal)}</span></div>
              </div>
            )}
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Observações</h3>
              <textarea style={{ ...s.input, height: 80, resize: 'none' }} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Anotações sobre a negociação..." />
            </div>
            <div style={s.botoesRow}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flex: 1 }}>
                <div style={{ flex: 1 }}>
                  <input style={{ ...s.input, borderColor: erros.vendedor ? '#ff4444' : '#2a2a2a' }} value={form.vendedor} onChange={e => { setForm({ ...form, vendedor: e.target.value }); setErros({...erros, vendedor: ''}) }} placeholder="Nome do vendedor" />
                  {erros.vendedor && <p style={s.erro}>{erros.vendedor}</p>}
                </div>
                <button style={s.btnLimpar} onClick={limpar}>Limpar</button>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <button style={s.btnPendente} onClick={() => salvar('Venda Pendente')} disabled={salvando}>{salvando ? '...' : 'Em Andamento'}</button>
                <button style={s.btnFechar} onClick={() => salvar('Venda Fechada')} disabled={salvando}>{salvando ? '...' : editandoId ? 'Salvar Alteração' : 'Fechar Venda'}</button>
              </div>
            </div>
          </div>
        )}
        {aba === 'clientes' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>Clientes</h1>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={s.buscaIcone}>🔍</span>
              <input style={{ ...s.input, paddingLeft: 42, paddingRight: 42 }} value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} placeholder="Buscar por nome ou telefone..." />
              {buscaCliente && <button style={s.buscaLimpar} onClick={() => setBuscaCliente('')}>×</button>}
            </div>
            <div style={s.filtrosRow}>
              {['Todos', 'Em Andamento', 'Venda Fechada', 'Desistiram'].map(f => (
                <button key={f} style={filtro === f ? s.filtroBtnAtivo : s.filtroBtn} onClick={() => setFiltro(f)}>{f}</button>
              ))}
            </div>
            {(() => {
              const porStatus = filtro === 'Todos' ? clientes
                : filtro === 'Em Andamento' ? clientes.filter(c => c.status === 'Venda Pendente')
                : clientes.filter(c => c.status === filtro)
              const termo = norm(buscaCliente)
              const digitos = buscaCliente.replace(/\D/g, '')
              const lista = !termo ? porStatus : porStatus.filter(c =>
                norm(c.nome).includes(termo) ||
                (digitos.length >= 3 && (c.telefone || '').replace(/\D/g, '').includes(digitos))
              )
              return (
                <>
                  {termo && <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>{lista.length} resultado(s) para "{buscaCliente}"</p>}
                  {lista.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#666' }}><p style={{ fontSize: 48 }}>📋</p><p>Nenhuma negociação encontrada</p></div>
                  ) : (
                    <div style={s.clientesGrid}>
                      {lista.map(c => (
                        <div key={c.id} style={s.clienteCard} onClick={() => setClienteSelecionado(c)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <p style={s.clienteNome}>{c.nome}</p>
                              <p style={s.clienteModelo}>{c.modelo || '-'}{c.cor ? ' · ' + c.cor : ''}</p>
                              <p style={s.clienteTel}>📱 {c.telefone || '-'}</p>
                              {c.vendedor && <p style={s.clienteTel}>{c.vendedor}</p>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ ...s.statusBadge, background: c.status === 'Venda Fechada' ? 'rgba(37,211,102,0.15)' : c.status === 'Desistiram' ? 'rgba(255,51,51,0.15)' : 'rgba(255,200,0,0.15)', color: c.status === 'Venda Fechada' ? '#25D366' : c.status === 'Desistiram' ? '#ff3333' : '#ffc800', border: '1px solid ' + (c.status === 'Venda Fechada' ? '#25D366' : c.status === 'Desistiram' ? '#ff3333' : '#ffc800') }}>{c.status === 'Venda Fechada' ? 'Fechada' : c.status === 'Desistiram' ? 'Desistiram' : 'Pendente'}</span>
                              <p style={{ color: '#ff6600', fontWeight: 900, fontSize: 18, marginTop: 8 }}>{fmt(c.valor_parcela)}</p>
                              <p style={{ color: '#888', fontSize: 12 }}>{textoPagamento(c)}</p>
                            </div>
                          </div>
                          <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}
        {aba === 'relatorios' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>Relatórios</h1>
            <p style={s.pageSubtitle}>Clique em um card para ver os clientes</p>
            <div style={s.filtrosRow}>
              {PERIODOS.map(p => (
                <button key={p.k} style={periodo === p.k ? s.filtroBtnAtivo : s.filtroBtn} onClick={() => { setPeriodo(p.k); setRelAberto(null); setVendedorAberto(null) }}>{p.l}</button>
              ))}
            </div>
            <div style={s.relGrid}>
              {[
                { label: 'Vendas Fechadas', status: 'Venda Fechada', icon: '✅', cor: '#25D366', rgb: '37,211,102' },
                { label: 'Em Andamento', status: 'Venda Pendente', icon: '⏳', cor: '#ffc800', rgb: '255,200,0' },
                { label: 'Desistiram', status: 'Desistiram', icon: '❌', cor: '#ff3333', rgb: '255,51,51' },
              ].map(({ label, status, icon, cor, rgb }) => {
                const lista = clientesPeriodo.filter(c => c.status === status)
                const aberto = relAberto === status
                return (
                  <div key={status}>
                    <div style={{ ...s.relCard, border: `1px solid ${cor}`, cursor: 'pointer', background: aberto ? `rgba(${rgb},0.08)` : '#0f0f0f' }} onClick={() => setRelAberto(aberto ? null : status)}>
                      <p style={s.relIcon}>{icon}</p>
                      <p style={{ ...s.relNumero, color: cor }}>{lista.length}</p>
                      <p style={s.relLabel}>{label}</p>
                      <p style={{ color: '#555', fontSize: 12, marginTop: 8 }}>{aberto ? '▲ fechar' : '▼ ver lista'}</p>
                    </div>
                    {aberto && lista.length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {lista.map(c => miniCard(c))}
                      </div>
                    )}
                    {aberto && lista.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 20, color: '#555' }}>Nenhum cliente nesta categoria</div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ ...s.relCard, border: '1px solid #ff6600', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', marginTop: 0 }}>
              <p style={{ ...s.relLabel, fontSize: 16 }}>Total de Negociações</p>
              <p style={{ ...s.relNumero, color: '#ff6600', fontSize: 48, margin: 0 }}>{clientesPeriodo.length}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 36, marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ ...s.pageTitle, fontSize: 22 }}>Por Vendedor</h2>
                <p style={{ color: '#666', fontSize: 13 }}>Ordenado pelo valor vendido (vendas fechadas)</p>
              </div>
              <div style={{ display: 'flex', gap: 20, textAlign: 'right', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div>
                  <p style={{ color: '#666', fontSize: 12, textTransform: 'uppercase' }}>Vendido no período</p>
                  <p style={{ color: '#ff6600', fontWeight: 900, fontSize: 22 }}>{fmt(totalVendidoPeriodo)}</p>
                </div>
                <div>
                  <p style={{ color: '#666', fontSize: 12, textTransform: 'uppercase' }}>💰 Lucro no período</p>
                  <p style={{ color: '#25D366', fontWeight: 900, fontSize: 22 }}>{fmt(totalLucroPeriodo)}</p>
                  {totalSemLucro > 0 && <p style={{ color: '#ffc800', fontSize: 11 }}>{totalSemLucro} venda(s) sem lucro preenchido</p>}
                  <button onClick={() => setPainelLucro(!painelLucro)}
                    style={{ marginTop: 6, background: painelLucro ? '#25D366' : 'rgba(37,211,102,0.12)', border: '1px solid #25D366', color: painelLucro ? 'white' : '#25D366', fontWeight: 700, borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>
                    {painelLucro ? '✓ Fechar' : '✏️ Preencher lucro'}
                  </button>
                </div>
              </div>
            </div>

            {painelLucro && (() => {
              const fechadas = clientesPeriodo.filter(c => c.status === 'Venda Fechada')
                .sort((a, b) => (a.lucro == null ? 0 : 1) - (b.lucro == null ? 0 : 1))
              return (
                <div style={{ background: '#0f0f0f', border: '1px solid #1f5c37', borderRadius: 14, padding: 14, marginBottom: 20 }}>
                  <p style={{ color: '#25D366', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>💰 Lucro das vendas fechadas</p>
                  <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>Preencha e toque em Salvar. O total soma no "Lucro no período".</p>
                  {fechadas.length === 0 ? (
                    <p style={{ color: '#555', textAlign: 'center', padding: 16 }}>Nenhuma venda fechada no período</p>
                  ) : fechadas.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #1a1a1a', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <p style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{c.nome}</p>
                        <p style={{ color: '#888', fontSize: 12 }}>{c.modelo || '-'} · {fmt(c.valor_aparelho)} · {new Date(c.created_at).toLocaleDateString('pt-BR')}{c.vendedor ? ' · ' + c.vendedor : ''}</p>
                        {c.lucro == null && <p style={{ color: '#ffc800', fontSize: 11 }}>sem lucro</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ ...s.inputPrefix, borderColor: '#1f5c37', width: 150 }}>
                          <span style={{ ...s.prefix, color: '#25D366', padding: '10px 10px' }}>R$</span>
                          <input style={{ ...s.input, borderRadius: '0 10px 10px 0', padding: '10px', fontSize: 16 }} inputMode="decimal" placeholder="0,00"
                            value={valorLucroEdit(c)} onChange={e => setLucrosEdit(prev => ({ ...prev, [c.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && salvarLucro(c)} />
                        </div>
                        <button onClick={() => salvarLucro(c)} disabled={salvandoLucroId === c.id}
                          style={{ background: '#25D366', border: 'none', color: 'white', fontWeight: 700, borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontSize: 13 }}>
                          {salvandoLucroId === c.id ? '...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
            {porVendedor.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#555' }}>Nenhuma negociação no período</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {porVendedor.map((v, i) => {
                  const aberto = vendedorAberto === v.chave
                  return (
                    <div key={v.chave}>
                      <div style={{ ...s.vendedorCard, border: aberto ? '1px solid #ff6600' : '1px solid #1e1e1e' }} onClick={() => setVendedorAberto(aberto ? null : v.chave)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 180, flex: 1 }}>
                          <div style={{ ...s.vendedorPos, background: i === 0 && v.vendido > 0 ? '#ff6600' : '#1a1a1a', color: i === 0 && v.vendido > 0 ? 'white' : '#888' }}>{i + 1}º</div>
                          <div>
                            <p style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>{v.nome}</p>
                            <p style={{ color: '#666', fontSize: 12 }}>{v.lista.length} negociação(ões) · {aberto ? '▲ fechar' : '▼ ver lista'}</p>
                          </div>
                        </div>
                        <div style={s.vendedorStats}>
                          <div style={s.vendedorStat}><span style={{ ...s.vendedorStatNum, color: '#25D366' }}>{v.fechadas}</span><span style={s.vendedorStatLabel}>Fechadas</span></div>
                          <div style={s.vendedorStat}><span style={{ ...s.vendedorStatNum, color: '#ffc800' }}>{v.pendentes}</span><span style={s.vendedorStatLabel}>Andamento</span></div>
                          <div style={s.vendedorStat}><span style={{ ...s.vendedorStatNum, color: '#ff3333' }}>{v.desistiram}</span><span style={s.vendedorStatLabel}>Desistiram</span></div>
                          <div style={s.vendedorStat}><span style={s.vendedorStatNum}>{v.conversao}%</span><span style={s.vendedorStatLabel}>Conversão</span></div>
                          <div style={{ ...s.vendedorStat, minWidth: 110 }}><span style={{ ...s.vendedorStatNum, color: '#ff6600' }}>{fmt(v.vendido)}</span><span style={s.vendedorStatLabel}>Vendido</span></div>
                          <div style={{ ...s.vendedorStat, minWidth: 100 }}><span style={{ ...s.vendedorStatNum, color: '#25D366' }}>{fmt(v.lucro)}</span><span style={s.vendedorStatLabel}>Lucro</span></div>
                          <div style={{ ...s.vendedorStat, minWidth: 100 }}><span style={{ ...s.vendedorStatNum, fontSize: 15 }}>{fmt(v.ticket)}</span><span style={s.vendedorStatLabel}>Ticket médio</span></div>
                        </div>
                      </div>
                      {aberto && (
                        <div style={{ ...s.listaGrid, marginTop: 10 }}>
                          {v.lista.map(c => miniCard(c))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {aba === 'entradas' && (
          <div style={s.content}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h1 style={s.pageTitle}>Entradas</h1>
                <p style={s.pageSubtitle}>Aparelhos que os clientes enviaram pelo catálogo</p>
              </div>
              <div style={s.caixaAvisos}>
                {estadoAviso === 'ligado' ? (
                  <>
                    <p style={{ margin: 0, color: '#25D366', fontWeight: 800, fontSize: 14 }}>🔔 Avisos ligados neste aparelho</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={{ ...s.btnFechar, padding: '8px 12px', fontSize: 13 }} onClick={testarAvisos}>Enviar teste</button>
                      <button style={{ ...s.btnLimpar, padding: '8px 12px', fontSize: 13 }} onClick={desativarAvisos}>Desligar</button>
                    </div>
                  </>
                ) : estadoAviso === 'instalar' ? (
                  <p style={{ margin: 0, color: '#ffb27a', fontSize: 13, lineHeight: 1.5 }}>🔔 Para receber avisos com a tela apagada: no Safari, toque em <b>Compartilhar → Adicionar à Tela de Início</b> e abra a Negociação por esse ícone.</p>
                ) : estadoAviso === 'negado' ? (
                  <p style={{ margin: 0, color: '#ff8a8a', fontSize: 13, lineHeight: 1.5 }}>🔕 As notificações foram bloqueadas. Libere em Ajustes → Notificações → Marcos Magazine.</p>
                ) : estadoAviso === 'sem-suporte' ? (
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Este navegador não aceita notificações.</p>
                ) : (
                  <button style={{ ...s.btnAlterar, padding: '12px 16px', fontSize: 14, width: '100%' }} onClick={ativarAvisos} disabled={estadoAviso === 'verificando'}>
                    🔔 Ativar avisos neste aparelho
                  </button>
                )}
                {msgAviso && <p style={{ margin: '8px 0 0', color: '#ccc', fontSize: 12 }}>{msgAviso}</p>}
              </div>
              <button style={{ ...s.btnAlterar, padding: '10px 18px', fontSize: 14 }} onClick={copiarLinkEntrada}>{linkCopiado ? '✓ Link copiado' : '🔗 Copiar link'}</button>
            </div>
            <div style={s.filtrosRow}>
              {[
                { k: 'Nova', l: `Novas (${entradas.filter(e => e.status === 'Nova').length})` },
                { k: 'Usada', l: 'Usadas' },
                { k: 'Arquivada', l: 'Arquivadas' },
                { k: 'Todas', l: 'Todas' },
              ].map(f => (
                <button key={f.k} style={filtroEntradas === f.k ? s.filtroBtnAtivo : s.filtroBtn} onClick={() => setFiltroEntradas(f.k)}>{f.l}</button>
              ))}
            </div>
            {(() => {
              const lista = filtroEntradas === 'Todas' ? entradas : entradas.filter(e => e.status === filtroEntradas)
              if (lista.length === 0) return (
                <div style={{ textAlign: 'center', padding: 60, color: '#666' }}><p style={{ fontSize: 48 }}>📲</p><p>Nenhuma entrada aqui</p></div>
              )
              return (
                <div style={s.clientesGrid}>
                  {lista.map(e => (
                    <div key={e.id} style={{ ...s.clienteCard, cursor: 'default', border: e.status === 'Nova' ? '1px solid #ff6600' : '1px solid #1e1e1e' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <p style={s.clienteNome}>{e.nome}</p>
                          <p style={s.clienteTel}>📱 {e.telefone}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ ...s.statusBadge, background: e.status === 'Nova' ? 'rgba(255,102,0,0.15)' : e.status === 'Usada' ? 'rgba(37,211,102,0.15)' : 'rgba(136,136,136,0.15)', color: e.status === 'Nova' ? '#ff6600' : e.status === 'Usada' ? '#25D366' : '#888', border: '1px solid ' + (e.status === 'Nova' ? '#ff6600' : e.status === 'Usada' ? '#25D366' : '#444') }}>{e.status}</span>
                          <p style={{ color: '#555', fontSize: 11, marginTop: 6 }}>{new Date(e.created_at).toLocaleDateString('pt-BR')} {new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      {e.interesse && (
                        <div style={s.interesseBox}>
                          <span style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quer comprar</span>
                          <span style={{ color: '#ff6600', fontWeight: 800, fontSize: 16 }}>{e.interesse}</span>
                        </div>
                      )}
                      <p style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 }}>Aparelho de entrada</p>
                      <p style={{ color: 'white', fontWeight: 700, fontSize: 16, marginTop: 2 }}>{e.modelo} {e.armazenamento}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={s.tagEntrada}>{e.estado}</span>
                        {e.bateria != null && <span style={{ ...s.tagEntrada, color: e.bateria < 80 ? '#ffc800' : '#ccc' }}>🔋 {e.bateria}%</span>}
                        {e.possui_defeito
                          ? <span style={{ ...s.tagEntrada, background: 'rgba(255,51,51,0.15)', color: '#ff4444', border: '1px solid #ff3333' }}>Com defeito</span>
                          : <span style={{ ...s.tagEntrada, color: '#25D366' }}>Sem defeito</span>}
                      </div>
                      {e.possui_defeito && e.defeito && <p style={{ color: '#ff6666', fontSize: 14, marginTop: 8 }}>⚠ {e.defeito}</p>}
                      {e.acessorios && e.acessorios.length > 0 && <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>Acompanha: {e.acessorios.join(', ')}</p>}
                      {e.fotos && e.fotos.length > 0 && (
                        <>
                          <p style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>📷 Fotos do aparelho ({e.fotos.length})</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
                            {e.fotos.map((f, i) => (
                              <div key={i} onClick={() => setZoomFotos({ fotos: e.fotos!, i })} style={{ cursor: 'pointer', textAlign: 'center' }}>
                                <img src={f.url} alt={f.lado} style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 8, border: '1px solid #2a2a2a', display: 'block' }} />
                                <span style={{ color: '#777', fontSize: 9 }}>{f.lado}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                        <button style={{ ...s.btnAlterar, padding: '10px 14px', fontSize: 13, flex: 2 }} onClick={() => usarEntrada(e)}>Usar na negociação</button>
                        <button style={{ ...s.btnFechar, padding: '10px 14px', fontSize: 13, flex: 1 }} onClick={() => whatsAppEntrada(e)}>WhatsApp</button>
                        {e.status === 'Arquivada'
                          ? <button style={{ ...s.btnLimpar, padding: '10px 14px', fontSize: 13 }} onClick={() => alterarStatusEntrada(e.id, 'Nova')}>Reabrir</button>
                          : <button style={{ ...s.btnLimpar, padding: '10px 14px', fontSize: 13 }} onClick={() => alterarStatusEntrada(e.id, 'Arquivada')}>Arquivar</button>}
                        <button style={{ ...s.btnExcluir, padding: '10px 14px', fontSize: 13 }} onClick={() => excluirEntrada(e)} aria-label="Excluir avaliação">🗑️ Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
        {aba === 'admin' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>Admin — Aparelhos</h1>
            <p style={s.pageSubtitle}>Cadastre modelos com cores disponíveis</p>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>{aparelhoEditandoId ? '✏️ Editando Aparelho' : '➕ Novo Aparelho'}</h3>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Modelo</label>
                <input style={s.input} value={adminModelo} onChange={e => setAdminModelo(e.target.value)} placeholder="Ex: iPhone 17 128GB" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Cores disponíveis — toque para selecionar</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                  {CORES_LISTA.map(c => {
                    const sel = adminCoresSelecionadas.includes(c.nome)
                    const ativa = adminCorAtiva === c.nome
                    const temFoto = (adminFotos[c.nome] || []).length > 0
                    return (
                      <div key={c.nome} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                        onClick={() => { toggleCorAdmin(c.nome); setAdminCorAtiva(c.nome) }}>
                        <div style={{ position: 'relative', width: 40, height: 40 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.hex, border: ativa ? '3px solid #ff6600' : sel ? '3px solid #25D366' : '3px solid transparent', outline: c.nome === 'Branco' ? '1px solid #444' : 'none', boxShadow: ativa ? '0 0 0 2px rgba(255,102,0,0.3)' : 'none', transition: 'all 0.2s' }} />
                          {temFoto && (
                            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700 }}>✓</div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: ativa ? '#ff6600' : sel ? '#25D366' : '#555', textAlign: 'center', maxWidth: 56 }}>{c.nome}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {adminCorAtiva && adminCoresSelecionadas.includes(adminCorAtiva) && (
                <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <p style={{ color: '#ff6600', fontWeight: 700, marginBottom: 12 }}>📷 Fotos — {adminCorAtiva}</p>
                  <label style={{ display: 'block', border: '2px dashed #333', borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', color: '#666', marginBottom: 12 }}>
                    Toque para adicionar fotos
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                      const files = Array.from(e.target.files || [])
                      files.forEach(f => {
                        const reader = new FileReader()
                        reader.onload = ev => {
                          setAdminFotos(prev => ({ ...prev, [adminCorAtiva!]: [...(prev[adminCorAtiva!] || []), ev.target!.result as string] }))
                        }
                        reader.readAsDataURL(f)
                      })
                      e.target.value = ''
                    }} />
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {(adminFotos[adminCorAtiva] || []).map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '2px solid #333' }} />
                        <button onClick={() => setAdminFotos(prev => ({ ...prev, [adminCorAtiva!]: prev[adminCorAtiva!].filter((_, j) => j !== i) }))}
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ff3333', border: 'none', color: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                {aparelhoEditandoId && (
                  <button onClick={() => { setAdminModelo(''); setAdminCoresSelecionadas([]); setAdminCorAtiva(null); setAdminFotos({}); setAparelhoEditandoId(null) }}
                    style={{ ...s.btnLimpar, flex: 1 }}>Cancelar</button>
                )}
                <button onClick={salvarAparelho} disabled={adminSalvando}
                  style={{ ...s.btnFechar, flex: 2, padding: 16, fontSize: 16 }}>
                  {adminSalvando ? 'Salvando...' : aparelhoEditandoId ? '✅ Atualizar' : '✅ Salvar Aparelho'}
                </button>
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Aparelhos Cadastrados ({aparelhos.length})</h3>
              {aparelhos.length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center', padding: 20 }}>Nenhum aparelho cadastrado ainda</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {aparelhos.map(a => (
                    <div key={a.id} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <p style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{a.modelo}</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => editarAparelho(a)} style={{ ...s.btnAlterar, padding: '8px 14px', fontSize: 13 }}>✏️ Editar</button>
                          <button onClick={() => excluirAparelho(a.id)} style={{ ...s.btnExcluir, padding: '8px 14px', fontSize: 13 }}>🗑️</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {a.cores.map((cor: string) => (
                          <div key={cor} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1a1a1a', borderRadius: 20, padding: '4px 10px' }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: CORES_HEX[cor] || '#888', border: cor === 'Branco' ? '1px solid #555' : 'none', flexShrink: 0 }} />
                            <span style={{ color: '#aaa', fontSize: 12 }}>{cor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const base: Record<string, React.CSSProperties> = {
  listaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  page: { minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'Poppins, sans-serif', display: 'flex', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 150 },
  sidebar: { position: 'fixed', top: 0, width: 260, height: '100vh', background: '#0a0a0a', borderRight: '1px solid #1a1a1a', zIndex: 200, padding: '30px 0', transition: 'left 0.3s ease' },
  sidebarLogo: { padding: '0 20px 25px', borderBottom: '1px solid #1a1a1a', marginBottom: 10 },
  navItem: { padding: '14px 20px', cursor: 'pointer', fontSize: 16, color: '#ccc' },
  navAtivo: { color: '#ff6600', fontWeight: 700, background: 'rgba(255,102,0,0.07)' },
  header: { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', background: '#080808', borderBottom: '1px solid #1a1a1a', position: 'sticky', top: 0, zIndex: 100 },
  hamburger: { border: 'none', background: 'none', color: '#ff6600', fontSize: 28, cursor: 'pointer' },
  logo: { lineHeight: 1, marginRight: 'auto' },
  logoM: { color: '#ff6600', fontSize: 28, fontWeight: 900, fontFamily: 'Nunito, sans-serif', display: 'block' },
  logoMag: { color: '#ff6600', fontSize: 13, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'right', opacity: 0.85 },
  abas: { display: 'flex', gap: 8, overflowX: 'auto' },
  abaAtiva: { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#ff6600', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  abaInativa: { padding: '10px 18px', borderRadius: 10, border: '1px solid #333', background: 'none', color: '#888', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  caixaAvisos: { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 14, padding: 12, minWidth: 0, flex: '1 1 260px', maxWidth: 420 },
  avisoEntrada: { position: 'fixed', top: 12, left: '50%', transform: 'translate(-50%, 0)', zIndex: 3000, width: 'min(560px, calc(100vw - 24px))', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 16px', borderRadius: 18, background: 'linear-gradient(135deg, #ff6600, #e04e00)', boxShadow: '0 14px 40px rgba(255,102,0,0.35)', animation: 'mmDesce .35s ease' },
  avisoVer: { padding: '10px 16px', borderRadius: 12, border: 'none', background: '#fff', color: '#ff6600', fontWeight: 800, fontSize: 14, cursor: 'pointer' },
  avisoFechar: { width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.2)', color: '#fff', cursor: 'pointer' },
  zoomFundo: { position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 },
  zoomBtn: { padding: '10px 16px', borderRadius: 12, border: '1px solid #444', background: '#1a1a1a', color: '#fff', fontSize: 14, cursor: 'pointer' },
  badgeNovas: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#ff6600', color: 'white', fontSize: 11, fontWeight: 800, marginLeft: 6 },
  content: { padding: '28px 20px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  pageTitle: { fontSize: 28, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', marginBottom: 6 },
  pageSubtitle: { color: '#666', fontSize: 14, marginBottom: 28 },
  section: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 },
  formGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  formGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  label: { display: 'block', color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0a0a0a', color: 'white', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  inputPrefix: { display: 'flex', alignItems: 'center', border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#0a0a0a' },
  prefix: { padding: '13px 14px', color: '#ff6600', fontWeight: 700, background: '#111', borderRight: '1px solid #2a2a2a', whiteSpace: 'nowrap' },
  resumoBox: { background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.3)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  resumoLabel: { color: '#ff6600', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 },
  resumoValor: { color: '#ff6600', fontSize: 24, fontWeight: 900 },
  parcelasGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  parcelaCard: { background: '#0a0a0a', borderRadius: 10, padding: '12px 16px', cursor: 'pointer' },
  parcelaAtiva: { background: 'rgba(255,102,0,0.1)' },
  resumoFinal: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 },
  resumoItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  resumoItemLabel: { color: '#666', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  resumoItemValor: { color: 'white', fontSize: 18, fontWeight: 700 },
  botoesRow: { display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 8, marginBottom: 40, flexWrap: 'wrap' },
  btnLimpar: { padding: '13px 20px', borderRadius: 12, border: '1px solid #333', background: 'none', color: '#888', cursor: 'pointer', fontSize: 15, whiteSpace: 'nowrap' },
  btnPendente: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#ffc800', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnFechar: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#25D366', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnAlterar: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#ff6600', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnDesistiram: { padding: '14px 24px', borderRadius: 12, border: '1px solid #ff3333', background: '#3a0000', color: '#ff6666', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnBack: { padding: '10px 18px', borderRadius: 10, border: '1px solid #333', background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14 },
  btnExcluir: { padding: '14px 24px', borderRadius: 12, border: '1px solid #ff3333', background: '#7a1111', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  erro: { color: '#ff4444', fontSize: 12, marginTop: 4 },
  filtrosRow: { display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  filtroBtn: { padding: '8px 18px', borderRadius: 20, border: '1px solid #333', background: 'none', color: '#888', cursor: 'pointer', fontSize: 14 },
  filtroBtnAtivo: { padding: '8px 18px', borderRadius: 20, border: '1px solid #ff6600', background: 'rgba(255,102,0,0.15)', color: '#ff6600', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  buscaIcone: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' },
  buscaLimpar: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#222', color: '#aaa', fontSize: 18, cursor: 'pointer', lineHeight: 1 },
  clientesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  clienteCard: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, cursor: 'pointer' },
  clienteNome: { fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 },
  clienteModelo: { fontSize: 14, color: '#aaa', marginBottom: 4 },
  clienteTel: { fontSize: 13, color: '#666' },
  statusBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  interesseBox: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.35)' },
  tagEntrada: { padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#1a1a1a', color: '#ccc', border: '1px solid #2a2a2a' },
  entradaBanner: { display: 'flex', alignItems: 'flex-start', gap: 16, background: 'rgba(255,102,0,0.08)', border: '1px solid #ff6600', borderRadius: 16, padding: 18, marginBottom: 20 },
  detalheContainer: { padding: '28px 20px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' },
  detalheTitle: { fontSize: 28, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', marginBottom: 24 },
  detalheGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  detalheCard: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 16 },
  detalheLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detalheValor: { color: 'white', fontSize: 16, fontWeight: 600 },
  sugestoesBox: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: 10, zIndex: 50, overflow: 'hidden' },
  sugestaoItem: { padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' },
  relGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 },
  relCard: { background: '#0f0f0f', borderRadius: 16, padding: 28, textAlign: 'center' },
  relIcon: { fontSize: 40, marginBottom: 12 },
  relNumero: { fontSize: 56, fontWeight: 900, color: 'white', fontFamily: 'Nunito, sans-serif', lineHeight: 1, marginBottom: 8 },
  relLabel: { color: '#888', fontSize: 14, fontWeight: 600 },
  vendedorCard: { background: '#0f0f0f', borderRadius: 14, padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  vendedorPos: { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 },
  vendedorStats: { display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' },
  vendedorStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 },
  vendedorStatNum: { color: 'white', fontWeight: 900, fontSize: 18 },
  vendedorStatLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
}
