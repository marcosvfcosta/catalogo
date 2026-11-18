import { useEffect, useState } from 'react'
import { baseModelo, carregarFotosCatalogo, completarFotos, type ComFotos } from '../lib/fotosCatalogo'
import { chaveVariante, memoriaDe, nomeSemMemoria } from '../lib/variantes'
import { useVoltarDeslizando } from '../lib/voltarDeslizando'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { recortarProduto } from '../lib/recortarProduto'
import CartaoAparelho, { marcaDoAparelho, precosComFornecedor, listaValida, CORES_BOLINHA, type DiaPreco } from '../components/CartaoAparelho'
import AssistenteIA from './AssistenteIA'
import VitrineAdmin from './VitrineAdmin'

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
  tipo?: string | null
  compativel?: string[] | null
  conector?: string | null
  preco?: number
  preco_antigo?: number | null
  mostrar_preco?: boolean | null
  disponivel?: boolean
  destaque?: boolean
  lancamento?: boolean
  promocao?: boolean
  mais_procurado?: boolean
  na_loja?: boolean | null
  chave?: string | null
  origem?: string | null
  ultima_lista?: string | null
}

type HeroImagem = {
  id: string
  url: string
  ordem: number
  ativo: boolean
  titulo?: string | null
  etiqueta?: string | null
}

type ProdutoFoto = {
  id: string
  produto_id: string
  url: string
  cor?: string | null
  ordem: number
}

type Aparelho = {
  id: string
  modelo: string
  cores: string[]
  fotos: Record<string, string[]>
  marca?: string | null
  memoria?: string | null
  custo?: number | null
  preco?: number | null
  precos_cor?: Record<string, number> | null
  chave?: string | null
  disponivel?: boolean | null
  fornecedor?: string | null
  ofertas?: Ofertas | null
  historico?: DiaPreco[] | null
  ultima_lista?: string | null
  na_loja?: boolean | null
}

// Preços de todos os fornecedores do dia, por cor (para achar outro fornecedor quando o mais barato não tem)
type Ofertas = { dia: string; itens: { f: string; cor: string; custo: number }[]; manual?: boolean }
const diaHoje = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no horário do aparelho

type ItemLista = {
  marca: string
  modelo: string
  memoria: string
  ram: string | null
  rede: string | null
  cores: string[]
  custo: number
  custos_cor?: Record<string, number> // quando cada cor tem um preço (ex: Branco mais caro)
  cpo?: boolean // recondicionado (CPO)
}

type ItemPreparado = ItemLista & {
  nome: string
  chave: string
  status: 'novo' | 'alterado' | 'igual' | 'maiscaro'
  custoAntigo: number | null
  fornecedorAntigo?: string | null
  marcado: boolean
}

// Início do dia de hoje (horário do aparelho)
function inicioDeHoje() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
const vistoHoje = (data: string | null | undefined) => !!data && new Date(data) >= inicioDeHoje()

type Saida = { tipo: 'produto' | 'aparelho'; id: string; nome: string; marcado: boolean }

const MEMORIAS = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB']

// Lucro por armazenamento (preço de venda = custo + lucro)
function lucroPorMemoria(memoria: string | null | undefined) {
  const m = (memoria || '').toUpperCase().replace(/\s/g, '')
  if (m.includes('512') || m.includes('1TB') || m.includes('2TB')) return 600
  if (m.includes('256')) return 550
  return 450
}

const normalizar = (t: string | null | undefined) =>
  (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// iPhone/iPad: cada fornecedor escreve de um jeito (com 5G, com RAM...). Sem isso o mesmo aparelho
// virava dois e o preço mais barato não era comparado.
const ehApple = (i: { marca?: string | null; modelo?: string | null }) =>
  /apple/i.test(i.marca || '') || /^(iphone|ipad)/i.test((i.modelo || '').trim())

function montarNome(i: ItemLista): string {
  // CPO vira um aparelho separado do novo (só na Negociação aparece "CPO")
  if (i.cpo) return montarNome({ ...i, cpo: false }) + ' CPO'
  if (ehApple(i)) return [i.modelo, i.memoria].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return [i.modelo, i.memoria, i.ram ? `${i.ram} RAM` : '', i.rede || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

// Chave para achar o mesmo aparelho entre listas de fornecedores diferentes
function chaveComparar(chaveOuNome: string | null | undefined) {
  let k = normalizar(chaveOuNome)
  const cpo = k.endsWith('cpo')
  if (cpo) k = k.slice(0, -3)
  k = k.replace(/nfc/g, '') // com ou sem NFC é o mesmo aparelho
  if (/^(iphone|ipad)/.test(k)) k = k.replace(/\d+gbram/g, '').replace(/[45]g$/, '')
  else k = k.replace(/4g$/, '') // "4G" no fim é o mesmo aparelho; só "5G" separa
  return k + (cpo ? 'cpo' : '')
}

function fmtReal(v: number | null | undefined) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type CapaModelo = {
  id: string
  marca: string
  modelo: string
  entrada?: string | null
  foto_url: string | null
  ordem: number
}

type CapaFoto = {
  id: string
  modelo_id: string
  tipo: string
  url: string
}

// ─── Acessórios: tipo e compatibilidade ───
const TIPOS_ACESSORIO = [
  { v: '', l: 'Não é acessório (celular, tablet...)' },
  { v: 'capa', l: '📱 Capa' },
  { v: 'pelicula', l: '🛡 Película' },
  { v: 'carregador', l: '🔌 Carregador' },
  { v: 'cabo', l: '➰ Cabo' },
  { v: 'fone', l: '🎧 Fone' },
]
const ENTRADAS = ['USB-C', 'Lightning']
type CamposAcessorio = { tipo: string; compativel: string[]; conector: string }
function numeroBR(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  const t = v.replace(/[^\d,.-]/g, '')
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return isFinite(n) && n > 0 ? n : null
}

function dadosAcessorio(v: CamposAcessorio) {
  const porModelo = v.tipo === 'capa' || v.tipo === 'pelicula'
  const porEntrada = v.tipo === 'carregador' || v.tipo === 'cabo' || v.tipo === 'fone'
  return {
    tipo: v.tipo || null,
    compativel: porModelo ? v.compativel : null,
    conector: porEntrada ? (v.conector || null) : null,
  }
}

const CATEGORIAS_PADRAO = ['Celulares', 'Tablet', 'Carregadores', 'Fones', 'Smartwatch', 'Caixa de som']

const CAPAS_MARCAS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Outra']
const CAPAS_TIPOS = ['Feminino', 'Masculino', 'Transparente', 'Decorado', 'Case']

const CORES_LISTA = ["Lilás","Preto","Branco","Vermelho","Azul","Verde","Amarelo","Rosa","Roxo","Laranja","Cinza","Dourado","Prata","Titânio Natural","Titânio Preto","Titânio Branco","Titânio Deserto","Meia-Noite","Estelar","Azul-Sierra","Rosa-Claro","Verde-Água","Azul-Alpino","Verde-Floresta","Vermelho-Produto","Luz das Estrelas","Azul-Pacífico","Roxo-Profundo","Cobre","Bordô"]

const CORES_HEX: Record<string, string> = {
  "Preto": "#1a1a1a", "Branco": "#f5f5f5", "Vermelho": "#c0392b", "Azul": "#2980b9",
  "Verde": "#27ae60", "Amarelo": "#f1c40f", "Rosa": "#e91e8c", "Roxo": "#8e44ad",
  "Laranja": "#e67e22", "Cinza": "#7f8c8d", "Dourado": "#d4af37", "Prata": "#bdc3c7",
  "Titânio Natural": "#8a8272", "Titânio Preto": "#2d2926", "Titânio Branco": "#e8e4dc",
  "Titânio Deserto": "#c2a882", "Meia-Noite": "#1c2340", "Estelar": "#f0ece2",
  "Azul-Sierra": "#4a7fa5", "Rosa-Claro": "#f4a7b9", "Verde-Água": "#00b4d8",
  "Azul-Alpino": "#5b8db8", "Verde-Floresta": "#2d6a4f", "Vermelho-Produto": "#a4161a",
  "Luz das Estrelas": "#f8f4e8", "Azul-Pacífico": "#005f73", "Roxo-Profundo": "#4a0e5e",
  "Cobre": "#b87333", "Bordô": "#6d1a2a", "Lilás": "#c8a2c8"
}

export default function Admin() {
  const navigate = useNavigate()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aba, setAba] = useState<'cadastrar' | 'lista' | 'capas' | 'aparelhos' | 'hero' | 'vitrine' | 'ia' | 'precos'>('cadastrar')
  const [marcaPreco, setMarcaPreco] = useState('Todos')
  const [precoAberto, setPrecoAberto] = useState<string | null>(null)
  const [memAdmin, setMemAdmin] = useState<Record<string, string>>({}) // memória escolhida em cada modelo (Preços)
  const [uploadandoHero, setUploadandoHero] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  useVoltarDeslizando(editando ? () => { setEditando(null); setFotosEdicao([]) } : null)
  const [heroImagens, setHeroImagens] = useState<HeroImagem[]>([])
  const [fotosNovas, setFotosNovas] = useState<string[]>([]) // fotos do produto novo (a 1ª é a capa)
  // Foto original guardada para o botão "usar original" (chave = url da foto ajustada)
  const [originais, setOriginais] = useState<Record<string, File>>({})
  const [enviandoFotos, setEnviandoFotos] = useState<{ feitas: number; total: number } | null>(null)
  const [ajusteAuto, setAjusteAuto] = useState(() => {
    try { return localStorage.getItem('ajusteAutoFotos') !== 'nao' } catch { return true }
  })
  const [fotosEdicao, setFotosEdicao] = useState<ProdutoFoto[]>([])
  // Fundo com IA: url nova → url de antes (para o botão "voltar")
  const [antesIA, setAntesIA] = useState<Record<string, string>>({})
  const [iaTrabalhando, setIaTrabalhando] = useState<string | null>(null)
  const [avisoIA, setAvisoIA] = useState('') // aviso enquanto a IA baixa / recorta
  const [apPrecosCor, setApPrecosCor] = useState<Record<string, string>>({})

  const [aparelhos, setAparelhos] = useState<Aparelho[]>([])
  const [fotosCat, setFotosCat] = useState<ComFotos[]>([])
  const [novoModelo, setNovoModelo] = useState('')
  const [coresSelecionadas, setCoresSelecionadas] = useState<string[]>([])
  const [fotosAparelho, setFotosAparelho] = useState<Record<string, string[]>>({})
  const [uploadandoFotoAp, setUploadandoFotoAp] = useState<string | null>(null)
  const [editandoAparelho, setEditandoAparelho] = useState<Aparelho | null>(null)
  const [novoAparelhoAberto, setNovoAparelhoAberto] = useState(false)
  const [salvandoAparelho, setSalvandoAparelho] = useState(false)
  const [apMemoria, setApMemoria] = useState('')
  const [apCusto, setApCusto] = useState('')
  const [apPreco, setApPreco] = useState('')

  // ─── Lista do dia ───
  const [modoCadastro, setModoCadastro] = useState<'produto' | 'lista'>('produto')
  const [textoLista, setTextoLista] = useState('')
  const [lendoLista, setLendoLista] = useState(false)
  // De qual fornecedor é a lista colada (fica salvo no aparelho o fornecedor do preço mais barato)
  const [fornecedorLista, setFornecedorLista] = useState('')
  // Chave "Incluir CPO": ligada cadastra os CPO (separados do novo); desligada ignora os CPO da lista
  const [incluirCpo, setIncluirCpo] = useState(() => { try { return localStorage.getItem('incluirCpo') === 'sim' } catch { return false } })
  const [fornecedoresSalvos, setFornecedoresSalvos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fornecedores') || '[]') } catch { return [] }
  })
  const [itensLista, setItensLista] = useState<ItemPreparado[] | null>(null)
  const [saidas, setSaidas] = useState<Saida[]>([])
  const [finalizando, setFinalizando] = useState(false)
  const [resumoHoje, setResumoHoje] = useState<{ vistos: number; faltando: number } | null>(null)
  const [aplicandoLista, setAplicandoLista] = useState<{ feitos: number; total: number } | null>(null)
  const [filtroProdutos, setFiltroProdutos] = useState<'todos' | 'disponiveis' | 'indisponiveis' | 'semfoto'>('todos')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [marcaProduto, setMarcaProduto] = useState('')

  // ─── Capas ───
  const [capasModelos, setCapasModelos] = useState<CapaModelo[]>([])
  const [capasFotos, setCapasFotos] = useState<CapaFoto[]>([])
  const [capaForm, setCapaForm] = useState({ marca: 'Apple', modelo: '', foto_url: '', entrada: '' })
  const [buscaCompat, setBuscaCompat] = useState('')
  const [capaEditandoId, setCapaEditandoId] = useState<string | null>(null)
  const [capaSalvando, setCapaSalvando] = useState(false)
  const [capaUploadModelo, setCapaUploadModelo] = useState(false)
  const [capaAberta, setCapaAberta] = useState<CapaModelo | null>(null)
  const [capaTipo, setCapaTipo] = useState(CAPAS_TIPOS[0])
  const [capaEnviando, setCapaEnviando] = useState<{ feitas: number; total: number } | null>(null)
  const [capaBusca, setCapaBusca] = useState('')
  const [categoriasNomes, setCategoriasNomes] = useState<string[]>(CATEGORIAS_PADRAO)

  const [novoProduto, setNovoProduto] = useState({
    categoria: 'Celulares',
    marca: '', modelo: '', memoria: '', cor: '', condicao: '',
    bateria_saude: '', preco: '', foto_url: '', descricao: '',
    disponivel: true, destaque: false, lancamento: false,
    promocao: false, mais_procurado: false,
    tipo: '', compativel: [] as string[], conector: '',
    preco_antigo: '', mostrar_preco: false, na_loja: false,
  })

  useEffect(() => {
    carregarProdutos(); carregarHeroImagens(); carregarAparelhos(); carregarCapas(); carregarCategorias()
  }, [])

  async function carregarProdutos() {
    const { data } = await supabase.from('produtos_catalogo').select('*').order('created_at', { ascending: false })
    setProdutos(data || [])
  }

  async function colocarHeroPrimeiro(id: string) {
    const menor = Math.min(0, ...heroImagens.map(h => h.ordem || 0))
    await supabase.from('hero_imagens').update({ ordem: menor - 1, ativo: true }).eq('id', id)
    carregarHeroImagens()
  }

  async function carregarHeroImagens() {
    const { data } = await supabase.from('hero_imagens').select('*').order('ordem', { ascending: true })
    setHeroImagens(data || [])
  }

  async function carregarFotosEdicao(produtoId: string) {
    const { data } = await supabase.from('produto_fotos').select('*').eq('produto_id', produtoId).order('ordem')
    setFotosEdicao(data || [])
  }

  // Trocar o fornecedor de um aparelho (quando o mais barato não tem mais): muda custo e venda até a próxima lista
  async function usarFornecedor(ap: Aparelho, fornecedor: string) {
    const novo = precosComFornecedor(ap, fornecedor)
    if (!novo) return
    if (!confirm(`Usar ${fornecedor} no ${ap.modelo}?\nCusto ${fmtReal(novo.custo)} · venda a partir de ${fmtReal(Math.min(...Object.values(novo.precos_cor)))}`)) return
    const { error } = await supabase.from('aparelhos').update(novo).eq('id', ap.id)
    if (error) { alert('Erro: ' + error.message); return }
    carregarAparelhos()
  }

  async function carregarAparelhos() {
    const { data } = await supabase.from('aparelhos').select('*').order('modelo')
    const lista = (data || []) as Aparelho[]
    // Ordem importa: primeiro tira o que é de lista vencida, pra preço velho não se misturar com o de hoje
    if (await zerarListaVencida(lista)) return carregarAparelhos()
    if (await juntarDuplicados(lista)) return carregarAparelhos()
    if (await recalcularPeloDia(lista)) return carregarAparelhos()
    sincronizarPrecosCatalogo(lista)
    setAparelhos(lista)
    carregarFotosCatalogo().then(setFotosCat).catch(() => {})
  }

  // Catálogo mostra o mesmo preço de venda da Negociação nos celulares que vieram da lista (custo nunca vai)
  async function sincronizarPrecosCatalogo(lista: Aparelho[]) {
    // Preço de cada cor também vai (a cor mais cara aparece mais cara no catálogo)
    // Todos os celulares do catálogo (da lista e os cadastrados à mão) pegam o preço da lista do dia
    const r1 = await supabase.from('produtos_catalogo').select('*')
    const comColunaCor = !r1.error && (r1.data || []).some(x => 'precos_cor' in (x as object))
    const prods = ((r1.data || []) as { id: string; chave?: string | null; modelo: string; memoria?: string | null; cor?: string | null; categoria?: string | null; origem?: string | null; na_loja?: boolean | null; preco?: number | null; mostrar_preco?: boolean | null; precos_cor?: Record<string, number> | null }[])
      .filter(p => !p.na_loja && (p.origem === 'lista' || (p.categoria || '').toLowerCase().includes('celular')))
    const disponiveis = lista.filter(a => a.disponivel !== false && a.preco != null && a.chave)
    let mudou = 0
    for (const p of prods) {
      // CPO entra junto do mesmo modelo no catálogo
      const semCpo = (t: string) => t.replace(/cpo$/, '')
      const k = semCpo(p.origem === 'lista' ? chaveComparar(p.chave || p.modelo) : chaveComparar(`${p.modelo} ${p.memoria || ''}`))
      const iguais = disponiveis.filter(a => semCpo(chaveComparar(a.chave!)) === k)
      if (!iguais.length) continue
      // Cores desse GB: exatamente as que vieram nas listas de hoje
      const cor = Array.from(new Set(iguais.flatMap(a => a.cores || []))).join(', ')
      const preco = Math.min(...iguais.map(a => Number(a.preco)))
      const precosCor: Record<string, number> = {}
      for (const a of iguais) for (const c of a.cores || []) {
        const v = Number(a.precos_cor?.[c] ?? a.preco)
        if (precosCor[c] == null || v < precosCor[c]) precosCor[c] = v
      }
      const corIgual = !comColunaCor || JSON.stringify(p.precos_cor || {}) === JSON.stringify(precosCor)
      if (Number(p.preco) === preco && p.mostrar_preco && corIgual && (p.cor || '') === cor) continue
      const dados: Record<string, unknown> = { preco, mostrar_preco: true, cor }
      if (comColunaCor) dados.precos_cor = precosCor
      const { error } = await supabase.from('produtos_catalogo').update(dados).eq('id', p.id)
      if (!error) mudou++
    }
    if (mudou) carregarProdutos()
  }

  // Às 10h do dia seguinte a lista vence: o que não veio em lista de hoje fica indisponível
  // (Negociação, Preços e catálogo). Os marcados "Tenho na loja" ficam.
  async function zerarListaVencida(lista: Aparelho[]) {
    const ids = lista.filter(a => a.chave && a.disponivel !== false && !a.na_loja && !listaValida(a.ultima_lista)).map(a => a.id)
    const { data: prods } = await supabase.from('produtos_catalogo').select('*').eq('origem', 'lista')
    const prodIds = ((prods || []) as { id: string; disponivel?: boolean; na_loja?: boolean | null; ultima_lista?: string | null }[])
      .filter(p => p.disponivel !== false && !p.na_loja && !listaValida(p.ultima_lista)).map(p => p.id)
    if (prodIds.length) { await supabase.from('produtos_catalogo').update({ disponivel: false }).in('id', prodIds); carregarProdutos() }
    if (!ids.length) return false
    const { error } = await supabase.from('aparelhos').update({ disponivel: false }).in('id', ids)
    return !error
  }

  // Preço sempre do dia: refaz custo, preço e preço de cada cor só com as ofertas dos fornecedores de hoje
  async function recalcularPeloDia(lista: Aparelho[]) {
    const hoje = diaHoje()
    let mudou = false
    for (const a of lista) {
      if (a.na_loja || a.disponivel === false || a.ofertas?.dia !== hoje || a.ofertas.manual || !a.ofertas.itens.length) continue
      const lucro = lucroPorMemoria(a.memoria || a.modelo)
      const itens = a.ofertas.itens
      const melhor = itens.reduce((x, y) => y.custo < x.custo ? y : x)
      const precosCor: Record<string, number> = {}
      for (const o of itens) { const v = o.custo + lucro; if (precosCor[o.cor] == null || v < precosCor[o.cor]) precosCor[o.cor] = v }
      const cores = Array.from(new Set(itens.map(o => o.cor)))
      // Só conserta preço "impossível" pra hoje (mais barato que qualquer fornecedor de hoje, ou cor que ninguém mandou hoje).
      // Se você escolheu outro fornecedor de propósito (mais caro), fica como está
      const velho = Number(a.custo) < melhor.custo
        || (a.cores || []).some(c => !cores.includes(c))
        || Object.entries(a.precos_cor || {}).some(([c, v]) => precosCor[c] == null || Number(v) < precosCor[c])
      if (!velho) continue
      const { error } = await supabase.from('aparelhos').update({ custo: melhor.custo, preco: melhor.custo + lucro, precos_cor: precosCor, cores, fornecedor: melhor.f }).eq('id', a.id)
      if (!error) mudou = true
    }
    return mudou
  }

  // Mesmo aparelho cadastrado 2x (ex: "Galaxy A07 128GB" e "Galaxy A07 128GB 4G"):
  // junta num só (menor preço de cada cor, todas as cores e fornecedores) e tira o outro
  async function juntarDuplicados(lista: Aparelho[]) {
    const grupos = new Map<string, Aparelho[]>()
    for (const a of lista) {
      if (a.disponivel === false || !a.chave) continue
      const k = chaveComparar(a.chave)
      grupos.set(k, [...(grupos.get(k) || []), a])
    }
    let mudou = false
    for (const g0 of grupos.values()) {
      // Só junta o que veio em lista de hoje (o de ontem fica de fora, não leva preço velho)
      const g = g0.filter(a => listaValida(a.ultima_lista))
      if (g.length < 2 || g.some(a => a.na_loja)) continue // o da loja tem preço travado: não mexe
      const comPreco = g.filter(a => a.preco != null)
      const barato = (comPreco.length ? comPreco : g).reduce((x, y) => Number(y.preco) < Number(x.preco) ? y : x)
      const principal = g.find(a => !/\b4g\b/i.test(a.modelo)) || g[0]
      const outros = g.filter(a => a.id !== principal.id)
      const cores = Array.from(new Set(g.flatMap(a => a.cores || [])))
      const precosCor: Record<string, number> = {}
      for (const a of g) for (const [c, v] of Object.entries(a.precos_cor || {})) {
        if (v != null && (precosCor[c] == null || Number(v) < precosCor[c])) precosCor[c] = Number(v)
      }
      const fotos: Record<string, string[]> = { ...(principal.fotos || {}) }
      for (const a of outros) for (const [c, fs] of Object.entries(a.fotos || {})) if (!fotos[c]?.length && fs?.length) fotos[c] = fs
      const hoje = diaHoje()
      const itens = g.flatMap(a => a.ofertas?.dia === hoje ? a.ofertas.itens : [])
      const ultima = g.map(a => a.ultima_lista || '').sort().pop() || null
      const dados: Record<string, unknown> = {
        cores, fotos, precos_cor: precosCor, custo: barato.custo, preco: barato.preco, fornecedor: barato.fornecedor ?? null,
        ultima_lista: ultima,
      }
      if (itens.length) dados.ofertas = { dia: hoje, itens }
      const { error } = await supabase.from('aparelhos').update(dados).eq('id', principal.id)
      if (error) { console.error('Juntar duplicados:', error); continue }
      const r2 = await supabase.from('aparelhos').update({ disponivel: false }).in('id', outros.map(a => a.id))
      if (!r2.error) mudou = true
    }
    return mudou
  }

  // ─── Capas: funções ───
  async function carregarCategorias() {
    const { data } = await supabase.from('catalogo_categorias').select('nome, tipo').order('ordem')
    const nomes = ((data || []) as { nome: string; tipo: string }[]).filter(c => c.tipo !== 'capas').map(c => c.nome)
    if (nomes.length) setCategoriasNomes(nomes)
  }

  async function carregarCapas() {
    const [m, f] = await Promise.all([
      supabase.from('capas_modelos').select('*').order('ordem').order('modelo'),
      supabase.from('capas_fotos').select('*').order('created_at', { ascending: false }),
    ])
    setCapasModelos(m.data || [])
    setCapasFotos(f.data || [])
  }

  function alternarAjuste(v: boolean) {
    setAjusteAuto(v)
    try { localStorage.setItem('ajusteAutoFotos', v ? 'sim' : 'nao') } catch { /* sem armazenamento */ }
  }

  // Envia para o Storage tentando até 3 vezes (o Supabase às vezes responde 504 / internet do 4G oscila)
  async function subirComRetentativa(nome: string, arquivo: File) {
    let ultimo: { error: unknown } = { error: null }
    for (let t = 0; t < 3; t++) {
      if (t) await new Promise(r => setTimeout(r, 1500 * t))
      const r = await supabase.storage.from('fotos').upload(nome, arquivo, { upsert: true, contentType: arquivo.type || 'image/jpeg' })
      if (!r.error) return r
      ultimo = r
    }
    return ultimo
  }

  // Ajusta (se ligado) e envia para o Storage. Devolve a url e, se ajustou, a original
  async function enviarFoto(arquivo: File, prefixo: string, pasta = ''): Promise<{ url: string; original?: File }> {
    // Recorte com IA grátis (no aparelho). Se der errado, envia a foto original sem mexer
    let aj = { arquivo, ajustou: false }
    if (ajusteAuto) {
      try { aj = { arquivo: await recortarProduto(arquivo, setAvisoIA), ajustou: true } }
      catch (e) { console.error('Recorte:', e) }
      setAvisoIA('')
    }
    const final = aj.arquivo
    const ext = (final.name.split('.').pop() || 'jpg').toLowerCase()
    const nomeArquivo = `${pasta}${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await subirComRetentativa(nomeArquivo, final)
    if (error) throw error
    const url = supabase.storage.from('fotos').getPublicUrl(nomeArquivo).data.publicUrl
    return { url, original: aj.ajustou ? arquivo : undefined }
  }

  // Envia a foto original (sem ajuste) — usado no botão "usar original"
  async function enviarOriginal(arquivo: File, prefixo: string) {
    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase()
    const nomeArquivo = `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await subirComRetentativa(nomeArquivo, arquivo)
    if (error) throw error
    return supabase.storage.from('fotos').getPublicUrl(nomeArquivo).data.publicUrl
  }

  // ─── Recorte com IA grátis (roda no aparelho, sem custo) ───
  async function recortarUrl(url: string) {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) throw new Error('Não consegui abrir a foto')
    try { return await enviarOriginal(await recortarProduto(await r.blob(), setAvisoIA), 'ia') }
    finally { setAvisoIA('') }
  }

  async function recortarCapinha(f: CapaFoto) {
    setIaTrabalhando(f.url)
    try {
      const nova = await recortarUrl(f.url)
      await supabase.from('capas_fotos').update({ url: nova }).eq('id', f.id)
      setAntesIA(prev => ({ ...prev, [nova]: f.url }))
      await carregarCapas()
    } catch (e) { alert('Não deu certo: ' + (e instanceof Error ? e.message : e)) }
    setIaTrabalhando(null)
  }

  async function voltarCapinha(f: CapaFoto) {
    const antes = antesIA[f.url]
    if (!antes) return
    await supabase.from('capas_fotos').update({ url: antes }).eq('id', f.id)
    setAntesIA(prev => { const n = { ...prev }; delete n[f.url]; return n })
    carregarCapas()
  }

  async function iaFotoEdicao(url: string, fotoId?: string) {
    if (!editando) return
    setIaTrabalhando(url)
    try {
      const nova = await recortarUrl(url)
      if (fotoId) await supabase.from('produto_fotos').update({ url: nova }).eq('id', fotoId)
      else {
        await supabase.from('produtos_catalogo').update({ foto_url: nova }).eq('id', editando.id)
        setEditando({ ...editando, foto_url: nova })
        setProdutos(prev => prev.map(p => p.id === editando.id ? { ...p, foto_url: nova } : p))
      }
      setAntesIA(prev => ({ ...prev, [nova]: url }))
      carregarFotosEdicao(editando.id)
    } catch (e) { alert('Não deu certo: ' + (e instanceof Error ? e.message : e)) }
    setIaTrabalhando(null)
  }

  async function voltarFotoEdicao(url: string, fotoId?: string) {
    if (!editando) return
    const antes = antesIA[url]
    if (!antes) return
    if (fotoId) await supabase.from('produto_fotos').update({ url: antes }).eq('id', fotoId)
    else {
      await supabase.from('produtos_catalogo').update({ foto_url: antes }).eq('id', editando.id)
      setEditando({ ...editando, foto_url: antes })
      setProdutos(prev => prev.map(p => p.id === editando.id ? { ...p, foto_url: antes } : p))
    }
    setAntesIA(prev => { const n = { ...prev }; delete n[url]; return n })
    carregarFotosEdicao(editando.id)
  }

  // Envia várias fotos em sequência, com contador
  async function enviarVarias(arquivos: File[], prefixo: string, aoEnviar: (url: string) => Promise<void> | void, pasta = '') {
    if (arquivos.length === 0) return
    setEnviandoFotos({ feitas: 0, total: arquivos.length })
    let falhas = 0
    let ultimoErro = ''
    for (let i = 0; i < arquivos.length; i++) {
      try {
        const { url, original } = await enviarFoto(arquivos[i], prefixo, pasta)
        if (original) setOriginais(prev => ({ ...prev, [url]: original }))
        await aoEnviar(url)
      } catch (e) {
        falhas++
        ultimoErro = e instanceof Error ? e.message : (e as { message?: string })?.message || String(e)
        console.error(e)
      }
      setEnviandoFotos({ feitas: i + 1, total: arquivos.length })
    }
    setEnviandoFotos(null)
    if (falhas) alert(`${falhas} foto(s) não foram enviadas. Tente de novo.\n\nMotivo: ${ultimoErro}`)
  }

  // ─── Fotos do produto novo ───
  async function adicionarFotosNovas(arquivos: File[]) {
    await enviarVarias(arquivos, 'prod', url => { setFotosNovas(prev => [...prev, url]) })
  }

  async function usarOriginalNova(url: string) {
    const original = originais[url]
    if (!original) return
    try {
      const nova = await enviarOriginal(original, 'prod')
      setFotosNovas(prev => prev.map(u => u === url ? nova : u))
      setOriginais(prev => { const n = { ...prev }; delete n[url]; return n })
    } catch { alert('Erro ao enviar a original') }
  }

  function tornarCapaNova(url: string) {
    setFotosNovas(prev => [url, ...prev.filter(u => u !== url)])
  }

  // ─── Fotos do produto em edição (capa = foto_url, demais = produto_fotos) ───
  async function adicionarFotosEdicao(arquivos: File[]) {
    if (!editando) return
    const prod = editando
    let capa = prod.foto_url || ''
    let ordem = fotosEdicao.length
    await enviarVarias(arquivos, 'prod', async url => {
      if (!capa) {
        capa = url
        await supabase.from('produtos_catalogo').update({ foto_url: url }).eq('id', prod.id)
        setEditando(prev => prev ? { ...prev, foto_url: url } : prev)
      } else {
        ordem++
        await supabase.from('produto_fotos').insert([{ produto_id: prod.id, url, ordem }])
      }
    })
    carregarFotosEdicao(prod.id)
  }

  async function excluirCapaEdicao() {
    if (!editando || !confirm('Excluir esta foto?')) return
    const proxima = fotosEdicao[0]
    const nova = proxima ? proxima.url : ''
    await supabase.from('produtos_catalogo').update({ foto_url: nova }).eq('id', editando.id)
    if (proxima) await supabase.from('produto_fotos').delete().eq('id', proxima.id)
    setEditando({ ...editando, foto_url: nova })
    carregarFotosEdicao(editando.id)
  }

  async function tornarCapaEdicao(foto: ProdutoFoto) {
    if (!editando) return
    const capaAtual = editando.foto_url
    const corCapa = editando.foto_cor || null
    await supabase.from('produtos_catalogo').update({ foto_url: foto.url }).eq('id', editando.id)
    await supabase.from('produtos_catalogo').update({ foto_cor: foto.cor || null }).eq('id', editando.id)
    if (capaAtual) {
      await supabase.from('produto_fotos').update({ url: capaAtual }).eq('id', foto.id)
      await supabase.from('produto_fotos').update({ cor: corCapa }).eq('id', foto.id)
    } else await supabase.from('produto_fotos').delete().eq('id', foto.id)
    setEditando({ ...editando, foto_url: foto.url, foto_cor: foto.cor || null })
    carregarFotosEdicao(editando.id)
  }

  // ─── Cor de cada foto (bolinhas do catálogo) ───
  function coresDoProduto(p: Produto | null) {
    const lista = (p?.cor || '').split(/[,/;]| e /).map(c => c.trim()).filter(Boolean)
    return lista.length ? lista : CORES_LISTA
  }

  async function definirCorFoto(foto: ProdutoFoto | null, cor: string) {
    if (!editando) return
    const valor = cor || null
    if (!foto) {
      const { error } = await supabase.from('produtos_catalogo').update({ foto_cor: valor }).eq('id', editando.id)
      if (error) { alert('Rode o SQL novo no Supabase para salvar as cores das fotos.'); return }
      setEditando({ ...editando, foto_cor: valor })
      setProdutos(prev => prev.map(p => p.id === editando.id ? { ...p, foto_cor: valor } : p))
    } else {
      const { error } = await supabase.from('produto_fotos').update({ cor: valor }).eq('id', foto.id)
      if (error) { alert('Rode o SQL novo no Supabase para salvar as cores das fotos.'); return }
      setFotosEdicao(prev => prev.map(f => f.id === foto.id ? { ...f, cor: valor } : f))
    }
  }

  async function usarOriginalEdicao(url: string, fotoId?: string) {
    if (!editando) return
    const original = originais[url]
    if (!original) return
    try {
      const nova = await enviarOriginal(original, 'prod')
      if (fotoId) await supabase.from('produto_fotos').update({ url: nova }).eq('id', fotoId)
      else {
        await supabase.from('produtos_catalogo').update({ foto_url: nova }).eq('id', editando.id)
        setEditando({ ...editando, foto_url: nova })
      }
      setOriginais(prev => { const n = { ...prev }; delete n[url]; return n })
      carregarFotosEdicao(editando.id)
    } catch { alert('Erro ao enviar a original') }
  }

  async function enviarArquivoCapa(arquivo: File, prefixo: string) {
    const { url } = await enviarFoto(arquivo, prefixo, 'capas/')
    return url
  }

  async function uploadFotoModeloCapa(arquivo: File) {
    setCapaUploadModelo(true)
    try {
      const url = await enviarArquivoCapa(arquivo, 'modelo')
      setCapaForm(prev => ({ ...prev, foto_url: url }))
    } catch {
      alert('Erro ao enviar a foto do modelo')
    }
    setCapaUploadModelo(false)
  }

  function limparCapaForm() {
    setCapaForm({ marca: 'Apple', modelo: '', foto_url: '', entrada: '' })
    setCapaEditandoId(null)
  }

  async function salvarCapaModelo() {
    const modelo = capaForm.modelo.trim()
    if (!modelo) { alert('Informe o modelo do celular'); return }
    setCapaSalvando(true)
    // Entrada do carregador definida sozinha pelo modelo (filtra cabos/carregadores no catálogo)
    const iphone = /iphone\s*(\d+)/i.exec(modelo)
    const entrada = capaForm.entrada || (iphone ? (Number(iphone[1]) >= 15 ? 'USB-C' : 'Lightning') : 'USB-C')
    const dados = { marca: capaForm.marca, modelo, foto_url: capaForm.foto_url || null, entrada }
    if (capaEditandoId) {
      const { error } = await supabase.from('capas_modelos').update(dados).eq('id', capaEditandoId)
      setCapaSalvando(false)
      if (error) { alert('Erro ao salvar: ' + error.message); return }
      limparCapaForm()
      carregarCapas()
      return
    }
    // Modelo novo: já abre a tela das capinhas para adicionar várias fotos
    const { data, error } = await supabase.from('capas_modelos').insert([dados]).select().single()
    setCapaSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    limparCapaForm()
    await carregarCapas()
    if (data) { setCapaAberta(data as CapaModelo); setCapaTipo(CAPAS_TIPOS[0]); window.scrollTo(0, 0) }
  }

  function editarCapaModelo(m: CapaModelo) {
    setCapaForm({ marca: m.marca || 'Apple', modelo: m.modelo, foto_url: m.foto_url || '', entrada: m.entrada || '' })
    setCapaEditandoId(m.id)
    window.scrollTo(0, 0)
  }

  async function excluirCapaModelo(m: CapaModelo) {
    const qtd = capasFotos.filter(f => f.modelo_id === m.id).length
    if (!confirm(`Excluir ${m.modelo}${qtd ? ` e as ${qtd} capinhas dele` : ''}?`)) return
    await supabase.from('capas_fotos').delete().eq('modelo_id', m.id)
    await supabase.from('capas_modelos').delete().eq('id', m.id)
    if (capaAberta?.id === m.id) setCapaAberta(null)
    carregarCapas()
  }

  async function uploadCapinhas(arquivos: File[]) {
    if (!capaAberta || arquivos.length === 0) return
    setCapaEnviando({ feitas: 0, total: arquivos.length })
    let falhas = 0
    for (let i = 0; i < arquivos.length; i++) {
      try {
        const url = await enviarArquivoCapa(arquivos[i], 'capa')
        const { error } = await supabase.from('capas_fotos').insert([{ modelo_id: capaAberta.id, tipo: capaTipo, url }])
        if (error) falhas++
      } catch {
        falhas++
      }
      setCapaEnviando({ feitas: i + 1, total: arquivos.length })
    }
    setCapaEnviando(null)
    if (falhas) alert(`${falhas} foto(s) não foram enviadas. Tente de novo.`)
    carregarCapas()
  }

  async function excluirCapinha(f: CapaFoto) {
    if (!confirm('Excluir esta capinha?')) return
    await supabase.from('capas_fotos').delete().eq('id', f.id)
    const caminho = f.url.split('/object/public/fotos/')[1]
    if (caminho) await supabase.storage.from('fotos').remove([decodeURIComponent(caminho)])
    carregarCapas()
  }

  async function excluirFotoExtra(fotoId: string, produtoId: string) {
    await supabase.from('produto_fotos').delete().eq('id', fotoId)
    carregarFotosEdicao(produtoId)
  }

  async function excluirFotoNova(url: string) {
    setFotosNovas(prev => prev.filter(f => f !== url))
  }

  async function uploadHeroImagem(arquivo: File) {
    setUploadandoHero(true)
    const nomeArquivo = `hero_${Date.now()}.png`
    const { error } = await supabase.storage.from('hero').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload'); setUploadandoHero(false); return }
    const url = `https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/hero/${nomeArquivo}`
    const ordem = heroImagens.length + 1
    await supabase.from('hero_imagens').insert([{ url, ordem, ativo: true }])
    carregarHeroImagens()
    setUploadandoHero(false)
  }

  async function toggleHeroImagem(id: string, ativo: boolean) {
    await supabase.from('hero_imagens').update({ ativo: !ativo }).eq('id', id)
    carregarHeroImagens()
  }

  async function excluirHeroImagem(id: string, url: string) {
    if (!confirm('Deseja excluir esta foto do hero?')) return
    const nomeArquivo = url.split('/').pop()
    await supabase.storage.from('hero').remove([nomeArquivo!])
    await supabase.from('hero_imagens').delete().eq('id', id)
    carregarHeroImagens()
  }

  // Campos de acessório (tipo + compatibilidade), usados no cadastro e na edição
  function camposAcessorio(v: CamposAcessorio, alterar: (patch: Partial<CamposAcessorio>) => void) {
    const porModelo = v.tipo === 'capa' || v.tipo === 'pelicula'
    const porEntrada = v.tipo === 'carregador' || v.tipo === 'cabo' || v.tipo === 'fone'
    const termo = buscaCompat.trim().toLowerCase()
    const modelos = capasModelos.filter(m => !termo || `${m.marca} ${m.modelo}`.toLowerCase().includes(termo))
    const marcar = (id: string, sim: boolean) => alterar({ compativel: sim ? Array.from(new Set([...v.compativel, id])) : v.compativel.filter(x => x !== id) })
    return (
      <div style={{ ...tagsBox, borderColor: v.tipo ? '#5a3a20' : '#222' }}>
        <p style={tagsTitle}>🔎 Acessório (busca "Qual é o seu celular?")</p>
        <select style={inputStyle} value={v.tipo} onChange={e => alterar({ tipo: e.target.value })}>
          {TIPOS_ACESSORIO.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        {porModelo && (
          <>
            <label style={labelStyle}>Serve em quais modelos? ({v.compativel.length} marcado{v.compativel.length === 1 ? '' : 's'})</label>
            {capasModelos.length === 0 ? (
              <p style={{ color: '#888', fontSize: 13 }}>Cadastre os modelos de celular na aba 📱 Capas primeiro.</p>
            ) : (
              <>
                <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="⌕ Filtrar modelos..." value={buscaCompat} onChange={e => setBuscaCompat(e.target.value)} />
                <div style={{ maxHeight: 230, overflowY: 'auto', border: '1px solid #222', borderRadius: 10, padding: '6px 10px', marginBottom: 6 }}>
                  {modelos.map(m => (
                    <label key={m.id} style={{ ...checkLabel, marginBottom: 6 }}>
                      <input type="checkbox" checked={v.compativel.includes(m.id)} onChange={e => marcar(m.id, e.target.checked)} />
                      <span>{m.modelo} <span style={{ color: '#666', fontSize: 12 }}>· {m.marca}</span></span>
                    </label>
                  ))}
                </div>
                {termo && modelos.length > 1 && (
                  <button style={{ ...btnSecundario, fontSize: 12, padding: '6px 10px' }} onClick={() => alterar({ compativel: Array.from(new Set([...v.compativel, ...modelos.map(m => m.id)])) })}>
                    Marcar os {modelos.length} filtrados
                  </button>
                )}
              </>
            )}
          </>
        )}
        {porEntrada && (
          <>
            <label style={labelStyle}>{v.tipo === 'fone' ? 'Conexão' : 'Entrada'}</label>
            <select style={inputStyle} value={v.conector} onChange={e => alterar({ conector: e.target.value })}>
              <option value="">Selecione...</option>
              {ENTRADAS.map(c => <option key={c}>{c}</option>)}
              {v.tipo === 'fone' && <option value="Bluetooth">Bluetooth (serve em todos)</option>}
            </select>
          </>
        )}
      </div>
    )
  }

  // "Disponível na loja" (vai para a aba Disponíveis da Negociação). Salvo à parte: sem a coluna, o resto salva normal
  async function salvarNaLoja(id: string, valor: boolean) {
    const { error } = await supabase.from('produtos_catalogo').update({ na_loja: valor }).eq('id', id)
    if (error && valor) alert('O produto foi salvo, mas o "Disponível na loja" não.\n\nCrie no Supabase a coluna na_loja (tipo bool, padrão false) na tabela produtos_catalogo.')
  }

  async function salvarProduto() {
    if (!novoProduto.marca || !novoProduto.modelo || !novoProduto.categoria) {
      alert('Preencha categoria, marca e modelo.'); return
    }
    const { data, error } = await supabase.from('produtos_catalogo').insert([{
      categoria: novoProduto.categoria, marca: novoProduto.marca, modelo: novoProduto.modelo,
      memoria: novoProduto.memoria, cor: novoProduto.cor, condicao: novoProduto.condicao,
      bateria_saude: novoProduto.bateria_saude, preco: numeroBR(novoProduto.preco),
      preco_antigo: numeroBR(novoProduto.preco_antigo), mostrar_preco: novoProduto.mostrar_preco || !!novoProduto.tipo,
      foto_url: fotosNovas[0] || '', descricao: novoProduto.descricao, disponivel: novoProduto.disponivel,
      destaque: novoProduto.destaque, lancamento: novoProduto.lancamento,
      promocao: novoProduto.promocao, mais_procurado: novoProduto.mais_procurado,
      ...dadosAcessorio(novoProduto),
    }]).select()
    if (error) { alert('Erro ao salvar produto' + (error.message?.includes('column') ? ' — rode o SQL novo no Supabase' : '')); return }
    if (data && data[0] && novoProduto.na_loja) await salvarNaLoja(data[0].id, true)
    if (data && data[0] && fotosNovas.length > 1) {
      const produtoId = data[0].id
      const extras = fotosNovas.slice(1)
      for (let i = 0; i < extras.length; i++) {
        await supabase.from('produto_fotos').insert([{ produto_id: produtoId, url: extras[i], ordem: i + 1 }])
      }
    }
    alert('Produto cadastrado!')
    setNovoProduto({ categoria: 'Celulares', marca: '', modelo: '', memoria: '', cor: '', condicao: '', bateria_saude: '', preco: '', foto_url: '', descricao: '', disponivel: true, destaque: false, lancamento: false, promocao: false, mais_procurado: false, tipo: '', compativel: [], conector: '', preco_antigo: '', mostrar_preco: false, na_loja: false })
    setFotosNovas([])
    carregarProdutos()
    setAba('lista')
  }

  async function salvarEdicao() {
    if (!editando) return
    const { error } = await supabase.from('produtos_catalogo').update({
      categoria: editando.categoria, marca: editando.marca, modelo: editando.modelo,
      memoria: editando.memoria, cor: editando.cor, condicao: editando.condicao,
      bateria_saude: editando.bateria_saude, preco: numeroBR(editando.preco), preco_antigo: numeroBR(editando.preco_antigo),
      mostrar_preco: !!editando.mostrar_preco || !!editando.tipo,
      foto_url: editando.foto_url, descricao: editando.descricao, disponivel: editando.disponivel,
      destaque: editando.destaque, lancamento: editando.lancamento,
      promocao: editando.promocao, mais_procurado: editando.mais_procurado,
      ...dadosAcessorio({ tipo: editando.tipo || '', compativel: editando.compativel || [], conector: editando.conector || '' }),
    }).eq('id', editando.id)
    if (error) { alert('Erro ao editar produto' + (error.message?.includes('column') ? ' — rode o SQL novo no Supabase' : '')); return }
    await salvarNaLoja(editando.id, !!editando.na_loja)
    alert('Produto atualizado!')
    setEditando(null)
    setFotosEdicao([])
    carregarProdutos()
  }

  // Lista de produtos: o mesmo celular com GB diferente vira um cartão só
  function gruposDeProdutos(lista: Produto[]) {
    const ordem: Produto[][] = []
    const mapa = new Map<string, Produto[]>()
    for (const p of lista) {
      const cel = (p.categoria || '').toLowerCase().includes('celular')
      const k = cel ? chaveVariante(p.marca, p.modelo) : 'id:' + p.id
      const g = mapa.get(k)
      if (g) g.push(p); else { const n = [p]; mapa.set(k, n); ordem.push(n) }
    }
    for (const g of ordem) g.sort((a, b) => (memoriaDe(a.modelo, a.memoria)?.valor || 0) - (memoriaDe(b.modelo, b.memoria)?.valor || 0))
    return ordem
  }

  // Liga/desliga uma memória sem abrir a edição (✓ disponível / ✕ indisponível)
  // Produto do catálogo de cada aparelho da lista (mesmo modelo e mesmo GB; CPO junto)
  function produtoDoAparelho(ap: Aparelho) {
    if (ap.id.startsWith('loja-')) return produtos.find(p => 'loja-' + p.id === ap.id) || null
    const semCpo = (t: string) => t.replace(/cpo$/, '')
    const k = semCpo(chaveComparar(ap.chave || ap.modelo))
    const iguais = produtos.filter(p => semCpo(p.origem === 'lista' ? chaveComparar(p.chave || p.modelo) : chaveComparar(`${p.modelo} ${p.memoria || ''}`)) === k)
    return iguais.find(p => p.origem === 'lista') || iguais[0] || null
  }

  async function alternarDisponivel(p: Produto) {
    const valor = !p.disponivel
    const { error } = await supabase.from('produtos_catalogo').update({ disponivel: valor }).eq('id', p.id)
    if (error) { alert('Erro: ' + error.message); return }
    setProdutos(prev => prev.map(x => x.id === p.id ? { ...x, disponivel: valor } : x))
  }

  async function excluirGrupo(g: Produto[]) {
    if (g.length === 1) return excluirProduto(g[0].id)
    if (!confirm(`Excluir as ${g.length} versões (${g.map(p => memoriaDe(p.modelo, p.memoria)?.rotulo || p.modelo).join(', ')})?`)) return
    const ids = g.map(p => p.id)
    await supabase.from('produto_fotos').delete().in('produto_id', ids)
    await supabase.from('produtos_catalogo').delete().in('id', ids)
    carregarProdutos()
  }

  // ─── Recuperar fotos: arquivos guardados no Storage que não estão ligados a nenhum produto ───
  type FotoSolta = { url: string; nome: string; data: number }
  const [recAberto, setRecAberto] = useState(false)
  const [recCarregando, setRecCarregando] = useState(false)
  const [recFotos, setRecFotos] = useState<FotoSolta[]>([])
  const [recMarcadas, setRecMarcadas] = useState<string[]>([])
  const [recBusca, setRecBusca] = useState('')
  const [recDestino, setRecDestino] = useState<Produto | null>(null)
  const [recCor, setRecCor] = useState('')
  const [recSalvando, setRecSalvando] = useState(false)

  async function abrirRecuperar() {
    setRecAberto(true); setRecCarregando(true); setRecMarcadas([]); setRecDestino(null)
    try {
      const arquivos: { name: string; created_at?: string; id?: string | null }[] = []
      for (let offset = 0; offset < 20000; offset += 1000) {
        const { data, error } = await supabase.storage.from('fotos').list('', { limit: 1000, offset, sortBy: { column: 'created_at', order: 'desc' } })
        if (error) throw error
        arquivos.push(...((data || []) as typeof arquivos))
        if (!data || data.length < 1000) break
      }
      const [{ data: prods }, { data: fts }, { data: aps }] = await Promise.all([
        supabase.from('produtos_catalogo').select('foto_url'),
        supabase.from('produto_fotos').select('url'),
        supabase.from('aparelhos').select('fotos'),
      ])
      const usadas = new Set<string>()
      for (const p of (prods || []) as { foto_url?: string | null }[]) if (p.foto_url) usadas.add(p.foto_url)
      for (const f of (fts || []) as { url: string }[]) usadas.add(f.url)
      for (const a of (aps || []) as { fotos?: Record<string, string[]> | null }[]) for (const l of Object.values(a.fotos || {})) for (const u of l || []) usadas.add(u)
      const soltas = arquivos
        .filter(a => a.id && /\.(jpe?g|png|webp|heic)$/i.test(a.name))
        .map(a => ({ url: supabase.storage.from('fotos').getPublicUrl(a.name).data.publicUrl, nome: a.name, data: a.created_at ? new Date(a.created_at).getTime() : 0 }))
        .filter(f => !usadas.has(f.url))
      setRecFotos(soltas)
    } catch (e) {
      alert('Não consegui ler as fotos guardadas: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setRecCarregando(false) }
  }

  async function ligarFotos() {
    if (!recDestino || !recMarcadas.length) return
    setRecSalvando(true)
    try {
      const { data: ja } = await supabase.from('produto_fotos').select('url').eq('produto_id', recDestino.id)
      let ordem = (ja || []).length
      let capa = recDestino.foto_url
      for (const url of recMarcadas) {
        if (!capa) {
          const up = await supabase.from('produtos_catalogo').update({ foto_url: url, foto_cor: recCor || null }).eq('id', recDestino.id)
          if (up.error) throw up.error
          capa = url
        } else {
          ordem++
          const ins = await supabase.from('produto_fotos').insert([{ produto_id: recDestino.id, url, ordem, cor: recCor || null }])
          if (ins.error) { const i2 = await supabase.from('produto_fotos').insert([{ produto_id: recDestino.id, url, ordem }]); if (i2.error) throw i2.error }
        }
      }
      setRecFotos(prev => prev.filter(f => !recMarcadas.includes(f.url)))
      setRecMarcadas([]); setRecDestino(null); setRecCor(''); setRecBusca('')
      carregarProdutos()
    } catch (e) {
      alert('Erro ao ligar a foto: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setRecSalvando(false) }
  }

  // Tira os celulares cadastrados à mão: antes passa as fotos (e marcações) pro celular igual que veio da lista
  const [limpandoManuais, setLimpandoManuais] = useState(false)
  async function limparManuais() {
    type P = Produto & { origem?: string | null; na_loja?: boolean | null; foto_cor?: string | null; descricao?: string | null }
    const todos = produtos as P[]
    const ehCel = (p: P) => (p.categoria || '').toLowerCase().includes('celular')
    const manuais = todos.filter(p => ehCel(p) && p.origem !== 'lista' && !p.na_loja)
    const daLista = todos.filter(p => p.origem === 'lista')
    const comPar = manuais.filter(m => daLista.some(l => baseModelo(l.modelo) === baseModelo(m.modelo)))
    const semPar = manuais.length - comPar.length
    if (!comPar.length) { alert('Nenhum cadastro manual tem um celular igual vindo da lista pra receber as fotos.'); return }
    if (!confirm(`Apagar ${comPar.length} celular(es) cadastrados à mão?\n\nAntes, as fotos deles passam pro mesmo modelo que veio da lista.` + (semPar ? `\n\n${semPar} ficam (o modelo não está em nenhuma lista, apagar perderia a foto).` : '') + (todos.some(p => ehCel(p) && p.origem !== 'lista' && p.na_loja) ? '\n\nOs marcados "na loja" ficam.' : ''))) return
    setLimpandoManuais(true)
    try {
      const ids = comPar.map(m => m.id)
      const { data: fotosRows } = await supabase.from('produto_fotos').select('*').in('produto_id', [...ids, ...daLista.map(l => l.id)])
      const fotos = (fotosRows || []) as { produto_id: string; url: string; ordem?: number; cor?: string | null }[]
      for (const l of daLista) {
        const doMesmo = comPar.filter(m => baseModelo(m.modelo) === baseModelo(l.modelo))
        if (!doMesmo.length) continue
        const fonte = doMesmo.find(m => m.foto_url) || doMesmo[0]
        const dados: Record<string, unknown> = {}
        if (!l.foto_url && fonte.foto_url) { dados.foto_url = fonte.foto_url; dados.foto_cor = fonte.foto_cor || null }
        if (!(l as P).descricao && fonte.descricao) dados.descricao = fonte.descricao
        for (const f of ['destaque', 'lancamento', 'promocao', 'mais_procurado'] as const) if (doMesmo.some(m => m[f]) && !l[f]) dados[f] = true
        if (Object.keys(dados).length) {
          const up = await supabase.from('produtos_catalogo').update(dados).eq('id', l.id)
          if (up.error) { alert('Parei sem apagar nada: não consegui passar a foto para ' + l.modelo + '.\n' + up.error.message); return }
        }
        // Fotos extras (galeria) que ainda não estão nele
        const jaTem = new Set(fotos.filter(f => f.produto_id === l.id).map(f => f.url))
        const novas = fotos.filter(f => doMesmo.some(m => m.id === f.produto_id) && !jaTem.has(f.url))
          .filter((f, i, arr) => arr.findIndex(x => x.url === f.url) === i)
        if (novas.length) {
          const linhas = novas.map((f, i) => ({ produto_id: l.id, url: f.url, ordem: jaTem.size + i + 1, cor: f.cor ?? null }))
          const ins = await supabase.from('produto_fotos').insert(linhas)
          if (ins.error) {
            const ins2 = await supabase.from('produto_fotos').insert(linhas.map(({ cor: _c, ...x }) => x))
            if (ins2.error) { alert('Parei sem apagar nada: não consegui passar as fotos para ' + l.modelo + '.\n' + ins2.error.message); return }
          }
        }
      }
      await supabase.from('produto_fotos').delete().in('produto_id', ids)
      const { error } = await supabase.from('produtos_catalogo').delete().in('id', ids)
      if (error) { alert('Erro ao apagar: ' + error.message); return }
      alert(`✅ Pronto! ${ids.length} cadastro(s) manual(is) apagados e as fotos passaram pros celulares da lista.`)
      carregarProdutos()
    } finally { setLimpandoManuais(false) }
  }

  async function excluirProduto(id: string) {
    if (!confirm('Deseja excluir este produto?')) return
    await supabase.from('produto_fotos').delete().eq('produto_id', id)
    await supabase.from('produtos_catalogo').delete().eq('id', id)
    carregarProdutos()
  }

  function toggleCorAdmin(cor: string) {
    if (editandoAparelho) {
      const novas = editandoAparelho.cores.includes(cor) ? editandoAparelho.cores.filter(c => c !== cor) : [...editandoAparelho.cores, cor]
      setEditandoAparelho({ ...editandoAparelho, cores: novas })
    } else {
      setCoresSelecionadas(prev => prev.includes(cor) ? prev.filter(c => c !== cor) : [...prev, cor])
    }
  }

  async function uploadFotosAparelho(cor: string, arquivos: File[]) {
    setUploadandoFotoAp(cor)
    await enviarVarias(arquivos, 'ap', url => {
      if (editandoAparelho) {
        setEditandoAparelho(prev => prev ? { ...prev, fotos: { ...prev.fotos, [cor]: [...(prev.fotos[cor] || []), url] } } : prev)
      } else {
        setFotosAparelho(prev => ({ ...prev, [cor]: [...(prev[cor] || []), url] }))
      }
    })
    setUploadandoFotoAp(null)
  }

  function removerFotoAparelho(cor: string, url: string) {
    if (editandoAparelho) {
      const novas = (editandoAparelho.fotos[cor] || []).filter(f => f !== url)
      setEditandoAparelho({ ...editandoAparelho, fotos: { ...editandoAparelho.fotos, [cor]: novas } })
    } else {
      setFotosAparelho(prev => ({ ...prev, [cor]: (prev[cor] || []).filter(f => f !== url) }))
    }
  }

  // ─── Lista do dia: ler, conferir e aplicar ───
  async function lerLista() {
    if (textoLista.trim().length < 10) { alert('Cole a lista do fornecedor'); return }
    if (!fornecedorLista.trim()) { alert('Escreva de qual fornecedor é essa lista'); return }
    const nomeForn = fornecedorLista.trim()
    const novosForn = [nomeForn, ...fornecedoresSalvos.filter(f => f.toLowerCase() !== nomeForn.toLowerCase())].slice(0, 12)
    setFornecedoresSalvos(novosForn)
    try { localStorage.setItem('fornecedores', JSON.stringify(novosForn)) } catch { /* sem armazenamento */ }
    setLendoLista(true)
    setItensLista(null)
    setSaidas([])
    try {
      // invoke já envia a chave do Supabase (funciona com "Verify JWT" ligado)
      const { data: dados, error: erroFuncao } = await supabase.functions.invoke('ler-lista', { body: { lista: textoLista } })
      if (erroFuncao || !dados || !Array.isArray(dados.itens)) {
        alert('Não consegui ler a lista. ' + (dados?.error || erroFuncao?.message || 'Tente de novo.'))
        return
      }

      const [{ data: prods }, { data: aps }] = await Promise.all([
        supabase.from('produtos_catalogo').select('id, marca, modelo, memoria, chave, disponivel'),
        supabase.from('aparelhos').select('*'),
      ])
      const listaProdutos = (prods || []) as { id: string; marca: string; modelo: string; memoria?: string; chave?: string; disponivel?: boolean }[]
      const listaAparelhos = (aps || []) as { id: string; modelo: string; marca?: string; chave?: string; custo?: number; disponivel?: boolean; ultima_lista?: string; fornecedor?: string | null }[]

      const vistos = new Set<string>()
      const preparados: ItemPreparado[] = []
      let ignoradosCpo = 0
      for (const bruto of dados.itens as ItemLista[]) {
        const item: ItemLista = {
          marca: (bruto.marca || '').trim(),
          modelo: (bruto.modelo || '').trim(),
          memoria: (bruto.memoria || '').toUpperCase().replace(/\s/g, ''),
          ram: bruto.ram ? String(bruto.ram).toUpperCase().replace(/\s/g, '') : null,
          rede: bruto.rede ? String(bruto.rede).toUpperCase() : null,
          cores: Array.from(new Set((bruto.cores || []).map(c => c.trim()).filter(Boolean))),
          custo: Number(bruto.custo) || 0,
          cpo: !!bruto.cpo || /\bcpo\b/i.test(bruto.modelo || ''),
        }
        item.modelo = item.modelo.replace(/\s*\bcpo\b\s*/ig, ' ').trim()
        if (!item.modelo || !item.custo) continue
        if (item.cpo && !incluirCpo) { ignoradosCpo++; continue }
        const nome = montarNome(item)
        const chave = normalizar(nome)
        // Mesmo aparelho em outra linha com outro preço (ex: Branco mais caro): junta as cores e guarda o preço de cada cor
        // (com/sem NFC e 4G contam como o mesmo aparelho)
        if (vistos.has(chaveComparar(chave))) {
          const ja = preparados.find(x => chaveComparar(x.chave) === chaveComparar(chave))
          if (ja) {
            const porCor = { ...(ja.custos_cor || {}) }
            for (const c of item.cores) porCor[c] = porCor[c] != null ? Math.min(porCor[c], item.custo) : item.custo
            ja.custos_cor = porCor
            ja.cores = Array.from(new Set([...ja.cores, ...item.cores]))
            ja.custo = Math.min(ja.custo, item.custo)
          }
          continue
        }
        vistos.add(chaveComparar(chave))
        item.custos_cor = Object.fromEntries(item.cores.map(c => [c, item.custo]))
        const ap = (listaAparelhos.find(a => a.disponivel !== false && chaveComparar(a.chave || a.modelo) === chaveComparar(chave)) || listaAparelhos.find(a => chaveComparar(a.chave || a.modelo) === chaveComparar(chave)))
        const existeProduto = listaProdutos.some(p => chaveComparar(p.chave || p.modelo) === chaveComparar(chave))
        const custoAntigo = ap?.custo != null ? Number(ap.custo) : null
        // Já veio em outra lista hoje com custo menor: mantém o menor
        const status: ItemPreparado['status'] = !ap && !existeProduto ? 'novo'
          : custoAntigo != null && vistoHoje(ap?.ultima_lista) && custoAntigo < item.custo ? 'maiscaro'
          : custoAntigo != null && custoAntigo !== item.custo ? 'alterado' : 'igual'
        preparados.push({ ...item, nome, chave, status, custoAntigo, fornecedorAntigo: ap?.fornecedor || null, marcado: true })
      }

      setItensLista(preparados)
      if (ignoradosCpo) alert(`${ignoradosCpo} aparelho(s) CPO foram ignorados (chave "Incluir CPO" desligada).`)
    } catch (e) {
      alert('Erro de conexão ao ler a lista. Tente de novo.')
      console.error(e)
    } finally {
      setLendoLista(false)
    }
  }

  async function aplicarLista() {
    if (!itensLista) return
    const selecionados = itensLista.filter(i => i.marcado)
    if (selecionados.length === 0) { alert('Nenhum aparelho marcado'); return }
    const total = selecionados.length
    setAplicandoLista({ feitos: 0, total })
    const agora = new Date().toISOString()

    const [{ data: prods }, { data: aps }] = await Promise.all([
      supabase.from('produtos_catalogo').select('id, modelo, chave, cor, ultima_lista, preco, disponivel'),
      supabase.from('aparelhos').select('*'),
    ])
    const listaProdutos = (prods || []) as { id: string; modelo: string; chave?: string; cor?: string; ultima_lista?: string; preco?: number | null; disponivel?: boolean | null }[]
    const listaAparelhos = (aps || []) as { id: string; modelo: string; chave?: string; cores?: string[]; fotos?: Record<string, string[]>; custo?: number; preco?: number | null; ultima_lista?: string; precos_cor?: Record<string, number> | null; fornecedor?: string | null; ofertas?: Ofertas | null; disponivel?: boolean; na_loja?: boolean | null; historico?: DiaPreco[] | null }[]
    const nomeFornecedor = fornecedorLista.trim() || null

    let feitos = 0
    let falhas = 0
    let semColunaCor = false
    let semColunaForn = false
    let semColunaOfertas = false
    let semColunaHist = false
    let comPrecoPorCor = 0
    for (const i of selecionados) {
      try {
        if (i.custos_cor && new Set(Object.values(i.custos_cor)).size > 1) comPrecoPorCor++
        // Catálogo (sem preço). Se já veio em outra lista hoje, soma as cores
        // No catálogo o CPO aparece sem "CPO" (junto do mesmo modelo)
        const nomeCatalogo = i.cpo ? i.nome.replace(/ CPO$/, '') : i.nome
        const chaveCatalogo = i.cpo ? normalizar(nomeCatalogo) : i.chave
        const prod = listaProdutos.find(p => chaveComparar(p.chave || p.modelo) === chaveComparar(chaveCatalogo))
        const coresProd = prod && vistoHoje(prod.ultima_lista)
          ? Array.from(new Set([...(prod.cor || '').split(',').map(c => c.trim()).filter(Boolean), ...i.cores]))
          : i.cores
        const cor = coresProd.join(', ')
        let prodId = prod?.id || null
        if (prod) {
          // Tirou do catálogo hoje (check desmarcado em Preços): lista nova do mesmo dia não coloca de volta
          const tiradoHoje = vistoHoje(prod.ultima_lista) && prod.disponivel === false
          await supabase.from('produtos_catalogo').update({ marca: i.marca, modelo: nomeCatalogo, cor, disponivel: !tiradoHoje, chave: chaveCatalogo, origem: 'lista', ultima_lista: agora }).eq('id', prod.id)
        } else {
          const novo = await supabase.from('produtos_catalogo').insert([{
            categoria: 'Celulares', marca: i.marca, modelo: nomeCatalogo, memoria: '', cor,
            disponivel: true, chave: chaveCatalogo, origem: 'lista', ultima_lista: agora,
          }]).select('id')
          prodId = (novo.data as { id: string }[] | null)?.[0]?.id || null
          if (prodId) listaProdutos.push({ id: prodId, modelo: nomeCatalogo, chave: chaveCatalogo, cor, ultima_lista: agora, preco: null })
        }
        // Preço de venda no catálogo (o mesmo da Negociação; mesmo dia fica o menor). Custo nunca vai pro catálogo
        const precoNoCatalogo = async (valor: number | null | undefined) => {
          if (!prodId || valor == null) return
          const atual = prod && vistoHoje(prod.ultima_lista) && prod.preco != null ? Number(prod.preco) : null
          const final = atual != null ? Math.min(atual, Number(valor)) : Number(valor)
          if (prod) prod.preco = final
          await supabase.from('produtos_catalogo').update({ preco: final, mostrar_preco: true }).eq('id', prodId)
        }
        // Negociação (custo e preço de venda). Mesmo dia: fica o menor custo e soma as cores
        const ap = (listaAparelhos.find(a => a.disponivel !== false && chaveComparar(a.chave || a.modelo) === chaveComparar(i.chave)) || listaAparelhos.find(a => chaveComparar(a.chave || a.modelo) === chaveComparar(i.chave)))
        // Celular "Tenho na loja": preço travado, a lista não mexe nele
        if (ap?.na_loja) {
          await supabase.from('aparelhos').update({ disponivel: true, ultima_lista: agora }).eq('id', ap.id)
          await precoNoCatalogo(ap.preco)
          feitos++; setAplicandoLista({ feitos, total }); continue
        }
        const lucro = lucroPorMemoria(i.memoria)
        // Ofertas de hoje: cada fornecedor com o custo de cada cor. Se o mesmo fornecedor manda de novo, a nova substitui a dele
        const hoje = diaHoje()
        const forn = nomeFornecedor || 'Lista'
        const itensOferta = (ap?.ofertas?.dia === hoje ? ap.ofertas.itens : []).filter(o => o.f.toLowerCase() !== forn.toLowerCase())
        const porCor = Object.keys(i.custos_cor || {}).length ? i.custos_cor! : Object.fromEntries(i.cores.map(c => [c, i.custo]))
        for (const [c, v] of Object.entries(porCor)) itensOferta.push({ f: forn, cor: c, custo: Number(v) })
        // Tudo sai das ofertas de hoje: cores = as que vieram nas listas desse GB; preço de cada cor = a mais barata + lucro
        const melhor = itensOferta.reduce((x, y) => y.custo < x.custo ? y : x)
        const custo = melhor.custo
        const fornecedor = melhor.f
        const preco = custo + lucro
        const cores = Array.from(new Set(itensOferta.map(o => o.cor)))
        const precosCor: Record<string, number> = {}
        for (const o of itensOferta) { const v = o.custo + lucro; if (precosCor[o.cor] == null || v < precosCor[o.cor]) precosCor[o.cor] = v }
        await precoNoCatalogo(preco)
        // Histórico: menor custo de cada dia (guarda 14 dias) para o selo de melhor preço da semana (só métrica)
        const corteHist = new Date(); corteHist.setDate(corteHist.getDate() - 13)
        const historico = [...(ap?.historico || []).filter(x => x.d !== hoje && x.d >= corteHist.toLocaleDateString('sv-SE')), { d: hoje, c: custo, f: fornecedor }]
        const dadosAp: Record<string, unknown> = { modelo: ap?.modelo || i.nome, marca: i.marca, memoria: i.memoria, cores, custo, preco, precos_cor: precosCor, fornecedor, ofertas: { dia: hoje, itens: itensOferta }, historico, chave: ap?.chave || i.chave, disponivel: true, ultima_lista: agora }
        // Tenta salvar; se faltar alguma coluna nova no Supabase (SQL não rodado), tira ela e tenta de novo
        for (let tentativa = 0; tentativa < 4; tentativa++) {
          const r = ap
            ? await supabase.from('aparelhos').update(dadosAp).eq('id', ap.id)
            : await supabase.from('aparelhos').insert([{ ...dadosAp, fotos: {} }])
          const msg = r.error?.message || ''
          if (!r.error) break
          if (msg.includes('precos_cor')) { semColunaCor = true; delete dadosAp.precos_cor; continue }
          if (msg.includes('fornecedor')) { semColunaForn = true; delete dadosAp.fornecedor; continue }
          if (msg.includes('ofertas')) { semColunaOfertas = true; delete dadosAp.ofertas; continue }
          if (msg.includes('historico')) { semColunaHist = true; delete dadosAp.historico; continue }
          throw r.error
        }
      } catch (e) {
        falhas++
        console.error(e)
      }
      feitos++
      setAplicandoLista({ feitos, total })
    }
    setAplicandoLista(null)
    alert((falhas
      ? `Concluído com ${falhas} erro(s). Confira a lista.`
      : 'Lista salva! Pode colar a próxima lista. Quando terminar todas as listas de hoje, toque em "Finalizar o dia".')
      + (semColunaCor
        ? '\n\n⚠️ O PREÇO POR COR NÃO FOI SALVO: falta rodar no Supabase (SQL Editor) a linha:\nalter table public.aparelhos add column if not exists precos_cor jsonb;\nDepois cole a lista de novo.'
        : comPrecoPorCor ? `\n\n🎨 ${comPrecoPorCor} aparelho(s) com preço diferente por cor. Na Negociação o valor muda ao tocar na cor.` : '')
      + (semColunaForn ? '\n\n⚠️ O FORNECEDOR NÃO FOI SALVO: falta criar no Supabase a coluna "fornecedor" (tipo text) na tabela aparelhos.' : '')
      + (semColunaHist ? '\n\n⚠️ O HISTÓRICO DE PREÇO (melhor preço da semana) NÃO FOI SALVO: falta criar no Supabase a coluna "historico" (tipo jsonb) na tabela aparelhos.' : '')
      + (semColunaOfertas ? '\n\n⚠️ A LISTA DE FORNECEDORES NÃO FOI SALVA: falta criar no Supabase a coluna "ofertas" (tipo jsonb) na tabela aparelhos.' : ''))
    setItensLista(null)
    setTextoLista('')
    carregarProdutos()
    carregarAparelhos()
    carregarResumoHoje()
  }

  // ─── Zerar listas: tira preços/cores/fornecedores das listas pra mandar tudo de novo (fotos ficam) ───
  async function zerarListasHoje() {
    if (!confirm('Zerar as listas?\n\nTodos os celulares das listas saem dos Preços, da Negociação e do catálogo até você mandar as listas de novo.\nOs "Tenho na loja" e as fotos ficam.')) return
    const { data: aps } = await supabase.from('aparelhos').select('id, chave, na_loja')
    const ids = ((aps || []) as { id: string; chave?: string | null; na_loja?: boolean | null }[]).filter(a => a.chave && !a.na_loja).map(a => a.id)
    const { data: prods } = await supabase.from('produtos_catalogo').select('id, na_loja').eq('origem', 'lista')
    const prodIds = ((prods || []) as { id: string; na_loja?: boolean | null }[]).filter(p => !p.na_loja).map(p => p.id)
    let erro = ''
    for (let k = 0; k < ids.length; k += 100) {
      const r = await supabase.from('aparelhos').update({ disponivel: false, ultima_lista: null, ofertas: null, precos_cor: {}, cores: [] }).in('id', ids.slice(k, k + 100))
      if (r.error) erro = r.error.message
    }
    for (let k = 0; k < prodIds.length; k += 100) {
      const r = await supabase.from('produtos_catalogo').update({ disponivel: false, ultima_lista: null }).in('id', prodIds.slice(k, k + 100))
      if (r.error) erro = r.error.message
    }
    if (erro) alert('Deu erro ao zerar: ' + erro)
    else alert(`✅ Listas zeradas (${ids.length} aparelho(s)). Pode mandar as listas de novo.`)
    carregarProdutos(); carregarAparelhos(); carregarResumoHoje()
  }

  // ─── Finalizar o dia: indisponível o que não veio em NENHUMA lista de hoje ───
  async function carregarResumoHoje() {
    const { data } = await supabase.from('aparelhos').select('id, chave, disponivel, ultima_lista')
    const daLista = ((data || []) as { chave?: string; disponivel?: boolean; ultima_lista?: string }[]).filter(a => a.chave)
    setResumoHoje({
      vistos: daLista.filter(a => vistoHoje(a.ultima_lista)).length,
      faltando: daLista.filter(a => a.disponivel !== false && !vistoHoje(a.ultima_lista)).length,
    })
  }

  async function prepararFinalizarDia() {
    const [{ data: prods }, { data: aps }] = await Promise.all([
      supabase.from('produtos_catalogo').select('*'),
      supabase.from('aparelhos').select('*'),
    ])
    const lista: Saida[] = []
    // Os marcados "na loja" nunca saem
    ;((prods || []) as { id: string; marca: string; modelo: string; origem?: string; disponivel?: boolean; ultima_lista?: string; na_loja?: boolean | null }[])
      .filter(p => p.origem === 'lista' && !p.na_loja && p.disponivel !== false && !vistoHoje(p.ultima_lista))
      .forEach(p => lista.push({ tipo: 'produto', id: p.id, nome: `${p.marca} ${p.modelo}`, marcado: true }))
    ;((aps || []) as { id: string; modelo: string; chave?: string; disponivel?: boolean; ultima_lista?: string; na_loja?: boolean | null }[])
      .filter(a => a.chave && !a.na_loja && a.disponivel !== false && !vistoHoje(a.ultima_lista))
      .forEach(a => lista.push({ tipo: 'aparelho', id: a.id, nome: `${a.modelo} (Negociação)`, marcado: true }))
    if (lista.length === 0) { alert('Tudo certo! Todos os aparelhos das listas apareceram hoje.'); return }
    setSaidas(lista)
    setFinalizando(true)
  }

  async function confirmarFinalizarDia() {
    const marcados = saidas.filter(sd => sd.marcado)
    if (!confirm(`Marcar ${marcados.length} como indisponível?`)) return
    const prodIds = marcados.filter(sd => sd.tipo === 'produto').map(sd => sd.id)
    const apIds = marcados.filter(sd => sd.tipo === 'aparelho').map(sd => sd.id)
    if (prodIds.length) await supabase.from('produtos_catalogo').update({ disponivel: false }).in('id', prodIds)
    if (apIds.length) await supabase.from('aparelhos').update({ disponivel: false }).in('id', apIds)
    setSaidas([])
    setFinalizando(false)
    carregarProdutos()
    carregarAparelhos()
    carregarResumoHoje()
    alert('Dia finalizado! Os indisponíveis ficam no filtro "Indisponíveis" da aba 📦, onde dá pra excluir.')
  }

  // Aba Preços: tira (deixa indisponível) os aparelhos que não vieram em nenhuma lista de hoje
  // Tira um celular da lista dos Preços e da Negociação (volta sozinho se vier numa lista nova)
  async function tirarAparelho(ap: Aparelho) {
    if (!confirm(`Tirar ${ap.modelo} dos Preços e da Negociação?\n\nSe ele vier numa lista nova, volta sozinho.`)) return
    const { error } = await supabase.from('aparelhos').update({ disponivel: false, na_loja: false }).eq('id', ap.id)
    if (error) { alert('Erro: ' + error.message); return }
    setPrecoAberto(null)
    carregarAparelhos()
  }

  // Marca/desmarca o celular da lista como "tenho na loja" (aba Disponíveis)
  async function alternarNaLoja(ap: Aparelho) {
    const valor = !ap.na_loja
    const { error } = await supabase.from('aparelhos').update({ na_loja: valor }).eq('id', ap.id)
    if (error) { alert('Não salvou.\n\nCrie no Supabase a coluna na_loja (tipo bool, padrão false) na tabela aparelhos.'); return }
    setAparelhos(prev => prev.map(a => a.id === ap.id ? { ...a, na_loja: valor } : a))
  }

  async function tirarListasAntigas(ids: string[]) {
    if (!ids.length) return
    if (!confirm(`Tirar ${ids.length} aparelho(s) de lista antiga?\n\nEles somem dos Preços e da Negociação. Se vierem numa lista nova, voltam sozinhos.`)) return
    const { error } = await supabase.from('aparelhos').update({ disponivel: false }).in('id', ids)
    if (error) { alert('Erro: ' + error.message); return }
    carregarAparelhos()
    carregarResumoHoje()
  }

  async function excluirIndisponiveis() {
    const ids = produtos.filter(p => !p.disponivel).map(p => p.id)
    if (ids.length === 0) return
    if (!confirm(`Excluir ${ids.length} produto(s) indisponível(is) do catálogo? Isso não pode ser desfeito.`)) return
    await supabase.from('produto_fotos').delete().in('produto_id', ids)
    const { error } = await supabase.from('produtos_catalogo').delete().in('id', ids)
    if (error) alert('Erro ao excluir: ' + error.message)
    carregarProdutos()
  }

  async function excluirAparelhosIndisponiveis() {
    const ids = aparelhos.filter(a => a.disponivel === false).map(a => a.id)
    if (ids.length === 0) return
    if (!confirm(`Excluir ${ids.length} aparelho(s) indisponível(is) da Negociação?`)) return
    const { error } = await supabase.from('aparelhos').delete().in('id', ids)
    if (error) alert('Erro ao excluir: ' + error.message)
    carregarAparelhos()
  }

  // Preço de venda automático no cadastro manual do aparelho
  function atualizarCustoAparelho(custoTxt: string, memoria: string) {
    setApCusto(custoTxt)
    setApMemoria(memoria)
    const custo = parseFloat(custoTxt.replace(/\./g, '').replace(',', '.')) || 0
    setApPreco(custo ? String(custo + lucroPorMemoria(memoria)).replace('.', ',') : '')
  }

  function abrirEdicaoAparelho(ap: Aparelho) {
    setNovoAparelhoAberto(false)
    setEditandoAparelho(ap)
    setApMemoria(ap.memoria || '')
    setApCusto(ap.custo != null ? String(ap.custo).replace('.', ',') : '')
    setApPreco(ap.preco != null ? String(ap.preco).replace('.', ',') : '')
    setApPrecosCor(Object.fromEntries(Object.entries(ap.precos_cor || {}).map(([c, v]) => [c, String(v).replace('.', ',')])))
    window.scrollTo(0, 0)
  }

  async function salvarAparelho() {
    const modelo = editandoAparelho ? editandoAparelho.modelo : novoModelo.trim()
    const cores = editandoAparelho ? editandoAparelho.cores : coresSelecionadas
    const fotos = editandoAparelho ? editandoAparelho.fotos : fotosAparelho
    if (!modelo) { alert('Informe o modelo'); return }
    if (cores.length === 0) { alert('Selecione ao menos uma cor'); return }
    setSalvandoAparelho(true)
    const num = (t: string) => t.trim() ? (parseFloat(t.replace(/\./g, '').replace(',', '.')) || null) : null
    const precosCor = Object.fromEntries(Object.entries(apPrecosCor)
      .filter(([c, v]) => cores.includes(c) && num(v) != null).map(([c, v]) => [c, num(v) as number]))
    const extras = { memoria: apMemoria || null, custo: num(apCusto), preco: num(apPreco), precos_cor: precosCor, disponivel: true }
    if (editandoAparelho) {
      // Editou à mão um aparelho da lista de hoje: sua edição vale até chegar uma lista nova dele
      const of = editandoAparelho.ofertas
      const marcaManual = of && of.dia === diaHoje() ? { ofertas: { ...of, manual: true } } : {}
      await supabase.from('aparelhos').update({ modelo, cores, fotos, ...extras, ...marcaManual }).eq('id', editandoAparelho.id)
      setEditandoAparelho(null)
    } else {
      await supabase.from('aparelhos').insert([{ modelo, cores, fotos, ...extras }])
      setNovoModelo('')
      setCoresSelecionadas([])
      setFotosAparelho({})
    }
    setApMemoria(''); setApCusto(''); setApPreco(''); setApPrecosCor({})
    setNovoAparelhoAberto(false)
    setSalvandoAparelho(false)
    carregarAparelhos()
  }

  async function excluirAparelho(id: string) {
    if (!confirm('Excluir este aparelho?')) return
    await supabase.from('aparelhos').delete().eq('id', id)
    carregarAparelhos()
  }

  const coresAtivas = editandoAparelho ? editandoAparelho.cores : coresSelecionadas
  const fotosAtivas = editandoAparelho ? editandoAparelho.fotos : fotosAparelho

  // Botões "🪄 Recortar" (IA grátis) e "↺ Voltar" embaixo de cada foto
  const botoesIA = (url: string, aoRecortar: () => void, aoVoltar: () => void) => (
    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
      <button onClick={aoRecortar} disabled={!!iaTrabalhando} title="Grátis: a IA recorta só o produto e centraliza"
        style={{ ...btnIA, background: '#0f2417', borderColor: '#25D366', color: '#7dffb0', opacity: iaTrabalhando && iaTrabalhando !== url ? 0.4 : 1 }}>
        {iaTrabalhando === url ? '⏳ Recortando...' : '🪄 Recortar'}
      </button>
      {antesIA[url] && <button onClick={aoVoltar} style={{ ...btnIA, flex: '0 0 auto', background: '#1a1a1a', color: '#ccc', borderColor: '#333' }} title="Voltar para a foto de antes">↺</button>}
    </div>
  )

  // Aviso flutuante enquanto a IA baixa / recorta
  const avisoFlutuante = avisoIA ? (
    <div style={{ position: 'fixed', left: 16, right: 16, bottom: 20, zIndex: 9999, background: '#0f2417', border: '1px solid #25D366', color: '#7dffb0', borderRadius: 14, padding: '12px 14px', fontSize: 14, fontWeight: 700, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      ⏳ {avisoIA}
    </div>
  ) : null

  const seletorAjuste = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ajusteAuto ? '#25D366' : '#888', margin: '0 0 8px', cursor: 'pointer' }}>
      <input type="checkbox" checked={ajusteAuto} onChange={e => alternarAjuste(e.target.checked)} style={{ accentColor: '#25D366', width: 16, height: 16 }} />
      🪄 Recortar fotos automaticamente com IA grátis (deixa só o produto)
    </label>
  )

  // Editor do aparelho (Negociação): usado dentro de 💰 Preços
  const formAparelho = (
          <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: 14, padding: 16, marginBottom: 24 }}>
            <p style={{ color: '#ff6600', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              {editandoAparelho ? '✏️ Editando: ' + editandoAparelho.modelo : '+ Novo aparelho'}
            </p>
            <label style={labelStyle}>Modelo</label>
            <input
              style={inputStyle}
              placeholder="Ex: iPhone 16 Pro Max"
              value={editandoAparelho ? editandoAparelho.modelo : novoModelo}
              onChange={e => editandoAparelho ? setEditandoAparelho({ ...editandoAparelho, modelo: e.target.value }) : setNovoModelo(e.target.value)}
            />
            <label style={labelStyle}>Cores disponíveis</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {Array.from(new Set([...CORES_LISTA, ...coresAtivas])).map(cor => {
                const sel = coresAtivas.includes(cor)
                return (
                  <button key={cor} onClick={() => toggleCorAdmin(cor)} title={cor} style={{
                    width: 32, height: 32, borderRadius: '50%', border: sel ? '3px solid #ff6600' : '2px solid #333',
                    background: CORES_HEX[cor], cursor: 'pointer', padding: 0,
                    boxShadow: sel ? '0 0 0 2px #ff6600' : 'none', flexShrink: 0,
                    outline: 'none', transition: 'all 0.15s'
                  }} />
                )
              })}
            </div>
            {coresAtivas.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Fotos por cor</label>
                {seletorAjuste}
                {coresAtivas.map(cor => (
                  <div key={cor} style={{ marginBottom: 14, background: '#111', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: CORES_HEX[cor], border: '1px solid #333', flexShrink: 0 }} />
                      <span style={{ color: '#ccc', fontSize: 13, fontWeight: 600 }}>{cor}</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a1a1a', border: '1px dashed #333', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#aaa', fontSize: 12, marginBottom: 6 }}>
                      {uploadandoFotoAp === cor && enviandoFotos ? `⏳ Enviando ${enviandoFotos.feitas} de ${enviandoFotos.total}...` : '📷 Adicionar fotos'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        multiple onChange={e => { const fs = Array.from(e.target.files || []) as File[]; e.target.value = ''; uploadFotosAparelho(cor, fs) }} />
                    </label>
                    {(fotosAtivas[cor] || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(fotosAtivas[cor] || []).map((url, i) => (
                          <div key={i} style={{ position: 'relative' }}>
                            <img src={url} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #333' }} />
                            <button onClick={() => removerFotoAparelho(cor, url)}
                              style={{ position: 'absolute', top: -4, right: -4, background: '#7a1111', border: 'none', color: 'white', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Armazenamento</label>
                <select style={inputStyle} value={apMemoria} onChange={e => atualizarCustoAparelho(apCusto, e.target.value)}>
                  <option value="">Selecione...</option>
                  {MEMORIAS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Custo (fornecedor)</label>
                <input style={inputStyle} inputMode="decimal" placeholder="0,00" value={apCusto} onChange={e => atualizarCustoAparelho(e.target.value, apMemoria)} />
              </div>
            </div>
            <label style={labelStyle}>💰 Preço de venda {apMemoria && apCusto ? <span style={{ color: '#25D366', textTransform: 'none', letterSpacing: 0 }}>(custo + R$ {lucroPorMemoria(apMemoria)})</span> : null}</label>
            <input style={{ ...inputStyle, borderColor: '#1f5c37', fontWeight: 700, color: '#25D366' }} inputMode="decimal" placeholder="Calculado automaticamente"
              value={apPreco} onChange={e => setApPreco(e.target.value)} />
            {coresAtivas.length > 1 && (
              <div style={{ ...tagsBox, marginBottom: 10 }}>
                <p style={tagsTitle}>🎨 Preço por cor (opcional — se uma cor for mais cara)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {coresAtivas.map(c => (
                    <div key={c}>
                      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: CORES_HEX[c] || '#777', display: 'inline-block' }} />{c}
                      </label>
                      <input style={inputStyle} inputMode="decimal" placeholder={apPreco || 'Igual ao preço'} value={apPrecosCor[c] || ''}
                        onChange={e => setApPrecosCor(prev => ({ ...prev, [c]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSalvar} onClick={salvarAparelho} disabled={salvandoAparelho}>
                {salvandoAparelho ? '⏳ Salvando...' : '✅ Salvar aparelho'}
              </button>
              {(editandoAparelho || novoAparelhoAberto) && (
                <button style={{ ...btnSecundario, padding: '14px 16px' }} onClick={() => { setEditandoAparelho(null); setNovoAparelhoAberto(false); setApMemoria(''); setApCusto(''); setApPreco(''); setApPrecosCor({}) }}>Cancelar</button>
              )}
            </div>
          </div>
  )

  if (editando) {
    return (
      <div style={adminPage}>
        {avisoFlutuante}
        <div style={adminHeader}>
          <div><span style={logoMarcas}>Marcos</span><span style={{ ...logoMag, display: 'inline', marginLeft: 4 }}> Magazine</span></div>
          <button style={btnSecundario} onClick={() => { setEditando(null); setFotosEdicao([]) }}>← Voltar</button>
        </div>
        <div style={formContainer}>
          <h2 style={formTitle}>✏️ Editar produto</h2>
          <label style={labelStyle}>Categoria</label>
          <select style={inputStyle} value={editando.categoria} onChange={e => setEditando({ ...editando, categoria: e.target.value })}>
            {Array.from(new Set([...categoriasNomes, editando.categoria].filter(Boolean))).map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={labelStyle}>Marca</label>
          <input style={inputStyle} value={editando.marca || ''} onChange={e => setEditando({ ...editando, marca: e.target.value })} />
          <label style={labelStyle}>Modelo</label>
          <input style={inputStyle} value={editando.modelo || ''} onChange={e => setEditando({ ...editando, modelo: e.target.value })} />
          <label style={labelStyle}>Memória</label>
          <input style={inputStyle} value={editando.memoria || ''} onChange={e => setEditando({ ...editando, memoria: e.target.value })} />
          <label style={labelStyle}>Cor</label>
          <input style={inputStyle} value={editando.cor || ''} onChange={e => setEditando({ ...editando, cor: e.target.value })} />
          <label style={labelStyle}>Condição</label>
          <select style={inputStyle} value={editando.condicao || ''} onChange={e => setEditando({ ...editando, condicao: e.target.value })}>
            <option value="">Selecione...</option>
            <option>Novo</option><option>Seminovo</option><option>Usado</option>
          </select>
          <label style={labelStyle}>Saúde da bateria</label>
          <input style={inputStyle} value={editando.bateria_saude || ''} onChange={e => setEditando({ ...editando, bateria_saude: e.target.value })} />
          {camposAcessorio(
            { tipo: editando.tipo || '', compativel: editando.compativel || [], conector: editando.conector || '' },
            patch => setEditando({ ...editando, ...patch }),
          )}
          <div style={tagsBox}>
            <p style={tagsTitle}>💰 Preço</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Preço</label>
                <input style={inputStyle} inputMode="decimal" placeholder="Ex: 49,90" value={editando.preco ?? ''}
                  onChange={e => setEditando({ ...editando, preco: (e.target.value as unknown as number) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Preço antigo (riscado)</label>
                <input style={inputStyle} inputMode="decimal" placeholder="Ex: 79,90" value={editando.preco_antigo ?? ''}
                  onChange={e => setEditando({ ...editando, preco_antigo: (e.target.value as unknown as number) })} />
              </div>
            </div>
            <label style={checkLabel}>
              <input type="checkbox" checked={!!editando.mostrar_preco || !!editando.tipo} disabled={!!editando.tipo}
                onChange={e => setEditando({ ...editando, mostrar_preco: e.target.checked })} />
              Mostrar preço no catálogo {editando.tipo ? '(acessório: sempre mostra)' : ''}
            </label>
          </div>
          <label style={labelStyle}>Fotos</label>
          {seletorAjuste}
          <label style={uploadBox}>
            {enviandoFotos ? `⏳ Ajustando e enviando ${enviandoFotos.feitas} de ${enviandoFotos.total}...` : '📷 Adicionar fotos'}
            <span style={{ fontSize: 11, color: '#666' }}>Pode escolher várias da galeria. A 1ª é a capa.</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={!!enviandoFotos}
              onChange={e => { const fs = Array.from(e.target.files || []) as File[]; e.target.value = ''; adicionarFotosEdicao(fs) }} />
          </label>
          {(editando.foto_url || fotosEdicao.length > 0) && (
            <div style={gradeFotos}>
              {editando.foto_url && (
                <div>
                  <div style={{ position: 'relative' }}>
                    <img src={editando.foto_url} style={fotoMiniatura} />
                    <span style={seloCapa}>CAPA</span>
                    <button onClick={excluirCapaEdicao} style={btnRemoverFoto}>✕</button>
                    {originais[editando.foto_url] && <button onClick={() => usarOriginalEdicao(editando.foto_url!)} style={btnOriginal}>↺ original</button>}
                  </div>
                  {botoesIA(editando.foto_url, () => iaFotoEdicao(editando.foto_url!), () => voltarFotoEdicao(editando.foto_url!))}
                  <select style={seletorCor} value={editando.foto_cor || ''} onChange={e => definirCorFoto(null, e.target.value)}>
                    <option value="">Cor?</option>
                    {Array.from(new Set([...coresDoProduto(editando), editando.foto_cor || ''].filter(Boolean))).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {fotosEdicao.map(foto => (
                <div key={foto.id}>
                  <div style={{ position: 'relative' }}>
                    <img src={foto.url} style={fotoMiniatura} />
                    <button onClick={() => tornarCapaEdicao(foto)} style={btnTornarCapa} title="Usar como capa">⭐</button>
                    <button onClick={() => excluirFotoExtra(foto.id, editando.id)} style={btnRemoverFoto}>✕</button>
                    {originais[foto.url] && <button onClick={() => usarOriginalEdicao(foto.url, foto.id)} style={btnOriginal}>↺ original</button>}
                  </div>
                  {botoesIA(foto.url, () => iaFotoEdicao(foto.url, foto.id), () => voltarFotoEdicao(foto.url, foto.id))}
                  <select style={seletorCor} value={foto.cor || ''} onChange={e => definirCorFoto(foto, e.target.value)}>
                    <option value="">Cor?</option>
                    {Array.from(new Set([...coresDoProduto(editando), foto.cor || ''].filter(Boolean))).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, height: 80 }} value={editando.descricao || ''} onChange={e => setEditando({ ...editando, descricao: e.target.value })} />
          <div style={tagsBox}>
            <p style={tagsTitle}>Tags do produto</p>
            <label style={checkLabel}><input type="checkbox" checked={editando.disponivel || false} onChange={e => setEditando({ ...editando, disponivel: e.target.checked })} />✅ Disponível no catálogo</label>
            <label style={{ ...checkLabel, color: '#25D366', fontWeight: 800 }}><input type="checkbox" checked={!!editando.na_loja} onChange={e => setEditando({ ...editando, na_loja: e.target.checked })} />🏪 Disponível na loja (vai para Disponíveis na Negociação)</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.destaque || false} onChange={e => setEditando({ ...editando, destaque: e.target.checked })} />☆ Destaque</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.lancamento || false} onChange={e => setEditando({ ...editando, lancamento: e.target.checked })} />🚀 Lançamento</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.promocao || false} onChange={e => setEditando({ ...editando, promocao: e.target.checked })} />🏷 Promoção</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.mais_procurado || false} onChange={e => setEditando({ ...editando, mais_procurado: e.target.checked })} />🔥 Mais Procurado</label>
          </div>
          <button style={btnSalvar} onClick={salvarEdicao}>✅ Salvar alterações</button>
        </div>
      </div>
    )
  }

  return (
    <div style={adminPage}>
      {avisoFlutuante}
      <div style={adminHeader}>
        <div><span style={logoMarcas}>Marcos</span><span style={{ ...logoMag, display: 'inline', marginLeft: 4 }}> Magazine</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnSecundario} onClick={() => navigate('/')}>Ver catálogo</button>
          <button style={btnSecundario} onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </div>

      <div style={abasContainer}>
        <button style={aba === 'cadastrar' ? abaAtiva : abaInativa} onClick={() => setAba('cadastrar')}>+ Cadastrar</button>
        <button style={aba === 'capas' ? abaAtiva : abaInativa} onClick={() => { setAba('capas'); setCapaAberta(null) }}>📱 Capas</button>
        <button style={aba === 'aparelhos' ? abaAtiva : abaInativa} onClick={() => setAba('aparelhos')}>🤝</button>
        <button style={aba === 'precos' || aba === 'lista' ? abaAtiva : abaInativa} onClick={() => { setAba('precos'); carregarAparelhos() }}>💰 Preços</button>
        <button style={aba === 'hero' ? abaAtiva : abaInativa} onClick={() => setAba('hero')}>🖼 Hero</button>
        <button style={aba === 'vitrine' ? abaAtiva : abaInativa} onClick={() => setAba('vitrine')}>🏷 Vitrine</button>
        <button style={aba === 'ia' ? abaAtiva : abaInativa} onClick={() => setAba('ia')}>🤖 IA</button>
      </div>

      {(aba === 'precos' || aba === 'lista') && (
        <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', maxWidth: 700, margin: '0 auto' }}>
          {([['precos', '💰 Lista do dia'], ['lista', `📦 Todos os produtos (${produtos.length})`]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => { setAba(v); if (v === 'precos') carregarAparelhos() }}
              style={{ flex: 1, background: aba === v ? '#ff6600' : '#151515', color: aba === v ? '#fff' : '#ccc', border: '1px solid ' + (aba === v ? '#ff6600' : '#333'), borderRadius: 14, padding: '11px 8px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
          ))}
        </div>
      )}

      {aba === 'precos' && (() => {
        // Preços da lista no mesmo visual da conferência: separado por marca, foco no modelo e no valor final
        const todos = completarFotos(aparelhos.filter(a => a.disponivel !== false && a.custo != null), [...fotosCat, ...aparelhos])
        const marcas = Array.from(new Set(todos.map(marcaDoAparelho))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        // Disponíveis: os celulares cadastrados com "Disponível na loja"
        const naLoja = completarFotos(produtos.filter(p => p.na_loja && p.disponivel !== false).map(p => ({
          id: 'loja-' + p.id, modelo: [p.modelo, p.memoria].filter(Boolean).join(' '), marca: p.marca,
          cores: (p.cor || '').split(/[,/;]| e /).map(c => c.trim()).filter(Boolean),
          fotos: p.foto_url ? { [(p.foto_cor || (p.cor || '').split(/[,/;]| e /)[0] || 'Padrão').trim()]: [p.foto_url] } : {},
          preco: p.preco ?? null, custo: null, ultima_lista: new Date().toISOString(),
        } as Aparelho)), [...fotosCat, ...aparelhos])
        const disponiveisLoja = [...todos.filter(a => a.na_loja), ...naLoja]
        const lista = (marcaPreco === 'Disponíveis' ? disponiveisLoja : todos
          .filter(a => marcaPreco === 'Todos' || marcaDoAparelho(a) === marcaPreco))
          .sort((a, b) => marcaDoAparelho(a).localeCompare(marcaDoAparelho(b), 'pt-BR') || a.modelo.localeCompare(b.modelo, 'pt-BR', { numeric: true }))
        return (
          <div style={formContainer}>
            <h2 style={formTitle}>💰 Preços da lista</h2>
            {(() => {
              const antigos = todos.filter(a => !a.na_loja && !vistoHoje(a.ultima_lista))
              return antigos.length > 0 && (
                <button type="button" onClick={() => tirarListasAntigas(antigos.map(a => a.id))}
                  style={{ width: '100%', background: 'rgba(255,200,0,0.08)', border: '1px solid #ffc800', color: '#ffc800', borderRadius: 14, padding: '12px', fontSize: 15, fontWeight: 800, marginBottom: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🧹 Tirar listas antigas ({antigos.length})
                </button>
              )
            })()}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 4 }}>
              {['Disponíveis', 'Todos', ...marcas].map(m => {
                const verde = m === 'Disponíveis', on = marcaPreco === m
                const cor = verde ? '#25D366' : '#ff6600'
                return (
                <button key={m} type="button" onClick={() => { setMarcaPreco(m); setPrecoAberto(null) }}
                  style={{ flex: '0 0 auto', background: on ? cor : '#151515', color: on ? (verde ? '#000' : '#fff') : verde ? '#25D366' : '#ccc', border: '1px solid ' + (on || verde ? cor : '#333'), borderRadius: 20, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {verde ? '✓ ' : ''}{m} <span style={{ opacity: 0.7, fontWeight: 400 }}>({verde ? disponiveisLoja.length : m === 'Todos' ? todos.length : todos.filter(a => marcaDoAparelho(a) === m).length})</span>
                </button>
              )})}
            </div>
            {(() => {
              const grupos: { marca: string; itens: Aparelho[] }[] = []
              for (const ap of lista) {
                const m = marcaDoAparelho(ap)
                const g = grupos[grupos.length - 1]
                if (g && g.marca === m) g.itens.push(ap); else grupos.push({ marca: m, itens: [ap] })
              }
              return grupos.map(g => (
                <div key={g.marca}>
                  <p style={{ color: '#ff6600', fontWeight: 800, letterSpacing: 2, fontSize: 13, textAlign: 'center', margin: '18px 0 8px', textTransform: 'uppercase' }}>{g.marca}</p>
                  <div style={{ border: '1px solid #222', borderRadius: 16, overflow: 'hidden' }}>
                    {(() => {
                      // Mesmo modelo com GB diferente: uma linha só, com botões de memória
                      const linhas: Aparelho[][] = []
                      const porChave = new Map<string, Aparelho[]>()
                      for (const a of g.itens) {
                        const ch = chaveVariante(marcaDoAparelho(a), a.modelo)
                        const l = porChave.get(ch)
                        if (l) l.push(a); else { const nova = [a]; porChave.set(ch, nova); linhas.push(nova) }
                      }
                      for (const l of linhas) l.sort((x, y) => (memoriaDe(x.modelo)?.valor || 0) - (memoriaDe(y.modelo)?.valor || 0))
                      return linhas.map((l, k) => {
                        const ap = l.find(x => x.id === precoAberto) || l.find(x => x.id === memAdmin[chaveVariante(marcaDoAparelho(x), x.modelo)]) || l[0]
                        const memorias = l.length > 1 ? l.map(x => ({ id: x.id, rotulo: memoriaDe(x.modelo)?.rotulo || x.modelo, preco: x.preco != null ? Number(x.preco) : null })) : undefined
                        return (
                          <CartaoAparelho key={l[0].id} ap={ap} listaAntiga={!ap.na_loja && !vistoHoje(ap.ultima_lista)} onUsarFornecedor={ap.id.startsWith('loja-') ? undefined : f => usarFornecedor(ap, f)}
                            onAlternarNaLoja={ap.id.startsWith('loja-') ? undefined : () => alternarNaLoja(ap)} mostrarHistorico
                            onTirar={ap.id.startsWith('loja-') ? undefined : () => tirarAparelho(ap)}
                            noCatalogo={(() => { const pr = produtoDoAparelho(ap); return pr ? { ligado: pr.disponivel !== false, alternar: () => alternarDisponivel(pr) } : undefined })()}
                            onEditarCatalogo={(() => { const pr = produtoDoAparelho(ap); return pr ? () => { setEditando(pr); carregarFotosEdicao(pr.id) } : undefined })()}
                            memorias={memorias} onEscolherMemoria={id => { setMemAdmin(m => ({ ...m, [chaveVariante(marcaDoAparelho(ap), ap.modelo)]: id })); setPrecoAberto(id) }}
                            sanfona={{ aberto: l.some(x => x.id === precoAberto), alternar: () => setPrecoAberto(l.some(x => x.id === precoAberto) ? null : ap.id), ultimo: k === linhas.length - 1 }} />
                        )
                      })
                    })()}
                  </div>
                </div>
              ))
            })()}
          </div>
        )
      })()}

      {aba === 'vitrine' && (
        <VitrineAdmin produtos={produtos} aoMudar={() => { carregarCategorias(); carregarProdutos() }} />
      )}

      {aba === 'ia' && (
        <AssistenteIA produtos={produtos} banners={heroImagens} ajusteAuto={ajusteAuto}
          aoMudar={() => { carregarProdutos(); carregarHeroImagens() }} />
      )}

      {aba === 'cadastrar' && (
        <div style={{ ...formContainer, paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModoCadastro('produto')} style={modoCadastro === 'produto' ? modoAtivo : modoInativo}>Novo produto</button>
            <button onClick={() => { setModoCadastro('lista'); carregarResumoHoje() }} style={modoCadastro === 'lista' ? modoAtivo : modoInativo}>📋 Lista do dia</button>
          </div>
        </div>
      )}

      {aba === 'cadastrar' && modoCadastro === 'lista' && (
        <div style={formContainer}>
          <h2 style={formTitle}>📋 Lista do dia</h2>
          {finalizando ? (
            <>
              <p style={{ color: '#ff6666', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>🏁 Não apareceram em nenhuma lista hoje</p>
              <p style={{ color: '#777', fontSize: 12, marginBottom: 10 }}>Vão ficar indisponíveis. Desmarque o que quiser manter disponível.</p>
              {saidas.map(sd => (
                <label key={sd.tipo + sd.id} style={{ ...produtoCard, cursor: 'pointer', opacity: sd.marcado ? 1 : 0.45, marginBottom: 6, padding: 10 }}>
                  <input type="checkbox" checked={sd.marcado} style={{ accentColor: '#ff4444', width: 18, height: 18 }}
                    onChange={() => setSaidas(prev => prev.map(x => x.tipo === sd.tipo && x.id === sd.id ? { ...x, marcado: !x.marcado } : x))} />
                  <span style={{ fontSize: 13, flex: 1 }}>{sd.nome}</span>
                </label>
              ))}
              <button style={{ ...btnSalvar, background: '#c0392b' }} onClick={confirmarFinalizarDia}>Marcar como indisponível</button>
              <button style={{ ...btnSecundario, width: '100%', padding: 12, marginTop: 8 }} onClick={() => { setFinalizando(false); setSaidas([]) }}>Cancelar</button>
            </>
          ) : !itensLista ? (
            <>
              {resumoHoje && (
                <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>
                  <p style={{ margin: 0, color: '#ccc' }}>Hoje: <b style={{ color: '#25D366' }}>{resumoHoje.vistos}</b> aparelho(s) já vieram nas listas</p>
                  {resumoHoje.faltando > 0 && <p style={{ margin: '4px 0 0', color: '#888', fontSize: 12 }}>{resumoHoje.faltando} ainda não apareceram em nenhuma lista hoje</p>}
                </div>
              )}
              <label style={labelStyle}>De qual fornecedor é a lista?</label>
              <input style={inputStyle} value={fornecedorLista} onChange={e => setFornecedorLista(e.target.value)} placeholder="Ex: João Importados" />
              {fornecedoresSalvos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '-4px 0 12px' }}>
                  {fornecedoresSalvos.map(f => (
                    <button key={f} type="button" onClick={() => setFornecedorLista(f)}
                      style={{ background: fornecedorLista === f ? '#ff6600' : '#1a1a1a', color: fornecedorLista === f ? '#fff' : '#ccc', border: '1px solid #333', borderRadius: 16, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>{f}</button>
                  ))}
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px', fontSize: 14, color: incluirCpo ? '#ffc800' : '#888', cursor: 'pointer' }}>
                <input type="checkbox" checked={incluirCpo} style={{ accentColor: '#ffc800', width: 20, height: 20 }}
                  onChange={e => { setIncluirCpo(e.target.checked); try { localStorage.setItem('incluirCpo', e.target.checked ? 'sim' : 'nao') } catch { /* ok */ } }} />
                ♻️ Incluir CPO {incluirCpo ? '(os CPO entram separados do novo)' : '(os CPO da lista são ignorados)'}
              </label>
              <label style={labelStyle}>Cole a lista do fornecedor (do WhatsApp)</label>
              <textarea style={{ ...inputStyle, height: 220, fontFamily: 'monospace', fontSize: 13 }} value={textoLista}
                onChange={e => setTextoLista(e.target.value)} placeholder={'📲*Redmi 15C 256GB 8Ram*\n*R$:965.00*\n*Preto*\n*Azul*'} />
              <p style={{ color: '#777', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                A IA tira a marca, o modelo, os GB, a RAM, o 4G/5G, as cores e o custo. Você confere antes de salvar.
                O preço de venda vai só para a Negociação (128GB +R$450 · 256GB +R$550 · 512GB/1TB/2TB +R$600).
              </p>
              <button style={btnSalvar} onClick={lerLista} disabled={lendoLista}>
                {lendoLista ? '⏳ Lendo a lista... (até 1 minuto)' : '🤖 Ler lista'}
              </button>
              <div style={{ borderTop: '1px solid #1e1e1e', marginTop: 22, paddingTop: 16 }}>
                <p style={{ color: '#aaa', fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
                  Terminou de colar todas as listas de hoje? O que não veio em <b>nenhuma</b> lista fica indisponível.
                  Aparelhos cadastrados à mão não são afetados.
                </p>
                <button style={{ ...btnSecundario, width: '100%', padding: 14, fontSize: 15, fontWeight: 700, borderColor: '#ff4444', color: '#ff6666' }}
                  onClick={prepararFinalizarDia}>🏁 Finalizar o dia</button>
                <p style={{ color: '#aaa', fontSize: 12, margin: '18px 0 8px', lineHeight: 1.5 }}>
                  Quer começar do zero? Apaga os preços e cores das listas de hoje (Preços, Negociação e catálogo) pra você mandar as listas de novo.
                  Os marcados <b>“Tenho na loja”</b>, as fotos e o histórico da semana ficam.
                </p>
                <button style={{ ...btnSecundario, width: '100%', padding: 14, fontSize: 15, fontWeight: 700, borderColor: '#ffc800', color: '#ffc800' }}
                  onClick={zerarListasHoje}>♻️ Zerar as listas e mandar de novo</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
                {[
                  { n: itensLista.length, l: 'aparelhos', c: '#fff' },
                  { n: itensLista.filter(i => i.status === 'novo').length, l: 'novos', c: '#4fc3f7' },
                  { n: itensLista.filter(i => i.status === 'alterado').length, l: 'custo mudou', c: '#ffc800' },
                  { n: itensLista.filter(i => i.status === 'maiscaro').length, l: 'mais caro', c: '#888' },
                ].map(b => (
                  <div key={b.l} style={{ background: '#0f0f0f', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                    <p style={{ color: b.c, fontWeight: 800, fontSize: 18, margin: 0 }}>{b.n}</p>
                    <p style={{ color: '#888', fontSize: 10, margin: 0 }}>{b.l}</p>
                  </div>
                ))}
              </div>

              {Array.from(new Set(itensLista.map(i => i.marca))).map(marca => (
                <div key={marca}>
                  <p style={{ color: '#ff6600', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', margin: '12px 0 6px' }}>{marca}</p>
                  {itensLista.filter(i => i.marca === marca).map(i => (
                    <label key={i.chave} style={{ ...produtoCard, alignItems: 'flex-start', cursor: 'pointer', opacity: i.marcado ? 1 : 0.45, marginBottom: 8 }}>
                      <input type="checkbox" checked={i.marcado} style={{ marginTop: 3, accentColor: '#ff6600', width: 18, height: 18, flexShrink: 0 }}
                        onChange={() => setItensLista(prev => prev ? prev.map(x => x.chave === i.chave ? { ...x, marcado: !x.marcado } : x) : prev)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>
                          <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{i.nome}</p>
                          {i.cpo && <span style={{ ...tagLista, color: '#ffc800', borderColor: '#ffc800' }}>CPO</span>}
                          {i.status === 'novo' && <span style={{ ...tagLista, color: '#4fc3f7', borderColor: '#4fc3f7' }}>NOVO</span>}
                          {i.status === 'alterado' && <span style={{ ...tagLista, color: '#ffc800', borderColor: '#ffc800' }}>{fmtReal(i.custoAntigo)}{i.fornecedorAntigo ? ` (${i.fornecedorAntigo})` : ''} → {fmtReal(i.custo)}</span>}
                          {i.status === 'igual' && <span style={{ ...tagLista, color: '#888', borderColor: '#333' }}>IGUAL</span>}
                          {i.status === 'maiscaro' && <span style={{ ...tagLista, color: '#888', borderColor: '#555' }}>fica {fmtReal(i.custoAntigo)} ({i.fornecedorAntigo || 'outra lista'}, mais barato)</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '6px 0' }}>
                          {i.cores.map(c => (
                            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1a1a1a', borderRadius: 12, padding: '2px 8px', fontSize: 11, color: '#ccc' }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: CORES_HEX[c] || '#777' }} />{c}
                            </span>
                          ))}
                        </div>
                        {i.custos_cor && new Set(Object.values(i.custos_cor)).size > 1
                          ? <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Custo por cor: {Object.entries(i.custos_cor).map(([c, v]) => `${c} ${fmtReal(v)}`).join(' · ')}</p>
                          : <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Custo {fmtReal(i.custo)}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              ))}

              <button style={btnSalvar} onClick={aplicarLista} disabled={!!aplicandoLista}>
                {aplicandoLista ? `⏳ Salvando ${aplicandoLista.feitos} de ${aplicandoLista.total}...` : '✅ Confirmar e cadastrar'}
              </button>
              <button style={{ ...btnSecundario, width: '100%', padding: 12, marginTop: 8 }} disabled={!!aplicandoLista}
                onClick={() => setItensLista(null)}>← Voltar e colar outra lista</button>
            </>
          )}
        </div>
      )}

      {aba === 'cadastrar' && modoCadastro === 'produto' && (
        <div style={formContainer}>
          <h2 style={formTitle}>Novo produto</h2>
          <label style={labelStyle}>Categoria</label>
          <select style={inputStyle} value={novoProduto.categoria} onChange={e => setNovoProduto({ ...novoProduto, categoria: e.target.value })}>
            {Array.from(new Set([...categoriasNomes, novoProduto.categoria].filter(Boolean))).map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={labelStyle}>Marca</label>
          <input style={inputStyle} placeholder="Ex: Apple" value={novoProduto.marca} onChange={e => setNovoProduto({ ...novoProduto, marca: e.target.value })} />
          <label style={labelStyle}>Modelo</label>
          <input style={inputStyle} placeholder="Ex: iPhone 15 Pro Max" value={novoProduto.modelo} onChange={e => setNovoProduto({ ...novoProduto, modelo: e.target.value })} />
          <label style={labelStyle}>Memória</label>
          <input style={inputStyle} placeholder="Ex: 256GB" value={novoProduto.memoria} onChange={e => setNovoProduto({ ...novoProduto, memoria: e.target.value })} />
          <label style={labelStyle}>Cor</label>
          <input style={inputStyle} placeholder="Ex: Preto Titânio" value={novoProduto.cor} onChange={e => setNovoProduto({ ...novoProduto, cor: e.target.value })} />
          <label style={labelStyle}>Condição</label>
          <select style={inputStyle} value={novoProduto.condicao} onChange={e => setNovoProduto({ ...novoProduto, condicao: e.target.value })}>
            <option value="">Selecione...</option>
            <option>Novo</option><option>Seminovo</option><option>Usado</option>
          </select>
          <label style={labelStyle}>Saúde da bateria</label>
          <input style={inputStyle} placeholder="Ex: 89%" value={novoProduto.bateria_saude} onChange={e => setNovoProduto({ ...novoProduto, bateria_saude: e.target.value })} />
          {camposAcessorio(novoProduto, patch => setNovoProduto({ ...novoProduto, ...patch }))}
          <div style={tagsBox}>
            <p style={tagsTitle}>💰 Preço</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Preço</label>
                <input style={inputStyle} inputMode="decimal" placeholder={novoProduto.tipo ? 'Ex: 49,90' : 'Ex: 2999'} value={novoProduto.preco} onChange={e => setNovoProduto({ ...novoProduto, preco: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Preço antigo (riscado)</label>
                <input style={inputStyle} inputMode="decimal" placeholder="Ex: 79,90" value={novoProduto.preco_antigo} onChange={e => setNovoProduto({ ...novoProduto, preco_antigo: e.target.value })} />
              </div>
            </div>
            <label style={checkLabel}>
              <input type="checkbox" checked={novoProduto.mostrar_preco || !!novoProduto.tipo} disabled={!!novoProduto.tipo}
                onChange={e => setNovoProduto({ ...novoProduto, mostrar_preco: e.target.checked })} />
              Mostrar preço no catálogo {novoProduto.tipo ? '(acessório: sempre mostra)' : ''}
            </label>
          </div>
          <label style={labelStyle}>Fotos</label>
          {seletorAjuste}
          <label style={uploadBox}>
            {enviandoFotos ? `⏳ Ajustando e enviando ${enviandoFotos.feitas} de ${enviandoFotos.total}...` : '📷 Adicionar fotos'}
            <span style={{ fontSize: 11, color: '#666' }}>Pode escolher várias da galeria. A 1ª é a capa.</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={!!enviandoFotos}
              onChange={e => { const fs = Array.from(e.target.files || []) as File[]; e.target.value = ''; adicionarFotosNovas(fs) }} />
          </label>
          {fotosNovas.length > 0 && (
            <div style={gradeFotos}>
              {fotosNovas.map((url, i) => (
                <div key={url} style={{ position: 'relative' }}>
                  <img src={url} style={fotoMiniatura} />
                  {i === 0
                    ? <span style={seloCapa}>CAPA</span>
                    : <button onClick={() => tornarCapaNova(url)} style={btnTornarCapa} title="Usar como capa">⭐</button>}
                  <button onClick={() => excluirFotoNova(url)} style={btnRemoverFoto}>✕</button>
                  {originais[url] && <button onClick={() => usarOriginalNova(url)} style={btnOriginal}>↺ original</button>}
                </div>
              ))}
            </div>
          )}
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, height: 80 }} placeholder="Descrição..." value={novoProduto.descricao} onChange={e => setNovoProduto({ ...novoProduto, descricao: e.target.value })} />
          <div style={tagsBox}>
            <p style={tagsTitle}>Tags do produto</p>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.disponivel} onChange={e => setNovoProduto({ ...novoProduto, disponivel: e.target.checked })} />✅ Disponível no catálogo</label>
            <label style={{ ...checkLabel, color: '#25D366', fontWeight: 800 }}><input type="checkbox" checked={novoProduto.na_loja} onChange={e => setNovoProduto({ ...novoProduto, na_loja: e.target.checked })} />🏪 Disponível na loja (vai para Disponíveis na Negociação)</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.destaque} onChange={e => setNovoProduto({ ...novoProduto, destaque: e.target.checked })} />☆ Destaque</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.lancamento} onChange={e => setNovoProduto({ ...novoProduto, lancamento: e.target.checked })} />🚀 Lançamento</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.promocao} onChange={e => setNovoProduto({ ...novoProduto, promocao: e.target.checked })} />🏷 Promoção</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.mais_procurado} onChange={e => setNovoProduto({ ...novoProduto, mais_procurado: e.target.checked })} />🔥 Mais Procurado</label>
          </div>
          <button style={btnSalvar} onClick={salvarProduto}>✅ Salvar produto</button>
        </div>
      )}

      {aba === 'lista' && (
        <div style={formContainer}>
          <h2 style={formTitle}>Produtos cadastrados</h2>
          <button type="button" onClick={limparManuais} disabled={limpandoManuais}
            style={{ width: '100%', background: 'rgba(255,200,0,0.08)', border: '1px solid #ffc800', color: '#ffc800', borderRadius: 14, padding: 12, fontSize: 15, fontWeight: 800, marginBottom: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {limpandoManuais ? 'Passando as fotos e apagando...' : '🧹 Tirar celulares cadastrados à mão (passa as fotos pros da lista)'}
          </button>
          <button type="button" onClick={() => recAberto ? setRecAberto(false) : abrirRecuperar()}
            style={{ width: '100%', background: 'rgba(37,211,102,0.08)', border: '1px solid #25D366', color: '#25D366', borderRadius: 14, padding: 12, fontSize: 15, fontWeight: 800, marginBottom: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {recAberto ? '✕ Fechar recuperar fotos' : '🖼 Recuperar fotos (fotos guardadas sem celular)'}
          </button>
          {recAberto && (
            <div style={{ background: '#0b0b0b', border: '1px solid #25D366', borderRadius: 14, padding: 12, marginBottom: 16 }}>
              {recCarregando ? <p style={{ color: '#aaa', textAlign: 'center' }}>Procurando as fotos guardadas...</p>
                : recFotos.length === 0 ? <p style={{ color: '#aaa', textAlign: 'center' }}>Nenhuma foto solta. Todas estão ligadas a algum produto ✅</p>
                : <>
                  <p style={{ color: '#ccc', fontSize: 13, margin: '0 0 8px' }}>{recFotos.length} foto(s) sem celular. 1) Toque nas fotos do mesmo modelo · 2) escolha o celular e a cor · 3) Ligar.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, maxHeight: 360, overflowY: 'auto', marginBottom: 12 }}>
                    {recFotos.map(f => {
                      const on = recMarcadas.includes(f.url)
                      return (
                        <div key={f.url} onClick={() => setRecMarcadas(m => on ? m.filter(x => x !== f.url) : [...m, f.url])}
                          style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '2px solid ' + (on ? '#25D366' : '#222'), background: '#fff', cursor: 'pointer' }}>
                          <img src={f.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          {on && <span style={{ position: 'absolute', top: 4, right: 4, background: '#25D366', color: '#000', borderRadius: '50%', width: 20, height: 20, fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                          {f.data > 0 && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, textAlign: 'center' }}>{new Date(f.data).toLocaleDateString('pt-BR')}</span>}
                        </div>
                      )
                    })}
                  </div>
                  {recMarcadas.length > 0 && (
                    <>
                      <input style={{ ...inputStyle, marginBottom: 8 }} placeholder={`De qual celular são essas ${recMarcadas.length} foto(s)? (ex: iphone 17)`} value={recBusca} onChange={e => { setRecBusca(e.target.value); setRecDestino(null) }} />
                      {!recDestino && recBusca.trim().length >= 2 && (
                        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 8 }}>
                          {gruposDeProdutos(produtos.filter(p => `${p.marca} ${p.modelo}`.toLowerCase().includes(recBusca.trim().toLowerCase()))).slice(0, 15).map(g => {
                            const alvo = g.find(x => (x as { origem?: string | null }).origem === 'lista') || g[0]
                            return (
                              <button key={alvo.id} type="button" onClick={() => { setRecDestino(alvo); setRecCor('') }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', background: '#151515', border: '1px solid #333', color: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 6, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {alvo.marca} {g.length > 1 ? nomeSemMemoria(alvo.modelo) : alvo.modelo} {alvo.foto_url ? '📷' : ''}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {recDestino && (
                        <>
                          <p style={{ color: '#25D366', fontSize: 14, margin: '0 0 6px' }}>Celular: <b>{recDestino.marca} {recDestino.modelo}</b></p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {['', ...(recDestino.cor || '').split(/[,/;]| e /).map(c => c.trim()).filter(Boolean)].map(c => (
                              <button key={c || 'sem'} type="button" onClick={() => setRecCor(c)}
                                style={{ ...(recCor === c ? filtroAtivo : filtroInativo) }}>{c || 'Sem cor'}</button>
                            ))}
                          </div>
                          <button type="button" onClick={ligarFotos} disabled={recSalvando}
                            style={{ width: '100%', background: '#25D366', color: '#000', border: 'none', borderRadius: 12, padding: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {recSalvando ? 'Ligando...' : `Ligar ${recMarcadas.length} foto(s) a esse celular`}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </>}
            </div>
          )}
          <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="🔍 Buscar modelo (ex: 17 pro max)" value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} />
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
            {['', ...Array.from(new Set(produtos.map(p => (p.marca || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))].map(m => (
              <button key={m || 'todas'} onClick={() => setMarcaProduto(m)}
                style={{ ...(marcaProduto === m ? filtroAtivo : filtroInativo), flex: '0 0 auto' }}>{m || 'Todas as marcas'}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {(() => { const gs = gruposDeProdutos(produtos); return [
              ['todos', `Todos (${gs.length})`],
              ['disponiveis', `Disponíveis (${gs.filter(g => g.some(p => p.disponivel)).length})`],
              ['indisponiveis', `Indisponíveis (${gs.filter(g => g.some(p => !p.disponivel)).length})`],
              ['semfoto', `Sem foto (${gs.filter(g => !g.some(p => p.foto_url)).length})`],
            ] as const })().map(([k, l]) => (
              <button key={k} onClick={() => setFiltroProdutos(k)} style={filtroProdutos === k ? filtroAtivo : filtroInativo}>{l}</button>
            ))}
          </div>
          {filtroProdutos === 'indisponiveis' && produtos.some(p => !p.disponivel) && (
            <button style={{ ...btnExcluir, width: '100%', padding: 12, fontSize: 14, fontWeight: 700, marginBottom: 12 }} onClick={excluirIndisponiveis}>
              🗑 Excluir todos os indisponíveis
            </button>
          )}
          {produtos.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>Nenhum produto ainda.</p>
          ) : (
            gruposDeProdutos(produtos.filter(p => {
              if (marcaProduto && (p.marca || '').trim() !== marcaProduto) return false
              const termo = buscaProduto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              if (!termo) return true
              const alvo = `${p.marca} ${p.modelo} ${p.memoria || ''} ${p.cor || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              return termo.split(/\s+/).every(w => alvo.includes(w))
            })).filter(g =>
              filtroProdutos === 'disponiveis' ? g.some(p => p.disponivel)
              : filtroProdutos === 'indisponiveis' ? g.some(p => !p.disponivel)
              : filtroProdutos === 'semfoto' ? !g.some(p => p.foto_url)
              : true
            ).sort((a, b) => Number(b.some(p => p.disponivel)) - Number(a.some(p => p.disponivel))) // disponíveis em cima
            .map(g => {
              const p = g.find(x => x.foto_url) || g[0]
              const varios = g.length > 1
              const disponivel = g.some(x => x.disponivel)
              const cores = Array.from(new Set(g.flatMap(x => (x.cor || '').split(/[,/;]| e /).map(c => c.trim()).filter(Boolean))))
              const editar = (x: Produto) => { setEditando(x); carregarFotosEdicao(x.id) }
              return (
              <div key={g[0].id} style={{ ...produtoCard, cursor: 'pointer' }} onClick={() => editar(p)}>
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.modelo} style={{ width: 65, height: 65, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={semFoto}>📱</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, wordBreak: 'break-word' }}>{p.marca} {varios ? nomeSemMemoria(p.modelo) : p.modelo}</p>
                  <p style={{ color: '#aaa', fontSize: 12 }}>{p.categoria} {!varios && p.memoria ? '· ' + p.memoria : ''}</p>
                  {varios && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, margin: '6px 0 2px' }}>
                      {g.map(x => (
                        <span key={x.id} style={{ display: 'inline-flex', border: '1px solid ' + (x.disponivel ? '#25D366' : '#ff4444'), borderRadius: 10, overflow: 'hidden' }}>
                          <button type="button" onClick={e => { e.stopPropagation(); editar(x) }}
                            style={{ background: '#151515', border: 'none', color: x.disponivel ? '#25D366' : '#ff8888', padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {memoriaDe(x.modelo, x.memoria)?.rotulo || x.modelo}{x.foto_url ? ' 📷' : ''}
                          </button>
                          <button type="button" title={x.disponivel ? 'Deixar indisponível' : 'Deixar disponível'} onClick={e => { e.stopPropagation(); alternarDisponivel(x) }}
                            style={{ background: x.disponivel ? 'rgba(37,211,102,0.15)' : 'rgba(255,68,68,0.15)', border: 'none', borderLeft: '1px solid ' + (x.disponivel ? '#25D366' : '#ff4444'), color: x.disponivel ? '#25D366' : '#ff8888', padding: '5px 9px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {x.disponivel ? '✓' : '✕'}
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: disponivel ? '#25D366' : '#ff4444' }}>{disponivel ? '● Disponível' : '● Indisponível'}</p>
                  {cores.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 10px', marginTop: 4 }}>
                      {cores.map(c => (
                        <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#aaa' }}>
                          <i style={{ width: 9, height: 9, borderRadius: '50%', background: CORES_BOLINHA[c] || '#888', border: '1px solid #555' }} />{c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {g.some(x => x.destaque) && <span style={tagStyle}>☆ Destaque</span>}
                    {g.some(x => x.lancamento) && <span style={tagStyle}>🚀 Lançamento</span>}
                    {g.some(x => x.promocao) && <span style={tagStyle}>🏷 Promoção</span>}
                    {g.some(x => x.mais_procurado) && <span style={tagStyle}>🔥 Mais Procurado</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button style={btnEditar} onClick={e => { e.stopPropagation(); editar(p) }}>✏️</button>
                  <button style={btnExcluir} onClick={e => { e.stopPropagation(); excluirGrupo(g) }}>🗑</button>
                </div>
              </div>
              )
            })
          )}
        </div>
      )}

      {aba === 'capas' && !capaAberta && (
        <div style={formContainer}>
          <h2 style={formTitle}>📱 Capas do catálogo</h2>
          <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: 14, padding: 16, marginBottom: 24 }}>
            <p style={{ color: '#ff6600', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              {capaEditandoId ? '✏️ Editando modelo' : '+ Novo modelo'}
            </p>
            <label style={labelStyle}>Marca</label>
            <select style={inputStyle} value={capaForm.marca} onChange={e => setCapaForm({ ...capaForm, marca: e.target.value })}>
              {CAPAS_MARCAS.map(m => <option key={m}>{m}</option>)}
            </select>
            <label style={labelStyle}>Modelo</label>
            <input style={inputStyle} placeholder="Ex: iPhone 17 Pro Max / 18 Pro Max" value={capaForm.modelo}
              onChange={e => setCapaForm({ ...capaForm, modelo: e.target.value })} />
            <label style={labelStyle}>Foto do celular (só 1 · aparece na lista de modelos)</label>
            {seletorAjuste}
            <label style={uploadBox}>
              {capaUploadModelo ? '⏳ Enviando...' : capaForm.foto_url ? '📷 Trocar foto' : '📷 Escolher foto'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoModeloCapa(f); e.target.value = '' }} />
            </label>
            {capaForm.foto_url && (
              <img src={capaForm.foto_url} alt="modelo" style={{ width: 90, height: 110, objectFit: 'cover', borderRadius: 10, marginBottom: 12, border: '1px solid #333' }} />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSalvar} onClick={salvarCapaModelo} disabled={capaSalvando}>
                {capaSalvando ? '⏳ Salvando...' : capaEditandoId ? '✅ Salvar alteração' : '✅ Cadastrar e adicionar capinhas →'}
              </button>
              {capaEditandoId && (
                <button style={{ ...btnSecundario, padding: '14px 16px', marginTop: 8 }} onClick={limparCapaForm}>Cancelar</button>
              )}
            </div>
          </div>

          <input style={inputStyle} placeholder="⌕ Buscar modelo..." value={capaBusca} onChange={e => setCapaBusca(e.target.value)} />
          <h3 style={{ color: '#aaa', fontSize: 14, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Modelos ({capasModelos.length})
          </h3>
          {capasModelos.length === 0 ? (
            <p style={{ color: '#555', textAlign: 'center', padding: 30 }}>Nenhum modelo cadastrado ainda.</p>
          ) : (
            capasModelos
              .filter(m => !capaBusca.trim() || m.modelo.toLowerCase().includes(capaBusca.toLowerCase().trim()))
              .map(m => {
                const qtd = capasFotos.filter(f => f.modelo_id === m.id).length
                return (
                  <div key={m.id} style={produtoCard}>
                    {m.foto_url
                      ? <img src={m.foto_url} alt={m.modelo} style={{ width: 56, height: 66, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                      : <div style={{ ...semFoto, width: 56, height: 66 }}>📱</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{m.modelo}</p>
                      <p style={{ color: qtd ? '#25D366' : '#ff9a55', fontSize: 12, margin: '4px 0 0' }}>
                        {qtd ? `${qtd} capinha(s) no catálogo` : 'Sem capinhas — não aparece no catálogo'}
                      </p>
                      <button style={{ marginTop: 8, background: '#ff6600', border: 'none', color: 'white', fontWeight: 700, borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
                        onClick={() => { setCapaAberta(m); setCapaTipo(CAPAS_TIPOS[0]); window.scrollTo(0, 0) }}>
                        📷 Capinhas
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button style={btnEditar} onClick={() => editarCapaModelo(m)}>✏️</button>
                      <button style={btnExcluir} onClick={() => excluirCapaModelo(m)}>🗑</button>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      )}

      {aba === 'capas' && capaAberta && (
        <div style={formContainer}>
          <button style={{ ...btnSecundario, marginBottom: 16 }} onClick={() => setCapaAberta(null)}>← Voltar aos modelos</button>
          <h2 style={{ ...formTitle, marginBottom: 4 }}>{capaAberta.modelo}</h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Escolha o tipo e adicione as fotos das capinhas</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {CAPAS_TIPOS.map(t => {
              const qtd = capasFotos.filter(f => f.modelo_id === capaAberta.id && f.tipo === t).length
              const ativo = t === capaTipo
              return (
                <button key={t} onClick={() => setCapaTipo(t)} style={{
                  padding: '9px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  border: ativo ? '1px solid #ff6600' : '1px solid #2a2a2a',
                  background: ativo ? '#ff6600' : '#111', color: ativo ? 'white' : '#ddd',
                }}>
                  {t}{qtd ? ` (${qtd})` : ''}
                </button>
              )
            })}
          </div>

          {seletorAjuste}
          <label style={{ ...uploadBox, borderColor: '#ff6600', color: '#ff6600' }}>
            {capaEnviando
              ? `⏳ Enviando ${capaEnviando.feitas} de ${capaEnviando.total}...`
              : `＋ Adicionar fotos em "${capaTipo}"`}
            <span style={{ color: '#777', fontSize: 12, textAlign: 'center' }}>Pode escolher várias de uma vez. No iPhone/iPad, toque em cada foto para marcar e depois em "Adicionar".</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={!!capaEnviando}
              onChange={e => { const fs = Array.from(e.target.files || []) as File[]; e.target.value = ''; uploadCapinhas(fs) }} />
          </label>

          {(() => {
            const lista = capasFotos.filter(f => f.modelo_id === capaAberta.id && f.tipo === capaTipo)
            if (lista.length === 0) return <p style={{ color: '#555', textAlign: 'center', padding: 30 }}>Nenhuma capinha em {capaTipo} ainda.</p>
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                {lista.map(f => (
                  <div key={f.id} style={{ position: 'relative' }}>
                    <img src={f.url} alt="capinha" style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 10, border: '1px solid #333', display: 'block' }} />
                    <button onClick={() => excluirCapinha(f)}
                      style={{ position: 'absolute', top: 4, right: 4, background: '#7a1111', border: 'none', color: 'white', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 12 }}>✕</button>
                    {botoesIA(f.url, () => recortarCapinha(f), () => voltarCapinha(f))}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {aba === 'aparelhos' && (
        <div style={formContainer}>
          <h2 style={formTitle}>🤝 Aparelhos p/ Negociação</h2>
          {formAparelho}
          <h3 style={{ color: '#aaa', fontSize: 14, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Cadastrados ({aparelhos.length})
          </h3>
          {aparelhos.some(a => a.disponivel === false) && (
            <button style={{ ...btnExcluir, width: '100%', padding: 12, fontSize: 14, fontWeight: 700, marginBottom: 12 }} onClick={excluirAparelhosIndisponiveis}>
              🗑 Excluir indisponíveis ({aparelhos.filter(a => a.disponivel === false).length})
            </button>
          )}
          {aparelhos.length === 0 ? (
            <p style={{ color: '#555', textAlign: 'center', padding: 30 }}>Nenhum aparelho cadastrado.</p>
          ) : (
            aparelhos.map(ap => (
              <div key={ap.id} style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, opacity: ap.disponivel === false ? 0.55 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 4 }}>{ap.modelo}</p>
                  <p style={{ fontSize: 12, marginBottom: 6, color: '#888' }}>
                    {ap.precos_cor && new Set(Object.values(ap.precos_cor)).size > 1
                      ? <span style={{ color: '#25D366', fontWeight: 700 }}>{Object.entries(ap.precos_cor).map(([c, v]) => `${c} ${fmtReal(v)}`).join(' · ')}</span>
                      : ap.preco != null && <span style={{ color: '#25D366', fontWeight: 700 }}>{fmtReal(ap.preco)}</span>}
                    {ap.custo != null && <span> · custo {fmtReal(ap.custo)}</span>}
                    {ap.fornecedor && <span style={{ color: '#ffb27a' }}> · 🏷 {ap.fornecedor}</span>}
                    {ap.disponivel === false && <span style={{ color: '#ff4444', fontWeight: 700 }}> · Indisponível</span>}
                    {Object.values(ap.fotos || {}).flat().length === 0 && <span style={{ color: '#ffc800' }}> · sem foto</span>}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(ap.cores || []).map(cor => (
                      <div key={cor} title={cor} style={{ width: 20, height: 20, borderRadius: '50%', background: CORES_HEX[cor] || '#555', border: '1px solid #333' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button style={btnEditar} onClick={() => abrirEdicaoAparelho(ap)}>✏️</button>
                  <button style={btnExcluir} onClick={() => excluirAparelho(ap.id)}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {aba === 'hero' && (
        <div style={formContainer}>
          <h2 style={formTitle}>🖼 Fotos do Hero</h2>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#ff6600', color: 'white', padding: '14px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 16, marginBottom: 24, width: '100%', boxSizing: 'border-box' as const }}>
            {uploadandoHero ? '⏳ Enviando...' : '📸 Adicionar foto ao Hero'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) uploadHeroImagem(e.target.files[0]) }} />
          </label>
          {heroImagens.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>Nenhuma foto cadastrada ainda.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {heroImagens.map((img) => (
                <div key={img.id} style={{ background: '#0a0a0a', border: `2px solid ${img.ativo ? '#ff6600' : '#222'}`, borderRadius: 14, overflow: 'hidden' }}>
                  <img src={img.url} alt="hero" style={{ width: '100%', height: 120, objectFit: img.titulo ? 'contain' : 'cover', background: img.titulo ? '#fff' : undefined, display: 'block' }} />
                  {img.titulo && <p style={{ margin: 0, padding: '6px 8px 0', fontSize: 12, color: '#ddd', fontWeight: 700 }}>{img.etiqueta ? <span style={{ color: '#ff6600' }}>{img.etiqueta} · </span> : null}{img.titulo}</p>}
                  <div style={{ padding: '8px 8px', display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleHeroImagem(img.id, img.ativo)}
                      style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: img.ativo ? '#1a4a1a' : '#2a2a2a', color: img.ativo ? '#25D366' : '#888' }}>
                      {img.ativo ? '● Ativo' : '○ Inativo'}
                    </button>
                    <button onClick={() => colocarHeroPrimeiro(img.id)} title="Mostrar primeiro no carrossel"
                      style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #5a3a20', background: '#1a0f05', color: '#ff8a3d', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>1º</button>
                    <button onClick={() => excluirHeroImagem(img.id, img.url)}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ff3333', background: '#7a1111', color: '#fff', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const logoMarcas: React.CSSProperties = { color: '#ff6600', fontSize: 32, fontWeight: 900, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'center' }
const logoMag: React.CSSProperties = { color: '#ff6600', fontSize: 16, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'center', marginTop: -6, opacity: 0.85 }
const adminPage: React.CSSProperties = { minHeight: '100vh', background: '#050505', color: 'white', paddingBottom: 40, overflowX: 'hidden', maxWidth: '100vw' }
const adminHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#080808', borderBottom: '1px solid #1a1a1a', position: 'sticky', top: 0, zIndex: 100 }
const abasContainer: React.CSSProperties = { display: 'flex', gap: 0, borderBottom: '1px solid #1a1a1a', overflowX: 'auto' }
const abaAtiva: React.CSSProperties = { flex: 1, padding: '14px 10px', whiteSpace: 'nowrap', background: 'none', color: '#ff6600', border: 'none', borderBottom: '3px solid #ff6600', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const abaInativa: React.CSSProperties = { flex: 1, padding: '14px 10px', whiteSpace: 'nowrap', background: 'none', color: '#666', border: 'none', borderBottom: '3px solid transparent', fontSize: 14, cursor: 'pointer' }
const formContainer: React.CSSProperties = { padding: '20px 16px', maxWidth: '100%', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }
const formTitle: React.CSSProperties = { color: '#ff6600', fontSize: 20, fontWeight: 800, marginBottom: 20 }
const labelStyle: React.CSSProperties = { color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', maxWidth: '100%', padding: '12px 14px', marginBottom: 14, borderRadius: 10, border: '1px solid #2a2a2a', background: '#0f0f0f', color: 'white', fontSize: 16, outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none' }
const uploadBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px', border: '2px dashed #2a2a2a', borderRadius: 12, marginBottom: 14, cursor: 'pointer', background: '#0f0f0f', color: '#aaa', fontSize: 14, width: '100%', boxSizing: 'border-box' }
const btnSalvar: React.CSSProperties = { width: '100%', padding: 16, borderRadius: 12, border: 'none', background: '#ff6600', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 8 }
const btnSecundario: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#ccc', fontSize: 13, cursor: 'pointer' }
const produtoCard: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 12, marginBottom: 12 }
const semFoto: React.CSSProperties = { width: 65, height: 65, background: '#1a1a1a', borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 24, flexShrink: 0 }
const btnEditar: React.CSSProperties = { background: '#0a1a2a', border: '1px solid #1a6aff', color: '#4a9aff', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 16 }
const btnExcluir: React.CSSProperties = { background: '#1a0000', border: '1px solid #ff3333', color: '#ff4444', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 16 }
const tagsBox: React.CSSProperties = { background: '#0a0a0a', border: '1px solid #222', borderRadius: 12, padding: 16, marginBottom: 16 }
const tagsTitle: React.CSSProperties = { color: '#ff6600', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }
const checkLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 15, color: '#ccc', cursor: 'pointer' }
const gradeFotos: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }
const fotoMiniatura: React.CSSProperties = { width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', borderRadius: 10, background: '#151515', border: '1px solid #2a2a2a', display: 'block' }
const seloCapa: React.CSSProperties = { position: 'absolute', top: 4, left: 4, background: '#ff6600', color: 'white', fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2px 6px' }
const btnTornarCapa: React.CSSProperties = { position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, padding: '2px 5px', cursor: 'pointer', fontSize: 12 }
const btnRemoverFoto: React.CSSProperties = { position: 'absolute', top: 3, right: 3, background: '#7a1111', border: 'none', color: 'white', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 11 }
const seletorCor: React.CSSProperties = { width: '100%', marginTop: 4, padding: '5px 4px', borderRadius: 6, border: '1px solid #2a2a2a', background: '#111', color: '#ddd', fontSize: 11 }
const btnIA: React.CSSProperties = { flex: 1, background: '#1b1230', border: '1px solid #5b3fa8', color: '#cbb6ff', borderRadius: 8, padding: '6px 4px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }
const btnOriginal: React.CSSProperties = { position: 'absolute', bottom: 4, left: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: '1px solid #444', color: '#ddd', borderRadius: 6, padding: '3px 0', cursor: 'pointer', fontSize: 10 }
const modoAtivo: React.CSSProperties = { flex: 1, padding: '11px 8px', borderRadius: 10, border: '1px solid #ff6600', background: 'rgba(255,102,0,0.15)', color: '#ff6600', fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const modoInativo: React.CSSProperties = { flex: 1, padding: '11px 8px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0f0f0f', color: '#888', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const filtroAtivo: React.CSSProperties = { padding: '7px 12px', borderRadius: 18, border: '1px solid #ff6600', background: 'rgba(255,102,0,0.15)', color: '#ff6600', fontWeight: 700, fontSize: 12, cursor: 'pointer' }
const filtroInativo: React.CSSProperties = { padding: '7px 12px', borderRadius: 18, border: '1px solid #333', background: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }
const tagLista: React.CSSProperties = { fontSize: 10, fontWeight: 800, border: '1px solid', borderRadius: 8, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }
const tagStyle: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#aaa' }