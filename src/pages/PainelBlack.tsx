// Painel do catálogo da Black (capinhas e cordinhas) — abre em Admin → Capas.
import { pintarFundo } from '../lib/corDoFundo'
// Visual igual ao painel da Elegância. Separado da Negociação.
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { supabase } from '../supabase'
import {
  BLACK_PADRAO, ehBlack, emPromocao, lerConfig, precoFinal, reais,
  filtrosFixosDe, slugDe, temFiltro, type FiltroFixo, type BlackConfig, type BlackFiltro, type BlackModelo, type BlackProduto, type BlackSecao, type BlackVestida, type BlackVideo,
} from '../lib/blackConfig'
import './painelBlack.css'

type Vista = 'capas' | 'produtos' | 'editar' | 'aparencia' | 'modelos'
type Filtro = 'todos' | 'site' | 'pausados' | 'rascunhos' | 'capa' | 'cordinha' | 'promo'

type Props = {
  onSair: () => void
  enviarFoto: (arquivo: File) => Promise<string> // envia a foto como está (sem editar)
  enviarArquivo: (arquivo: File, pasta?: string) => Promise<string> // envia como está (vídeos, fotos da IA)
}

type Form = {
  id: string | null
  nome: string
  tipo: 'capa' | 'cordinha'
  preco: string
  promo: string
  descricao: string
  fotos: string[]
  modelos: string[]
  no_site: boolean
  lancamento: boolean
  destaque: boolean
  filtros: string[]
}

const FORM_VAZIO: Form = { id: null, nome: '', tipo: 'capa', preco: '', promo: '', descricao: '', fotos: [], modelos: [], no_site: true, lancamento: false, destaque: false, filtros: [] }

type Lote = { nome: string; tipo: '' | 'capa' | 'cordinha'; preco: string; promo: string; modelos: string[]; filtros: string[]; publicar: boolean }
const LOTE_VAZIO: Lote = { nome: '', tipo: '', preco: '', promo: '', modelos: [], filtros: [], publicar: false }

const paraNumero = (t: string) => {
  const n = Number(String(t).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const paraTexto = (n: number | null | undefined) => (n || n === 0 ? n.toFixed(2).replace('.', ',') : '')

// ── ícones ──
const IcSeta = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B5AFA6" strokeWidth="1.6" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
const IcEstrela = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" /></svg>
const IcBusca = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B655C" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
const IcCamera = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6B655C" strokeWidth="1.6" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
const IcProdutos = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3" /><rect x="8" y="4.5" width="4" height="4" rx="1.2" /></svg>
const IcMais = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
const IcPincel = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M3 16l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.6" /></svg>
const IcLista = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r=".8" fill="currentColor" /><circle cx="4" cy="12" r=".8" fill="currentColor" /><circle cx="4" cy="18" r=".8" fill="currentColor" /></svg>

function Chave({ ligado, onClick, rotulo }: { ligado: boolean; onClick: () => void; rotulo: string }) {
  return <button type="button" className={`pb-sw ${ligado ? 'on' : ''}`} onClick={onClick} aria-label={rotulo} aria-pressed={ligado} />
}

export default function PainelBlack({ onSair, enviarFoto, enviarArquivo }: Props) {
  const [vista, setVista] = useState<Vista>('capas')
  const [produtos, setProdutos] = useState<BlackProduto[]>([])
  const [modelos, setModelos] = useState<BlackModelo[]>([])
  const [videos, setVideos] = useState<BlackVideo[]>([])
  const [vestidas, setVestidas] = useState<BlackVestida[]>([])
  const [gerando, setGerando] = useState('')
  const [selCores, setSelCores] = useState<string[]>([])
  const [config, setConfig] = useState<BlackConfig>(BLACK_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [erroBanco, setErroBanco] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState<Form>(FORM_VAZIO)
  const [ocupado, setOcupado] = useState('')
  const [aviso, setAviso] = useState('')
  const [novoModelo, setNovoModelo] = useState({ marca: '', nome: '' })
  const [filtrosOp, setFiltrosOp] = useState<BlackFiltro[]>([])
  const [selecionando, setSelecionando] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [lote, setLote] = useState<Lote | null>(null)

  const timerAviso = useRef<number | undefined>(undefined)
  function avisar(t: string) {
    setAviso(t)
    window.clearTimeout(timerAviso.current)
    timerAviso.current = window.setTimeout(() => setAviso(''), 2200)
  }

  async function carregar() {
    const [p, m, v, c, ve, fi] = await Promise.all([
      supabase.from('black_produtos').select('*').order('ordem').order('criado_em', { ascending: false }),
      supabase.from('black_modelos').select('*').order('ordem', { ascending: false }), // mais novo primeiro
      supabase.from('black_videos').select('*').order('ordem'),
      supabase.from('black_config').select('dados').eq('id', 1).maybeSingle(),
      supabase.from('black_vestidas').select('*').order('criado_em'),
      supabase.from('black_filtros').select('*').order('grupo').order('ordem'),
    ])
    setFiltrosOp(fi.error ? [] : ((fi.data || []) as BlackFiltro[]))
    setVestidas(ve.error ? [] : ((ve.data || []) as BlackVestida[]))
    if (p.error) {
      setErroBanco(p.error.message)
    } else {
      setErroBanco('')
      setProdutos((p.data || []) as BlackProduto[])
      setModelos((m.data || []) as BlackModelo[])
      setVideos((v.data || []) as BlackVideo[])
      setConfig(lerConfig(c.data?.dados))
    }
    setCarregando(false)
  }
  useEffect(() => { carregar() }, [])

  function ir(v: Vista, p?: BlackProduto) {
    if (v === 'editar') {
      setForm(p ? {
        id: p.id, nome: p.nome, tipo: p.tipo, preco: paraTexto(p.preco), promo: paraTexto(p.preco_promo), descricao: p.descricao || '',
        fotos: [...(p.fotos || [])], modelos: [...(p.modelos || [])], no_site: p.rascunho ? true : p.no_site, lancamento: p.lancamento, destaque: p.destaque, filtros: filtrosFixosDe(p, filtrosOp, config.filtros),
      } : { ...FORM_VAZIO })
    }
    setVista(v)
    window.scrollTo(0, 0)
  }

  // ───────── Produtos ─────────
  const contagem = useMemo(() => ({
    todos: produtos.length,
    site: produtos.filter(p => p.no_site).length,
    pausados: produtos.filter(p => !p.no_site && !p.rascunho).length,
    rascunhos: produtos.filter(p => p.rascunho).length,
    capa: produtos.filter(p => p.tipo === 'capa').length,
    cordinha: produtos.filter(p => p.tipo === 'cordinha').length,
    promo: produtos.filter(emPromocao).length,
  }), [produtos])

  const lista = produtos.filter(p => {
    const ok = filtro === 'todos' || (filtro === 'site' && p.no_site) || (filtro === 'pausados' && !p.no_site && !p.rascunho) || (filtro === 'rascunhos' && !!p.rascunho)
      || (filtro === 'capa' && p.tipo === 'capa') || (filtro === 'cordinha' && p.tipo === 'cordinha') || (filtro === 'promo' && emPromocao(p))
    return ok && p.nome.toLowerCase().includes(busca.trim().toLowerCase())
  })

  async function alternar(p: BlackProduto, campo: 'no_site' | 'destaque') {
    const valor = !p[campo]
    setProdutos(l => l.map(x => (x.id === p.id ? { ...x, [campo]: valor } : x)))
    const { error } = await supabase.from('black_produtos').update({ [campo]: valor }).eq('id', p.id)
    if (error) { avisar('Não salvou: ' + error.message); carregar(); return }
    avisar(campo === 'no_site' ? (valor ? 'Agora aparece no site' : 'Pausado: saiu do site') : (valor ? 'Foi pra Mais vendidos ★' : 'Saiu de Mais vendidos'))
  }

  // ───────── Novo / editar ─────────
  async function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos || !arquivos.length) return
    const fs = Array.from(arquivos)
    for (let i = 0; i < fs.length; i++) {
      setOcupado(`Enviando foto ${i + 1} de ${fs.length}...`)
      try {
        const url = await enviarFoto(fs[i])
        setForm(f => ({ ...f, fotos: [...f.fotos, url] }))
      } catch (e) {
        avisar('Foto não enviada: ' + (e instanceof Error ? e.message : String(e)))
      }
    }
    setOcupado('')
  }
  function moverFoto(i: number, d: number) {
    setForm(f => {
      const fotos = [...f.fotos]
      const j = i + d
      if (j < 0 || j >= fotos.length) return f
      ;[fotos[i], fotos[j]] = [fotos[j], fotos[i]]
      return { ...f, fotos }
    })
  }

  async function salvar() {
    if (!form.nome.trim()) return avisar('Coloque o nome do produto')
    const preco = paraNumero(form.preco)
    if (!preco) return avisar('Coloque o preço')
    const promo = form.promo.trim() ? paraNumero(form.promo) : null
    if (promo && promo >= preco) return avisar('O preço da Black tem que ser menor que o preço normal')
    if (!form.fotos.length) return avisar('Coloque pelo menos uma foto')
    if (form.tipo === 'capa' && !form.modelos.length) return avisar('Marque em quais celulares a capinha serve')
    const dados = {
      nome: form.nome.trim(), tipo: form.tipo, preco, preco_promo: promo, descricao: form.descricao.trim() || null,
      fotos: form.fotos, modelos: form.tipo === 'capa' ? form.modelos : [],
      no_site: form.no_site, lancamento: form.lancamento, destaque: form.destaque,
      filtros: form.filtros, rascunho: false,
    }
    setOcupado('Salvando...')
    const { error } = form.id
      ? await supabase.from('black_produtos').update(dados).eq('id', form.id)
      : await supabase.from('black_produtos').insert([{ ...dados, ordem: produtos.length }])
    setOcupado('')
    if (error) return avisar('Não salvou: ' + error.message)
    avisar(form.id ? 'Alterações salvas ✓' : 'Produto cadastrado ✓')
    await carregar()
    ir('produtos')
  }

  async function excluir() {
    if (!form.id || !confirm('Excluir este produto do catálogo da Black?')) return
    const { error } = await supabase.from('black_produtos').delete().eq('id', form.id)
    if (error) return avisar('Não excluiu: ' + error.message)
    avisar('Produto excluído')
    await carregar()
    ir('produtos')
  }

  // ───────── Experimentar no meu celular (fotos da capinha vestida, geradas pelo Gemini) ─────────
  const coresAtivas = selCores.length ? selCores : config.experimentar.cores.slice(0, 3).map(c => c.nome)
  async function gerarUma(produto: { id: string; foto: string }, modelo: string, cor: string) {
    const { data, error } = await supabase.functions.invoke('gerar-banner', {
      body: { acao: 'capa_estudio', foto_url: produto.foto, modelo, cor, proporcao: '4:5' },
    })
    if (error) {
      let msg = error.message
      try { const c = await (error as { context?: Response }).context?.json(); if (c?.error) msg = c.error } catch { /* ok */ }
      throw new Error(msg)
    }
    if (data?.error || !data?.imagem) throw new Error(data?.error || 'A IA não devolveu a foto')
    const blob = await (await fetch(`data:${data.mime || 'image/jpeg'};base64,${data.imagem}`)).blob()
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    const url = await enviarArquivo(new File([blob], `vestida.${ext}`, { type: blob.type || 'image/jpeg' }), 'black/vestida')
    const { error: e2 } = await supabase.from('black_vestidas').upsert({ produto_id: produto.id, modelo, cor, url }, { onConflict: 'produto_id,modelo,cor' })
    if (e2) throw e2
  }
  async function gerarVestidas(somenteFaltando: boolean) {
    if (!form.id || !form.fotos[0]) return avisar('Salve o produto com foto antes')
    const combos: [string, string][] = []
    for (const m of form.modelos) for (const c of coresAtivas) {
      if (!somenteFaltando || !vestidas.some(v => v.produto_id === form.id && v.modelo === m && v.cor === c)) combos.push([m, c])
    }
    if (!combos.length) return avisar('Todas as fotos já foram geradas ✓')
    if (!confirm(`Gerar ${combos.length} ${combos.length === 1 ? 'foto' : 'fotos'} com a IA (Gemini)? Leva alguns segundos cada.`)) return
    let falhas = 0
    for (let i = 0; i < combos.length; i++) {
      const [m, c] = combos[i]
      setGerando(`Vestindo a capinha: ${m} ${c} (${i + 1} de ${combos.length})...`)
      try { await gerarUma({ id: form.id, foto: form.fotos[0] }, m, c) } catch (e) { falhas++; console.error(e); if (falhas === 1) avisar('Erro da IA: ' + (e instanceof Error ? e.message : String(e))) }
    }
    setGerando('')
    await carregar()
    avisar(falhas ? `Pronto, mas ${falhas} não deu certo. Toque em gerar de novo.` : 'Fotos geradas ✓')
  }
  async function refazerVestida(v: BlackVestida) {
    if (!form.id || !form.fotos[0]) return
    setGerando(`Refazendo: ${v.modelo} ${v.cor}...`)
    try { await gerarUma({ id: form.id, foto: form.fotos[0] }, v.modelo, v.cor); await carregar(); avisar('Foto refeita ✓') }
    catch (e) { avisar('Erro da IA: ' + (e instanceof Error ? e.message : String(e))) }
    setGerando('')
  }
  async function apagarVestida(v: BlackVestida) {
    await supabase.from('black_vestidas').delete().eq('id', v.id)
    setVestidas(l => l.filter(x => x.id !== v.id))
  }

  // ───────── Aparência ─────────
  function mudarSecao(chave: keyof BlackConfig['secoes'], campo: keyof BlackSecao, valor: string | boolean) {
    setConfig(c => ({ ...c, secoes: { ...c.secoes, [chave]: { ...c.secoes[chave], [campo]: valor } } }))
  }
  async function salvarAparencia() {
    setOcupado('Salvando...')
    const { error } = await supabase.from('black_config').upsert({ id: 1, dados: config })
    setOcupado('')
    avisar(error ? 'Não salvou: ' + error.message : 'Aparência salva ✓')
  }
  async function adicionarVideo(arquivos: FileList | null) {
    if (!arquivos || !arquivos.length) return
    const fs = Array.from(arquivos)
    for (let i = 0; i < fs.length; i++) {
      setOcupado(`Enviando vídeo ${i + 1} de ${fs.length}...`)
      try {
        const url = await enviarArquivo(fs[i])
        const { error } = await supabase.from('black_videos').insert([{ video_url: url, ordem: videos.length + i }])
        if (error) throw error
      } catch (e) {
        avisar('Vídeo não enviado: ' + (e instanceof Error ? e.message : String(e)))
      }
    }
    setOcupado('')
    carregar()
  }
  async function ligarVideo(v: BlackVideo, produtoId: string) {
    setVideos(l => l.map(x => (x.id === v.id ? { ...x, produto_id: produtoId || null } : x)))
    await supabase.from('black_videos').update({ produto_id: produtoId || null }).eq('id', v.id)
  }
  async function apagarVideo(v: BlackVideo) {
    if (!confirm('Apagar este vídeo?')) return
    await supabase.from('black_videos').delete().eq('id', v.id)
    carregar()
  }

  // ───────── Várias fotos de uma vez → rascunhos ─────────
  async function subirRascunhos(arquivos: FileList | null) {
    if (!arquivos || !arquivos.length) return
    const fs = Array.from(arquivos)
    let ok = 0
    for (let i = 0; i < fs.length; i++) {
      setOcupado(`Enviando foto ${i + 1} de ${fs.length}...`)
      try {
        const url = await enviarFoto(fs[i])
        const { error } = await supabase.from('black_produtos').insert([{
          nome: 'Rascunho', tipo: 'capa', preco: 0, fotos: [url], modelos: [], filtros: [],
          no_site: false, rascunho: true, lancamento: false, ordem: produtos.length + i,
        }])
        if (error) throw error
        ok++
      } catch (e) { avisar('Foto não enviada: ' + (e instanceof Error ? e.message : String(e))) }
    }
    setOcupado('')
    await carregar()
    setFiltro('rascunhos')
    setSelecionando(true)
    setSel([])
    if (ok) avisar(`${ok} ${ok === 1 ? 'foto virou rascunho' : 'fotos viraram rascunhos'}. Marque e organize em lote.`)
  }
  function marcar(id: string) { setSel(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id])) }

  async function aplicarLote() {
    if (!lote || !sel.length) return
    const preco = lote.preco.trim() ? paraNumero(lote.preco) : null
    const promo = lote.promo.trim() ? paraNumero(lote.promo) : null
    if (promo && preco && promo >= preco) return avisar('O preço da Black tem que ser menor que o preço normal')
    const escolhidos = produtos.filter(p => sel.includes(p.id))
    if (lote.publicar) {
      const faltando = escolhidos.find(p => {
        const tipo = lote.tipo || p.tipo
        const nome = lote.nome.trim() || p.nome
        const pr = preco ?? p.preco
        const mods = [...new Set([...p.modelos, ...lote.modelos])]
        void pr
        return !nome || nome === 'Rascunho' || (tipo === 'capa' && !mods.length)
      })
      if (faltando) return avisar('Pra publicar, todos precisam de nome e (capinha) modelos')
    }
    setOcupado(`Aplicando em ${escolhidos.length} ${escolhidos.length === 1 ? 'produto' : 'produtos'}...`)
    let erro = ''
    for (const p of escolhidos) {
      const dados: Record<string, unknown> = {
        modelos: [...new Set([...p.modelos, ...lote.modelos])],
        filtros: [...new Set([...filtrosFixosDe(p, filtrosOp, config.filtros), ...lote.filtros])],
      }
      if (lote.nome.trim()) dados.nome = lote.nome.trim()
      if (lote.tipo) dados.tipo = lote.tipo
      if (lote.tipo === 'cordinha') dados.modelos = []
      if (preco !== null) dados.preco = preco
      if (promo !== null) dados.preco_promo = promo
      if (lote.publicar) { dados.no_site = true; dados.rascunho = false }
      const { error } = await supabase.from('black_produtos').update(dados).eq('id', p.id)
      if (error) erro = error.message
    }
    setOcupado('')
    if (erro) avisar('Alguns não salvaram: ' + erro)
    else avisar(lote.publicar ? 'Publicados no site ✓' : 'Alterações aplicadas ✓')
    setLote(null)
    setSel([])
    await carregar()
  }
  async function excluirSelecionados() {
    if (!sel.length || !confirm(`Excluir ${sel.length} ${sel.length === 1 ? 'produto' : 'produtos'}?`)) return
    setOcupado('Excluindo...')
    await supabase.from('black_produtos').delete().in('id', sel)
    setOcupado('')
    setSel([])
    await carregar()
  }

  // ───────── Filtros (opções de cada grupo) ─────────
  async function fotoModelo(m: BlackModelo, arquivos: FileList | null) {
    if (!arquivos || !arquivos[0]) return
    setOcupado('Enviando foto do ' + m.nome + '...')
    try {
      const url = await enviarFoto(arquivos[0])
      const { error } = await supabase.from('black_modelos').update({ foto_url: url }).eq('id', m.id)
      if (error) throw error
      setModelos(l => l.map(x => (x.id === m.id ? { ...x, foto_url: url } : x)))
    } catch (e) { avisar('Não salvou: ' + (e instanceof Error ? e.message : String(e))) }
    setOcupado('')
  }

  // chips de filtro (usado no produto e no lote)
  function escolhaFiltros(marcados: string[], trocar: (id: string) => void) {
    return (
      <div className="pb-mods">
        {config.filtros.map(f => (
          <button key={f.slug} className={marcados.includes(f.slug) ? 'on' : ''} onClick={() => trocar(f.slug)}>{f.nome}</button>
        ))}
      </div>
    )
  }
  const alternarId = (lista: string[], id: string) => (lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id])

  // ───────── Modelos ─────────
  async function addModelo() {
    const nome = novoModelo.nome.trim()
    if (!nome) return avisar('Digite o modelo')
    const { error } = await supabase.from('black_modelos').insert([{ nome, marca: novoModelo.marca.trim() || 'Outros', ordem: Math.max(0, ...modelos.map(x => x.ordem)) + 1 }])
    if (error) return avisar(error.message.includes('duplicate') ? 'Esse modelo já existe' : 'Não salvou: ' + error.message)
    setNovoModelo({ marca: novoModelo.marca, nome: '' })
    avisar('Modelo adicionado ✓')
    carregar()
  }
  async function moverModelo(m: BlackModelo, d: number) {
    const i = modelos.findIndex(x => x.id === m.id)
    const j = i + d
    if (j < 0 || j >= modelos.length) return
    const nova = [...modelos]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    setModelos(nova)
    await Promise.all(nova.map((x, k) => supabase.from('black_modelos').update({ ordem: nova.length - k }).eq('id', x.id)))
  }
  // renomear modelo: leva junto as capinhas. Se o nome novo já existe, junta os dois.
  async function renomearModelo(m: BlackModelo) {
    const nome = (prompt('Novo nome do modelo', m.nome) || '').trim()
    if (!nome || nome === m.nome) return
    const existente = modelos.find(x => x.id !== m.id && x.nome.toLowerCase() === nome.toLowerCase())
    if (existente && !confirm(`Já existe "${existente.nome}". Juntar as capinhas do ${m.nome} nele e apagar o ${m.nome}?`)) return
    const destino = existente ? existente.nome : nome
    setOcupado('Salvando...')
    let erro = ''
    for (const p of produtos.filter(x => x.modelos.includes(m.nome))) {
      const novos = [...new Set(p.modelos.map(x => (x === m.nome ? destino : x)))]
      const { error } = await supabase.from('black_produtos').update({ modelos: novos }).eq('id', p.id)
      if (error) erro = error.message
    }
    await supabase.from('black_vestidas').update({ modelo: destino }).eq('modelo', m.nome)
    const r = existente
      ? await supabase.from('black_modelos').delete().eq('id', m.id)
      : await supabase.from('black_modelos').update({ nome: destino }).eq('id', m.id)
    if (r.error) erro = r.error.message
    setOcupado('')
    avisar(erro ? 'Não salvou tudo: ' + erro : existente ? 'Modelos juntados ✓' : 'Nome trocado ✓')
    carregar()
  }
  async function apagarModelo(m: BlackModelo) {
    if (!confirm(`Apagar o modelo ${m.nome}?`)) return
    await supabase.from('black_modelos').delete().eq('id', m.id)
    carregar()
  }

  // ───────── telas ─────────
  const ehNovo = vista === 'editar' && !form.id
  const marcas = [...new Set(modelos.map(m => m.marca || 'Outros'))]

  function telaProdutos() {
    const chips: [Filtro, string, number][] = [
      ['todos', 'Todos', contagem.todos], ['site', 'No site', contagem.site], ['pausados', 'Pausados', contagem.pausados], ['rascunhos', 'Rascunhos', contagem.rascunhos],
      ['capa', 'Capinhas', contagem.capa], ['cordinha', 'Cordinhas', contagem.cordinha], ['promo', 'Promoção', contagem.promo],
    ]
    return (
      <>
        <h1 className="pb-titulo pb-serif">Produtos</h1>
        <p className="pb-sub">{contagem.todos} cadastrados · {contagem.site} no site</p>
        <div className="pb-acoes-lista">
          <label className="pb-btn-pequeno pb-escuro">
            <IcCamera />Subir várias fotos
            <input type="file" accept="image/*" multiple hidden onChange={e => { subirRascunhos(e.target.files); e.target.value = '' }} />
          </label>
          <button className={`pb-btn-pequeno ${selecionando ? 'pb-escuro' : ''}`} onClick={() => { setSelecionando(x => !x); setSel([]) }}>{selecionando ? 'Cancelar seleção' : 'Selecionar'}</button>
        </div>
        <div className="pb-busca"><IcBusca /><input placeholder="Buscar produto" value={busca} onChange={e => setBusca(e.target.value)} /></div>
        <div className="pb-chips pb-sem-barra">
          {chips.map(([k, l, q]) => (
            <button key={k} className={`pb-chip ${filtro === k ? 'on' : ''}`} onClick={() => setFiltro(k)}>{l}<span>{q}</span></button>
          ))}
        </div>
        {carregando ? <p className="pb-sub pb-vazio">Carregando...</p>
          : !lista.length ? (
            <div className="pb-vazio">
              <p className="pb-sub">{produtos.length ? 'Nenhum produto aqui.' : 'Nenhum produto ainda.'}</p>
              {!produtos.length && <button className="pb-btn" onClick={() => ir('editar')}>Cadastrar o primeiro</button>}
            </div>
          ) : (
            <div className="pb-lista">
              {lista.map(p => (
                <div className={`pb-card ${sel.includes(p.id) ? 'pb-marcado' : ''}`} key={p.id}>
                  <div className="pb-linha1" onClick={() => (selecionando ? marcar(p.id) : ir('editar', p))}>
                    {selecionando && <span className={`pb-check ${sel.includes(p.id) ? 'on' : ''}`}>✓</span>}
                    <div className="pb-thumb">
                      {p.fotos?.[0] ? <img src={p.fotos[0]} alt="" loading="lazy" /> : <IcCamera />}
                      {emPromocao(p) && <span className="pb-off">-{Math.round((1 - (p.preco_promo as number) / p.preco) * 100)}%</span>}
                    </div>
                    <div className="pb-info">
                      <div className="pb-nome pb-serif">{p.nome}</div>
                      <div className="pb-preco pb-serif">{reais(precoFinal(p))}{emPromocao(p) && <s>{reais(p.preco)}</s>}</div>
                      <div className="pb-meta">{p.rascunho ? <span className="pb-tag-rascunho">Rascunho · falta preencher</span> : p.tipo === 'capa' ? `Capinha · ${p.modelos.length} ${p.modelos.length === 1 ? 'modelo' : 'modelos'}` : 'Cordinha · serve em todos'}</div>
                      {config.filtros.some(f => temFiltro(p, f.slug, filtrosOp)) && <div className="pb-meta pb-meta-filtros">{config.filtros.filter(f => temFiltro(p, f.slug, filtrosOp)).map(f => f.nome).join(' · ')}</div>}
                    </div>
                    {!selecionando && <IcSeta />}
                  </div>
                  {!p.rascunho && <div className="pb-linha2">
                    <button className="pb-chave" onClick={() => alternar(p, 'no_site')}><span className={`pb-sw ${p.no_site ? 'on' : ''}`} />No site</button>
                    <button className={`pb-estrela ${p.destaque ? 'on' : ''}`} onClick={() => alternar(p, 'destaque')}><IcEstrela />Mais vendido</button>
                  </div>}
                </div>
              ))}
            </div>
          )}
        {selecionando && (
          <div className="pb-barra-lote">
            <button onClick={() => setSel(sel.length === lista.length ? [] : lista.map(p => p.id))}>{sel.length === lista.length && lista.length ? 'Desmarcar' : 'Marcar todos'}</button>
            <span>{sel.length} {sel.length === 1 ? 'marcado' : 'marcados'}</span>
            <button className="pb-perigo" disabled={!sel.length} onClick={excluirSelecionados}>Excluir</button>
            <button className="pb-lote-ok" disabled={!sel.length} onClick={() => setLote({ ...LOTE_VAZIO })}>Organizar</button>
          </div>
        )}
      </>
    )
  }

  function telaLote() {
    if (!lote) return null
    const L = lote
    const muda = (x: Partial<Lote>) => setLote(l => (l ? { ...l, ...x } : l))
    return (
      <div className="pb-lote">
        <div className="pb-lote-caixa">
          <div className="pb-secao-topo"><h3 className="pb-serif">Organizar {sel.length} {sel.length === 1 ? 'produto' : 'produtos'}</h3><button onClick={() => setLote(null)} aria-label="Fechar" style={{ fontSize: 26 }}>×</button></div>
          <p className="pb-dica">Só muda o que você preencher. Modelos e filtros marcados aqui são <b>somados</b> aos que já tinham.</p>
          <div className="pb-fotos pb-sem-barra" style={{ marginBottom: 6 }}>
            {produtos.filter(p => sel.includes(p.id)).map(p => <div className="pb-f" key={p.id} style={{ width: 64 }}>{p.fotos[0] && <img src={p.fotos[0]} alt="" />}</div>)}
          </div>
          <label className="pb-rot">Tipo</label>
          <div className="pb-segment">
            <button className={L.tipo === 'capa' ? 'on' : ''} onClick={() => muda({ tipo: L.tipo === 'capa' ? '' : 'capa' })}>Capinha</button>
            <button className={L.tipo === 'cordinha' ? 'on' : ''} onClick={() => muda({ tipo: L.tipo === 'cordinha' ? '' : 'cordinha' })}>Cordinha</button>
          </div>
          <label className="pb-rot">Nome (o mesmo pra todos)</label>
          <input className="pb-campo" placeholder="deixe vazio pra não mudar" value={L.nome} onChange={e => muda({ nome: e.target.value })} />
          <div className="pb-duas">
            <div><label className="pb-rot">Preço</label><input className="pb-campo" inputMode="decimal" placeholder="não mudar" value={L.preco} onChange={e => muda({ preco: e.target.value })} /></div>
            <div><label className="pb-rot">Preço da Black</label><input className="pb-campo" inputMode="decimal" placeholder="não mudar" value={L.promo} onChange={e => muda({ promo: e.target.value })} /></div>
          </div>
          {L.tipo !== 'cordinha' && (
            <>
              <label className="pb-rot">Servem nos celulares</label>
              <div className="pb-mods">
                {modelos.map(m => <button key={m.id} className={L.modelos.includes(m.nome) ? 'on' : ''} onClick={() => muda({ modelos: alternarId(L.modelos, m.nome) })}>{m.nome}</button>)}
              </div>
            </>
          )}
          {escolhaFiltros(L.filtros, id => muda({ filtros: alternarId(L.filtros, id) }))}
          <div className="pb-item-chave" style={{ marginTop: 10 }}>
            <div><b>Publicar no site</b><small>Tira de rascunho e coloca no ar</small></div>
            <Chave ligado={L.publicar} rotulo="Publicar" onClick={() => muda({ publicar: !L.publicar })} />
          </div>
          <button className="pb-btn" onClick={aplicarLote}>Aplicar em {sel.length}</button>
        </div>
      </div>
    )
  }

  function itemChave(campo: 'no_site' | 'lancamento' | 'destaque', titulo: string, sub: string) {
    return (
      <div className="pb-item-chave">
        <div><b>{titulo}</b><small>{sub}</small></div>
        <Chave ligado={form[campo]} rotulo={titulo} onClick={() => setForm(f => ({ ...f, [campo]: !f[campo] }))} />
      </div>
    )
  }

  function telaEditar() {
    return (
      <>
        <h1 className="pb-titulo pb-serif">{ehNovo ? 'Novo produto' : 'Editar produto'}</h1>
        <p className="pb-sub">{ehNovo ? 'Capinha ou cordinha pro catálogo da Black' : 'Mude o que quiser e salve'}</p>

        <div className="pb-bloco">
          <h3 className="pb-serif">Fotos</h3>
          <p className="pb-dica">A primeira é a capa. Pode escolher várias de uma vez.</p>
          <div className="pb-fotos pb-sem-barra">
            {form.fotos.map((f, i) => (
              <div className="pb-f" key={f + i}>
                <img src={f} alt="" />
                <button className="pb-x" aria-label="Tirar foto" onClick={() => setForm(x => ({ ...x, fotos: x.fotos.filter((_, k) => k !== i) }))}>×</button>
                {i > 0 && <button className="pb-esq" aria-label="Mover pra esquerda" onClick={() => moverFoto(i, -1)}>‹</button>}
                {i === 0 && <span className="pb-capa">CAPA</span>}
              </div>
            ))}
            <label className="pb-f pb-add">
              <IcCamera />Tirar ou escolher fotos
              <input type="file" accept="image/*" multiple hidden onChange={e => { adicionarFotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
        </div>

        <div className="pb-bloco">
          <h3 className="pb-serif">Informações</h3>
          <label className="pb-rot">Tipo</label>
          <div className="pb-segment">
            <button className={form.tipo === 'capa' ? 'on' : ''} onClick={() => setForm(f => ({ ...f, tipo: 'capa' }))}>Capinha</button>
            <button className={form.tipo === 'cordinha' ? 'on' : ''} onClick={() => setForm(f => ({ ...f, tipo: 'cordinha' }))}>Cordinha</button>
          </div>
          <label className="pb-rot">Nome</label>
          <input className="pb-campo" value={form.nome} placeholder="Ex: Capa Transparente Strass Dourada" onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          <div className="pb-duas">
            <div><label className="pb-rot">Preço</label><input className="pb-campo" inputMode="decimal" placeholder="0,00" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} /></div>
            <div><label className="pb-rot">Preço da Black</label><input className="pb-campo" inputMode="decimal" placeholder="opcional" value={form.promo} onChange={e => setForm(f => ({ ...f, promo: e.target.value }))} /></div>
          </div>
          <label className="pb-rot">Descrição (opcional)</label>
          <textarea className="pb-campo" placeholder="Material, detalhes, o que vem junto..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>

        <div className="pb-bloco">
          <h3 className="pb-serif">Serve em quais celulares?</h3>
          {form.tipo === 'cordinha' ? <p className="pb-dica" style={{ margin: 0 }}>Cordinha serve em todos os celulares — não precisa marcar.</p> : (
            <>
              <p className="pb-dica">Toque nos modelos. O cliente filtra por eles no site.</p>
              {!modelos.length && <p className="pb-dica">Nenhum modelo cadastrado. Cadastre em <b>Filtros</b>, no menu de baixo.</p>}
              <div className="pb-mods">
                {modelos.map(m => (
                  <button key={m.id} className={form.modelos.includes(m.nome) ? 'on' : ''}
                    onClick={() => setForm(f => ({ ...f, modelos: f.modelos.includes(m.nome) ? f.modelos.filter(x => x !== m.nome) : [...f.modelos, m.nome] }))}>
                    {m.nome}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="pb-bloco">
          <h3 className="pb-serif">Filtros</h3>
          <p className="pb-dica">O cliente acha a capinha por esses filtros no site.</p>
          {escolhaFiltros(form.filtros, id => setForm(f => ({ ...f, filtros: alternarId(f.filtros, id) })))}
        </div>

        {form.tipo === 'capa' && config.experimentar.ativo && (
          <div className="pb-bloco">
            <h3 className="pb-serif">Experimentar no celular</h3>
            {!form.id ? <p className="pb-dica" style={{ margin: 0 }}>Cadastre a capinha primeiro. Depois volte aqui pra gerar as fotos dela vestida nos celulares.</p> : (
              <>
                <p className="pb-dica">A IA veste esta capinha em cada modelo marcado, nas cores escolhidas. O cliente vê no site em "Experimentar no meu celular".</p>
                <label className="pb-rot">Cores do celular</label>
                <div className="pb-mods">
                  {config.experimentar.cores.map(c => (
                    <button key={c.nome} className={coresAtivas.includes(c.nome) ? 'on' : ''}
                      onClick={() => setSelCores(l => { const base = l.length ? l : coresAtivas; return base.includes(c.nome) ? base.filter(x => x !== c.nome) : [...base, c.nome] })}>
                      <span className="pb-bolinha" style={{ background: c.hex }} />{c.nome}
                    </button>
                  ))}
                </div>
                <p className="pb-dica" style={{ marginTop: 10 }}>{form.modelos.length} {form.modelos.length === 1 ? 'modelo' : 'modelos'} × {coresAtivas.length} {coresAtivas.length === 1 ? 'cor' : 'cores'} = {form.modelos.length * coresAtivas.length} fotos</p>
                {(() => {
                  const minhas = vestidas.filter(v => v.produto_id === form.id)
                  return (
                    <>
                      {minhas.length > 0 && (
                        <div className="pb-fotos pb-sem-barra" style={{ marginTop: 6 }}>
                          {minhas.map(v => (
                            <div className="pb-f" key={v.id}>
                              <img src={v.url} alt="" />
                              <button className="pb-x" aria-label="Apagar" onClick={() => apagarVestida(v)}>×</button>
                              <button className="pb-esq" aria-label="Refazer" onClick={() => refazerVestida(v)}>↻</button>
                              <span className="pb-capa">{v.modelo} · {v.cor}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="pb-btn pb-laranja" onClick={() => gerarVestidas(true)} disabled={!!gerando || !form.modelos.length}>
                        {minhas.length ? 'Gerar as que faltam' : 'Gerar fotos nos celulares'}
                      </button>
                    </>
                  )
                })()}
              </>
            )}
          </div>
        )}

        <div className="pb-bloco">
          <h3 className="pb-serif">Onde aparece</h3>
          {itemChave('no_site', 'No site', 'Desligado = pausado, some do catálogo')}
          {itemChave('lancamento', 'Lançamentos', 'Aparece na vitrine de lançamentos')}
          {itemChave('destaque', 'Mais vendidos', 'Aparece na vitrine de mais vendidos')}
          <p className="pb-dica" style={{ margin: '10px 0 0' }}>Com "Preço da Black" preenchido, entra sozinho em Promoção.</p>
        </div>

        <button className="pb-btn" onClick={salvar} disabled={!!ocupado}>{ehNovo ? 'Cadastrar produto' : 'Salvar alterações'}</button>
        {!ehNovo && <button className="pb-btn pb-contorno" onClick={excluir}>Excluir produto</button>}
      </>
    )
  }

  function blocoSecao(chave: keyof BlackConfig['secoes'], nome: string, extra?: ReactNode) {
    const s = config.secoes[chave]
    return (
      <div className="pb-bloco">
        <div className="pb-secao-topo"><h3 className="pb-serif">{nome}</h3><Chave ligado={s.ativo} rotulo={`Mostrar ${nome}`} onClick={() => mudarSecao(chave, 'ativo', !s.ativo)} /></div>
        <p className="pb-dica">{s.ativo ? 'Aparecendo no site' : 'Escondida do site'}</p>
        <label className="pb-rot">Título</label>
        <input className="pb-campo" value={s.titulo} onChange={e => mudarSecao(chave, 'titulo', e.target.value)} />
        <label className="pb-rot">Texto embaixo do título</label>
        <input className="pb-campo" value={s.texto} onChange={e => mudarSecao(chave, 'texto', e.target.value)} />
        {extra}
      </div>
    )
  }

  function campo(chave: 'faixa' | 'linha1' | 'linha2' | 'frase' | 'botao' | 'contagem_titulo' | 'whatsapp' | 'instagram' | 'endereco' | 'horario', rotulo: string) {
    return (
      <>
        <label className="pb-rot">{rotulo}</label>
        <input className="pb-campo" value={config[chave]} onChange={e => setConfig(c => ({ ...c, [chave]: e.target.value }))} />
      </>
    )
  }

  // data da contagem no formato do campo (horário de Brasília)
  const contagemLocal = (() => {
    if (!config.contagem) return ''
    const d = new Date(config.contagem)
    if (isNaN(d.getTime())) return ''
    const br = new Date(d.getTime() - 3 * 3600 * 1000)
    return br.toISOString().slice(0, 16)
  })()

  // ───────── Cupons de desconto (tabela black_cupons — BLACK-4-CUPONS.sql) ─────────
  type Cupom = { id: string; codigo: string; pct: number; limite: number | null; inicio: string | null; fim: string | null; usos: number }
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [cuponsErro, setCuponsErro] = useState('')
  const [novoCupom, setNovoCupom] = useState({ codigo: '', pct: '', limite: '', de: '', ate: '' })
  async function carregarCupons() {
    const { data, error } = await supabase.from('black_cupons').select('*').order('criado_em', { ascending: false })
    if (error) { setCuponsErro(error.message); return }
    setCuponsErro(''); setCupons((data || []) as Cupom[])
  }
  useEffect(() => { if (vista === 'aparencia') carregarCupons() }, [vista])
  async function criarCupom() {
    const codigo = novoCupom.codigo.trim().toUpperCase().replace(/\s+/g, '')
    const pct = paraNumero(novoCupom.pct)
    if (!codigo) return avisar('Digite o código do cupom')
    if (!(pct > 0 && pct <= 100)) return avisar('O desconto tem que ser de 1 a 100%')
    if (cupons.some(c => c.codigo.toUpperCase() === codigo)) return avisar('Já existe um cupom com esse código')
    const limite = novoCupom.limite.trim() ? Math.max(1, Math.floor(paraNumero(novoCupom.limite))) : null
    const inicio = novoCupom.de ? novoCupom.de + 'T00:00:00-03:00' : null
    const fim = novoCupom.ate ? novoCupom.ate + 'T23:59:59-03:00' : null
    if (inicio && fim && fim < inicio) return avisar('A data final tem que ser depois da inicial')
    setOcupado('Criando cupom...')
    const { error } = await supabase.from('black_cupons').insert([{ codigo, pct, limite, inicio, fim }])
    setOcupado('')
    if (error) return avisar('Não criou: ' + error.message)
    setNovoCupom({ codigo: '', pct: '', limite: '', de: '', ate: '' })
    avisar('Cupom criado ✓')
    carregarCupons()
  }
  async function apagarCupom(c: Cupom) {
    if (!confirm(`Apagar o cupom ${c.codigo}?`)) return
    const { error } = await supabase.from('black_cupons').delete().eq('id', c.id)
    if (error) return avisar('Não apagou: ' + error.message)
    avisar('Cupom apagado')
    carregarCupons()
  }
  const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')
  function situacaoCupom(c: Cupom) {
    const agora = Date.now()
    if (c.inicio && new Date(c.inicio).getTime() > agora) return { t: 'Ainda não começou', cor: '#8A6A1E' }
    if ((c.fim && new Date(c.fim).getTime() < agora) || (c.limite != null && c.usos >= c.limite)) return { t: 'Expirado', cor: '#A3361F' }
    return { t: 'Valendo', cor: '#1E7A43' }
  }

  function telaAparencia() {
    return (
      <>
        <h1 className="pb-titulo pb-serif">Aparência</h1>
        <p className="pb-sub">Tudo que aparece no site da Black, na ordem</p>

        <div className="pb-bloco">
          <h3 className="pb-serif">Abertura</h3>
          <p className="pb-dica">A parte preta do topo</p>
          <div className="pb-previa-hero">
            <div className="e">{config.linha1} 🔥</div>
            <div className="b">{config.linha2}</div>
            <div className="c">{config.frase} <span>{config.botao}</span></div>
          </div>
          {campo('faixa', 'Faixa do topo')}
          <div className="pb-duas">
            <div>{campo('linha1', 'Linha 1')}</div>
            <div>{campo('linha2', 'Linha 2')}</div>
          </div>
          {campo('frase', 'Frase')}
          {campo('botao', 'Botão')}
          <label className="pb-rot">Contagem regressiva até (vazio = sem contagem)</label>
          <input className="pb-campo" type="datetime-local" value={contagemLocal}
            onChange={e => setConfig(c => ({ ...c, contagem: e.target.value ? e.target.value + ':00-03:00' : '' }))} />
          {campo('contagem_titulo', 'Texto em cima da contagem')}
        </div>

        {blocoSecao('filtro', 'Filtro')}
        {blocoSecao('lancamentos', 'Lançamentos')}
        {blocoSecao('videos', 'Vídeos', (
          <>
            <label className="pb-rot">Vídeos (arraste pro lado)</label>
            <div className="pb-videos pb-sem-barra">
              {videos.map(v => (
                <div className="pb-v" key={v.id}>
                  <video src={v.video_url + '#t=0.5'} muted playsInline preload="metadata" />
                  <button className="pb-x" aria-label="Apagar vídeo" onClick={() => apagarVideo(v)}>×</button>
                  <select value={v.produto_id || ''} onChange={e => ligarVideo(v, e.target.value)} aria-label="Produto do vídeo">
                    <option value="">Sem produto (opcional)</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              ))}
              <label className="pb-v pb-add">
                ＋<br />Adicionar vídeo
                <input type="file" accept="video/*" multiple hidden onChange={e => { adicionarVideo(e.target.files); e.target.value = '' }} />
              </label>
            </div>
            <p className="pb-dica" style={{ marginTop: 8 }}>Ligue cada vídeo a um produto: aparece o card com preço e o botão de comprar.</p>
          </>
        ))}
        {blocoSecao('mais', 'Mais vendidos')}
        {blocoSecao('promo', 'Promoção')}

        <div className="pb-bloco">
          <div className="pb-secao-topo"><h3 className="pb-serif">Experimentar no celular</h3>
            <Chave ligado={config.experimentar.ativo} rotulo="Mostrar Experimentar" onClick={() => setConfig(c => ({ ...c, experimentar: { ...c.experimentar, ativo: !c.experimentar.ativo } }))} /></div>
          <p className="pb-dica">{config.experimentar.ativo ? 'Botão aparecendo nas capinhas que têm fotos geradas' : 'Botão escondido do site'}</p>
          <label className="pb-rot">Cores de celular que o cliente pode escolher</label>
          {config.experimentar.cores.map((c, i) => (
            <div className="pb-cor" key={i}>
              <input type="color" value={c.hex} aria-label="Cor"
                onChange={e => setConfig(cf => ({ ...cf, experimentar: { ...cf.experimentar, cores: cf.experimentar.cores.map((x, k) => (k === i ? { ...x, hex: e.target.value } : x)) } }))} />
              <input className="pb-campo" value={c.nome}
                onChange={e => setConfig(cf => ({ ...cf, experimentar: { ...cf.experimentar, cores: cf.experimentar.cores.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) } }))} />
              <button aria-label="Tirar cor" onClick={() => setConfig(cf => ({ ...cf, experimentar: { ...cf.experimentar, cores: cf.experimentar.cores.filter((_, k) => k !== i) } }))}>×</button>
            </div>
          ))}
          <button className="pb-btn pb-contorno-escuro" onClick={() => setConfig(cf => ({ ...cf, experimentar: { ...cf.experimentar, cores: [...cf.experimentar.cores, { nome: 'Nova cor', hex: '#888888' }] } }))}>+ Adicionar cor</button>
        </div>

        <div className="pb-bloco">
          <h3 className="pb-serif">Cupons de desconto</h3>
          <p className="pb-dica">Não aparecem no site. O cliente digita o cupom na sacola e o desconto já entra no total.</p>
          {cuponsErro ? (
            <p className="pb-cupom-aviso">Pra usar cupons, rode uma vez o arquivo <b>BLACK-4-CUPONS.sql</b> no Supabase (SQL Editor → New query → Run).</p>
          ) : (
            <>
              {cupons.length > 0 && (
                <div className="pb-cupons">
                  {cupons.map(c => {
                    const st = situacaoCupom(c)
                    return (
                      <div className="pb-cupom" key={c.id}>
                        <div>
                          <b>{c.codigo}</b> <span className="pct">{Number(c.pct)}%</span>
                          <small>
                            {c.limite != null ? `${c.usos} de ${c.limite} usados` : `${c.usos} ${c.usos === 1 ? 'uso' : 'usos'} · sem limite`}
                            {(c.inicio || c.fim) && ` · ${c.inicio ? 'de ' + dataBR(c.inicio) : ''}${c.fim ? ' até ' + dataBR(c.fim) : ''}`}
                          </small>
                          <small style={{ color: st.cor, fontWeight: 700 }}>{st.t}</small>
                        </div>
                        <button aria-label={'Apagar ' + c.codigo} onClick={() => apagarCupom(c)}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="pb-cupom-form">
                <label className="pb-rotulo">Código<input className="pb-campo" placeholder="EX.: BLACK10" value={novoCupom.codigo} onChange={e => setNovoCupom(n => ({ ...n, codigo: e.target.value.toUpperCase() }))} /></label>
                <div className="pb-cupom-par">
                  <label className="pb-rotulo">Desconto (%)<input className="pb-campo" inputMode="decimal" placeholder="10" value={novoCupom.pct} onChange={e => setNovoCupom(n => ({ ...n, pct: e.target.value }))} /></label>
                  <label className="pb-rotulo">Limite de usos<input className="pb-campo" inputMode="numeric" placeholder="sem limite" value={novoCupom.limite} onChange={e => setNovoCupom(n => ({ ...n, limite: e.target.value }))} /></label>
                </div>
                <div className="pb-cupom-par">
                  <label className="pb-rotulo">Vale de<input className="pb-campo" type="date" value={novoCupom.de} onChange={e => setNovoCupom(n => ({ ...n, de: e.target.value }))} /></label>
                  <label className="pb-rotulo">Até<input className="pb-campo" type="date" value={novoCupom.ate} onChange={e => setNovoCupom(n => ({ ...n, ate: e.target.value }))} /></label>
                </div>
                <p className="pb-dica" style={{ margin: 0 }}>Limite e datas são opcionais — vazio = sem limite / sem data.</p>
                <button className="pb-btn pb-contorno-escuro" onClick={criarCupom} disabled={!!ocupado}>+ Criar cupom</button>
              </div>
            </>
          )}
        </div>

        <div className="pb-bloco">
          <h3 className="pb-serif">Contato</h3>
          {campo('whatsapp', 'WhatsApp que recebe os pedidos')}
          {campo('instagram', 'Instagram')}
          {campo('endereco', 'Endereço do rodapé')}
          {campo('horario', 'Horário')}
        </div>
        <button className="pb-btn" onClick={salvarAparencia} disabled={!!ocupado}>Salvar aparência</button>
      </>
    )
  }

  function telaModelos() {
    return (
      <>
        <h1 className="pb-titulo pb-serif">Modelos</h1>
        <p className="pb-sub">Os iPhones do "Qual é o seu celular?". Filtros agora são só Black, Couro, Brilho e Transparente — marque em Capas.</p>

        <h3 className="pb-serif" style={{ fontSize: 26, marginTop: 22 }}>Qual é o seu iPhone?</h3>
        <p className="pb-dica">Toque na foto pra trocar. Ela aparece no quadradinho do site.</p>
        <div className="pb-bloco">
          <h3 className="pb-serif">Novo modelo</h3>
          <div className="pb-duas">
            <div><label className="pb-rot">Marca</label><input className="pb-campo" placeholder="Apple" value={novoModelo.marca} onChange={e => setNovoModelo(n => ({ ...n, marca: e.target.value }))} /></div>
            <div><label className="pb-rot">Modelo</label><input className="pb-campo" placeholder="iPhone 17 Pro Max" value={novoModelo.nome} onChange={e => setNovoModelo(n => ({ ...n, nome: e.target.value }))} /></div>
          </div>
          <button className="pb-btn" onClick={addModelo}>Adicionar modelo</button>
        </div>
        {marcas.map(mc => (
          <div key={mc}>
            <p className="pb-grupo-marca">{mc}</p>
            {modelos.filter(m => (m.marca || 'Outros') === mc).map(m => {
              const q = produtos.filter(p => p.tipo === 'capa' && p.modelos.includes(m.nome)).length
              return (
                <div className="pb-modelo" key={m.id}>
                  <label className="pb-foto-modelo" aria-label={'Foto do ' + m.nome}>
                    {m.foto_url ? <img src={m.foto_url} alt="" onLoad={pintarFundo} /> : <IcCamera />}
                    <input type="file" accept="image/*" hidden onChange={e => { fotoModelo(m, e.target.files); e.target.value = '' }} />
                  </label>
                  <div className="pb-n"><b>{m.nome}</b><small>{q} {q === 1 ? 'capinha' : 'capinhas'}</small></div>
                  <button aria-label="Editar nome" onClick={() => renomearModelo(m)}>✎</button>
                  <button aria-label="Subir" onClick={() => moverModelo(m, -1)}>↑</button>
                  <button aria-label="Descer" onClick={() => moverModelo(m, 1)}>↓</button>
                  <button aria-label="Apagar" className="pb-perigo" onClick={() => apagarModelo(m)}>×</button>
                </div>
              )
            })}
          </div>
        ))}
      </>
    )
  }


  // ───────── Capas por modelo: abre todas as capinhas do modelo, marca filtro e valor de cada uma ─────────
  type Ed = { filtros: FiltroFixo[]; black: boolean; mais: boolean; preco: string; promo: string }
  const [modeloAdm, setModeloAdm] = useState('')
  const [edicoes, setEdicoes] = useState<Record<string, Ed>>({})
  const [valorTodas, setValorTodas] = useState('')
  const capasDo = (nome: string) => produtos.filter(p => p.tipo === 'capa' && (p.modelos.includes(nome) || !p.modelos.length))
  const itensDo = (nome: string) => capasDo(nome).flatMap(p => (p.fotos.length ? p.fotos : ['']).map((foto, i) => ({ p, i, foto, chave: p.id + '|' + i })))
  const edDe = (p: BlackProduto, chave: string): Ed => edicoes[chave] || {
    filtros: filtrosFixosDe(p, filtrosOp, config.filtros).filter(x => x !== 'black'), black: ehBlack(p), mais: !!p.destaque,
    preco: p.preco ? paraTexto(p.preco) : '', promo: p.preco_promo ? paraTexto(p.preco_promo) : '',
  }
  function mudarEd(p: BlackProduto, chave: string, x: Partial<Ed>) {
    setEdicoes(e => ({ ...e, [chave]: { ...edDe(p, chave), ...x } }))
  }
  const qtdSujos = Object.keys(edicoes).length
  function sairDoModeloAdm() {
    if (qtdSujos && !confirm('Tem alterações sem salvar. Sair mesmo assim?')) return
    setEdicoes({}); setValorTodas(''); setModeloAdm(''); window.scrollTo(0, 0)
  }
  function dadosDe(ed: Ed, p: BlackProduto) {
    const preco = paraNumero(ed.preco)
    const promo = ed.black && ed.promo.trim() ? paraNumero(ed.promo) : null
    const d: Record<string, unknown> = {
      filtros: [...new Set(ed.filtros.filter(x => x !== 'black'))].concat(ed.black ? ['black'] : []),
      preco, preco_promo: promo && preco && promo < preco ? promo : null, destaque: ed.mais,
      modelos: p.modelos.length ? p.modelos : [modeloAdm],
    }
    d.rascunho = false; d.no_site = true // salvou = vai pro site (sem preço aparece "Consulte")
    if (p.nome === 'Rascunho') d.nome = 'Capinha'
    return d
  }
  async function salvarCapas() {
    const itens = itensDo(modeloAdm)
    // salva tudo do modelo do jeito que está — não precisa marcar filtro nem preço
    const mexidos = new Set(itens.map(it => it.p.id))
    if (!mexidos.size) return avisar('Nenhuma capinha nesse modelo')
    for (const it of itens) {
      const ed = edicoes[it.chave]
      if (!ed) continue
      const pr = paraNumero(ed.preco), pm = paraNumero(ed.promo)
      // Black pode ficar sem preço; se tiver os 2, o Black tem que ser menor
      if (ed.black && pr && pm && pm >= pr) return avisar('O preço Black tem que ser menor que o atual')
    }
    setOcupado('Salvando...')
    let erro = ''
    for (const id of mexidos) {
      const p = produtos.find(x => x.id === id)!
      const fotos = p.fotos.length ? p.fotos : ['']
      const doProduto = itens.filter(it => it.p.id === id)
      if (fotos.length <= 1) {
        const { error } = await supabase.from('black_produtos').update(dadosDe(edDe(p, doProduto[0].chave), p)).eq('id', p.id)
        if (error) erro = error.message
        continue
      }
      // várias fotos no mesmo cadastro: separa cada foto num cadastro próprio (pra mexer uma por uma)
      const { error } = await supabase.from('black_produtos').update({ ...dadosDe(edDe(p, doProduto[0].chave), p), fotos: [fotos[0]] }).eq('id', p.id)
      if (error) { erro = error.message; continue }
      const novos = doProduto.slice(1).map((it, k) => ({
        nome: p.nome, tipo: p.tipo, descricao: p.descricao, lancamento: p.lancamento, destaque: p.destaque,
        no_site: p.no_site, rascunho: !!p.rascunho, ordem: (p.ordem || 0) + k + 1,
        ...dadosDe(edDe(p, it.chave), p), fotos: [it.foto],
      }))
      const r = await supabase.from('black_produtos').insert(novos)
      if (r.error) erro = r.error.message
    }
    setOcupado('')
    if (erro) return avisar('Não salvou tudo: ' + erro)
    setEdicoes({})
    avisar('Salvo ✓')
    await carregar()
  }
  const [novoFiltroCfg, setNovoFiltroCfg] = useState('')
  async function gravarFiltros(filtros: BlackConfig['filtros']) {
    const novo = { ...config, filtros }
    setConfig(novo)
    const { error } = await supabase.from('black_config').upsert({ id: 1, dados: novo })
    if (error) avisar('Não salvou: ' + error.message)
    return !error
  }
  async function criarFiltroCfg() {
    const nome = novoFiltroCfg.trim()
    const slug = slugDe(nome)
    if (!slug) return avisar('Digite o nome do filtro')
    if (slug === 'black' || config.filtros.some(f => f.slug === slug)) return avisar('Esse filtro já existe')
    if (await gravarFiltros([...config.filtros, { slug, nome: nome.charAt(0).toUpperCase() + nome.slice(1) }])) {
      setNovoFiltroCfg('')
      avisar('Filtro criado ✓ Já está no menu do site')
    }
  }
  async function apagarFiltroCfg(slug: string) {
    const f = config.filtros.find(x => x.slug === slug)
    if (!f || !confirm(`Apagar o filtro ${f.nome}? Ele sai do menu do site.`)) return
    if (await gravarFiltros(config.filtros.filter(x => x.slug !== slug))) avisar('Filtro apagado')
  }
  async function apagarCapa(p: BlackProduto, i: number) {
    if (!confirm('Apagar essa capinha?')) return
    setOcupado('Apagando...')
    const r = p.fotos.length > 1
      ? await supabase.from('black_produtos').update({ fotos: p.fotos.filter((_, k) => k !== i) }).eq('id', p.id)
      : await supabase.from('black_produtos').delete().eq('id', p.id)
    setOcupado('')
    if (r.error) return avisar('Não apagou: ' + r.error.message)
    // as fotos desse cadastro mudaram de posição: descarta o que não foi salvo dele
    setEdicoes(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(p.id + '|'))))
    avisar('Capinha apagada')
    await carregar()
  }
  async function subirFotosDoModelo(arquivos: FileList | null) {
    if (!arquivos || !arquivos.length || !modeloAdm) return
    const fs = Array.from(arquivos)
    for (let i = 0; i < fs.length; i++) {
      setOcupado(`Enviando foto ${i + 1} de ${fs.length}...`)
      try {
        const url = await enviarFoto(fs[i])
        const { error } = await supabase.from('black_produtos').insert([{
          nome: 'Capinha', tipo: 'capa', preco: 0, fotos: [url], modelos: [modeloAdm], filtros: [],
          no_site: false, rascunho: true, lancamento: false, ordem: produtos.length + i,
        }])
        if (error) throw error
      } catch (e) { avisar('Foto não enviada: ' + (e instanceof Error ? e.message : String(e))) }
    }
    setOcupado('')
    await carregar()
    avisar('Fotos no modelo ✓ Agora marque o filtro e o valor de cada uma')
  }
  function telaCapas() {
    if (!modeloAdm) {
      return (
        <>
          <h1 className="pb-titulo pb-serif">Capas</h1>
          <p className="pb-sub">Toque no modelo pra abrir todas as capinhas dele</p>
          <div className="pb-bloco pb-filtros-cfg">
            <h3 className="pb-serif">Filtros</h3>
            <p className="pb-dica">Aparecem sozinhos no menu ☰ do site e nos checks de cada capinha. "Black" é automático (capinha com preço Black).</p>
            <div className="pb-opcoes">
              {config.filtros.map(f => (
                <span className="pb-opcao" key={f.slug}>{f.nome}<button aria-label={'Apagar ' + f.nome} onClick={() => apagarFiltroCfg(f.slug)}>×</button></span>
              ))}
            </div>
            <div className="pb-add-linha">
              <input className="pb-campo" placeholder="Novo filtro (ex.: Silicone)" value={novoFiltroCfg} onChange={e => setNovoFiltroCfg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criarFiltroCfg() }} />
              <button className="pb-btn-pequeno pb-escuro" onClick={criarFiltroCfg}>Criar</button>
            </div>
          </div>
          {carregando ? <p className="pb-sub pb-vazio">Carregando...</p> : (
            <div className="pb-grade-mods">
              {modelos.map(m => {
                const its = itensDo(m.nome)
                const falta = its.filter(it => !it.p.preco).length
                return (
                  <button key={m.id} className="pb-mod-tile" onClick={() => { setEdicoes({}); setModeloAdm(m.nome); window.scrollTo(0, 0) }}>
                    <span className="pb-mod-foto">{m.foto_url ? <img src={m.foto_url} alt="" onLoad={pintarFundo} /> : <IcProdutos />}</span>
                    <b>{m.nome.replace(/^iPhone\s+/i, '')}</b>
                    <small>{its.length} {its.length === 1 ? 'capinha' : 'capinhas'}</small>
                    {falta > 0 && <em>{falta} sem preço</em>}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )
    }
    const itens = itensDo(modeloAdm)
    return (
      <>
        <div className="pb-cap-topo">
          <button className="pb-cap-voltar" onClick={sairDoModeloAdm} aria-label="Voltar">‹</button>
          <div><b className="pb-serif">{modeloAdm}</b><small>{itens.length} {itens.length === 1 ? 'capinha' : 'capinhas'}</small></div>
        </div>
        <p className="pb-cap-nota">Ponha o valor e salve — o filtro pode marcar depois. Marcou <b>Black</b>? Ela já entra na vitrine Black do site — os 2 preços (<b>atual</b> e <b>com desconto</b>) pode pôr depois.</p>
        <label className="pb-btn-pequeno pb-escuro" style={{ marginBottom: 12 }}>
          <IcCamera />Subir fotos pra esse modelo
          <input type="file" accept="image/*" multiple hidden onChange={e => { subirFotosDoModelo(e.target.files); e.target.value = '' }} />
        </label>
        {itens.length > 0 && (
          <div className="pb-cap-todas">
            <div className="pb-cap-campo"><small>PRA TODAS</small>
              <input inputMode="decimal" placeholder="0,00" value={valorTodas} onChange={e => setValorTodas(e.target.value)} /></div>
            <button className="pb-btn-pequeno pb-escuro" onClick={() => {
              if (!paraNumero(valorTodas)) return avisar('Digite o valor')
              setEdicoes(e => {
                const n = { ...e }
                for (const it of itens) n[it.chave] = { ...edDe(it.p, it.chave), preco: valorTodas }
                return n
              })
              avisar('Valor colocado em todas. Agora é só Salvar tudo')
            }}>Pôr em todas</button>
          </div>
        )}
        {!itens.length ? <p className="pb-sub pb-vazio">Nenhuma capinha nesse modelo ainda.</p> : (
          <div className="pb-cap-grade">
            {itens.map(({ p, i, foto, chave }) => {
              const ed = edDe(p, chave)
              const pr = paraNumero(ed.preco), pm = paraNumero(ed.promo)
              return (
                <div key={chave} className={`pb-cap ${ed.black ? 'preto' : ''} ${edicoes[chave] ? 'sujo' : ''}`}>
                  <div className="pb-cap-foto">
                    {foto ? <img src={foto} alt="" loading="lazy" /> : <IcCamera />}
                    <button className="pb-cap-apagar" aria-label="Apagar capinha" onClick={() => apagarCapa(p, i)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3361F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                    </button>
                  </div>
                  <div className="pb-cap-checks">
                    <label className="blk"><input type="checkbox" checked={ed.black} onChange={e => mudarEd(p, chave, { black: e.target.checked })} />Black</label>
                    <label className="mais"><input type="checkbox" checked={ed.mais} onChange={e => mudarEd(p, chave, { mais: e.target.checked })} />Mais vendida</label>
                    {config.filtros.map(f => (
                      <label key={f.slug}><input type="checkbox" checked={ed.filtros.includes(f.slug)}
                        onChange={() => mudarEd(p, chave, { filtros: ed.filtros.includes(f.slug) ? ed.filtros.filter(x => x !== f.slug) : [...ed.filtros, f.slug] })} />{f.nome}</label>
                    ))}
                  </div>
                  <div className="pb-cap-campo"><small>{ed.black ? 'ATUAL' : 'VALOR'}</small>
                    <input inputMode="decimal" placeholder="0,00" value={ed.preco} onChange={e => mudarEd(p, chave, { preco: e.target.value })} /></div>
                  {ed.black && <>
                    <div className="pb-cap-campo desc"><small>BLACK</small>
                      <input inputMode="decimal" placeholder="0,00" value={ed.promo} onChange={e => mudarEd(p, chave, { promo: e.target.value })} /></div>
                    {pr > 0 && pm > 0 && pm < pr && <div className="pb-cap-pct">-{Math.round((1 - pm / pr) * 100)}% na Black</div>}
                  </>}
                  {!p.no_site && <div className="pb-cap-status">{p.rascunho ? 'Ainda não está no site — toque em Salvar tudo' : 'Pausada (fora do site)'}</div>}
                </div>
              )
            })}
          </div>
        )}
        <div style={{ height: 80 }} />
        <button className="pb-cap-salvar" disabled={!itens.length} onClick={salvarCapas}>{qtdSujos ? `Salvar tudo (${qtdSujos} alteradas)` : 'Salvar tudo'}</button>
      </>
    )
  }

  const abas: { v: Vista; rotulo: string; Icone: () => ReactElement; ativa: boolean }[] = [
    { v: 'capas', rotulo: 'Capas', Icone: IcProdutos, ativa: vista === 'capas' },
    { v: 'produtos', rotulo: 'Lista', Icone: IcLista, ativa: vista === 'produtos' || vista === 'editar' },
    { v: 'aparencia', rotulo: 'Aparência', Icone: IcPincel, ativa: vista === 'aparencia' },
    { v: 'modelos', rotulo: 'Modelos', Icone: IcMais, ativa: vista === 'modelos' },
  ]

  return (
    <div className="pb">
      <header className="pb-topo">
        <div className="pb-marca">
          <div className="pb-selo"><b>Marcos</b><i>Magazine</i></div>
          <span className="pb-t pb-serif">PAINEL <em>BLACK</em></span>
        </div>
        <div className="pb-acoes">
          <a href="/black" target="_blank" rel="noreferrer" aria-label="Ver o site da Black">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F1E6DA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          </a>
          <button onClick={onSair} aria-label="Voltar ao Admin">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F1E6DA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" /></svg>
          </button>
        </div>
      </header>

      <main className="pb-main">
        {erroBanco ? (
          <div className="pb-bloco">
            <h3 className="pb-serif">Falta preparar o banco</h3>
            <p className="pb-dica">Rode o arquivo <b>BLACK-RODAR-NO-SUPABASE.sql</b> no Supabase (SQL Editor → New query → colar → Run) e abra de novo.</p>
            <p className="pb-dica" style={{ color: '#A3361F' }}>{erroBanco}</p>
            <button className="pb-btn" onClick={() => { setCarregando(true); carregar() }}>Tentar de novo</button>
          </div>
        ) : vista === 'capas' ? telaCapas() : vista === 'produtos' ? telaProdutos() : vista === 'editar' ? telaEditar() : vista === 'aparencia' ? telaAparencia() : telaModelos()}
      </main>

      {telaLote()}

      <nav className="pb-menu">
        {abas.map(({ v, rotulo, Icone, ativa }) => (
          <button key={rotulo} className={ativa ? 'on' : ''} onClick={() => ir(v)}><Icone />{rotulo}</button>
        ))}
      </nav>

      {(ocupado || gerando) && <div className="pb-ocupado"><div className="pb-roda" />{ocupado || gerando}</div>}
      <div className={`pb-toast ${aviso ? 'on' : ''}`}>{aviso}</div>
    </div>
  )
}
