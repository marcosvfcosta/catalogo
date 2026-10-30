import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import VitrineHero from './components/VitrineHero'

// ─── Tipos ─────────────────────────────────────────
type Produto = {
  id: string
  categoria: string
  marca: string
  modelo: string
  memoria?: string
  cor?: string
  condicao?: string
  bateria_saude?: string
  descricao?: string
  foto_url?: string
  foto_cor?: string | null
  disponivel?: boolean
  destaque?: boolean
  lancamento?: boolean
  promocao?: boolean
  mais_procurado?: boolean
  preco?: number | null
  preco_antigo?: number | null
  mostrar_preco?: boolean | null
  tipo?: string | null
  compativel?: string[] | null
  conector?: string | null
}

type ModeloCelular = { id: string; marca: string; modelo: string; entrada?: string | null; foto_url?: string | null }

type Banner = {
  id: string
  url: string
  ordem: number
  ativo: boolean
  etiqueta?: string | null
  titulo?: string | null
  subtitulo?: string | null
  produto_id?: string | null
  arte?: boolean | null
}

type FiltroEspecial = 'destaques' | 'lancamentos' | 'promocoes' | 'mais_procurados' | 'todos' | null

// ─── Dados fixos da loja ───────────────────────────
const WHATSAPP = '5564993374281'
const PARCELAS = 18

// ─── Visual do catálogo ───
// true  = visual "Vitrine" (parede cinza, prateleiras de acrílico)
// false = visual antigo (branco, estilo iPlace). Para voltar, é só trocar para false e publicar.
const TEMA_VITRINE = true
const CLASSE_TEMA = TEMA_VITRINE ? ' tema-vitrine' : ''
const STORAGE = 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public'
const CHAVE_SACOLA = 'mm-sacola'
const DESCONTO_KIT = 0.1 // 10% de desconto no kit

// Grupos de acessório na busca por modelo
const GRUPOS_ACESSORIO = [
  { id: 'capa', nome: 'Capas', tipos: ['capa'] },
  { id: 'pelicula', nome: 'Películas', tipos: ['pelicula'] },
  { id: 'carregador', nome: 'Carregadores e cabos', tipos: ['carregador', 'cabo'] },
  { id: 'fone', nome: 'Fones', tipos: ['fone'] },
]
const CHIPS_ACESSORIO = [
  { id: '', nome: 'Tudo' }, { id: 'capa', nome: 'Capa' }, { id: 'pelicula', nome: 'Película' },
  { id: 'carregador', nome: 'Carregador' }, { id: 'fone', nome: 'Fone' },
]

type ItemVitrine = { nome: string; img: string | null; capas?: boolean; padrao?: boolean }

// Usadas só se as tabelas do Admin (🏷 Vitrine) ainda estiverem vazias
const CATEGORIAS_PADRAO: ItemVitrine[] = [
  { nome: 'Celulares',    img: `${STORAGE}/categorias/celulares.png` },
  { nome: 'Capas',        img: `${STORAGE}/categorias/capas.png`, capas: true },
  { nome: 'Tablet',       img: `${STORAGE}/categorias/tablet.png` },
  { nome: 'Carregadores', img: `${STORAGE}/categorias/carregadores%20(1).png` },
  { nome: 'Fones',        img: `${STORAGE}/categorias/fones.png` },
  { nome: 'Smartwatch',   img: `${STORAGE}/categorias/smartwatch%20(1).png` },
  { nome: 'Caixa de som', img: `${STORAGE}/categorias/caixasom%20(1).png` },
]

const MARCAS_PADRAO: ItemVitrine[] = [
  { nome: 'Apple',    img: `${STORAGE}/marcas/apple.png` },
  { nome: 'Samsung',  img: `${STORAGE}/marcas/samsung.png` },
  { nome: 'Xiaomi',   img: `${STORAGE}/marcas/xiaomi%20(1).png` },
  { nome: 'Motorola', img: `${STORAGE}/marcas/motorola.png` },
  { nome: 'Realme',   img: `${STORAGE}/marcas/realme%20(2).png` },
]

const CORES_HEX: Record<string, string> = {
  preto: '#1d1d1f', branco: '#f5f5f5', azul: '#3b6fd8', verde: '#3e9b6a', vermelho: '#d0312d', rosa: '#f4a7b9',
  roxo: '#7b4bb3', lilas: '#c8a2c8', amarelo: '#f5d04c', laranja: '#ff7a1a', cinza: '#8e8e93', prata: '#d9d9de',
  dourado: '#d4b26a', grafite: '#3a3a3c', 'titanio natural': '#8a8272', 'titanio preto': '#2d2926',
  'titanio branco': '#e8e4dc', 'titanio deserto': '#c2a882', 'meia-noite': '#1c2340', estelar: '#f0ece2',
  'azul-sierra': '#4a7fa5', 'verde-agua': '#00b4d8', cobre: '#b87333', bordo: '#6d1a2a',
}

// iPad (inclusive iPadOS 13+, que se identifica como Mac com tela de toque)
const ehIpad = typeof navigator !== 'undefined' && (
  /iPad/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
)

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const mesmaMarca = (a?: string | null, b?: string | null) => !!a && !!b && semAcento(a) === semAcento(b)

// Tira o fundo branco (e as bordinhas brancas) das fotos das categorias na parede cinza.
// Apaga só o branco que encosta na borda da foto, então partes brancas do produto ficam.
const cacheSemBranco: Record<string, string> = {}
function FotoSemFundoBranco({ src }: { src: string }) {
  const [url, setUrl] = useState(cacheSemBranco[src] || '')
  useEffect(() => {
    if (cacheSemBranco[src]) { setUrl(cacheSemBranco[src]); return }
    let vivo = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const esc = Math.min(1, 500 / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * esc)), h = Math.max(1, Math.round(img.naturalHeight * esc))
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw 0
        ctx.drawImage(img, 0, 0, w, h)
        const d = ctx.getImageData(0, 0, w, h), px = d.data
        const claro = (i: number) => px[i + 3] < 30 || (px[i] > 222 && px[i + 1] > 222 && px[i + 2] > 222)
        const visto = new Uint8Array(w * h), fila: number[] = []
        for (let x = 0; x < w; x++) { fila.push(x, (h - 1) * w + x) }
        for (let y = 0; y < h; y++) { fila.push(y * w, y * w + w - 1) }
        while (fila.length) {
          const k = fila.pop()!
          if (visto[k]) continue
          visto[k] = 1
          if (!claro(k * 4)) continue
          px[k * 4 + 3] = 0
          const x = k % w, y = (k - x) / w
          if (x > 0) fila.push(k - 1); if (x < w - 1) fila.push(k + 1)
          if (y > 0) fila.push(k - w); if (y < h - 1) fila.push(k + w)
        }
        // suaviza a borda: pixel claro vizinho de transparente fica meio transparente
        for (let k = 0; k < w * h; k++) {
          if (px[k * 4 + 3] === 0) continue
          const x = k % w
          const viz = [k - 1, k + 1, k - w, k + w].some(n => n >= 0 && n < w * h && Math.abs((n % w) - x) <= 1 && px[n * 4 + 3] === 0)
          if (viz && px[k * 4] > 190 && px[k * 4 + 1] > 190 && px[k * 4 + 2] > 190) px[k * 4 + 3] = 90
        }
        ctx.putImageData(d, 0, 0)
        // recorta a sobra transparente, assim o produto encosta na prateleira
        let x0 = w, y0 = h, x1 = -1, y1 = -1
        for (let k = 0; k < w * h; k++) if (px[k * 4 + 3] > 20) { const x = k % w, y = (k - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
        let saida = c
        if (x1 > x0 && y1 > y0) {
          saida = document.createElement('canvas'); saida.width = x1 - x0 + 1; saida.height = y1 - y0 + 1
          saida.getContext('2d')?.drawImage(c, x0, y0, saida.width, saida.height, 0, 0, saida.width, saida.height)
        }
        saida.toBlob(b => { if (!b || !vivo) return; cacheSemBranco[src] = URL.createObjectURL(b); setUrl(cacheSemBranco[src]) }, 'image/png')
      } catch { if (vivo) { cacheSemBranco[src] = src; setUrl(src) } }
    }
    img.onerror = () => { if (vivo) setUrl(src) }
    img.src = src
    return () => { vivo = false }
  }, [src])
  return url ? <img src={url} alt="" /> : <img src={src} alt="" style={{ opacity: 0 }} />
}

function coresDoProduto(cor?: string) {
  if (!cor) return []
  return cor.split(/[,/;]| e /).map(c => c.trim()).filter(Boolean).slice(0, 5)
    .map(nome => ({ nome, hex: CORES_HEX[semAcento(nome)] || CORES_HEX[semAcento(nome).split(' ')[0]] || '#cfcfd4' }))
}

function abrirWhatsApp(texto: string) {
  window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${encodeURIComponent(texto)}`, '_blank')
}

const nomeCompleto = (p: Produto) => [p.marca === 'Apple' ? '' : p.marca, p.modelo, p.memoria].filter(Boolean).join(' ')

// Link do produto com prévia (foto) no WhatsApp
function linkProduto(p: Produto, cor?: string | null) {
  return `${window.location.origin}/api/p?id=${p.id}${cor ? `&cor=${encodeURIComponent(cor)}` : ''}`
}

function textoInteresse(p: Produto, cor?: string | null) {
  const cupom = cupomVale(p) ? `\n\n🎟 Cupom *#${CUPOM!.codigo}* (${CUPOM!.pct}%): de ${reais(p.preco || 0)} por *${reais(precoFinal(p))}*` : ''
  return `Olá! Tenho interesse no ${nomeCompleto(p)}${cor ? ` na cor ${cor}` : ''} que vi no catálogo da Marcos Magazine.\n${linkProduto(p, cor)}${cupom}`
}

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Preço só aparece se tiver valor e (for acessório ou estiver marcado "mostrar preço")
function precoVisivel(p: Produto) {
  return !!p.preco && p.preco > 0 && (!!p.tipo || !!p.mostrar_preco)
}
const temDesconto = (p: Produto) => precoVisivel(p) && !!p.preco_antigo && p.preco_antigo > (p.preco || 0)

// ─── Cupom do cliente (vem no link do WhatsApp: ?cupom=JOAO10) ───
type Cupom = { codigo: string; pct: number; validade: string }
const CHAVE_CUPOM = 'mm-cupom'
let CUPOM: Cupom | null = null // atualizado a cada render do App
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
function lerCupom(): Cupom | null {
  try { const c = JSON.parse(localStorage.getItem(CHAVE_CUPOM) || 'null'); return c?.codigo && c.validade >= hojeISO() ? c : null } catch { return null }
}
// Cupom vale só em acessórios com preço
const cupomVale = (p: Produto) => !!CUPOM && !!p.tipo && precoVisivel(p)
const precoFinal = (p: Produto) => cupomVale(p) ? Math.round((p.preco || 0) * (1 - CUPOM!.pct / 100) * 100) / 100 : (p.preco || 0)

function PrecoProduto({ p, grande = false }: { p: Produto; grande?: boolean }) {
  if (!precoVisivel(p)) return null
  if (cupomVale(p)) {
    const de = temDesconto(p) ? (p.preco_antigo || 0) : (p.preco || 0)
    return (
      <div className={grande ? 'mm-preco mm-preco-grande' : 'mm-preco'}>
        <span className="mm-preco-de"><s>{reais(de)}</s><em className="mm-tag-cupom">#{CUPOM!.codigo} -{CUPOM!.pct}%</em></span>
        <b className="mm-preco-cupom">{reais(precoFinal(p))}</b>
      </div>
    )
  }
  const pct = temDesconto(p) ? Math.round((1 - (p.preco || 0) / (p.preco_antigo || 1)) * 100) : 0
  return (
    <div className={grande ? 'mm-preco mm-preco-grande' : 'mm-preco'}>
      {pct > 0 && <span className="mm-preco-de"><s>{reais(p.preco_antigo || 0)}</s><em>-{pct}%</em></span>}
      <b>{reais(p.preco || 0)}</b>
    </div>
  )
}

// Acessório serve no celular escolhido?
function serveNoCelular(p: Produto, m: ModeloCelular) {
  if (!p.tipo) return false
  if (p.tipo === 'capa' || p.tipo === 'pelicula') return (p.compativel || []).includes(m.id)
  if (!p.conector || p.conector === 'Bluetooth' || !m.entrada) return true
  return p.conector === m.entrada
}

// Guarda a última versão do catálogo no aparelho → abre na hora, sem piscar a tela padrão
const CHAVE_CACHE = 'mm-cache-v1'
type CacheCatalogo = { produtos: Produto[]; banners: Banner[]; categorias: ItemVitrine[] | null; marcas: ItemVitrine[] | null; modelos: ModeloCelular[] }
function lerCache(): CacheCatalogo | null {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_CACHE) || 'null'); return v && Array.isArray(v.produtos) ? v : null } catch { return null }
}
const CACHE = typeof window !== 'undefined' ? lerCache() : null

function lerSacola(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_SACOLA) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}

// ─── Ícones ────────────────────────────────────────
const IconeMenu = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
const IconeBusca = () => (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
const IconeSacola = ({ tamanho = 26 }: { tamanho?: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </svg>
)
const IconeVs = ({ tamanho = 22 }: { tamanho?: number }) => (
  <svg width={tamanho * 1.45} height={tamanho} viewBox="0 0 32 22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1" y="2" width="9" height="18" rx="2.2" /><rect x="22" y="2" width="9" height="18" rx="2.2" />
    <text x="16" y="14.5" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="currentColor" stroke="none" fontFamily="Poppins, Arial, sans-serif">VS</text>
  </svg>
)
const IconeWhats = ({ tamanho = 20 }: { tamanho?: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z" /></svg>
)

function App() {
  const navigate = useNavigate()
  const [produtos, setProdutos] = useState<Produto[]>(CACHE?.produtos || [])
  const [banners, setBanners] = useState<Banner[]>(CACHE?.banners || [])
  const [categorias, setCategorias] = useState<ItemVitrine[]>(CACHE?.categorias || [])
  const [marcas, setMarcas] = useState<ItemVitrine[]>(CACHE?.marcas || [])
  const [carregando, setCarregando] = useState(!CACHE)
  const [menuAberto, setMenuAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  const [marcaAtiva, setMarcaAtiva] = useState<string | null>(null)
  const [filtroEspecial, setFiltroEspecial] = useState<FiltroEspecial>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [selecionado, setSelecionado] = useState<Produto | null>(null)
  const [fotosDetalhe, setFotosDetalhe] = useState<{ url: string; cor: string | null }[]>([])
  const [corEscolhida, setCorEscolhida] = useState<string | null>(null)
  const galeriaRef = useRef<HTMLDivElement>(null)
  const [fotoIndex, setFotoIndex] = useState(0)
  const [sacola, setSacola] = useState<string[]>(lerSacola)
  const [sacolaAberta, setSacolaAberta] = useState(false)
  const [aviso, setAviso] = useState('')
  const [modelos, setModelos] = useState<ModeloCelular[]>(CACHE?.modelos || [])
  const [cupom, setCupom] = useState<Cupom | null>(lerCupom)
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [erroCupom, setErroCupom] = useState('')
  CUPOM = cupom && cupom.validade >= hojeISO() ? cupom : null
  const [meuCelular, setMeuCelular] = useState<ModeloCelular | null>(null)
  const [textoCelular, setTextoCelular] = useState('')
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [grupoAcessorio, setGrupoAcessorio] = useState('')
  const campoCelularRef = useRef<HTMLInputElement>(null)
  const [categoriaAcesa, setCategoriaAcesa] = useState<string | null>(null)
  const toqueInicio = useRef<number | null>(null)
  const topoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('produtos_catalogo').select('*').order('created_at', { ascending: false }),
      supabase.from('hero_imagens').select('*').eq('ativo', true).order('ordem', { ascending: true }),
      supabase.from('catalogo_categorias').select('*').eq('ativo', true).order('ordem'),
      supabase.from('catalogo_marcas').select('*').eq('ativo', true).order('ordem'),
      supabase.from('capas_modelos').select('*').order('ordem').order('modelo'),
    ]).then(([p, h, c, m, cm]) => {
      const novosModelos = (cm.data || []) as ModeloCelular[]
      const cats = (c.data || []) as { nome: string; foto_url: string | null; tipo: string }[]
      const novasCategorias = cats.length ? cats.map(x => ({ nome: x.nome, img: x.foto_url, capas: x.tipo === 'capas' })) : CATEGORIAS_PADRAO
      const mrs = (m.data || []) as { nome: string; logo_url: string | null }[]
      const novasMarcas = mrs.length ? mrs.map(x => ({ nome: x.nome, img: x.logo_url, padrao: !!x.logo_url && x.logo_url.includes('/logo_') })) : MARCAS_PADRAO
      const novosProdutos = ((p.data || []) as Produto[]).filter(x => x.disponivel !== false)
      const novosBanners = (h.data || []) as Banner[]
      const falhou = !!p.error
      if (!falhou || !CACHE) {
        setModelos(novosModelos); setCategorias(novasCategorias); setMarcas(novasMarcas)
        setProdutos(novosProdutos); setBanners(novosBanners)
      }
      setCarregando(false)
      if (!falhou) {
        try {
          localStorage.setItem(CHAVE_CACHE, JSON.stringify({ produtos: novosProdutos, banners: novosBanners, categorias: novasCategorias, marcas: novasMarcas, modelos: novosModelos }))
        } catch { /* sem espaço: tudo bem */ }
      }
      try {
        const q = new URLSearchParams(window.location.search)
        // Link do retorno: /?celular=ID&tipo=capa → abre os acessórios daquele celular
        const celularId = q.get('celular')
        const alvoCel = celularId ? novosModelos.find(x => x.id === celularId) : undefined
        if (alvoCel) {
          try { window.history.replaceState({}, '', window.location.pathname) } catch { /* ok */ }
          escolherCelular(alvoCel, q.get('tipo') || '')
        }
        const id = q.get('produto')
        if (id) {
          const alvo = ((p.data || []) as Produto[]).find(x => x.id === id)
          try { window.history.replaceState({}, '', window.location.pathname) } catch { /* ok */ }
          if (alvo) abrirProduto(alvo, q.get('cor'))
        }
      } catch { /* ok */ }
    })
  }, [])

  useEffect(() => {
    try { localStorage.setItem(CHAVE_SACOLA, JSON.stringify(sacola)) } catch { /* sem armazenamento */ }
  }, [sacola])

  // Cupom: do link (?cupom=X) ou o que já estava salvo → confere se ainda vale
  useEffect(() => {
    let codigo = ''
    try { codigo = new URLSearchParams(window.location.search).get('cupom') || '' } catch { /* ok */ }
    if (codigo) aplicarCupom(codigo, true)
    else if (cupom) aplicarCupom(cupom.codigo, false, true)
  }, [])

  async function aplicarCupom(codigoBruto: string, avisar = true, silencioso = false) {
    const codigo = codigoBruto.replace('#', '').trim().toUpperCase()
    if (!codigo) return
    setErroCupom('')
    const { data, error } = await supabase.rpc('validar_cupom', { p_codigo: codigo })
    const c = Array.isArray(data) ? data[0] : data
    if (error || !c || !c.pct) {
      if (silencioso) { setCupom(null); try { localStorage.removeItem(CHAVE_CUPOM) } catch { /* ok */ } }
      else setErroCupom('Cupom inválido ou vencido')
      return
    }
    const novo = { codigo, pct: Number(c.pct), validade: String(c.validade) }
    setCupom(novo); setCodigoDigitado('')
    try { localStorage.setItem(CHAVE_CUPOM, JSON.stringify(novo)) } catch { /* ok */ }
    if (avisar) mostrarAviso(`🎟 Cupom #${codigo} ativado: ${novo.pct}% off em acessórios`)
  }

  function tirarCupom() {
    setCupom(null)
    try { localStorage.removeItem(CHAVE_CUPOM) } catch { /* ok */ }
  }

  // Botão "voltar" do celular fecha o produto aberto
  useEffect(() => {
    const aoVoltar = () => { setSelecionado(null); setFotosDetalhe([]) }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  // Carrossel automático
  useEffect(() => {
    if (banners.length < 2 || selecionado) return
    const t = setInterval(() => setHeroIndex(i => (i + 1) % banners.length), 5500)
    return () => clearInterval(t)
  }, [banners.length, heroIndex, selecionado])

  // ─── Sacola ──────────────────────────────────────
  const itensSacola = sacola.map(id => produtos.find(p => p.id === id)).filter(Boolean) as Produto[]
  const naSacola = (id: string) => sacola.includes(id)

  function mostrarAviso(t: string) {
    setAviso(t)
    setTimeout(() => setAviso(''), 1800)
  }

  function alternarSacola(p: Produto) {
    if (naSacola(p.id)) { setSacola(s => s.filter(x => x !== p.id)); mostrarAviso('Removido da sacola') }
    else { setSacola(s => [...s, p.id]); mostrarAviso('✓ Adicionado à sacola') }
  }

  function enviarSacola() {
    if (!itensSacola.length) return
    const lista = itensSacola.map((p, i) => {
      const preco = !precoVisivel(p) ? '' : cupomVale(p) ? ` — ~${reais(p.preco || 0)}~ *${reais(precoFinal(p))}* (cupom)` : ` — ${reais(p.preco || 0)}`
      return `${i + 1}. ${nomeCompleto(p)}${preco}\n${linkProduto(p)}`
    }).join('\n\n')
    const comPreco = itensSacola.filter(precoVisivel)
    const total = comPreco.length > 1 ? `\n\nTotal dos itens com preço: *${reais(comPreco.reduce((t, p) => t + precoFinal(p), 0))}*` : ''
    const linhaCupom = CUPOM && itensSacola.some(cupomVale) ? `\n\n🎟 Cupom: *#${CUPOM.codigo}* (${CUPOM.pct}% em acessórios)` : ''
    abrirWhatsApp(`Olá! Vim pelo catálogo da Marcos Magazine e tenho interesse ${itensSacola.length > 1 ? 'nestes produtos' : 'neste produto'}:\n\n${lista}${total}${linhaCupom}\n\nPode me passar valores e condições?`)
  }

  // ─── Navegação ───────────────────────────────────
  async function abrirProduto(p: Produto, corInicial?: string | null) {
    const capa = p.foto_url ? [{ url: p.foto_url, cor: p.foto_cor || null }] : []
    setSelecionado(p); setFotoIndex(0); setFotosDetalhe(capa); setSacolaAberta(false); setCorEscolhida(corInicial || p.foto_cor || null)
    window.history.pushState({ produto: p.id }, '')
    window.scrollTo(0, 0)
    const r1 = await supabase.from('produto_fotos').select('url, cor').eq('produto_id', p.id).order('ordem')
    const data = r1.error ? (await supabase.from('produto_fotos').select('url').eq('produto_id', p.id).order('ordem')).data : r1.data
    const extras = ((data || []) as { url: string; cor?: string | null }[]).map(f => ({ url: f.url, cor: f.cor || null }))
    const todas = [...capa, ...extras]
    setFotosDetalhe(todas)
    if (corInicial) {
      const i = todas.findIndex(f => f.cor && semAcento(f.cor) === semAcento(corInicial))
      if (i > 0) setTimeout(() => { galeriaRef.current?.scrollTo({ left: i * (galeriaRef.current?.clientWidth || 0) }); setFotoIndex(i) }, 150)
    }
  }

  // Compartilhar: no celular manda a FOTO + nome/preço/link (WhatsApp, Instagram...). No PC copia o texto.
  async function compartilhar(p: Produto) {
    const fotoUrl = fotosDetalhe[fotoIndex]?.url || p.foto_url || ''
    const cor = fotosDetalhe[fotoIndex]?.cor || corEscolhida
    const preco = precoVisivel(p) ? `\n${temDesconto(p) ? `De ~${reais(p.preco_antigo || 0)}~ por ` : ''}*${reais(p.preco || 0)}*` : ''
    const texto = `*${nomeCompleto(p)}*${cor ? ` · ${cor}` : ''}${preco}\n💳 Até ${PARCELAS}x no cartão\n\nVeja no catálogo da Marcos Magazine:\n${linkProduto(p, cor)}`
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    try {
      if (fotoUrl && nav.share) {
        mostrarAviso('Preparando foto...')
        const blob = await (await fetch(fotoUrl)).blob()
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
        const arquivo = new File([blob], `${p.modelo.replace(/[^\w-]+/g, '-')}.${ext}`, { type: blob.type || 'image/jpeg' })
        if (!nav.canShare || nav.canShare({ files: [arquivo] })) {
          await nav.share({ files: [arquivo], text: texto })
          return
        }
      }
      if (nav.share) { await nav.share({ text: texto }); return }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return // a pessoa cancelou
    }
    try { await navigator.clipboard.writeText(texto); mostrarAviso('✓ Texto e link copiados') }
    catch { abrirWhatsApp(texto) }
  }

  // Toca na bolinha → mostra a foto daquela cor
  function escolherCor(nome: string) {
    setCorEscolhida(nome)
    const i = fotosDetalhe.findIndex(f => f.cor && semAcento(f.cor) === semAcento(nome))
    if (i >= 0 && galeriaRef.current) {
      galeriaRef.current.scrollTo({ left: i * galeriaRef.current.clientWidth, behavior: 'smooth' })
      setFotoIndex(i)
    }
  }

  function irParaInicio() {
    limparFiltros(); setMenuAberto(false); setSacolaAberta(false)
    if (selecionado) fecharProduto()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function fecharProduto() {
    if (window.history.state?.produto) window.history.back()
    else { setSelecionado(null); setFotosDetalhe([]) }
  }

  function limparFiltros() {
    setBusca(''); setCategoriaAtiva(null); setMarcaAtiva(null); setFiltroEspecial(null); setMeuCelular(null)
  }

  // ─── Busca por modelo de celular ─────────────────
  function escolherCelular(m: ModeloCelular, grupo = '') {
    setBusca(''); setCategoriaAtiva(null); setMarcaAtiva(null); setFiltroEspecial(null)
    setMeuCelular(m); setGrupoAcessorio(grupo); setTextoCelular(''); setSugestoesAbertas(false)
    campoCelularRef.current?.blur()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function buscarTexto(t: string) {
    if (!t.trim()) return
    setMeuCelular(null); setCategoriaAtiva(null); setMarcaAtiva(null); setFiltroEspecial(null)
    setBusca(t.trim()); setTextoCelular(''); setSugestoesAbertas(false)
    campoCelularRef.current?.blur()
  }

  function abrirBuscaCelular() {
    if (selecionado) fecharProduto()
    limparFiltros()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => { campoCelularRef.current?.focus(); setSugestoesAbertas(true) }, 120)
  }

  const sugestoesCelular = useMemo(() => {
    const palavras = semAcento(textoCelular).split(/\s+/).filter(Boolean)
    if (!palavras.length) return []
    return modelos.filter(m => {
      const alvo = semAcento(`${m.marca} ${m.modelo}`)
      return palavras.every(w => alvo.includes(w))
    }).slice(0, 6)
  }, [modelos, textoCelular])

  const acessoriosDoCelular = useMemo(
    () => meuCelular ? produtos.filter(p => serveNoCelular(p, meuCelular)) : [],
    [produtos, meuCelular])

  function kitDoCelular() {
    const maisBarato = (tipos: string[]) => acessoriosDoCelular
      .filter(p => tipos.includes(p.tipo || '') && precoVisivel(p))
      .sort((a, b) => (a.preco || 0) - (b.preco || 0))[0]
    const itens = [maisBarato(['capa']), maisBarato(['pelicula']), maisBarato(['carregador'])].filter(Boolean) as Produto[]
    if (itens.length < 2) return null
    const soma = itens.reduce((t, p) => t + (p.preco || 0), 0)
    const comDesconto = soma * (1 - DESCONTO_KIT)
    return { itens, soma, preco: comDesconto > 10 ? Math.floor(comDesconto) - 0.1 : Math.round(comDesconto * 100) / 100 }
  }

  function aplicarFiltro(f: { categoria?: string; marca?: string; especial?: FiltroEspecial }) {
    setBusca('')
    setCategoriaAtiva(f.categoria || null)
    setMarcaAtiva(f.marca || null)
    setFiltroEspecial(f.especial || null)
    setMenuAberto(false)
    setTimeout(() => topoRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const filtrando = !meuCelular && !!(busca.trim() || categoriaAtiva || marcaAtiva || filtroEspecial)

  // Telas de Carregadores, Fones, Capas, Películas, Cabos → mostra "Qual é o seu celular?" também
  const grupoDaCategoria = (() => {
    const c = semAcento(categoriaAtiva || '')
    if (!c || marcaAtiva || filtroEspecial || busca.trim()) return null
    if (c.includes('carregador') || c.includes('cabo')) return 'carregador'
    if (c.includes('fone')) return 'fone'
    if (c.includes('pelicula')) return 'pelicula'
    if (c.includes('capa') || c.includes('capinha')) return 'capa'
    return null
  })()
  const mostrarBarraCelular = !filtrando || grupoDaCategoria !== null

  const resultados = useMemo(() => {
    const termo = semAcento(busca)
    return produtos.filter(p => {
      if (termo && !semAcento(`${p.marca} ${p.modelo} ${p.memoria || ''} ${p.categoria} ${p.cor || ''}`).includes(termo)) return false
      if (categoriaAtiva && p.categoria !== categoriaAtiva) return false
      if (marcaAtiva && !mesmaMarca(p.marca, marcaAtiva)) return false
      if (filtroEspecial === 'destaques' && !p.destaque) return false
      if (filtroEspecial === 'lancamentos' && !p.lancamento) return false
      if (filtroEspecial === 'promocoes' && !p.promocao) return false
      if (filtroEspecial === 'mais_procurados' && !p.mais_procurado) return false
      return true
    })
  }, [produtos, busca, categoriaAtiva, marcaAtiva, filtroEspecial])

  // Marcas que existem na categoria escolhida (ex: Celulares → Apple, Samsung, Xiaomi...)
  const marcasDaCategoria = categoriaAtiva
    ? marcas.filter(m => produtos.some(p => p.categoria === categoriaAtiva && mesmaMarca(p.marca, m.nome)))
    : []

  const tituloResultados =
    filtroEspecial === 'destaques' ? 'Destaques' :
    filtroEspecial === 'lancamentos' ? 'Lançamentos' :
    filtroEspecial === 'promocoes' ? 'Promoções' :
    filtroEspecial === 'mais_procurados' ? 'Mais procurados' :
    filtroEspecial === 'todos' ? 'Todos os produtos' :
    categoriaAtiva ? `${categoriaAtiva}${marcaAtiva ? ` ${marcaAtiva}` : ''}` :
    marcaAtiva || `Busca: "${busca.trim()}"`

  // "Todos os produtos" da tela inicial: 8 itens misturados (1 de cada categoria, revezando)
  const vitrineMista = useMemo(() => {
    const grupos = new Map<string, Produto[]>()
    for (const p of produtos) {
      const g = grupos.get(p.categoria) || []
      g.push(p); grupos.set(p.categoria, g)
    }
    // Ordem: categorias do Admin primeiro, depois as outras
    const ordem = [...categorias.map(c => c.nome).filter(n => grupos.has(n)), ...[...grupos.keys()].filter(n => !categorias.some(c => c.nome === n))]
    const lista: Produto[] = []
    for (let i = 0; lista.length < 8; i++) {
      let pegou = false
      for (const nome of ordem) {
        const item = grupos.get(nome)?.[i]
        if (item && lista.length < 8) { lista.push(item); pegou = true }
      }
      if (!pegou) break
    }
    return lista
  }, [produtos, categorias])

  // Abertura "parede de vitrine": até 10 celulares (2 prateleiras) com foto (lançamentos, depois destaques, depois os mais novos)
  const celularesVitrine = useMemo(() => {
    const cel = produtos.filter(p => p.foto_url && semAcento(p.categoria || '').includes('celular'))
    const peso = (p: Produto) => (p.lancamento ? 2 : 0) + (p.destaque ? 1 : 0)
    return [...cel].sort((a, b) => peso(b) - peso(a)).slice(0, 8)
  }, [produtos])
  const itensVitrine = celularesVitrine.map(p => {
    const cor = p.foto_cor || coresDoProduto(p.cor)[0]?.nome || ''
    return {
      id: p.id,
      nome: [p.marca === 'Apple' ? '' : p.marca, p.modelo].filter(Boolean).join(' '),
      foto: p.foto_url!,
      detalhe: p.lancamento ? 'Lançamento' : p.destaque ? 'Destaque da semana' : '',
      cor: CORES_HEX[semAcento(cor)] || cor,
      marca: p.marca,
      specs: [
        p.memoria && { rotulo: 'Memória', valor: p.memoria },
        p.condicao && { rotulo: 'Condição', valor: p.condicao },
        p.bateria_saude && { rotulo: 'Bateria', valor: p.bateria_saude },
        p.cor && { rotulo: 'Cores', valor: coresDoProduto(p.cor).map(c => c.nome).join(', ') },
        { rotulo: 'Pagamento', valor: `Até ${PARCELAS}x no cartão` },
      ].filter(Boolean) as { rotulo: string; valor: string }[],
      preco: precoVisivel(p) ? reais(precoFinal(p)) : undefined,
    }
  })

  const destaques = produtos.filter(p => p.destaque)
  const lancamentos = produtos.filter(p => p.lancamento)
  const promocoes = produtos.filter(p => p.promocao)
  const maisProcurados = produtos.filter(p => p.mais_procurado)

  // ─── Pedaços da tela ─────────────────────────────
  const cartao = (p: Produto, grade = false) => {
    const cores = coresDoProduto(p.cor)
    const selo = p.lancamento ? { t: 'LANÇAMENTO', c: '#1d1d1f' } : (p.promocao || temDesconto(p)) ? { t: 'OFERTA', c: '#e5332a' } : p.mais_procurado ? { t: 'TOP', c: '#ff6600' } : null
    const dentro = naSacola(p.id)
    return (
      <div key={p.id} className={grade ? 'mm-card mm-card-grade' : 'mm-card'} onClick={() => abrirProduto(p)}>
        <div className="mm-card-foto">
          {selo && <span className="mm-selo" style={{ background: selo.c }}>{selo.t}</span>}
          {p.foto_url ? <img src={p.foto_url} alt={p.modelo} loading="lazy" /> : <span className="mm-sem-foto">{p.marca}</span>}
        </div>
        <b className="mm-card-nome">{p.modelo}</b>
        <small className="mm-card-info">{[p.memoria, p.condicao].filter(Boolean).join(' · ') || p.marca}</small>
        <PrecoProduto p={p} />
        <div className="mm-cores">
          {cores.map(c => <i key={c.nome} title={c.nome} style={{ background: c.hex }} />)}
        </div>
        <button className={dentro ? 'mm-btn-sacola dentro' : 'mm-btn-sacola'} onClick={e => { e.stopPropagation(); alternarSacola(p) }}>
          {dentro ? '✓ Na sacola' : <><IconeSacola tamanho={18} /> Adicionar</>}
        </button>
      </div>
    )
  }

  const secao = (titulo: string, lista: Produto[], especial: FiltroEspecial) => lista.length === 0 ? null : (
    <section className="mm-secao">
      <div className="mm-secao-topo">
        <h2>{titulo}</h2>
        {lista.length > 2 && especial && <button className="mm-link" onClick={() => aplicarFiltro({ especial })}>Ver todos ›</button>}
      </div>
      <div className="mm-trilho">{lista.slice(0, 12).map(p => cartao(p))}</div>
    </section>
  )

  const botaoSacolaTopo = (
    <button className="mm-icone mm-icone-sacola" onClick={() => setSacolaAberta(true)} aria-label="Sacola">
      <IconeSacola />
      {sacola.length > 0 && <span className="mm-contagem">{sacola.length}</span>}
    </button>
  )

  const gavetaSacola = sacolaAberta && (
    <>
      <div className="mm-fundo-menu" onClick={() => setSacolaAberta(false)} />
      <div className="mm-gaveta">
        <div className="mm-gaveta-topo">
          <b><IconeSacola tamanho={24} /> Minha sacola</b>
          <button className="mm-icone" onClick={() => setSacolaAberta(false)}>✕</button>
        </div>
        {itensSacola.length === 0 ? (
          <div className="mm-vazio">
            <p>Sua sacola está vazia.</p>
            <p style={{ fontSize: 14 }}>Toque em <b>Adicionar</b> nos produtos que você gostou e depois envie tudo de uma vez pelo WhatsApp.</p>
          </div>
        ) : (
          <>
            <div className="mm-gaveta-lista">
              {itensSacola.map(p => (
                <div key={p.id} className="mm-gaveta-item">
                  <div className="mm-gaveta-foto" onClick={() => abrirProduto(p)}>
                    {p.foto_url ? <img src={p.foto_url} alt="" /> : <span>{p.marca}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => abrirProduto(p)}>
                    <b>{p.modelo}</b>
                    <small>{[p.marca, p.memoria].filter(Boolean).join(' · ')}</small>
                    <PrecoProduto p={p} />
                  </div>
                  <button className="mm-gaveta-remover" onClick={() => setSacola(s => s.filter(x => x !== p.id))} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
            <div className="mm-gaveta-rodape">
              {cupom ? (
                <div className="mm-cupom-ativo">🎟 Cupom <b>#{cupom.codigo}</b> · {cupom.pct}% off em acessórios <button onClick={tirarCupom} aria-label="Tirar cupom">✕</button></div>
              ) : (
                <div className="mm-cupom-campo">
                  <input placeholder="Tem cupom? Digite aqui" value={codigoDigitado} onChange={e => setCodigoDigitado(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && aplicarCupom(codigoDigitado)} />
                  <button onClick={() => aplicarCupom(codigoDigitado)}>Aplicar</button>
                </div>
              )}
              {erroCupom && <small className="mm-cupom-erro">{erroCupom}</small>}
              <button className="mm-btn-verde" onClick={enviarSacola}><IconeWhats /> Enviar pelo WhatsApp ({itensSacola.length})</button>
              <button className="mm-link mm-limpar" onClick={() => setSacola([])}>Esvaziar sacola</button>
            </div>
          </>
        )}
      </div>
    </>
  )

  const avisoFlutuante = aviso && <div className="mm-aviso-flutuante">{aviso}</div>

  // ─── DETALHE DO PRODUTO ──────────────────────────
  if (selecionado) {
    const p = selecionado
    const cores = coresDoProduto(p.cor)
    const dentro = naSacola(p.id)
    const specs = [
      p.memoria && { icone: '💾', nome: 'Memória', valor: p.memoria },
      p.condicao && { icone: '✅', nome: 'Condição', valor: p.condicao },
      p.bateria_saude && { icone: '🔋', nome: 'Bateria', valor: p.bateria_saude },
    ].filter(Boolean) as { icone: string; nome: string; valor: string }[]
    return (
      <div className={'mm' + CLASSE_TEMA}>
        <style>{TEMA_VITRINE ? CSS + CSS_VITRINE : CSS}</style>
        <header className="mm-topo mm-topo-detalhe">
          <button className="mm-voltar" onClick={fecharProduto}>‹ Voltar</button>
          <Logo onClick={irParaInicio} />
          {botaoSacolaTopo}
        </header>
        <main className="mm-detalhe">
          <div className="mm-galeria" ref={galeriaRef}
            onScroll={e => {
              const el = e.currentTarget; const i = Math.round(el.scrollLeft / el.clientWidth); setFotoIndex(i)
              const cor = fotosDetalhe[i]?.cor; if (cor) setCorEscolhida(cor)
            }}>
            {fotosDetalhe.length > 0
              ? fotosDetalhe.map((f, i) => <div key={i} className="mm-galeria-item"><img src={f.url} alt={`${p.modelo} ${f.cor || i + 1}`} /></div>)
              : <div className="mm-galeria-item"><span className="mm-sem-foto mm-sem-foto-grande">{p.marca}</span></div>}
          </div>
          {fotosDetalhe.length > 1 && (
            <div className="mm-pontos">{fotosDetalhe.map((_, i) => <i key={i} className={i === fotoIndex ? 'on' : ''} />)}</div>
          )}
          <div className="mm-detalhe-info">
            <p className="mm-detalhe-marca">{p.marca}</p>
            <div className="mm-nome-linha">
              <h1 className="mm-detalhe-nome">{p.modelo}</h1>
              <button className="mm-compartilhar" onClick={() => compartilhar(p)} aria-label="Compartilhar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
                Enviar
              </button>
            </div>
            <PrecoProduto p={p} grande />
            {cores.length > 0 && (
              <div className="mm-cores mm-cores-grandes">
                {cores.map(c => {
                  const ativa = !!corEscolhida && semAcento(corEscolhida) === semAcento(c.nome)
                  const temFoto = fotosDetalhe.some(f => f.cor && semAcento(f.cor) === semAcento(c.nome))
                  return (
                    <button key={c.nome} className={ativa ? 'mm-cor on' : 'mm-cor'} onClick={() => escolherCor(c.nome)} title={temFoto ? 'Ver esta cor' : c.nome}>
                      <i style={{ background: c.hex }} />{c.nome}
                    </button>
                  )
                })}
              </div>
            )}
            {specs.length > 0 && (
              <div className="mm-specs">
                {specs.map(s => (
                  <div key={s.nome} className="mm-spec"><span>{s.icone}</span><small>{s.nome}</small><b>{s.valor}</b></div>
                ))}
              </div>
            )}
            {p.descricao && <p className="mm-descricao">{p.descricao}</p>}
            <div className="mm-beneficios mm-beneficios-detalhe">
              <div><span>💳</span><p><b>Até {PARCELAS}x</b>no cartão</p></div>
              <div onClick={() => navigate('/entrada')}><span>⇄</span><p><b>Seu usado</b>vale como entrada</p></div>
            </div>
            <button className="mm-btn-contorno" onClick={() => navigate('/comparar')}><span className="mm-com-icone"><IconeVs /> Comparar com outro celular</span></button>
          </div>
        </main>
        <div className="mm-barra-fixa mm-barra-dupla">
          <button className={dentro ? 'mm-btn-contorno mm-btn-sacola-grande dentro' : 'mm-btn-contorno mm-btn-sacola-grande'} onClick={() => alternarSacola(p)}>
            {dentro ? '✓ Na sacola' : <><IconeSacola tamanho={20} /> Sacola</>}
          </button>
          <button className="mm-btn-verde" onClick={() => abrirWhatsApp(textoInteresse(p, corEscolhida))}><IconeWhats /> Tenho interesse</button>
        </div>
        {gavetaSacola}
        {avisoFlutuante}
      </div>
    )
  }

  // ─── CATÁLOGO ────────────────────────────────────
  const banner = banners.length ? banners[heroIndex % banners.length] : null
  const produtoDoBanner = banner?.produto_id ? produtos.find(x => x.id === banner.produto_id) : undefined
  const cliqueBanner = () => {
    if (produtoDoBanner) abrirProduto(produtoDoBanner)
    else abrirWhatsApp(banner?.titulo ? `Olá! Vi o banner "${banner.titulo}" no catálogo e quero saber mais.` : 'Olá! Vim pelo catálogo da Marcos Magazine.')
  }

  return (
    <div className={(sacola.length > 0 ? 'mm mm-com-barra' : 'mm') + CLASSE_TEMA}>
      <style>{TEMA_VITRINE ? CSS + CSS_VITRINE : CSS}</style>

      {/* Menu lateral */}
      {menuAberto && <div className="mm-fundo-menu" onClick={() => setMenuAberto(false)} />}
      <aside className={menuAberto ? 'mm-menu aberto' : 'mm-menu'}>
        <div className="mm-menu-topo"><Logo /><button className="mm-icone" onClick={() => setMenuAberto(false)}>✕</button></div>
        <nav>
          <button onClick={() => { limparFiltros(); setMenuAberto(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>⌂ Início</button>
          <button onClick={() => aplicarFiltro({ categoria: 'Celulares' })}>📱 Celulares</button>
          <button onClick={() => navigate('/comparar')}><span className="mm-com-icone"><IconeVs tamanho={18} /> Comparar celulares</span></button>
          <button onClick={() => navigate('/entrada')}>⇄ Avaliar meu usado</button>
          <button onClick={() => navigate('/capas')}>🛡 Capinhas</button>
          <button onClick={() => { setMenuAberto(false); setSacolaAberta(true) }}>🛍 Minha sacola{sacola.length ? ` (${sacola.length})` : ''}</button>
          {ehIpad && <button className="mm-menu-destaque" onClick={() => navigate('/negociacao')}>💼 Negociação</button>}
          <hr />
          <button onClick={() => aplicarFiltro({ especial: 'destaques' })}>☆ Destaques</button>
          <button onClick={() => aplicarFiltro({ especial: 'lancamentos' })}>🚀 Lançamentos</button>
          <button onClick={() => aplicarFiltro({ especial: 'promocoes' })}>🏷 Promoções</button>
          <button onClick={() => aplicarFiltro({ especial: 'mais_procurados' })}>🔥 Mais procurados</button>
          <hr />
          <button onClick={() => window.open('https://www.google.com/maps/search/Avenida+Goiás+686+Centro+Bom+Jesus+de+Goiás+GO', '_blank')}>📍 Localização</button>
          <button onClick={() => window.open('https://www.instagram.com/marcosmagazinee', '_blank')}>📷 Instagram</button>
          <button onClick={() => abrirWhatsApp('Olá! Vim pelo catálogo da Marcos Magazine.')}>💬 WhatsApp</button>
        </nav>
      </aside>

      {/* Faixa de aviso */}
      {cupom
        ? <div className="mm-aviso mm-aviso-cupom">🎟 Cupom <b>#{cupom.codigo}</b> ativo: <b>{cupom.pct}% off</b> em acessórios até {cupom.validade.split('-').reverse().slice(0, 2).join('/')}</div>
        : <div className="mm-aviso">💳 <b>Parcele em até {PARCELAS}x</b> · ⇄ Aceitamos seu usado</div>}

      {/* Topo */}
      <header className="mm-topo">
        <button className="mm-icone" onClick={() => setMenuAberto(true)} aria-label="Menu"><IconeMenu /></button>
        <Logo onClick={irParaInicio} />
        <button className="mm-icone" onClick={abrirBuscaCelular} aria-label="Buscar"><IconeBusca /></button>
        {botaoSacolaTopo}
      </header>
      {busca && filtrando && (
        <div className="mm-busca">
          <IconeBusca />
          <input autoFocus placeholder="Buscar celular, fone, capinha..." value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button onClick={() => setBusca('')}>✕</button>}
        </div>
      )}

      <div ref={topoRef} style={{ scrollMarginTop: 70 }} />
      {/* ─── Qual é o seu celular? ─── */}
      {mostrarBarraCelular && (
        <div className="mm-qual">
          <div className={sugestoesAbertas && textoCelular ? 'mm-qual-caixa aberta' : 'mm-qual-caixa'}>
            <IconeBusca />
            <input ref={campoCelularRef} placeholder={grupoDaCategoria ? 'Qual é o seu celular?' : 'Qual é o seu celular? Ex: iPhone 13'} value={textoCelular}
              onFocus={() => setSugestoesAbertas(true)}
              onBlur={() => setTimeout(() => setSugestoesAbertas(false), 200)}
              onChange={e => { setTextoCelular(e.target.value); setSugestoesAbertas(true) }}
              onKeyDown={e => {
                if (e.key !== 'Enter') return
                if (sugestoesCelular.length) escolherCelular(sugestoesCelular[0], grupoDaCategoria || ''); else buscarTexto(textoCelular)
              }} />
            {textoCelular && <button onClick={() => setTextoCelular('')} aria-label="Limpar">✕</button>}
          </div>
          {sugestoesAbertas && textoCelular.trim() && (
            <div className="mm-qual-lista">
              {sugestoesCelular.map(m => (
                <button key={m.id} onMouseDown={e => e.preventDefault()} onClick={() => escolherCelular(m, grupoDaCategoria || '')}>
                  <span className="mm-qual-foto">{m.foto_url ? <img src={m.foto_url} alt="" /> : '📱'}</span>
                  <span><b>{m.modelo}</b><small>{grupoDaCategoria ? `Ver ${CHIPS_ACESSORIO.find(c => c.id === grupoDaCategoria)?.nome.toLowerCase()} que serve nele` : 'Ver capas, películas e acessórios'}</small></span>
                </button>
              ))}
              <button className="mm-qual-texto" onMouseDown={e => e.preventDefault()} onClick={() => buscarTexto(textoCelular)}>
                <IconeBusca /> Buscar “{textoCelular.trim()}” em todo o catálogo
              </button>
            </div>
          )}
          {!meuCelular && !filtrando && (
            <button className="mm-usado-faixa" onClick={() => navigate('/entrada')}>
              <span className="mm-usado-bola">⇄</span>
              <span className="mm-usado-texto"><b>Avalie seu usado</b><small>Vale como entrada no novo</small></span>
              <span className="mm-usado-seta">›</span>
            </button>
          )}
        </div>
      )}

      {meuCelular ? (
        /* ─── Acessórios para o celular escolhido ─── */
        (() => {
          const kit = kitDoCelular()
          const grupos = GRUPOS_ACESSORIO
            .filter(g => !grupoAcessorio || g.id === grupoAcessorio)
            .map(g => ({ ...g, lista: acessoriosDoCelular.filter(p => g.tipos.includes(p.tipo || '')) }))
          const nada = grupos.every(g => g.lista.length === 0)
          return (
            <main className="mm-conteudo mm-acessorios">
              <div className="mm-celular-escolhido">
                <span className="mm-celular-foto">{meuCelular.foto_url ? <img src={meuCelular.foto_url} alt="" /> : '📱'}</span>
                <div>
                  <small>Acessórios para o seu</small>
                  <b>{meuCelular.modelo}</b>
                  {meuCelular.entrada && <em>Entrada {meuCelular.entrada}</em>}
                </div>
                <button className="mm-link" onClick={() => { setMeuCelular(null); setTimeout(abrirBuscaCelular, 50) }}>Trocar</button>
              </div>

              <div className="mm-chips">
                {CHIPS_ACESSORIO.map(c => (
                  <button key={c.id} className={grupoAcessorio === c.id ? 'on' : ''} onClick={() => setGrupoAcessorio(c.id)}>{c.nome}</button>
                ))}
              </div>

              {kit && !grupoAcessorio && (
                <div className="mm-kit">
                  <div className="mm-kit-topo"><span>KIT PROTEÇÃO</span><em>-{Math.round(DESCONTO_KIT * 100)}%</em></div>
                  <div className="mm-kit-fotos">
                    {kit.itens.map(p => (
                      <button key={p.id} onClick={() => abrirProduto(p)}>
                        {p.foto_url ? <img src={p.foto_url} alt="" /> : <span>{p.modelo}</span>}
                      </button>
                    ))}
                  </div>
                  <p className="mm-kit-nomes">{kit.itens.map(p => p.modelo).join(' + ')}</p>
                  <div className="mm-preco mm-preco-grande">
                    <span className="mm-preco-de"><s>{reais(kit.soma)}</s></span>
                    <b>{reais(kit.preco)}</b>
                  </div>
                  <div className="mm-kit-botoes">
                    <button className="mm-btn-contorno" onClick={() => {
                      setSacola(s => [...s, ...kit.itens.map(p => p.id).filter(id => !s.includes(id))]); mostrarAviso('✓ Kit na sacola')
                    }}><IconeSacola tamanho={18} /> Sacola</button>
                    <button className="mm-btn-verde" onClick={() => abrirWhatsApp(
                      `Olá! Quero o kit de proteção para o meu ${meuCelular.modelo}:\n\n${kit.itens.map(p => `• ${nomeCompleto(p)} — ${reais(p.preco || 0)}`).join('\n')}\n\nDe ${reais(kit.soma)} por ${reais(kit.preco)} no kit.`
                    )}><IconeWhats /> Quero o kit</button>
                  </div>
                </div>
              )}

              {nada ? (
                <div className="mm-vazio">
                  <p>Ainda não cadastramos {grupoAcessorio ? 'esse acessório' : 'acessórios'} para o {meuCelular.modelo} aqui no catálogo.</p>
                  <button className="mm-btn-verde" onClick={() => abrirWhatsApp(`Olá! Vocês têm ${grupoAcessorio ? CHIPS_ACESSORIO.find(c => c.id === grupoAcessorio)?.nome.toLowerCase() : 'acessórios'} para ${meuCelular.modelo}?`)}><IconeWhats /> Perguntar no WhatsApp</button>
                </div>
              ) : grupos.map(g => g.lista.length === 0 ? null : (
                <section key={g.id} className="mm-secao">
                  <div className="mm-secao-topo"><h2>{g.nome}</h2><small className="mm-contador">{g.lista.length}</small></div>
                  <div className={grupoAcessorio ? 'mm-grade' : 'mm-trilho'}>{g.lista.map(p => cartao(p, !!grupoAcessorio))}</div>
                </section>
              ))}

              {(!grupoAcessorio || grupoAcessorio === 'capa') && (
                <button className="mm-btn-contorno mm-ver-mais" onClick={() => navigate('/capas')}>🛡 Ver vitrine de capinhas ›</button>
              )}
            </main>
          )
        })()
      ) : filtrando ? (
        /* ─── Resultado de filtro / busca ─── */
        <main className="mm-conteudo">
          <div className="mm-chips">
            <button className={!categoriaAtiva && !marcaAtiva && !filtroEspecial ? 'on' : ''} onClick={() => { setCategoriaAtiva(null); setMarcaAtiva(null); setFiltroEspecial(null) }}>Tudo</button>
            {categorias.filter(c => !c.capas).map(c => (
              <button key={c.nome} className={categoriaAtiva === c.nome ? 'on' : ''}
                onClick={() => { setCategoriaAtiva(categoriaAtiva === c.nome ? null : c.nome); setMarcaAtiva(null); setFiltroEspecial(null) }}>{c.nome}</button>
            ))}
          </div>

          {marcasDaCategoria.length > 1 && (
            <div className="mm-escolha-marca">
              <p>Qual marca você procura?</p>
              <div className="mm-marcas-linha">
                <button className={!marcaAtiva ? 'on' : ''} onClick={() => setMarcaAtiva(null)}><span className="mm-todas">Todas</span></button>
                {marcasDaCategoria.map(m => (
                  <button key={m.nome} className={mesmaMarca(marcaAtiva, m.nome) ? 'on' : ''} onClick={() => setMarcaAtiva(mesmaMarca(marcaAtiva, m.nome) ? null : m.nome)}>
                    {m.img ? <img src={m.img} alt={m.nome} className={m.padrao ? 'padrao' : ''} /> : <b className="mm-marca-texto">{m.nome}</b>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mm-secao-topo">
            <h2>{tituloResultados}</h2>
            <button className="mm-link" onClick={limparFiltros}>✕ Limpar</button>
          </div>
          {resultados.length === 0 ? (
            <div className="mm-vazio">
              <p>Não encontramos esse produto no catálogo agora.</p>
              <button className="mm-btn-verde" onClick={() => abrirWhatsApp(`Olá! Vocês têm ${busca.trim() || tituloResultados}?`)}><IconeWhats /> Perguntar no WhatsApp</button>
            </div>
          ) : (
            <div className="mm-grade">{resultados.map(p => cartao(p, true))}</div>
          )}
        </main>
      ) : (
        <main>
          {/* ─── Abertura: parede de vitrine (ou o carrossel, se ainda não tiver celulares com foto) ─── */}
          {itensVitrine.length >= 3 ? (
            <VitrineHero
              itens={itensVitrine}
              onVerProduto={id => { const p = produtos.find(x => x.id === id); if (p) abrirProduto(p) }}
              onInteresse={id => { const p = produtos.find(x => x.id === id); if (p) abrirWhatsApp(textoInteresse(p)) }}
            />
          ) : carregando && !banner ? <section className="mm-hero mm-hero-fantasma" /> : (
          <section className={banner?.arte ? 'mm-hero mm-hero-arte' : 'mm-hero'}
            onTouchStart={e => { toqueInicio.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              if (toqueInicio.current === null || banners.length < 2) return
              const dx = e.changedTouches[0].clientX - toqueInicio.current
              if (Math.abs(dx) > 40) setHeroIndex(i => (i + (dx < 0 ? 1 : banners.length - 1)) % banners.length)
              toqueInicio.current = null
            }}>
            {banner?.arte ? (
              <img key={banner.id} className="mm-hero-arte-img" src={banner.url} alt={banner.titulo || 'Banner Marcos Magazine'} onClick={cliqueBanner} />
            ) : (
              <div className="mm-hero-slide" key={banner?.id || 'padrao'}>
                <span className="mm-hero-etiqueta">{banner?.titulo ? (banner.etiqueta || 'DESTAQUE') : 'MARCOS MAGAZINE'}</span>
                <h1>{banner?.titulo || 'Os melhores celulares'}</h1>
                <p>{banner?.titulo ? (banner.subtitulo || '') : 'e acessórios. Você só encontra aqui!'}</p>
                {banner && <img className="mm-hero-img" src={banner.url} alt={banner.titulo || 'Destaque'} onClick={cliqueBanner} />}
              </div>
            )}
          </section>
          )}
          {itensVitrine.length < 3 && banners.length > 1 && (
            <div className="mm-pontos">
              {banners.map((b, i) => <i key={b.id} className={i === heroIndex % banners.length ? 'on' : ''} onClick={() => setHeroIndex(i)} />)}
            </div>
          )}

          {/* ─── Categorias ─── */}
          <div className="mm-categorias">
            {categorias.map(c => (
              <button key={c.nome} className={categoriaAcesa === c.nome ? 'mm-categoria acesa' : 'mm-categoria'}
                onClick={() => {
                  const ir = () => { setCategoriaAcesa(null); if (c.capas) navigate('/capas'); else aplicarFiltro({ categoria: c.nome }) }
                  if (!TEMA_VITRINE) { ir(); return }
                  setCategoriaAcesa(c.nome) // acende a luz do nicho e depois abre
                  setTimeout(ir, 750)
                }}>
                <span>{c.img ? (TEMA_VITRINE ? <FotoSemFundoBranco src={c.img} /> : <img src={c.img} alt="" />) : <b className="mm-marca-texto">{c.nome.charAt(0)}</b>}</span>
                {c.nome}
              </button>
            ))}
          </div>

          {/* ─── Vantagens ─── */}
          <div className="mm-beneficios">
            <div><span>💳</span><p><b>Até {PARCELAS}x</b>no cartão</p></div>
            <div onClick={() => navigate('/entrada')}><span>⇄</span><p><b>Seu usado</b>vale como entrada</p></div>
            <div><span>🛡️</span><p><b>Garantia</b>e procedência</p></div>
            <div><span>🔧</span><p><b>Assistência</b>técnica própria</p></div>
          </div>

          {carregando ? (
            <div className="mm-trilho mm-carregando">{[0, 1, 2].map(i => <div key={i} className="mm-card mm-card-fantasma" />)}</div>
          ) : (
            <>
              {secao('Destaques da semana', destaques.length ? destaques : produtos.slice(0, 10), destaques.length ? 'destaques' : null)}


              {secao('Lançamentos', lancamentos, 'lancamentos')}
              {secao('Promoções', promocoes, 'promocoes')}
              {secao('Mais procurados', maisProcurados, 'mais_procurados')}

              {/* ─── Todos ─── */}
              <section className="mm-secao">
                <div className="mm-secao-topo"><h2>Todos os produtos</h2><small className="mm-contador">{produtos.length}</small></div>
                <div className="mm-chips">
                  {categorias.filter(c => !c.capas && produtos.some(p => p.categoria === c.nome)).map(c => (
                    <button key={c.nome} onClick={() => aplicarFiltro({ categoria: c.nome })}>{c.nome}</button>
                  ))}
                </div>
                <div className="mm-grade">{vitrineMista.map(p => cartao(p, true))}</div>
                {produtos.length > 8 && (
                  <button className="mm-btn-contorno mm-ver-mais" onClick={() => aplicarFiltro({ especial: 'todos' })}>Ver todos os {produtos.length} produtos ›</button>
                )}
              </section>
            </>
          )}

          {/* ─── Marcas ─── */}
          <section className="mm-secao">
            <div className="mm-secao-topo"><h2>Marcas</h2></div>
            <div className="mm-marcas">
              {marcas.map(m => (
                <button key={m.nome} onClick={() => aplicarFiltro({ marca: m.nome })}>
                  {m.img ? <img src={m.img} alt={m.nome} className={m.padrao ? 'padrao' : ''} /> : <b className="mm-marca-texto">{m.nome}</b>}
                </button>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* ─── Rodapé ─── */}
      <footer className="mm-rodape">
        <b>Marcos Magazine</b>
        <p>Avenida Goiás, 686, sala 3 · Centro · Bom Jesus de Goiás</p>
        <p>Seg a sex 08:00–18:00 · Sáb 08:00–12:30</p>
        <div className="mm-rodape-links">
          <button onClick={() => abrirWhatsApp('Olá! Vim pelo catálogo da Marcos Magazine.')}>WhatsApp (64) 99337-4281</button>
          <span>·</span>
          <button onClick={() => window.open('https://www.instagram.com/marcosmagazinee', '_blank')}>Instagram</button>
          <span>·</span>
          <button onClick={() => window.open('https://www.google.com/maps/search/Avenida+Goiás+686+Centro+Bom+Jesus+de+Goiás+GO', '_blank')}>Como chegar</button>
        </div>
        <small className="mm-copy">© {new Date().getFullYear()} Marcos Magazine. Todos os direitos reservados.</small>
      </footer>

      {/* Barra da sacola */}
      {sacola.length > 0 && !sacolaAberta && (
        <div className="mm-barra-sacola">
          <button className="mm-barra-sacola-ver" onClick={() => setSacolaAberta(true)}>
            <span className="mm-barra-sacola-icone"><IconeSacola tamanho={22} /><i>{sacola.length}</i></span>
            Ver sacola
          </button>
          <button className="mm-barra-sacola-enviar" onClick={enviarSacola}><IconeWhats tamanho={19} /> Enviar</button>
        </div>
      )}
      {gavetaSacola}
      {avisoFlutuante}
    </div>
  )
}

function Logo({ onClick }: { onClick?: () => void }) {
  return <div className="mm-logo" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}><b>Marcos</b><i>Magazine</i></div>
}

// ─── Visual (branco, inspirado em lojas premium) ───
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Nunito:wght@800;900&display=swap');
html, body { background: #fff !important; }
body { display: block !important; place-items: normal !important; margin: 0 !important; min-width: 0 !important; color: #1d1d1f !important; }
#root { width: 100% !important; max-width: none !important; justify-self: stretch !important; padding: 0 !important; margin: 0 !important; text-align: left !important; }
.mm { --laranja: #ff6600; --tinta: #1d1d1f; --cinza: #f5f5f7; --borda: #ececf0; --verde: #25D366;
  min-height: 100vh; background: #fff; color: var(--tinta); font-family: Poppins, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased; overflow-x: hidden; overflow-x: clip; }
.mm * { box-sizing: border-box; }
.mm button { all: unset; box-sizing: border-box; cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent; }
.mm h1, .mm h2, .mm h3, .mm p { margin: 0; }
.mm h1, .mm h2, .mm h3, .mm b, .mm strong, .mm small { color: inherit; font-family: inherit; }
.mm img { display: block; max-width: 100%; }
.mm main, .mm-busca { max-width: 1100px; margin-left: auto; margin-right: auto; }
.mm.mm-com-barra { padding-bottom: 92px; }

.mm .mm-aviso { background: var(--tinta); color: #fff; font-size: 14px; text-align: center; padding: 9px 12px; }
.mm .mm-aviso b { color: #ff8a3d; }

/* Topo */
.mm .mm-topo { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 2px; padding: 10px 10px;
  background: rgba(255,255,255,0.94); backdrop-filter: saturate(180%) blur(14px); -webkit-backdrop-filter: saturate(180%) blur(14px); border-bottom: 1px solid var(--borda); }
.mm .mm-logo { line-height: 1; margin-right: auto; margin-left: 6px; }
.mm .mm-logo b { display: block; color: var(--laranja); font-weight: 800; font-size: 26px; letter-spacing: -0.5px; font-family: Nunito, Poppins, sans-serif; }
.mm .mm-logo i { display: block; color: var(--laranja); font-style: normal; font-weight: 700; font-size: 12px; text-align: right; margin-top: -2px; }
.mm .mm-icone { position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 22px; color: var(--tinta); }
.mm .mm-icone:active { background: var(--cinza); }
.mm .mm-contagem { position: absolute; top: 4px; right: 3px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: var(--laranja); color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; animation: mmPop .3s ease; }
@keyframes mmPop { 0% { transform: scale(0.4) } 70% { transform: scale(1.2) } 100% { transform: scale(1) } }

.mm .mm-busca { display: flex; align-items: center; gap: 8px; margin: 12px 16px 0; background: var(--cinza); border-radius: 16px; padding: 4px 6px 4px 14px; color: #86868b; }
.mm .mm-busca input { flex: 1; border: none; outline: none; background: none; font-size: 17px; padding: 11px 0; font-family: inherit; color: var(--tinta); min-width: 0; }
.mm .mm-busca button { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #888; font-size: 16px; }

/* Banner */
.mm .mm-hero { position: relative; overflow: hidden; background: linear-gradient(180deg, #f5f5f7 0%, #fbe9dc 100%); text-align: center; touch-action: pan-y; }
.mm .mm-hero-slide { display: flex; flex-direction: column; align-items: center; padding: 30px 20px 0; min-height: 400px; animation: mmEntra .6s ease; }
@keyframes mmEntra { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.mm .mm-hero-etiqueta { font-size: 13px; font-weight: 700; color: var(--laranja); letter-spacing: 2px; }
.mm .mm-hero h1 { color: var(--tinta); font-size: 36px; font-weight: 800; letter-spacing: -0.8px; line-height: 1.1; margin-top: 8px; }
.mm .mm-hero p { font-size: 17px; color: #555; margin-top: 8px; max-width: 340px; }
.mm .mm-hero-botoes { display: flex; gap: 10px; margin-top: 18px; }
.mm .mm-btn-laranja { background: var(--laranja); color: #fff; border-radius: 26px; padding: 12px 24px; font-size: 16px; font-weight: 700; }
.mm .mm-btn-contorno-laranja { border: 2px solid var(--laranja); color: var(--laranja); border-radius: 26px; padding: 10px 22px; font-size: 16px; font-weight: 700; }
.mm .mm-hero-img { width: auto; max-width: 92%; height: 230px; object-fit: contain; margin-top: 18px; mix-blend-mode: multiply; }
.mm .mm-hero-arte { background: #fff; padding: 12px 12px 0; }
.mm .mm-hero-arte-img { width: 100%; max-width: 620px; margin: 0 auto; border-radius: 22px; cursor: pointer; animation: mmEntra .6s ease; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }

.mm .mm-pontos { display: flex; justify-content: center; gap: 7px; padding: 14px 0 4px; }
.mm .mm-pontos i { width: 8px; height: 8px; border-radius: 4px; background: #d2d2d7; transition: all .3s; cursor: pointer; }
.mm .mm-pontos i.on { width: 24px; background: var(--laranja); }

/* Categorias */
.mm .mm-categorias { display: flex; gap: 12px; overflow-x: auto; padding: 14px 16px 18px; scrollbar-width: none; }
.mm .mm-categorias::-webkit-scrollbar { display: none; }
.mm .mm-categoria { flex: 0 0 auto; width: 112px; text-align: center; font-size: 16px; font-weight: 700; color: var(--tinta); line-height: 1.25; }
.mm .mm-categoria span { width: 108px; height: 100px; border-radius: 0; background: none; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.mm .mm-categoria img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; transition: transform .2s; }
.mm .mm-categoria:active img { transform: scale(0.94); }

/* Vantagens */
.mm .mm-beneficios { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px 6px; }
.mm .mm-beneficios div { background: var(--cinza); border-radius: 18px; padding: 14px 14px; display: flex; gap: 12px; align-items: center; cursor: default; }
.mm .mm-beneficios span { font-size: 28px; line-height: 1; }
.mm .mm-beneficios p { font-size: 13.5px; color: #6e6e73; line-height: 1.35; }
.mm .mm-beneficios b { display: block; color: var(--tinta); font-size: 16px; }

/* Seções */
.mm .mm-secao { padding-top: 28px; }
.mm .mm-secao-topo { display: flex; justify-content: space-between; align-items: center; padding: 0 16px 14px; gap: 10px; }
.mm .mm-secao-topo h2 { color: var(--tinta); font-size: 25px; display: flex; align-items: center; gap: 10px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.15; }
.mm .mm-secao-topo h2::before { content: ''; width: 5px; height: 24px; border-radius: 3px; background: var(--laranja); flex-shrink: 0; }
.mm .mm-link { color: var(--laranja); font-size: 15px; font-weight: 700; white-space: nowrap; }
.mm .mm-contador { color: #86868b; font-size: 15px; }
.mm .mm-trilho { display: flex; gap: 12px; overflow-x: auto; padding: 0 16px 6px; scroll-padding: 0 16px; scroll-snap-type: x mandatory; scrollbar-width: none; }
.mm .mm-trilho::-webkit-scrollbar { display: none; }

/* Cartão de produto */
.mm .mm-card { flex: 0 0 auto; width: 196px; border: 1px solid var(--borda); border-radius: 22px; padding: 10px; background: #fff; scroll-snap-align: start; cursor: pointer; display: flex; flex-direction: column; transition: transform .15s; }
.mm .mm-card:active { transform: scale(0.98); }
.mm .mm-card-grade { width: auto; }
.mm .mm-card-foto { position: relative; height: 158px; background: var(--cinza); border-radius: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.mm .mm-card-foto img { width: 90%; height: 90%; object-fit: contain; mix-blend-mode: multiply; }
.mm .mm-selo { position: absolute; top: 8px; left: 8px; z-index: 1; color: #fff; font-size: 10.5px; font-weight: 800; border-radius: 7px; padding: 3px 8px; letter-spacing: .5px; }
.mm .mm-sem-foto { color: #aaa; font-weight: 700; font-size: 15px; }
.mm .mm-card-nome { color: var(--tinta); font-size: 16.5px; font-weight: 700; margin-top: 10px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mm .mm-card-info { color: #6e6e73; font-size: 14px; margin-top: 3px; }
.mm .mm-cores { display: flex; gap: 5px; margin: 8px 0 12px; min-height: 13px; flex-wrap: wrap; }
.mm .mm-cores i { width: 13px; height: 13px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); }
.mm .mm-btn-sacola { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: var(--tinta); color: #fff; border-radius: 20px; padding: 11px 6px; font-size: 15px; font-weight: 700; margin-top: auto; transition: background .2s; }
.mm .mm-btn-sacola.dentro { background: #fff1e6; color: var(--laranja); }
.mm .mm-card-fantasma { height: 300px; background: linear-gradient(90deg, #f3f3f5, #fafafa, #f3f3f5); background-size: 200% 100%; animation: mmBrilhoCarregando 1.2s infinite; border: none; }
@keyframes mmBrilhoCarregando { to { background-position: -200% 0 } }
.mm .mm-carregando { padding-top: 22px; }

.mm .mm-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 10px; padding: 0 16px; }
.mm .mm-chips { display: flex; gap: 8px; overflow-x: auto; padding: 14px 16px 12px; scrollbar-width: none; }
.mm .mm-chips::-webkit-scrollbar { display: none; }
.mm .mm-chips button { flex: 0 0 auto; padding: 9px 16px; border-radius: 20px; background: var(--cinza); font-size: 15px; font-weight: 600; color: #444; }
.mm .mm-chips button.on { background: var(--tinta); color: #fff; }
.mm .mm-conteudo { padding-bottom: 20px; }
.mm .mm-vazio { text-align: center; padding: 40px 24px; color: #6e6e73; font-size: 16px; display: flex; flex-direction: column; gap: 16px; align-items: center; }

/* Escolha de marca (embaixo de Celulares) */
.mm .mm-escolha-marca { padding: 2px 16px 18px; }
.mm .mm-escolha-marca p { font-size: 15px; font-weight: 700; color: #6e6e73; margin-bottom: 10px; }
.mm .mm-marcas-linha { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.mm .mm-marcas-linha::-webkit-scrollbar { display: none; }
.mm .mm-marcas-linha button { flex: 0 0 auto; width: 124px; height: 84px; border-radius: 20px; background: var(--cinza); border: 2px solid transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px; transition: all .2s; }
.mm .mm-marcas-linha button.on { background: #fff; border-color: var(--laranja); box-shadow: 0 6px 16px rgba(255,102,0,0.18); }
.mm .mm-marcas-linha img, .mm .mm-marcas img { width: 100%; height: 56px; object-fit: contain; filter: grayscale(1) brightness(0.25) contrast(1.4); transform: scale(1.3); }
.mm .mm-marcas-linha img.padrao, .mm .mm-marcas img.padrao { filter: none; transform: none; height: 48px; }
.mm .mm-marca-texto { font-size: 17px; font-weight: 800; color: var(--tinta); }
.mm .mm-com-icone { display: inline-flex; align-items: center; gap: 8px; }
.mm .mm-todas { font-size: 15px; font-weight: 800; color: var(--tinta); }

/* Cartões duplos */
.mm .mm-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 28px 16px 0; }
.mm .mm-duo button { position: relative; overflow: hidden; border-radius: 22px; padding: 18px 16px; min-height: 210px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
.mm .mm-duo b { font-size: 19px; font-weight: 800; line-height: 1.2; position: relative; z-index: 1; }
.mm .mm-duo small { font-size: 14px; line-height: 1.35; position: relative; z-index: 1; }
.mm .mm-duo-bola { position: absolute; top: 16px; left: 16px; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 25px; font-weight: 900; }
.mm .mm-duo-escuro { background: var(--tinta); color: #fff; }
.mm .mm-duo-escuro .mm-duo-bola { background: var(--laranja); color: #fff; animation: mmGira 3.5s ease-in-out infinite; }
@keyframes mmGira { 0%, 70% { transform: rotate(0) } 85%, 100% { transform: rotate(180deg) } }
.mm .mm-duo-escuro small { color: #ffa366; }
.mm .mm-duo-escuro::after { content: ''; position: absolute; top: 0; left: 0; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); animation: mmBrilho 3.5s ease-in-out infinite; }
@keyframes mmBrilho { 0% { transform: translateX(-120%) skewX(-20deg) } 60%, 100% { transform: translateX(320%) skewX(-20deg) } }
.mm .mm-novo { position: absolute; top: 18px; right: 14px; background: var(--laranja); color: #fff; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 10px; animation: mmPulso 1.6s ease-in-out infinite; }
@keyframes mmPulso { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.1) } }
.mm .mm-duo-claro { background: #fff3ea; color: var(--tinta); }
.mm .mm-duo-claro .mm-duo-bola { background: #fff; color: var(--laranja); }
.mm .mm-duo-vs { position: absolute; top: 12px; left: 8px; right: 8px; height: 88px; display: flex; align-items: center; justify-content: center; }
.mm .mm-duo-vs img { height: 100%; width: auto; max-width: 46%; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.15)); }
.mm .mm-duo-vs img:first-child { transform: rotate(-6deg); }
.mm .mm-duo-vs img:last-child { transform: rotate(6deg); }
.mm .mm-duo-vs i { position: relative; z-index: 1; margin: 0 -10px; width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; background: var(--laranja); color: #fff; font-style: normal; font-size: 13px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 3px solid #fff3ea; animation: mmPulso 1.6s ease-in-out infinite; }
.mm .mm-duo-claro small { color: #d4560a; }

/* Marcas */
.mm .mm-marcas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 16px 28px; }
.mm .mm-marcas button { background: var(--cinza); border-radius: 20px; height: 84px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px; }
.mm .mm-ver-mais { display: block; width: calc(100% - 32px); margin: 16px 16px 0; text-align: center; }

/* Rodapé */
.mm .mm-rodape { background: var(--cinza); border-top: 1px solid var(--borda); padding: 26px 16px 30px; font-size: 12.5px; color: #1d1d1f; line-height: 1.7; margin-top: 16px; text-align: center; }
.mm .mm-rodape > * { max-width: 1100px; margin-left: auto; margin-right: auto; }
.mm .mm-rodape b { color: var(--laranja); font-size: 16px; font-weight: 800; display: block; margin-bottom: 4px; }
.mm .mm-rodape-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 8px; margin-top: 10px; color: #86868b; }
.mm .mm-rodape-links button { font-size: 12.5px; color: #1d1d1f; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: #c7c7cc; }
.mm .mm-copy { display: block; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--borda); color: #86868b; font-size: 11px; }

/* Menu lateral */
.mm .mm-fundo-menu { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 90; animation: mmFade .2s; }
@keyframes mmFade { from { opacity: 0 } }
.mm .mm-menu { position: fixed; top: 0; left: 0; bottom: 0; width: 300px; max-width: 85vw; background: #fff; z-index: 100; transform: translateX(-100%); transition: transform .25s ease; overflow-y: auto; }
.mm .mm-menu.aberto { transform: none; box-shadow: 0 0 40px rgba(0,0,0,0.15); }
.mm .mm-menu-topo { display: flex; align-items: center; padding: 14px 12px 10px 16px; border-bottom: 1px solid var(--borda); }
.mm .mm-menu nav { display: flex; flex-direction: column; padding: 8px; }
.mm .mm-menu nav button { width: 100%; padding: 14px 12px; border-radius: 12px; font-size: 17px; font-weight: 500; color: var(--tinta); }
.mm .mm-menu nav button:active { background: var(--cinza); }
.mm .mm-menu nav .mm-menu-destaque { color: var(--laranja); font-weight: 700; }
.mm .mm-menu hr { border: none; border-top: 1px solid var(--borda); margin: 6px 12px; }

/* Sacola */
.mm .mm-barra-sacola { position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 70; max-width: 560px; margin: 0 auto; display: flex; gap: 8px; padding: 8px; border-radius: 22px; background: var(--tinta); box-shadow: 0 12px 30px rgba(0,0,0,0.25); animation: mmSobe .3s ease; }
@keyframes mmSobe { from { transform: translateY(120%) } }
.mm .mm-barra-sacola-ver { flex: 1; display: flex; align-items: center; gap: 10px; color: #fff; font-size: 16px; font-weight: 700; padding: 6px 10px; }
.mm .mm-barra-sacola-icone { position: relative; display: flex; }
.mm .mm-barra-sacola-icone i { position: absolute; top: -6px; right: -9px; min-width: 18px; height: 18px; border-radius: 9px; background: var(--laranja); font-style: normal; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.mm .mm-barra-sacola-enviar { display: flex; align-items: center; gap: 6px; background: var(--verde); color: #fff; border-radius: 16px; padding: 12px 18px; font-size: 16px; font-weight: 800; }
.mm .mm-gaveta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; max-height: 82vh; display: flex; flex-direction: column; background: #fff; border-radius: 26px 26px 0 0; max-width: 620px; margin: 0 auto; animation: mmSobe .3s ease; box-shadow: 0 -10px 40px rgba(0,0,0,0.15); }
.mm .mm-gaveta-topo { display: flex; align-items: center; justify-content: space-between; padding: 16px 12px 10px 20px; border-bottom: 1px solid var(--borda); }
.mm .mm-gaveta-topo b { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 800; }
.mm .mm-gaveta-lista { overflow-y: auto; padding: 8px 16px; }
.mm .mm-gaveta-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--borda); cursor: pointer; }
.mm .mm-gaveta-foto { width: 64px; height: 64px; border-radius: 14px; background: var(--cinza); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; color: #aaa; font-size: 11px; font-weight: 700; }
.mm .mm-gaveta-foto img { width: 88%; height: 88%; object-fit: contain; mix-blend-mode: multiply; }
.mm .mm-gaveta-item b { display: block; font-size: 16px; font-weight: 700; line-height: 1.25; }
.mm .mm-gaveta-item small { display: block; color: #6e6e73; font-size: 13.5px; margin-top: 2px; }
.mm .mm-gaveta-remover { width: 36px; height: 36px; border-radius: 50%; background: var(--cinza); color: #6e6e73; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.mm .mm-gaveta-rodape { padding: 14px 16px calc(16px + env(safe-area-inset-bottom)); border-top: 1px solid var(--borda); display: flex; flex-direction: column; gap: 10px; align-items: center; }
.mm .mm-limpar { color: #86868b; font-size: 14px; font-weight: 600; }
.mm .mm-aviso-flutuante { position: fixed; left: 50%; top: 84px; transform: translateX(-50%); z-index: 120; background: var(--tinta); color: #fff; padding: 11px 20px; border-radius: 22px; font-size: 15px; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,0.2); animation: mmEntra .25s ease; white-space: nowrap; }

/* Detalhe do produto */
.mm .mm-topo-detalhe { gap: 8px; }
.mm .mm-voltar { font-size: 17px; font-weight: 600; color: var(--laranja); padding: 8px 6px; }
.mm .mm-topo-detalhe .mm-logo { margin: 0 auto; }
.mm .mm-detalhe { max-width: 640px; padding-bottom: 110px; }
.mm .mm-galeria { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; background: var(--cinza); }
.mm .mm-galeria::-webkit-scrollbar { display: none; }
.mm .mm-galeria-item { flex: 0 0 100%; scroll-snap-align: center; height: 380px; display: flex; align-items: center; justify-content: center; padding: 20px; }
.mm .mm-galeria-item img { max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.mm .mm-sem-foto-grande { font-size: 26px; }
.mm .mm-detalhe-info { padding: 16px 20px 10px; }
.mm .mm-detalhe-marca { color: var(--laranja); font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 2.5px; }
.mm .mm-nome-linha { display: flex; align-items: flex-start; gap: 10px; }
.mm .mm-nome-linha .mm-detalhe-nome { flex: 1; min-width: 0; }
.mm .mm-compartilhar { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-top: 8px; padding: 9px 14px; border-radius: 20px; background: #fff1e6; color: var(--laranja); font-size: 15px; font-weight: 700; }
.mm .mm-detalhe-nome { color: var(--tinta); font-size: 31px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.15; margin-top: 4px; }
.mm .mm-cores-grandes { gap: 14px; margin-top: 14px; }
.mm .mm-cores-grandes { gap: 8px; }
.mm .mm-cor { display: flex; align-items: center; gap: 8px; font-size: 15px; color: #444; padding: 7px 14px 7px 8px; border-radius: 22px; border: 2px solid var(--borda); background: #fff; transition: all .2s; }
.mm .mm-cor i { width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.15); }
.mm .mm-cor.on { border-color: var(--laranja); color: var(--tinta); font-weight: 700; box-shadow: 0 4px 12px rgba(255,102,0,0.15); }
.mm .mm-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
.mm .mm-spec { background: var(--cinza); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 3px; }
.mm .mm-spec span { font-size: 22px; }
.mm .mm-spec small { font-size: 12px; color: #86868b; text-transform: uppercase; letter-spacing: 1px; }
.mm .mm-spec b { font-size: 16px; }
.mm .mm-descricao { font-size: 16px; color: #555; line-height: 1.65; margin-top: 20px; }
.mm .mm-beneficios-detalhe { padding: 0; margin-top: 20px; }
.mm .mm-beneficios-detalhe div:nth-child(2) { cursor: pointer; }
.mm .mm-btn-contorno { display: block; width: 100%; text-align: center; border: 1.5px solid var(--borda); border-radius: 18px; padding: 14px; font-size: 16px; font-weight: 700; color: var(--tinta); margin-top: 12px; }
.mm .mm-barra-fixa { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--borda); }
.mm .mm-barra-dupla { display: flex; gap: 10px; justify-content: center; }
.mm .mm-barra-dupla > * { max-width: 300px; }
.mm .mm-btn-sacola-grande { flex: 0 0 38%; margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 15px 8px; }
.mm .mm-btn-sacola-grande.dentro { border-color: var(--laranja); color: var(--laranja); background: #fff1e6; }
.mm .mm-btn-verde { display: flex; align-items: center; justify-content: center; gap: 8px; flex: 1; width: 100%; text-align: center; background: var(--verde); color: #fff; border-radius: 18px; padding: 15px 18px; font-size: 17px; font-weight: 800; max-width: 600px; }

/* Telas maiores (iPad / computador) */
/* Preço */
.mm .mm-preco { display: flex; flex-direction: column; margin-top: 6px; line-height: 1.15; }
.mm .mm-preco b { font-size: 19px; font-weight: 800; color: var(--tinta); letter-spacing: -0.3px; }
.mm .mm-preco-de { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #8e8e93; }
.mm .mm-preco-de em { font-style: normal; font-size: 11px; font-weight: 800; color: #fff; background: #e5332a; border-radius: 6px; padding: 1px 5px; }
.mm .mm-preco-grande { margin: 8px 0 4px; }
.mm .mm-preco-grande b { font-size: 30px; }
.mm .mm-preco-grande .mm-preco-de { font-size: 16px; }
.mm .mm-gaveta-item .mm-preco b { font-size: 15px; }

/* Qual é o seu celular? */
.mm .mm-qual { position: relative; margin: 12px auto 14px; width: calc(100% - 32px); max-width: 1068px; }
.mm .mm-qual-caixa { display: flex; align-items: center; gap: 8px; background: #fff; border: 1.5px solid var(--borda); border-radius: 18px; padding: 4px 6px 4px 14px; color: var(--laranja); box-shadow: 0 6px 18px rgba(0,0,0,0.05); }
.mm .mm-qual-caixa.aberta { border-color: var(--laranja); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.mm .mm-qual-caixa input { flex: 1; min-width: 0; border: none; outline: none; background: none; font-size: 17px; padding: 12px 0; font-family: inherit; color: var(--tinta); }
.mm .mm-qual-caixa button { width: 36px; height: 36px; color: #888; font-size: 16px; }
.mm .mm-qual-lista { position: absolute; left: 0; right: 0; top: 100%; z-index: 40; background: #fff; border: 1.5px solid var(--laranja); border-top: none; border-radius: 0 0 18px 18px; overflow: hidden; box-shadow: 0 16px 30px rgba(0,0,0,0.12); }
.mm .mm-qual-lista button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; text-align: left; border-top: 1px solid var(--borda); }
.mm .mm-qual-lista b { display: block; font-size: 16px; color: var(--tinta); }
.mm .mm-qual-lista small { display: block; font-size: 13px; color: #86868b; }
.mm .mm-qual-foto { width: 42px; height: 42px; border-radius: 12px; background: var(--cinza); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.mm .mm-qual-foto img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.mm .mm-qual-texto { color: var(--laranja); font-weight: 700; font-size: 15px; }
.mm .mm-qual-texto svg { width: 18px; height: 18px; }
.mm .mm-qual-ultimo { margin-top: 8px; font-size: 14px; color: #6e6e73; }
.mm .mm-qual-ultimo b { color: var(--laranja); }

/* Resultado por celular */
.mm .mm-celular-escolhido { display: flex; align-items: center; gap: 12px; margin: 4px 16px 12px; padding: 12px; border-radius: 20px; background: linear-gradient(135deg, #fff4ec, #f5f5f7); }
.mm .mm-celular-foto { width: 56px; height: 56px; border-radius: 16px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; overflow: hidden; flex-shrink: 0; }
.mm .mm-celular-foto img { width: 100%; height: 100%; object-fit: contain; }
.mm .mm-celular-escolhido div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mm .mm-celular-escolhido small { font-size: 13px; color: #6e6e73; }
.mm .mm-celular-escolhido b { font-size: 20px; color: var(--tinta); }
.mm .mm-celular-escolhido em { font-style: normal; font-size: 12px; color: var(--laranja); font-weight: 700; }
.mm .mm-kit { margin: 4px 16px 18px; padding: 16px; border-radius: 24px; background: var(--tinta); color: #fff; }
.mm .mm-kit-topo { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: var(--laranja); }
.mm .mm-kit-topo em { font-style: normal; background: var(--laranja); color: #fff; border-radius: 8px; padding: 2px 8px; letter-spacing: 0; }
.mm .mm-kit-fotos { display: flex; gap: 8px; margin: 12px 0 8px; }
.mm .mm-kit-fotos button { flex: 1; aspect-ratio: 1; background: #fff; border-radius: 16px; overflow: hidden; display: flex; align-items: center; justify-content: center; color: var(--tinta); font-size: 12px; padding: 6px; }
.mm .mm-kit-fotos img { width: 100%; height: 100%; object-fit: contain; }
.mm .mm-kit-nomes { font-size: 14px; color: #c7c7cc; }
.mm .mm-kit .mm-preco b { color: #fff; }
.mm .mm-kit-botoes { display: flex; gap: 8px; margin-top: 10px; }
.mm .mm-kit-botoes .mm-btn-contorno { flex: 0 0 36%; margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; color: #fff; border-color: #48484a; }
.mm .mm-kit-botoes .mm-btn-verde { flex: 1; margin: 0; }
.mm .mm-hero-fantasma { min-height: 400px; background: linear-gradient(90deg, #f5f5f7 25%, #ececf0 50%, #f5f5f7 75%); background-size: 200% 100%; animation: mmBrilho 1.2s infinite linear; }
@keyframes mmBrilho { from { background-position: 200% 0 } to { background-position: -200% 0 } }
.mm .mm-usado-faixa { display: flex; align-items: center; gap: 14px; width: 100%; margin-top: 10px; padding: 14px 16px; border-radius: 20px; text-align: left;
  background: linear-gradient(110deg, #1d1d1f 0%, #2c2c2e 55%, #ff6600 140%); color: #fff; box-shadow: 0 10px 24px rgba(255,102,0,0.18); }
.mm .mm-usado-bola { width: 48px; height: 48px; border-radius: 50%; background: var(--laranja); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.mm .mm-usado-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mm .mm-usado-texto b { font-size: 19px; font-weight: 800; color: #fff; }
.mm .mm-usado-texto small { font-size: 14px; color: #ffb27a; }
.mm .mm-usado-seta { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
.mm .mm-aviso-cupom { background: linear-gradient(90deg, #ff6600, #ff8a3d); color: #fff; }
.mm .mm-aviso-cupom b { color: #fff; }
.mm .mm-preco-de em.mm-tag-cupom { background: var(--laranja); }
.mm .mm-preco b.mm-preco-cupom { color: var(--laranja); }
.mm .mm-cupom-campo { display: flex; gap: 8px; width: 100%; }
.mm .mm-cupom-campo input { flex: 1; min-width: 0; border: 1.5px dashed #ffb27a; border-radius: 14px; padding: 11px 14px; font-size: 16px; font-family: inherit; outline: none; text-transform: uppercase; color: var(--tinta); }
.mm .mm-cupom-campo button { background: var(--tinta); color: #fff; border-radius: 14px; padding: 0 16px; font-weight: 700; font-size: 15px; }
.mm .mm-cupom-ativo { width: 100%; display: flex; align-items: center; gap: 6px; background: #fff1e6; color: var(--laranja); border-radius: 14px; padding: 11px 14px; font-size: 14px; }
.mm .mm-cupom-ativo button { margin-left: auto; color: #b0b0b5; font-size: 15px; }
.mm .mm-cupom-erro { color: #e5332a; font-size: 13px; }
@media (min-width: 760px) {
  .mm .mm-hero { border-radius: 28px; margin: 16px 16px 0; }
  .mm .mm-hero-arte { background: none; padding: 0; }
  .mm .mm-hero-slide { min-height: 470px; padding-top: 44px; }
  .mm .mm-hero h1 { font-size: 50px; }
  .mm .mm-hero-img { height: 280px; }
  .mm .mm-categorias { justify-content: center; gap: 18px; }
  .mm .mm-categoria { width: 140px; font-size: 17px; }
  .mm .mm-categoria span { width: 134px; height: 124px; }
  .mm .mm-beneficios { grid-template-columns: repeat(4, 1fr); }
  .mm .mm-card { width: 230px; }
  .mm .mm-card-grade { width: auto; }
  .mm .mm-card-foto { height: 190px; }
  .mm .mm-grade { grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 14px; }
  .mm .mm-marcas { grid-template-columns: repeat(5, 1fr); }
  .mm .mm-duo button { min-height: 210px; }
  .mm .mm-secao-topo h2 { font-size: 30px; }
}
@media (prefers-reduced-motion: reduce) { .mm *, .mm *::after { animation: none !important; transition: none !important; } }
`

// ─── Visual "Vitrine": parede cinza fosca, prateleiras de acrílico e etiquetas escuras ───
const PAREDE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.46  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`

const CSS_VITRINE = `
html, body { background: #4e4953 !important; }
body { color: #fff !important; }
.mm.tema-vitrine { --tinta: #ffffff; --cinza: rgba(255,255,255,0.08); --borda: rgba(255,255,255,0.12); --vidro: rgba(26,24,29,0.55);
  color: #fff; background-color: #5f5964;
  background-image: ${PAREDE}, linear-gradient(180deg, #7a747e 0%, #6a646e 25%, #5d5762 65%, #4e4953 100%);
  background-size: 220px 220px, 100% 100%; background-attachment: scroll, fixed; }
.mm.tema-vitrine img { mix-blend-mode: normal !important; }

/* faixa e topo */
.mm.tema-vitrine .mm-aviso { background: #1c1a1f; }
.mm.tema-vitrine .mm-aviso-cupom { background: linear-gradient(90deg, #ff6600, #ff8a3d); }
.mm.tema-vitrine .mm-topo { background: rgba(38,35,42,0.78); border-bottom-color: rgba(255,255,255,0.08); }
.mm.tema-vitrine .mm-icone { color: #fff; }
.mm.tema-vitrine .mm-icone:active { background: rgba(255,255,255,0.1); }
.mm.tema-vitrine .mm-contagem { border-color: #2a272e; }

/* busca e "qual é o seu celular" */
.mm.tema-vitrine .mm-busca, .mm.tema-vitrine .mm-qual-caixa { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); box-shadow: none; color: #ffb27a; }
.mm.tema-vitrine .mm-busca input, .mm.tema-vitrine .mm-qual-caixa input, .mm.tema-vitrine .mm-cupom-campo input { color: #fff; }
.mm.tema-vitrine input::placeholder { color: rgba(255,255,255,0.6); }
.mm.tema-vitrine .mm-qual-caixa.aberta { border-color: var(--laranja); }
.mm.tema-vitrine .mm-qual-lista { background: #2a272e; border-color: var(--laranja); }
.mm.tema-vitrine .mm-qual-lista small, .mm.tema-vitrine .mm-qual-ultimo { color: rgba(255,255,255,0.6); }
.mm.tema-vitrine .mm-qual-foto, .mm.tema-vitrine .mm-celular-foto { background: rgba(255,255,255,0.08); }
.mm.tema-vitrine .mm-usado-faixa { background: linear-gradient(110deg, #1c1a1f 0%, #2a2630 55%, #ff6600 150%); box-shadow: 0 10px 24px rgba(0,0,0,0.25); }

/* banner antigo (quando não há vitrine) */
.mm.tema-vitrine .mm-hero { background: transparent; }
.mm.tema-vitrine .mm-hero h1 { color: #fff; }
.mm.tema-vitrine .mm-hero p { color: rgba(255,255,255,0.7); }
.mm.tema-vitrine .mm-hero-arte { background: transparent; }
.mm.tema-vitrine .mm-hero-fantasma { background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%); background-size: 200% 100%; }
.mm.tema-vitrine .mm-pontos i { background: rgba(255,255,255,0.3); }
.mm.tema-vitrine .mm-pontos i.on { background: var(--laranja); }

/* categorias = produtos na parede em prateleiras de acrílico (igual vitrine de tênis) */
.mm.tema-vitrine .mm-categorias { gap: 14px; padding-top: 20px; }
.mm.tema-vitrine .mm-categoria { width: 112px; color: #fff; font-size: 14px; position: relative; }
.mm.tema-vitrine .mm-categoria span { position: relative; width: 112px; height: 124px; margin-bottom: 12px; border-radius: 0; padding: 18px 20px 0; overflow: visible;
  align-items: flex-end; background: none; box-shadow: none; }
/* prateleira de acrílico */
.mm.tema-vitrine .mm-categoria span::after { content: ''; position: absolute; left: 2%; right: 2%; bottom: -8px; height: 7px; border-radius: 3px;
  background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.14));
  box-shadow: 0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 14px rgba(0,0,0,0.35); transition: background .3s, box-shadow .3s; }
/* brilho laranja embaixo da prateleira (só quando acende) */
.mm.tema-vitrine .mm-categoria span::before { content: ''; position: absolute; left: -22%; right: -22%; top: calc(100% + 2px); height: 70px; pointer-events: none; opacity: 0;
  background: radial-gradient(50% 60% at 50% 0%, rgba(255,110,30,0.75), rgba(255,90,20,0.25) 45%, transparent 75%); filter: blur(4px); }
.mm.tema-vitrine .mm-categoria img { position: relative; z-index: 1; object-position: 50% 100%; transform-origin: 50% 100%;
  filter: drop-shadow(0 6px 6px rgba(0,0,0,0.35));
  transition: transform .22s ease; }
.mm.tema-vitrine .mm-categoria:active img { transform: translateY(-4px) scale(1.08); }
/* Ao tocar: a prateleira acende em laranja e o produto sobe um pouco */
.mm.tema-vitrine .mm-categoria.acesa span::before { animation: mmLuzLiga .7s ease-out forwards; }
.mm.tema-vitrine .mm-categoria.acesa span::after { animation: mmLinhaLiga .7s ease-out forwards; }
.mm.tema-vitrine .mm-categoria.acesa img { animation: mmSobeLuz .7s ease-out forwards; }
.mm.tema-vitrine .mm-categoria.acesa { color: #ffb27a; }
@keyframes mmLuzLiga { 0% { opacity: 0 } 12% { opacity: .9 } 20% { opacity: .15 } 32% { opacity: 1 } 40% { opacity: .4 } 55%, 100% { opacity: 1 } }
@keyframes mmLinhaLiga { 0% { background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.14)); box-shadow: 0 8px 14px rgba(0,0,0,0.35) }
  30% { background: linear-gradient(180deg, #ffd2a8, #ff8a3d); box-shadow: 0 0 6px #ff7a1a }
  40% { background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.14)); box-shadow: none }
  60%, 100% { background: linear-gradient(180deg, #ffd2a8, #ff8a3d); box-shadow: 0 0 8px #ff7a1a, 0 0 22px rgba(255,122,26,0.8) } }
@keyframes mmSobeLuz { 0% { transform: none } 100% { transform: translateY(-8px) scale(1.12) } }

/* vantagens */
.mm.tema-vitrine .mm-beneficios div { background: var(--vidro); border: 1px solid rgba(255,255,255,0.08); }
.mm.tema-vitrine .mm-beneficios p { color: rgba(255,255,255,0.65); }
.mm.tema-vitrine .mm-beneficios b { color: #fff; }

/* seções */
.mm.tema-vitrine .mm-secao-topo h2 { color: #fff; }
.mm.tema-vitrine .mm-secao-topo h2::before { display: none; }
.mm.tema-vitrine .mm-link { color: #ffb27a; }
.mm.tema-vitrine .mm-contador { color: rgba(255,255,255,0.6); }

/* produto em pé na prateleira de acrílico + etiqueta escura */
.mm.tema-vitrine .mm-card { background: transparent; border: none; padding: 0 2px; border-radius: 0; }
.mm.tema-vitrine .mm-card-foto { height: 170px; background: transparent; border-radius: 0; overflow: visible; align-items: flex-end; padding-bottom: 9px; }
.mm.tema-vitrine .mm-card-foto img { width: 86%; height: 100%; object-position: bottom; filter: drop-shadow(0 10px 10px rgba(0,0,0,0.4)); }
.mm.tema-vitrine .mm-card-foto::after { content: ''; position: absolute; left: -4px; right: -4px; bottom: 0; height: 7px; border-radius: 3px;
  background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12)); box-shadow: 0 6px 10px rgba(0,0,0,0.35); }
.mm.tema-vitrine .mm-card:hover .mm-card-foto::after, .mm.tema-vitrine .mm-card:active .mm-card-foto::after {
  background: linear-gradient(180deg, #ffd2a8, #ff8a3d); box-shadow: 0 0 10px #ff7a1a, 0 0 24px rgba(255,122,26,0.8); }
.mm.tema-vitrine .mm-card-nome, .mm.tema-vitrine .mm-card-info, .mm.tema-vitrine .mm-card .mm-preco, .mm.tema-vitrine .mm-card .mm-cores { background: var(--vidro); margin: 0; padding-left: 12px; padding-right: 12px; }
.mm.tema-vitrine .mm-card-nome { margin-top: 12px; padding-top: 10px; border-radius: 12px 12px 0 0; color: #fff; font-size: 15px; }
.mm.tema-vitrine .mm-card-info { color: rgba(255,255,255,0.6); font-size: 12.5px; padding-top: 2px; }
.mm.tema-vitrine .mm-card .mm-preco { padding-top: 6px; }
.mm.tema-vitrine .mm-card .mm-cores { padding-top: 8px; padding-bottom: 10px; margin-bottom: 10px; border-radius: 0 0 12px 12px; min-height: 0; }
.mm.tema-vitrine .mm-cores i { border-color: rgba(255,255,255,0.35); }
.mm.tema-vitrine .mm-btn-sacola { background: #fff; color: #111; }
.mm.tema-vitrine .mm-btn-sacola.dentro { background: rgba(255,102,0,0.2); color: #ffb27a; }
.mm.tema-vitrine .mm-selo { top: 0; }
.mm.tema-vitrine .mm-sem-foto { color: rgba(255,255,255,0.5); }
.mm.tema-vitrine .mm-card-fantasma { background: linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.12), rgba(255,255,255,0.05)); background-size: 200% 100%; }
.mm.tema-vitrine .mm-grade { gap: 22px 14px; }

/* preço */
.mm.tema-vitrine .mm-preco b { color: #fff; }
.mm.tema-vitrine .mm-preco-de { color: rgba(255,255,255,0.5); }
.mm.tema-vitrine .mm-preco b.mm-preco-cupom { color: #ffb27a; }

/* filtros, marcas, vazio */
.mm.tema-vitrine .mm-chips button { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.14); color: #fff; }
.mm.tema-vitrine .mm-chips button.on { background: #fff; color: #111; }
.mm.tema-vitrine .mm-escolha-marca p { color: rgba(255,255,255,0.7); }
.mm.tema-vitrine .mm-marcas button, .mm.tema-vitrine .mm-marcas-linha button { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.12); }
.mm.tema-vitrine .mm-marcas-linha button.on { background: rgba(255,102,0,0.15); border-color: var(--laranja); }
.mm.tema-vitrine .mm-marcas img, .mm.tema-vitrine .mm-marcas-linha img { filter: grayscale(1) brightness(0) invert(1); }
.mm.tema-vitrine .mm-marcas img.padrao, .mm.tema-vitrine .mm-marcas-linha img.padrao { filter: brightness(0) invert(1); }
.mm.tema-vitrine .mm-marca-texto, .mm.tema-vitrine .mm-todas { color: #fff; }
.mm.tema-vitrine .mm-vazio { color: rgba(255,255,255,0.7); }
.mm.tema-vitrine .mm-btn-contorno { border-color: rgba(255,255,255,0.22); color: #fff; }

/* rodapé */
.mm.tema-vitrine .mm-rodape { background: rgba(22,20,25,0.7); border-top-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75); }
.mm.tema-vitrine .mm-rodape-links, .mm.tema-vitrine .mm-copy { color: rgba(255,255,255,0.5); }
.mm.tema-vitrine .mm-rodape-links button { color: rgba(255,255,255,0.85); text-decoration-color: rgba(255,255,255,0.3); }
.mm.tema-vitrine .mm-copy { border-top-color: rgba(255,255,255,0.08); }

/* menu e sacola */
.mm.tema-vitrine .mm-menu, .mm.tema-vitrine .mm-gaveta { background: #252229; color: #fff; }
.mm.tema-vitrine .mm-menu nav button { color: #fff; }
.mm.tema-vitrine .mm-menu nav button:active, .mm.tema-vitrine .mm-gaveta-remover { background: rgba(255,255,255,0.08); }
.mm.tema-vitrine .mm-gaveta-item small, .mm.tema-vitrine .mm-limpar { color: rgba(255,255,255,0.6); }
.mm.tema-vitrine .mm-gaveta-foto { background: rgba(255,255,255,0.06); }
.mm.tema-vitrine .mm-barra-sacola { background: #1c1a1f; }
.mm.tema-vitrine .mm-cupom-campo button { background: #fff; color: #111; }
.mm.tema-vitrine .mm-cupom-ativo { background: rgba(255,102,0,0.15); color: #ffb27a; }
.mm.tema-vitrine .mm-aviso-flutuante { background: #fff; color: #111; }

/* acessórios por celular */
.mm.tema-vitrine .mm-celular-escolhido { background: var(--vidro); border: 1px solid rgba(255,255,255,0.08); }
.mm.tema-vitrine .mm-celular-escolhido small { color: rgba(255,255,255,0.6); }
.mm.tema-vitrine .mm-kit { background: #1c1a1f; }

/* página do produto: aparelho em pé na prateleira acesa */
.mm.tema-vitrine .mm-galeria { background: transparent; }
.mm.tema-vitrine .mm-galeria-item { position: relative; height: 400px; padding: 24px 24px 44px; align-items: flex-end; }
.mm.tema-vitrine .mm-galeria-item img { filter: drop-shadow(0 22px 24px rgba(0,0,0,0.5)); }
.mm.tema-vitrine .mm-galeria-item::after { content: ''; position: absolute; left: 18%; right: 18%; bottom: 34px; height: 9px; border-radius: 4px;
  background: linear-gradient(180deg, #ffd2a8, #ff8a3d); box-shadow: 0 0 10px #ff7a1a, 0 0 26px rgba(255,122,26,0.8), 0 16px 40px 10px rgba(255,110,30,0.28); }
.mm.tema-vitrine .mm-pontos i { background: rgba(255,255,255,0.3); }
.mm.tema-vitrine .mm-pontos i.on { background: #fff; }
.mm.tema-vitrine .mm-detalhe-marca { color: #ffb27a; }
.mm.tema-vitrine .mm-detalhe-nome { color: #fff; }
.mm.tema-vitrine .mm-compartilhar { background: rgba(255,255,255,0.1); color: #fff; }
.mm.tema-vitrine .mm-cor { background: rgba(0,0,0,0.18); border-color: rgba(255,255,255,0.18); color: #fff; }
.mm.tema-vitrine .mm-cor i { border-color: rgba(255,255,255,0.4); }
.mm.tema-vitrine .mm-cor.on { border-color: var(--laranja); background: rgba(255,102,0,0.15); color: #fff; }
.mm.tema-vitrine .mm-spec { background: var(--vidro); border: 1px solid rgba(255,255,255,0.08); }
.mm.tema-vitrine .mm-spec small { color: rgba(255,255,255,0.55); }
.mm.tema-vitrine .mm-descricao { color: rgba(255,255,255,0.75); }
.mm.tema-vitrine .mm-voltar { color: #ffb27a; }
.mm.tema-vitrine .mm-barra-fixa { background: rgba(28,26,31,0.9); border-top-color: rgba(255,255,255,0.08); }
.mm.tema-vitrine .mm-btn-sacola-grande { color: #fff; border-color: rgba(255,255,255,0.25); }
.mm.tema-vitrine .mm-btn-sacola-grande.dentro { background: rgba(255,102,0,0.18); color: #ffb27a; }
@media (min-width: 760px) {
  .mm.tema-vitrine .mm-card-foto { height: 210px; }
  .mm.tema-vitrine .mm-categoria { width: 140px; }
  .mm.tema-vitrine .mm-categoria span { width: 140px; height: 150px; }
}
`

export default App
