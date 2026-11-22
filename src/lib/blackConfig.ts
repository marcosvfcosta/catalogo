// Catálogo da Black (capinhas e cordinhas) — tipos e textos padrão.
// Usado pelo painel (Admin → Capas) e pelo site público (/black). Separado da Negociação.

export type BlackProduto = {
  id: string
  nome: string
  tipo: 'capa' | 'cordinha'
  preco: number
  preco_promo: number | null
  fotos: string[]
  modelos: string[]
  descricao: string | null
  no_site: boolean
  lancamento: boolean
  destaque: boolean
  ordem: number
  filtros?: string[] // ids de black_filtros
  rascunho?: boolean
  criado_em?: string
}

export type BlackModelo = { id: string; nome: string; marca: string | null; ordem: number; foto_url?: string | null }

export type BlackGrupo = 'publico' | 'estilo' | 'funcao' | 'cor'
export type BlackFiltro = { id: string; grupo: BlackGrupo; nome: string; cor_hex: string | null; ordem: number }
export const GRUPOS: { id: BlackGrupo; nome: string }[] = [
  { id: 'publico', nome: 'Público' },
  { id: 'estilo', nome: 'Estilo' },
  { id: 'funcao', nome: 'Função' },
  { id: 'cor', nome: 'Cor' },
]

export type BlackVideo = { id: string; video_url: string; capa_url: string | null; produto_id: string | null; ordem: number }

export type BlackSecao = { ativo: boolean; titulo: string; texto: string }

export type BlackCor = { nome: string; hex: string }

// Foto da capinha vestida num modelo + cor de celular (gerada pela IA no painel)
export type BlackVestida = { id: string; produto_id: string; modelo: string; cor: string; url: string }

export type BlackConfig = {
  faixa: string
  linha1: string
  linha2: string
  frase: string
  botao: string
  contagem: string // ISO; vazio = sem contagem
  contagem_titulo: string
  secoes: { filtro: BlackSecao; lancamentos: BlackSecao; videos: BlackSecao; mais: BlackSecao; promo: BlackSecao }
  experimentar: { ativo: boolean; cores: BlackCor[] }
  whatsapp: string
  instagram: string
  endereco: string
  horario: string
}

export const BLACK_PADRAO: BlackConfig = {
  faixa: 'Parcele em até 18x · Aceitamos seu usado',
  linha1: 'BLACK',
  linha2: 'FRIDAY',
  frase: 'O melhor jeito de comprar.',
  botao: 'Aproveite',
  contagem: '2026-11-27T00:00:00-03:00',
  contagem_titulo: 'Black Friday começa em',
  secoes: {
    filtro: { ativo: true, titulo: 'Qual é o seu celular?', texto: 'Toque no modelo e veja só o que serve nele' },
    lancamentos: { ativo: true, titulo: 'Lançamentos', texto: 'Acabaram de chegar pra Black' },
    videos: { ativo: true, titulo: 'Descubra cada detalhe em vídeo', texto: 'Toque pra ver como fica na mão' },
    mais: { ativo: true, titulo: 'Mais vendidos', texto: 'Os queridinhos de Bom Jesus' },
    promo: { ativo: true, titulo: 'Promoção Black', texto: 'Preço de Black Friday enquanto durar o estoque' },
  },
  experimentar: {
    ativo: true,
    cores: [
      { nome: 'Preto', hex: '#1d1d1f' }, { nome: 'Branco', hex: '#f2f1ec' }, { nome: 'Azul', hex: '#5e7fa3' },
      { nome: 'Rosa', hex: '#f2c6c9' }, { nome: 'Verde', hex: '#a9c3a4' },
    ],
  },
  whatsapp: '5564993374281',
  instagram: '@marcosmagazinee',
  endereco: 'Av. Goiás · Centro · Bom Jesus',
  horario: 'Seg a Sáb · 8h às 18h',
}

// Junta o que está salvo com o padrão (campos novos nunca ficam vazios)
export function lerConfig(dados: unknown): BlackConfig {
  const d = (dados && typeof dados === 'object' ? dados : {}) as Partial<BlackConfig>
  const s = (d.secoes || {}) as Partial<BlackConfig['secoes']>
  const e = (d.experimentar || {}) as Partial<BlackConfig['experimentar']>
  return {
    ...BLACK_PADRAO,
    ...d,
    experimentar: {
      ativo: e.ativo ?? BLACK_PADRAO.experimentar.ativo,
      cores: Array.isArray(e.cores) && e.cores.length ? e.cores : BLACK_PADRAO.experimentar.cores,
    },
    secoes: {
      filtro: { ...BLACK_PADRAO.secoes.filtro, ...(s.filtro || {}) },
      lancamentos: { ...BLACK_PADRAO.secoes.lancamentos, ...(s.lancamentos || {}) },
      videos: { ...BLACK_PADRAO.secoes.videos, ...(s.videos || {}) },
      mais: { ...BLACK_PADRAO.secoes.mais, ...(s.mais || {}) },
      promo: { ...BLACK_PADRAO.secoes.promo, ...(s.promo || {}) },
    },
  }
}

export const precoFinal = (p: BlackProduto) => (p.preco_promo && p.preco_promo < p.preco ? p.preco_promo : p.preco)
export const emPromocao = (p: BlackProduto) => !!(p.preco_promo && p.preco_promo < p.preco)
export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const soNumeros = (t: string) => t.replace(/\D/g, '')
