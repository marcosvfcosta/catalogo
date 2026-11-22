// Painel do catálogo da Black (capinhas e cordinhas) — abre em Admin → Capas.
// Visual igual ao painel da Elegância. Separado da Negociação.
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { supabase } from '../supabase'
import {
  BLACK_PADRAO, emPromocao, lerConfig, precoFinal, reais,
  type BlackConfig, type BlackModelo, type BlackProduto, type BlackSecao, type BlackVestida, type BlackVideo,
} from '../lib/blackConfig'
import './painelBlack.css'

type Vista = 'produtos' | 'editar' | 'aparencia' | 'modelos'
type Filtro = 'todos' | 'site' | 'pausados' | 'capa' | 'cordinha' | 'promo'

type Props = {
  onSair: () => void
  enviarFoto: (arquivo: File) => Promise<string> // já deixa no padrão (fundo branco, centralizada)
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
}

const FORM_VAZIO: Form = { id: null, nome: '', tipo: 'capa', preco: '', promo: '', descricao: '', fotos: [], modelos: [], no_site: true, lancamento: true, destaque: false }

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
  const [vista, setVista] = useState<Vista>('produtos')
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

  const timerAviso = useRef<number | undefined>(undefined)
  function avisar(t: string) {
    setAviso(t)
    window.clearTimeout(timerAviso.current)
    timerAviso.current = window.setTimeout(() => setAviso(''), 2200)
  }

  async function carregar() {
    const [p, m, v, c, ve] = await Promise.all([
      supabase.from('black_produtos').select('*').order('ordem').order('criado_em', { ascending: false }),
      supabase.from('black_modelos').select('*').order('ordem'),
      supabase.from('black_videos').select('*').order('ordem'),
      supabase.from('black_config').select('dados').eq('id', 1).maybeSingle(),
      supabase.from('black_vestidas').select('*').order('criado_em'),
    ])
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
        fotos: [...(p.fotos || [])], modelos: [...(p.modelos || [])], no_site: p.no_site, lancamento: p.lancamento, destaque: p.destaque,
      } : { ...FORM_VAZIO })
    }
    setVista(v)
    window.scrollTo(0, 0)
  }

  // ───────── Produtos ─────────
  const contagem = useMemo(() => ({
    todos: produtos.length,
    site: produtos.filter(p => p.no_site).length,
    pausados: produtos.filter(p => !p.no_site).length,
    capa: produtos.filter(p => p.tipo === 'capa').length,
    cordinha: produtos.filter(p => p.tipo === 'cordinha').length,
    promo: produtos.filter(emPromocao).length,
  }), [produtos])

  const lista = produtos.filter(p => {
    const ok = filtro === 'todos' || (filtro === 'site' && p.no_site) || (filtro === 'pausados' && !p.no_site)
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
      setOcupado(`Deixando a foto ${i + 1} de ${fs.length} no padrão...`)
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

  // ───────── Modelos ─────────
  async function addModelo() {
    const nome = novoModelo.nome.trim()
    if (!nome) return avisar('Digite o modelo')
    const { error } = await supabase.from('black_modelos').insert([{ nome, marca: novoModelo.marca.trim() || 'Outros', ordem: modelos.length + 1 }])
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
    await Promise.all(nova.map((x, k) => supabase.from('black_modelos').update({ ordem: k + 1 }).eq('id', x.id)))
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
      ['todos', 'Todos', contagem.todos], ['site', 'No site', contagem.site], ['pausados', 'Pausados', contagem.pausados],
      ['capa', 'Capinhas', contagem.capa], ['cordinha', 'Cordinhas', contagem.cordinha], ['promo', 'Promoção', contagem.promo],
    ]
    return (
      <>
        <h1 className="pb-titulo pb-serif">Produtos</h1>
        <p className="pb-sub">{contagem.todos} cadastrados · {contagem.site} no site</p>
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
                <div className="pb-card" key={p.id}>
                  <div className="pb-linha1" onClick={() => ir('editar', p)}>
                    <div className="pb-thumb">
                      {p.fotos?.[0] ? <img src={p.fotos[0]} alt="" loading="lazy" /> : <IcCamera />}
                      {emPromocao(p) && <span className="pb-off">-{Math.round((1 - (p.preco_promo as number) / p.preco) * 100)}%</span>}
                    </div>
                    <div className="pb-info">
                      <div className="pb-nome pb-serif">{p.nome}</div>
                      <div className="pb-preco pb-serif">{reais(precoFinal(p))}{emPromocao(p) && <s>{reais(p.preco)}</s>}</div>
                      <div className="pb-meta">{p.tipo === 'capa' ? `Capinha · ${p.modelos.length} ${p.modelos.length === 1 ? 'modelo' : 'modelos'}` : 'Cordinha · serve em todos'}</div>
                    </div>
                    <IcSeta />
                  </div>
                  <div className="pb-linha2">
                    <button className="pb-chave" onClick={() => alternar(p, 'no_site')}><span className={`pb-sw ${p.no_site ? 'on' : ''}`} />No site</button>
                    <button className={`pb-estrela ${p.destaque ? 'on' : ''}`} onClick={() => alternar(p, 'destaque')}><IcEstrela />Mais vendido</button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </>
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
          <p className="pb-auto">🪄 Automático: tira o fundo e o dedo, deixa no branco, centraliza e coloca sombra. Dica: fotografe em cima de uma folha branca.</p>
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
              {!modelos.length && <p className="pb-dica">Nenhum modelo cadastrado. Cadastre em <b>Modelos</b>, no menu de baixo.</p>}
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
                    <option value="">Ligar a um produto...</option>
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
        <p className="pb-sub">Celulares do filtro "Qual é o seu celular?"</p>
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
                  <div className="pb-n"><b>{m.nome}</b><small>{q} {q === 1 ? 'capinha' : 'capinhas'}</small></div>
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

  const abas: { v: Vista; rotulo: string; Icone: () => ReactElement; ativa: boolean }[] = [
    { v: 'produtos', rotulo: 'Produtos', Icone: IcProdutos, ativa: vista === 'produtos' || (vista === 'editar' && !ehNovo) },
    { v: 'editar', rotulo: 'Novo produto', Icone: IcMais, ativa: ehNovo },
    { v: 'aparencia', rotulo: 'Aparência', Icone: IcPincel, ativa: vista === 'aparencia' },
    { v: 'modelos', rotulo: 'Modelos', Icone: IcLista, ativa: vista === 'modelos' },
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
        ) : vista === 'produtos' ? telaProdutos() : vista === 'editar' ? telaEditar() : vista === 'aparencia' ? telaAparencia() : telaModelos()}
      </main>

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
