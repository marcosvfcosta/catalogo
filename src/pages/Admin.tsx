import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { ajustarFoto } from '../lib/ajustarFoto'
import AssistenteIA from './AssistenteIA'

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
  preco?: number
  disponivel?: boolean
  destaque?: boolean
  lancamento?: boolean
  promocao?: boolean
  mais_procurado?: boolean
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
  chave?: string | null
  disponivel?: boolean | null
}

type ItemLista = {
  marca: string
  modelo: string
  memoria: string
  ram: string | null
  rede: string | null
  cores: string[]
  custo: number
}

type ItemPreparado = ItemLista & {
  nome: string
  chave: string
  status: 'novo' | 'alterado' | 'igual' | 'maiscaro'
  custoAntigo: number | null
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

function montarNome(i: ItemLista) {
  return [i.modelo, i.memoria, i.ram ? `${i.ram} RAM` : '', i.rede || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

function fmtReal(v: number | null | undefined) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type CapaModelo = {
  id: string
  marca: string
  modelo: string
  foto_url: string | null
  ordem: number
}

type CapaFoto = {
  id: string
  modelo_id: string
  tipo: string
  url: string
}

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
  const [aba, setAba] = useState<'cadastrar' | 'lista' | 'capas' | 'aparelhos' | 'hero' | 'ia'>('cadastrar')
  const [uploadandoHero, setUploadandoHero] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [heroImagens, setHeroImagens] = useState<HeroImagem[]>([])
  const [fotosNovas, setFotosNovas] = useState<string[]>([]) // fotos do produto novo (a 1ª é a capa)
  // Foto original guardada para o botão "usar original" (chave = url da foto ajustada)
  const [originais, setOriginais] = useState<Record<string, File>>({})
  const [enviandoFotos, setEnviandoFotos] = useState<{ feitas: number; total: number } | null>(null)
  const [ajusteAuto, setAjusteAuto] = useState(() => {
    try { return localStorage.getItem('ajusteAutoFotos') !== 'nao' } catch { return true }
  })
  const [fotosEdicao, setFotosEdicao] = useState<ProdutoFoto[]>([])

  const [aparelhos, setAparelhos] = useState<Aparelho[]>([])
  const [novoModelo, setNovoModelo] = useState('')
  const [coresSelecionadas, setCoresSelecionadas] = useState<string[]>([])
  const [fotosAparelho, setFotosAparelho] = useState<Record<string, string[]>>({})
  const [uploadandoFotoAp, setUploadandoFotoAp] = useState<string | null>(null)
  const [editandoAparelho, setEditandoAparelho] = useState<Aparelho | null>(null)
  const [salvandoAparelho, setSalvandoAparelho] = useState(false)
  const [apMemoria, setApMemoria] = useState('')
  const [apCusto, setApCusto] = useState('')
  const [apPreco, setApPreco] = useState('')

  // ─── Lista do dia ───
  const [modoCadastro, setModoCadastro] = useState<'produto' | 'lista'>('produto')
  const [textoLista, setTextoLista] = useState('')
  const [lendoLista, setLendoLista] = useState(false)
  const [itensLista, setItensLista] = useState<ItemPreparado[] | null>(null)
  const [saidas, setSaidas] = useState<Saida[]>([])
  const [finalizando, setFinalizando] = useState(false)
  const [resumoHoje, setResumoHoje] = useState<{ vistos: number; faltando: number } | null>(null)
  const [aplicandoLista, setAplicandoLista] = useState<{ feitos: number; total: number } | null>(null)
  const [filtroProdutos, setFiltroProdutos] = useState<'todos' | 'disponiveis' | 'indisponiveis' | 'semfoto'>('todos')

  // ─── Capas ───
  const [capasModelos, setCapasModelos] = useState<CapaModelo[]>([])
  const [capasFotos, setCapasFotos] = useState<CapaFoto[]>([])
  const [capaForm, setCapaForm] = useState({ marca: 'Apple', modelo: '', foto_url: '' })
  const [capaEditandoId, setCapaEditandoId] = useState<string | null>(null)
  const [capaSalvando, setCapaSalvando] = useState(false)
  const [capaUploadModelo, setCapaUploadModelo] = useState(false)
  const [capaAberta, setCapaAberta] = useState<CapaModelo | null>(null)
  const [capaTipo, setCapaTipo] = useState(CAPAS_TIPOS[0])
  const [capaEnviando, setCapaEnviando] = useState<{ feitas: number; total: number } | null>(null)
  const [capaBusca, setCapaBusca] = useState('')

  const [novoProduto, setNovoProduto] = useState({
    categoria: 'Celulares',
    marca: '', modelo: '', memoria: '', cor: '', condicao: '',
    bateria_saude: '', preco: '', foto_url: '', descricao: '',
    disponivel: true, destaque: false, lancamento: false,
    promocao: false, mais_procurado: false,
  })

  useEffect(() => {
    carregarProdutos(); carregarHeroImagens(); carregarAparelhos(); carregarCapas()
  }, [])

  async function carregarProdutos() {
    const { data } = await supabase.from('produtos_catalogo').select('*').order('created_at', { ascending: false })
    setProdutos(data || [])
  }

  async function carregarHeroImagens() {
    const { data } = await supabase.from('hero_imagens').select('*').order('ordem', { ascending: true })
    setHeroImagens(data || [])
  }

  async function carregarFotosEdicao(produtoId: string) {
    const { data } = await supabase.from('produto_fotos').select('*').eq('produto_id', produtoId).order('ordem')
    setFotosEdicao(data || [])
  }

  async function carregarAparelhos() {
    const { data } = await supabase.from('aparelhos').select('*').order('modelo')
    setAparelhos(data || [])
  }

  // ─── Capas: funções ───
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

  // Ajusta (se ligado) e envia para o Storage. Devolve a url e, se ajustou, a original
  async function enviarFoto(arquivo: File, prefixo: string, pasta = ''): Promise<{ url: string; original?: File }> {
    const aj = ajusteAuto ? await ajustarFoto(arquivo) : { arquivo, ajustou: false }
    const final = aj.arquivo
    const ext = (final.name.split('.').pop() || 'jpg').toLowerCase()
    const nomeArquivo = `${pasta}${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, final, { upsert: true, contentType: final.type || 'image/jpeg' })
    if (error) throw error
    const url = supabase.storage.from('fotos').getPublicUrl(nomeArquivo).data.publicUrl
    return { url, original: aj.ajustou ? arquivo : undefined }
  }

  // Envia a foto original (sem ajuste) — usado no botão "usar original"
  async function enviarOriginal(arquivo: File, prefixo: string) {
    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase()
    const nomeArquivo = `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true, contentType: arquivo.type || 'image/jpeg' })
    if (error) throw error
    return supabase.storage.from('fotos').getPublicUrl(nomeArquivo).data.publicUrl
  }

  // Envia várias fotos em sequência, com contador
  async function enviarVarias(arquivos: File[], prefixo: string, aoEnviar: (url: string) => Promise<void> | void, pasta = '') {
    if (arquivos.length === 0) return
    setEnviandoFotos({ feitas: 0, total: arquivos.length })
    let falhas = 0
    for (let i = 0; i < arquivos.length; i++) {
      try {
        const { url, original } = await enviarFoto(arquivos[i], prefixo, pasta)
        if (original) setOriginais(prev => ({ ...prev, [url]: original }))
        await aoEnviar(url)
      } catch (e) {
        falhas++
        console.error(e)
      }
      setEnviandoFotos({ feitas: i + 1, total: arquivos.length })
    }
    setEnviandoFotos(null)
    if (falhas) alert(`${falhas} foto(s) não foram enviadas. Tente de novo.`)
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
    await supabase.from('produtos_catalogo').update({ foto_url: foto.url }).eq('id', editando.id)
    if (capaAtual) await supabase.from('produto_fotos').update({ url: capaAtual }).eq('id', foto.id)
    else await supabase.from('produto_fotos').delete().eq('id', foto.id)
    setEditando({ ...editando, foto_url: foto.url })
    carregarFotosEdicao(editando.id)
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
    setCapaForm({ marca: 'Apple', modelo: '', foto_url: '' })
    setCapaEditandoId(null)
  }

  async function salvarCapaModelo() {
    const modelo = capaForm.modelo.trim()
    if (!modelo) { alert('Informe o modelo do celular'); return }
    setCapaSalvando(true)
    const dados = { marca: capaForm.marca, modelo, foto_url: capaForm.foto_url || null }
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
    setCapaForm({ marca: m.marca || 'Apple', modelo: m.modelo, foto_url: m.foto_url || '' })
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

  async function salvarProduto() {
    if (!novoProduto.marca || !novoProduto.modelo || !novoProduto.categoria) {
      alert('Preencha categoria, marca e modelo.'); return
    }
    const { data, error } = await supabase.from('produtos_catalogo').insert([{
      categoria: novoProduto.categoria, marca: novoProduto.marca, modelo: novoProduto.modelo,
      memoria: novoProduto.memoria, cor: novoProduto.cor, condicao: novoProduto.condicao,
      bateria_saude: novoProduto.bateria_saude, preco: novoProduto.preco ? Number(novoProduto.preco) : null,
      foto_url: fotosNovas[0] || '', descricao: novoProduto.descricao, disponivel: novoProduto.disponivel,
      destaque: novoProduto.destaque, lancamento: novoProduto.lancamento,
      promocao: novoProduto.promocao, mais_procurado: novoProduto.mais_procurado,
    }]).select()
    if (error) { alert('Erro ao salvar produto'); return }
    if (data && data[0] && fotosNovas.length > 1) {
      const produtoId = data[0].id
      const extras = fotosNovas.slice(1)
      for (let i = 0; i < extras.length; i++) {
        await supabase.from('produto_fotos').insert([{ produto_id: produtoId, url: extras[i], ordem: i + 1 }])
      }
    }
    alert('Produto cadastrado!')
    setNovoProduto({ categoria: 'Celulares', marca: '', modelo: '', memoria: '', cor: '', condicao: '', bateria_saude: '', preco: '', foto_url: '', descricao: '', disponivel: true, destaque: false, lancamento: false, promocao: false, mais_procurado: false })
    setFotosNovas([])
    carregarProdutos()
    setAba('lista')
  }

  async function salvarEdicao() {
    if (!editando) return
    const { error } = await supabase.from('produtos_catalogo').update({
      categoria: editando.categoria, marca: editando.marca, modelo: editando.modelo,
      memoria: editando.memoria, cor: editando.cor, condicao: editando.condicao,
      bateria_saude: editando.bateria_saude, preco: editando.preco,
      foto_url: editando.foto_url, descricao: editando.descricao, disponivel: editando.disponivel,
      destaque: editando.destaque, lancamento: editando.lancamento,
      promocao: editando.promocao, mais_procurado: editando.mais_procurado,
    }).eq('id', editando.id)
    if (error) { alert('Erro ao editar produto'); return }
    alert('Produto atualizado!')
    setEditando(null)
    setFotosEdicao([])
    carregarProdutos()
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
        supabase.from('aparelhos').select('id, modelo, marca, chave, custo, disponivel, ultima_lista'),
      ])
      const listaProdutos = (prods || []) as { id: string; marca: string; modelo: string; memoria?: string; chave?: string; disponivel?: boolean }[]
      const listaAparelhos = (aps || []) as { id: string; modelo: string; marca?: string; chave?: string; custo?: number; disponivel?: boolean; ultima_lista?: string }[]

      const vistos = new Set<string>()
      const preparados: ItemPreparado[] = []
      for (const bruto of dados.itens as ItemLista[]) {
        const item: ItemLista = {
          marca: (bruto.marca || '').trim(),
          modelo: (bruto.modelo || '').trim(),
          memoria: (bruto.memoria || '').toUpperCase().replace(/\s/g, ''),
          ram: bruto.ram ? String(bruto.ram).toUpperCase().replace(/\s/g, '') : null,
          rede: bruto.rede ? String(bruto.rede).toUpperCase() : null,
          cores: Array.from(new Set((bruto.cores || []).map(c => c.trim()).filter(Boolean))),
          custo: Number(bruto.custo) || 0,
        }
        if (!item.modelo || !item.custo) continue
        const nome = montarNome(item)
        const chave = normalizar(nome)
        if (vistos.has(chave)) continue
        vistos.add(chave)
        const ap = listaAparelhos.find(a => (a.chave || normalizar(a.modelo)) === chave)
        const existeProduto = listaProdutos.some(p => (p.chave || normalizar(p.modelo)) === chave)
        const custoAntigo = ap?.custo != null ? Number(ap.custo) : null
        // Já veio em outra lista hoje com custo menor: mantém o menor
        const status: ItemPreparado['status'] = !ap && !existeProduto ? 'novo'
          : custoAntigo != null && vistoHoje(ap?.ultima_lista) && custoAntigo < item.custo ? 'maiscaro'
          : custoAntigo != null && custoAntigo !== item.custo ? 'alterado' : 'igual'
        preparados.push({ ...item, nome, chave, status, custoAntigo, marcado: true })
      }

      setItensLista(preparados)
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
      supabase.from('produtos_catalogo').select('id, modelo, chave, cor, ultima_lista'),
      supabase.from('aparelhos').select('id, modelo, chave, cores, fotos, custo, ultima_lista'),
    ])
    const listaProdutos = (prods || []) as { id: string; modelo: string; chave?: string; cor?: string; ultima_lista?: string }[]
    const listaAparelhos = (aps || []) as { id: string; modelo: string; chave?: string; cores?: string[]; fotos?: Record<string, string[]>; custo?: number; ultima_lista?: string }[]

    let feitos = 0
    let falhas = 0
    for (const i of selecionados) {
      try {
        // Catálogo (sem preço). Se já veio em outra lista hoje, soma as cores
        const prod = listaProdutos.find(p => (p.chave || normalizar(p.modelo)) === i.chave)
        const coresProd = prod && vistoHoje(prod.ultima_lista)
          ? Array.from(new Set([...(prod.cor || '').split(',').map(c => c.trim()).filter(Boolean), ...i.cores]))
          : i.cores
        const cor = coresProd.join(', ')
        if (prod) {
          await supabase.from('produtos_catalogo').update({ marca: i.marca, modelo: i.nome, cor, disponivel: true, chave: i.chave, origem: 'lista', ultima_lista: agora }).eq('id', prod.id)
        } else {
          await supabase.from('produtos_catalogo').insert([{
            categoria: 'Celulares', marca: i.marca, modelo: i.nome, memoria: '', cor,
            disponivel: true, chave: i.chave, origem: 'lista', ultima_lista: agora,
          }])
        }
        // Negociação (custo e preço de venda). Mesmo dia: fica o menor custo e soma as cores
        const ap = listaAparelhos.find(a => (a.chave || normalizar(a.modelo)) === i.chave)
        const mesmoDia = !!ap && vistoHoje(ap.ultima_lista)
        const custo = mesmoDia && ap?.custo != null ? Math.min(Number(ap.custo), i.custo) : i.custo
        const preco = custo + lucroPorMemoria(i.memoria)
        const cores = mesmoDia ? Array.from(new Set([...(ap?.cores || []), ...i.cores])) : i.cores
        const dadosAp = { modelo: i.nome, marca: i.marca, memoria: i.memoria, cores, custo, preco, chave: i.chave, disponivel: true, ultima_lista: agora }
        if (ap) {
          await supabase.from('aparelhos').update(dadosAp).eq('id', ap.id)
        } else {
          await supabase.from('aparelhos').insert([{ ...dadosAp, fotos: {} }])
        }
      } catch (e) {
        falhas++
        console.error(e)
      }
      feitos++
      setAplicandoLista({ feitos, total })
    }
    setAplicandoLista(null)
    alert(falhas
      ? `Concluído com ${falhas} erro(s). Confira a lista.`
      : 'Lista salva! Pode colar a próxima lista. Quando terminar todas as listas de hoje, toque em "Finalizar o dia".')
    setItensLista(null)
    setTextoLista('')
    carregarProdutos()
    carregarAparelhos()
    carregarResumoHoje()
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
      supabase.from('produtos_catalogo').select('id, marca, modelo, origem, disponivel, ultima_lista'),
      supabase.from('aparelhos').select('id, modelo, chave, disponivel, ultima_lista'),
    ])
    const lista: Saida[] = []
    ;((prods || []) as { id: string; marca: string; modelo: string; origem?: string; disponivel?: boolean; ultima_lista?: string }[])
      .filter(p => p.origem === 'lista' && p.disponivel !== false && !vistoHoje(p.ultima_lista))
      .forEach(p => lista.push({ tipo: 'produto', id: p.id, nome: `${p.marca} ${p.modelo}`, marcado: true }))
    ;((aps || []) as { id: string; modelo: string; chave?: string; disponivel?: boolean; ultima_lista?: string }[])
      .filter(a => a.chave && a.disponivel !== false && !vistoHoje(a.ultima_lista))
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

  async function salvarAparelho() {
    const modelo = editandoAparelho ? editandoAparelho.modelo : novoModelo.trim()
    const cores = editandoAparelho ? editandoAparelho.cores : coresSelecionadas
    const fotos = editandoAparelho ? editandoAparelho.fotos : fotosAparelho
    if (!modelo) { alert('Informe o modelo'); return }
    if (cores.length === 0) { alert('Selecione ao menos uma cor'); return }
    setSalvandoAparelho(true)
    const num = (t: string) => t.trim() ? (parseFloat(t.replace(/\./g, '').replace(',', '.')) || null) : null
    const extras = { memoria: apMemoria || null, custo: num(apCusto), preco: num(apPreco), disponivel: true }
    if (editandoAparelho) {
      await supabase.from('aparelhos').update({ modelo, cores, fotos, ...extras }).eq('id', editandoAparelho.id)
      setEditandoAparelho(null)
    } else {
      await supabase.from('aparelhos').insert([{ modelo, cores, fotos, ...extras }])
      setNovoModelo('')
      setCoresSelecionadas([])
      setFotosAparelho({})
    }
    setApMemoria(''); setApCusto(''); setApPreco('')
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

  const seletorAjuste = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ajusteAuto ? '#25D366' : '#888', margin: '0 0 8px', cursor: 'pointer' }}>
      <input type="checkbox" checked={ajusteAuto} onChange={e => alternarAjuste(e.target.checked)} style={{ accentColor: '#25D366', width: 16, height: 16 }} />
      🪄 Ajustar fotos automaticamente (tira o fundo e centraliza)
    </label>
  )

  if (editando) {
    return (
      <div style={adminPage}>
        <div style={adminHeader}>
          <div><span style={logoMarcas}>Marcos</span><span style={{ ...logoMag, display: 'inline', marginLeft: 4 }}> Magazine</span></div>
          <button style={btnSecundario} onClick={() => { setEditando(null); setFotosEdicao([]) }}>← Voltar</button>
        </div>
        <div style={formContainer}>
          <h2 style={formTitle}>✏️ Editar produto</h2>
          <label style={labelStyle}>Categoria</label>
          <select style={inputStyle} value={editando.categoria} onChange={e => setEditando({ ...editando, categoria: e.target.value })}>
            <option>Celulares</option><option>Tablet</option><option>Carregadores</option>
            <option>Fones</option><option>Smartwatch</option><option>Caixa de som</option>
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
          <label style={labelStyle}>Preço</label>
          <input style={inputStyle} type="number" value={editando.preco || ''} onChange={e => setEditando({ ...editando, preco: Number(e.target.value) })} />
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
                <div style={{ position: 'relative' }}>
                  <img src={editando.foto_url} style={fotoMiniatura} />
                  <span style={seloCapa}>CAPA</span>
                  <button onClick={excluirCapaEdicao} style={btnRemoverFoto}>✕</button>
                  {originais[editando.foto_url] && <button onClick={() => usarOriginalEdicao(editando.foto_url!)} style={btnOriginal}>↺ original</button>}
                </div>
              )}
              {fotosEdicao.map(foto => (
                <div key={foto.id} style={{ position: 'relative' }}>
                  <img src={foto.url} style={fotoMiniatura} />
                  <button onClick={() => tornarCapaEdicao(foto)} style={btnTornarCapa} title="Usar como capa">⭐</button>
                  <button onClick={() => excluirFotoExtra(foto.id, editando.id)} style={btnRemoverFoto}>✕</button>
                  {originais[foto.url] && <button onClick={() => usarOriginalEdicao(foto.url, foto.id)} style={btnOriginal}>↺ original</button>}
                </div>
              ))}
            </div>
          )}
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, height: 80 }} value={editando.descricao || ''} onChange={e => setEditando({ ...editando, descricao: e.target.value })} />
          <div style={tagsBox}>
            <p style={tagsTitle}>Tags do produto</p>
            <label style={checkLabel}><input type="checkbox" checked={editando.disponivel || false} onChange={e => setEditando({ ...editando, disponivel: e.target.checked })} />✅ Disponível no catálogo</label>
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
      <div style={adminHeader}>
        <div><span style={logoMarcas}>Marcos</span><span style={{ ...logoMag, display: 'inline', marginLeft: 4 }}> Magazine</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnSecundario} onClick={() => navigate('/')}>Ver catálogo</button>
          <button style={btnSecundario} onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </div>

      <div style={abasContainer}>
        <button style={aba === 'cadastrar' ? abaAtiva : abaInativa} onClick={() => setAba('cadastrar')}>+ Cadastrar</button>
        <button style={aba === 'lista' ? abaAtiva : abaInativa} onClick={() => setAba('lista')}>📦 ({produtos.length})</button>
        <button style={aba === 'capas' ? abaAtiva : abaInativa} onClick={() => { setAba('capas'); setCapaAberta(null) }}>📱 Capas</button>
        <button style={aba === 'aparelhos' ? abaAtiva : abaInativa} onClick={() => setAba('aparelhos')}>🤝</button>
        <button style={aba === 'hero' ? abaAtiva : abaInativa} onClick={() => setAba('hero')}>🖼 Hero</button>
        <button style={aba === 'ia' ? abaAtiva : abaInativa} onClick={() => setAba('ia')}>🤖 IA</button>
      </div>

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
                          {i.status === 'novo' && <span style={{ ...tagLista, color: '#4fc3f7', borderColor: '#4fc3f7' }}>NOVO</span>}
                          {i.status === 'alterado' && <span style={{ ...tagLista, color: '#ffc800', borderColor: '#ffc800' }}>{fmtReal(i.custoAntigo)} → {fmtReal(i.custo)}</span>}
                          {i.status === 'igual' && <span style={{ ...tagLista, color: '#888', borderColor: '#333' }}>IGUAL</span>}
                          {i.status === 'maiscaro' && <span style={{ ...tagLista, color: '#888', borderColor: '#555' }}>fica {fmtReal(i.custoAntigo)} (outra lista)</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '6px 0' }}>
                          {i.cores.map(c => (
                            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1a1a1a', borderRadius: 12, padding: '2px 8px', fontSize: 11, color: '#ccc' }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: CORES_HEX[c] || '#777' }} />{c}
                            </span>
                          ))}
                        </div>
                        <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Custo {fmtReal(i.custo)}</p>
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
            <option>Celulares</option><option>Tablet</option><option>Carregadores</option>
            <option>Fones</option><option>Smartwatch</option><option>Caixa de som</option>
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
          <label style={labelStyle}>Preço (interno)</label>
          <input style={inputStyle} placeholder="Ex: 2999" value={novoProduto.preco} onChange={e => setNovoProduto({ ...novoProduto, preco: e.target.value })} />
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {([
              ['todos', `Todos (${produtos.length})`],
              ['disponiveis', `Disponíveis (${produtos.filter(p => p.disponivel).length})`],
              ['indisponiveis', `Indisponíveis (${produtos.filter(p => !p.disponivel).length})`],
              ['semfoto', `Sem foto (${produtos.filter(p => !p.foto_url).length})`],
            ] as const).map(([k, l]) => (
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
            produtos.filter(p =>
              filtroProdutos === 'disponiveis' ? p.disponivel
              : filtroProdutos === 'indisponiveis' ? !p.disponivel
              : filtroProdutos === 'semfoto' ? !p.foto_url
              : true
            ).map(p => (
              <div key={p.id} style={produtoCard}>
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.modelo} style={{ width: 65, height: 65, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={semFoto}>📱</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.marca} {p.modelo}</p>
                  <p style={{ color: '#aaa', fontSize: 12 }}>{p.categoria} {p.memoria ? '· ' + p.memoria : ''}</p>
                  <p style={{ fontSize: 11, color: p.disponivel ? '#25D366' : '#ff4444' }}>{p.disponivel ? '● Disponível' : '● Indisponível'}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {p.destaque && <span style={tagStyle}>☆ Destaque</span>}
                    {p.lancamento && <span style={tagStyle}>🚀 Lançamento</span>}
                    {p.promocao && <span style={tagStyle}>🏷 Promoção</span>}
                    {p.mais_procurado && <span style={tagStyle}>🔥 Mais Procurado</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button style={btnEditar} onClick={() => { setEditando(p); carregarFotosEdicao(p.id) }}>✏️</button>
                  <button style={btnExcluir} onClick={() => excluirProduto(p.id)}>🗑</button>
                </div>
              </div>
            ))
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSalvar} onClick={salvarAparelho} disabled={salvandoAparelho}>
                {salvandoAparelho ? '⏳ Salvando...' : '✅ Salvar aparelho'}
              </button>
              {editandoAparelho && (
                <button style={{ ...btnSecundario, padding: '14px 16px' }} onClick={() => { setEditandoAparelho(null); setApMemoria(''); setApCusto(''); setApPreco('') }}>Cancelar</button>
              )}
            </div>
          </div>
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
                    {ap.preco != null && <span style={{ color: '#25D366', fontWeight: 700 }}>{fmtReal(ap.preco)}</span>}
                    {ap.custo != null && <span> · custo {fmtReal(ap.custo)}</span>}
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
                  <button style={btnEditar} onClick={() => {
                    setEditandoAparelho(ap)
                    setApMemoria(ap.memoria || '')
                    setApCusto(ap.custo != null ? String(ap.custo).replace('.', ',') : '')
                    setApPreco(ap.preco != null ? String(ap.preco).replace('.', ',') : '')
                    window.scrollTo(0, 0)
                  }}>✏️</button>
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
const btnOriginal: React.CSSProperties = { position: 'absolute', bottom: 4, left: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: '1px solid #444', color: '#ddd', borderRadius: 6, padding: '3px 0', cursor: 'pointer', fontSize: 10 }
const modoAtivo: React.CSSProperties = { flex: 1, padding: '11px 8px', borderRadius: 10, border: '1px solid #ff6600', background: 'rgba(255,102,0,0.15)', color: '#ff6600', fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const modoInativo: React.CSSProperties = { flex: 1, padding: '11px 8px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0f0f0f', color: '#888', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const filtroAtivo: React.CSSProperties = { padding: '7px 12px', borderRadius: 18, border: '1px solid #ff6600', background: 'rgba(255,102,0,0.15)', color: '#ff6600', fontWeight: 700, fontSize: 12, cursor: 'pointer' }
const filtroInativo: React.CSSProperties = { padding: '7px 12px', borderRadius: 18, border: '1px solid #333', background: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }
const tagLista: React.CSSProperties = { fontSize: 10, fontWeight: 800, border: '1px solid', borderRadius: 8, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }
const tagStyle: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#aaa' }