import { useState } from 'react'
import { supabase } from '../supabase'
import { ajustarFoto } from '../lib/ajustarFoto'

// ─── Tipos ─────────────────────────────────────────
type ProdutoIA = {
  id: string; categoria: string; marca: string; modelo: string
  memoria?: string; cor?: string; condicao?: string; descricao?: string; foto_url?: string
  disponivel?: boolean; destaque?: boolean; lancamento?: boolean; promocao?: boolean; mais_procurado?: boolean
}
type BannerIA = { id: string; url: string; ordem: number; ativo: boolean; titulo?: string | null }

type CampoMarcar = 'destaque' | 'lancamento' | 'promocao' | 'mais_procurado' | 'disponivel'
type Acao =
  | { tipo: 'marcar'; ids: string[]; campo: CampoMarcar; valor: boolean }
  | { tipo: 'editar'; id: string; campos: Record<string, string> }
  | { tipo: 'banner'; produto_id: string; etiqueta?: string; titulo?: string; subtitulo?: string }
  | { tipo: 'desativar_banner'; id: string }

type FotoIA = {
  chave: string; arquivo: File; preview: string
  status: 'lendo' | 'pronto' | 'erro' | 'salva'
  produto_id: string; cor?: string; confianca?: string; motivo?: string
}

type Props = {
  produtos: ProdutoIA[]
  banners: BannerIA[]
  ajusteAuto: boolean
  aoMudar: () => void
}

const NOME_CAMPO: Record<CampoMarcar, string> = {
  destaque: '⭐ Destaque', lancamento: '🚀 Lançamento', promocao: '🏷 Promoção',
  mais_procurado: '🔥 Mais procurado', disponivel: '● Disponível',
}
const CAMPOS_EDITAVEIS = ['modelo', 'marca', 'memoria', 'cor', 'categoria', 'condicao', 'descricao']

const EXEMPLOS = [
  'Coloca em destaque todos da Xiaomi e Realme',
  'Cria um banner do iPhone 17 Pro como lançamento',
  'Escreve a descrição dos celulares que estão sem descrição',
  'Tira a promoção de todos os produtos',
]

const nomeProduto = (p?: ProdutoIA) => p ? [p.marca, p.modelo, p.memoria].filter(Boolean).join(' ') : '(produto não encontrado)'

// Reduz a foto para mandar à IA (mais rápido e barato)
function fotoParaBase64(arquivo: File): Promise<{ data: string; tipo: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, 1024 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala)
      const ctx = c.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve({ data: c.toDataURL('image/jpeg', 0.85).split(',')[1], tipo: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')) }
    img.src = url
  })
}

async function mensagemDeErro(error: unknown) {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') { const b = await ctx.json(); if (b?.error) return String(b.error) }
  } catch { /* ignora */ }
  return error instanceof Error ? error.message : 'Erro desconhecido'
}

export default function AssistenteIA({ produtos, banners, ajusteAuto, aoMudar }: Props) {
  // ─── Comando ───
  const [comando, setComando] = useState('')
  const [pensando, setPensando] = useState(false)
  const [resposta, setResposta] = useState('')
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [marcadas, setMarcadas] = useState<boolean[]>([])
  const [aplicando, setAplicando] = useState(false)
  const [abertas, setAbertas] = useState<number | null>(null)

  // ─── Fotos ───
  const [fotos, setFotos] = useState<FotoIA[]>([])
  const [salvandoFotos, setSalvandoFotos] = useState<{ feitas: number; total: number } | null>(null)

  const porId = (id: string) => produtos.find(p => p.id === id)

  async function enviarComando(texto?: string) {
    const pedido = (texto ?? comando).trim()
    if (pedido.length < 3) return
    if (texto) setComando(texto)
    setPensando(true); setResposta(''); setAcoes([]); setMarcadas([])
    const lista = produtos.map(p => ({
      id: p.id, marca: p.marca, modelo: p.modelo, memoria: p.memoria || null, categoria: p.categoria,
      cor: p.cor || null, condicao: p.condicao || null,
      marcacoes: (['destaque', 'lancamento', 'promocao', 'mais_procurado'] as const).filter(c => p[c]),
      disponivel: p.disponivel !== false, tem_foto: !!p.foto_url, tem_descricao: !!p.descricao,
    }))
    const { data, error } = await supabase.functions.invoke('assistente', {
      body: { modo: 'comando', comando: pedido, produtos: lista, banners: banners.map(b => ({ id: b.id, titulo: b.titulo || '(foto sem texto)', ativo: b.ativo })) },
    })
    setPensando(false)
    if (error) { setResposta('❌ ' + await mensagemDeErro(error)); return }
    if (data?.error) { setResposta('❌ ' + data.error); return }
    const validas = ((data?.acoes || []) as Acao[]).filter(a => {
      if (a.tipo === 'marcar') return Array.isArray(a.ids) && a.ids.some(id => porId(id)) && a.campo in NOME_CAMPO
      if (a.tipo === 'editar') return !!porId(a.id) && a.campos && typeof a.campos === 'object'
      if (a.tipo === 'banner') return !!porId(a.produto_id)
      if (a.tipo === 'desativar_banner') return banners.some(b => b.id === a.id)
      return false
    })
    setResposta(data?.resposta || (validas.length ? 'Pronto, confere abaixo:' : 'Não entendi o que fazer.'))
    setAcoes(validas)
    setMarcadas(validas.map(() => true))
  }

  function descreverAcao(a: Acao) {
    if (a.tipo === 'marcar') {
      const n = a.ids.filter(id => porId(id)).length
      return `${NOME_CAMPO[a.campo]}: ${a.valor ? 'ligar' : 'desligar'} em ${n} produto${n === 1 ? '' : 's'}`
    }
    if (a.tipo === 'editar') return `✏️ Editar ${nomeProduto(porId(a.id))}: ${Object.keys(a.campos).filter(k => CAMPOS_EDITAVEIS.includes(k)).join(', ')}`
    if (a.tipo === 'banner') return `🖼 Banner: ${a.titulo || nomeProduto(porId(a.produto_id))}${a.etiqueta ? ` (${a.etiqueta})` : ''}`
    return `🚫 Desativar banner: ${banners.find(b => b.id === a.id)?.titulo || 'foto do carrossel'}`
  }

  function detalhesAcao(a: Acao) {
    if (a.tipo === 'marcar') return a.ids.map(id => nomeProduto(porId(id)))
    if (a.tipo === 'editar') return Object.entries(a.campos).filter(([k]) => CAMPOS_EDITAVEIS.includes(k)).map(([k, v]) => `${k}: ${v}`)
    if (a.tipo === 'banner') {
      const p = porId(a.produto_id)
      return [a.subtitulo || '', p?.foto_url ? '' : '⚠️ Esse produto está sem foto — o banner não será criado'].filter(Boolean)
    }
    return []
  }

  async function aplicar() {
    setAplicando(true)
    let erros = 0
    let ordem = Math.max(0, ...banners.map(b => b.ordem || 0))
    for (let i = 0; i < acoes.length; i++) {
      if (!marcadas[i]) continue
      const a = acoes[i]
      try {
        if (a.tipo === 'marcar') {
          const ids = a.ids.filter(id => porId(id))
          const { error } = await supabase.from('produtos_catalogo').update({ [a.campo]: !!a.valor }).in('id', ids)
          if (error) throw error
        } else if (a.tipo === 'editar') {
          const campos = Object.fromEntries(Object.entries(a.campos).filter(([k]) => CAMPOS_EDITAVEIS.includes(k)))
          if (Object.keys(campos).length) {
            const { error } = await supabase.from('produtos_catalogo').update(campos).eq('id', a.id)
            if (error) throw error
          }
        } else if (a.tipo === 'banner') {
          const p = porId(a.produto_id)
          if (!p?.foto_url) { erros++; continue }
          ordem++
          const { error } = await supabase.from('hero_imagens').insert([{
            url: p.foto_url, ordem, ativo: true, produto_id: p.id,
            etiqueta: a.etiqueta || null, titulo: a.titulo || p.modelo, subtitulo: a.subtitulo || null,
          }])
          if (error) throw error
        } else if (a.tipo === 'desativar_banner') {
          const { error } = await supabase.from('hero_imagens').update({ ativo: false }).eq('id', a.id)
          if (error) throw error
        }
      } catch (e) { console.error(e); erros++ }
    }
    setAplicando(false)
    aoMudar()
    if (erros) alert(`${erros} ação(ões) não foram aplicadas.`)
    setResposta(erros ? 'Algumas ações deram erro.' : '✅ Feito! O catálogo já está atualizado.')
    setAcoes([]); setMarcadas([]); setComando('')
  }

  // ─── Fotos com IA ───
  async function escolherFotos(arquivos: File[]) {
    if (!arquivos.length) return
    const novas: FotoIA[] = arquivos.map((arquivo, i) => ({
      chave: `${Date.now()}_${i}_${arquivo.name}`, arquivo, preview: URL.createObjectURL(arquivo), status: 'lendo', produto_id: '',
    }))
    setFotos(prev => [...prev, ...novas])
    const lista = produtos.map(p => ({ id: p.id, nome: [p.marca, p.modelo, p.memoria, p.cor].filter(Boolean).join(' '), sem_foto: !p.foto_url }))
    for (const f of novas) {
      try {
        const img = await fotoParaBase64(f.arquivo)
        const { data, error } = await supabase.functions.invoke('assistente', {
          body: { modo: 'foto', imagem: img.data, tipo: img.tipo, nome_arquivo: f.arquivo.name, produtos: lista },
        })
        if (error || data?.error) throw new Error(error ? await mensagemDeErro(error) : data.error)
        const achou = data?.produto_id && porId(data.produto_id) ? data.produto_id : ''
        setFotos(prev => prev.map(x => x.chave === f.chave ? { ...x, status: 'pronto', produto_id: achou, cor: data?.cor, confianca: achou ? data?.confianca : 'baixa', motivo: data?.motivo } : x))
      } catch (e) {
        console.error(e)
        setFotos(prev => prev.map(x => x.chave === f.chave ? { ...x, status: 'erro', motivo: e instanceof Error ? e.message : 'erro' } : x))
      }
    }
  }

  function removerFoto(chave: string) {
    setFotos(prev => prev.filter(f => f.chave !== chave))
  }

  async function salvarFotos() {
    const prontas = fotos.filter(f => (f.status === 'pronto' || f.status === 'erro') && f.produto_id)
    if (!prontas.length) return
    setSalvandoFotos({ feitas: 0, total: prontas.length })
    const capaLocal: Record<string, boolean> = {}
    const ordemLocal: Record<string, number> = {}
    let erros = 0
    for (let i = 0; i < prontas.length; i++) {
      const f = prontas[i]
      try {
        const aj = ajusteAuto ? await ajustarFoto(f.arquivo) : { arquivo: f.arquivo }
        const final = aj.arquivo
        const ext = (final.name.split('.').pop() || 'jpg').toLowerCase()
        const nome = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
        const up = await supabase.storage.from('fotos').upload(nome, final, { upsert: true, contentType: final.type || 'image/jpeg' })
        if (up.error) throw up.error
        const url = supabase.storage.from('fotos').getPublicUrl(nome).data.publicUrl
        const p = porId(f.produto_id)
        const temCapa = !!p?.foto_url || capaLocal[f.produto_id]
        if (!temCapa) {
          const { error } = await supabase.from('produtos_catalogo').update({ foto_url: url }).eq('id', f.produto_id)
          if (error) throw error
          capaLocal[f.produto_id] = true
        } else {
          if (ordemLocal[f.produto_id] === undefined) {
            const { count } = await supabase.from('produto_fotos').select('id', { count: 'exact', head: true }).eq('produto_id', f.produto_id)
            ordemLocal[f.produto_id] = count || 0
          }
          ordemLocal[f.produto_id]++
          const { error } = await supabase.from('produto_fotos').insert([{ produto_id: f.produto_id, url, ordem: ordemLocal[f.produto_id] }])
          if (error) throw error
        }
        setFotos(prev => prev.map(x => x.chave === f.chave ? { ...x, status: 'salva' } : x))
      } catch (e) { console.error(e); erros++ }
      setSalvandoFotos({ feitas: i + 1, total: prontas.length })
    }
    setSalvandoFotos(null)
    aoMudar()
    setFotos(prev => prev.filter(f => f.status !== 'salva'))
    if (erros) alert(`${erros} foto(s) não foram salvas. Tente de novo.`)
  }

  const ordenados = [...produtos].sort((a, b) => (a.foto_url ? 1 : 0) - (b.foto_url ? 1 : 0) || nomeProduto(a).localeCompare(nomeProduto(b)))
  const fotosParaSalvar = fotos.filter(f => f.status !== 'lendo' && f.status !== 'salva' && f.produto_id).length
  const lendo = fotos.some(f => f.status === 'lendo')

  return (
    <div style={{ padding: '20px 16px', boxSizing: 'border-box', width: '100%' }}>
      {/* ─── Pedido ─── */}
      <h2 style={titulo}>🤖 Assistente IA</h2>
      <p style={ajuda}>Escreva o que você quer mudar no catálogo. A IA prepara, você confere e aplica.</p>
      <textarea style={caixaTexto} rows={3} placeholder="Ex: coloca em destaque todos da Xiaomi e Realme"
        value={comando} onChange={e => setComando(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComando() } }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {EXEMPLOS.map(ex => (
          <button key={ex} style={chip} onClick={() => enviarComando(ex)} disabled={pensando}>{ex}</button>
        ))}
      </div>
      <button style={{ ...btnLaranja, opacity: pensando || comando.trim().length < 3 ? 0.5 : 1 }}
        disabled={pensando || comando.trim().length < 3} onClick={() => enviarComando()}>
        {pensando ? '🤖 Pensando...' : 'Enviar para a IA'}
      </button>

      {resposta && <div style={caixaResposta}>{resposta}</div>}

      {acoes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {acoes.map((a, i) => {
            const det = detalhesAcao(a)
            return (
              <div key={i} style={cartaoAcao}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!marcadas[i]} style={{ accentColor: '#ff6600', width: 18, height: 18, marginTop: 2 }}
                    onChange={e => setMarcadas(prev => prev.map((v, j) => j === i ? e.target.checked : v))} />
                  <span style={{ flex: 1, fontSize: 14, color: '#eee' }}>{descreverAcao(a)}</span>
                </label>
                {a.tipo === 'banner' && porId(a.produto_id)?.foto_url && (
                  <div style={previewBanner}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {a.etiqueta && <p style={{ color: '#ff6600', fontSize: 10, fontWeight: 800, letterSpacing: 2, margin: 0 }}>{a.etiqueta}</p>}
                      <p style={{ color: '#111', fontSize: 17, fontWeight: 800, margin: '2px 0' }}>{a.titulo}</p>
                      <p style={{ color: '#555', fontSize: 12, margin: 0 }}>{a.subtitulo}</p>
                    </div>
                    <img src={porId(a.produto_id)!.foto_url} alt="" style={{ width: 70, height: 70, objectFit: 'contain' }} />
                  </div>
                )}
                {det.length > 0 && (
                  <>
                    <button style={btnVerMais} onClick={() => setAbertas(abertas === i ? null : i)}>
                      {abertas === i ? 'Esconder' : `Ver detalhes (${det.length})`}
                    </button>
                    {abertas === i && <ul style={{ margin: '6px 0 0', paddingLeft: 30, color: '#aaa', fontSize: 13 }}>{det.map((d, j) => <li key={j}>{d}</li>)}</ul>}
                  </>
                )}
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnVerde, flex: 1, opacity: aplicando || !marcadas.some(Boolean) ? 0.5 : 1 }}
              disabled={aplicando || !marcadas.some(Boolean)} onClick={aplicar}>
              {aplicando ? 'Aplicando...' : '✅ Aplicar'}
            </button>
            <button style={btnCinza} onClick={() => { setAcoes([]); setResposta('') }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ─── Fotos ─── */}
      <h2 style={{ ...titulo, marginTop: 36 }}>📷 Fotos com IA</h2>
      <p style={ajuda}>Selecione várias fotos de uma vez. A IA descobre de qual produto é cada uma e coloca no lugar certo.{ajusteAuto ? ' As fotos serão ajustadas (fundo e centro) ao salvar.' : ''}</p>
      <label style={caixaUpload}>
        📸 Escolher fotos da galeria
        <input type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { const l = Array.from(e.target.files || []); e.target.value = ''; escolherFotos(l) }} />
      </label>

      {fotos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fotos.map(f => (
            <div key={f.chave} style={cartaoFoto}>
              <img src={f.preview} alt="" style={{ width: 72, height: 72, objectFit: 'contain', background: '#fff', borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {f.status === 'lendo' ? (
                  <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>🤖 Identificando...</p>
                ) : (
                  <>
                    <select style={seletor} value={f.produto_id}
                      onChange={e => setFotos(prev => prev.map(x => x.chave === f.chave ? { ...x, produto_id: e.target.value, confianca: 'manual' } : x))}>
                      <option value="">— Escolha o produto —</option>
                      {ordenados.map(p => <option key={p.id} value={p.id}>{p.foto_url ? '' : '📷 '}{nomeProduto(p)}</option>)}
                    </select>
                    <p style={{ fontSize: 11, margin: '4px 0 0', color: f.confianca === 'alta' || f.confianca === 'manual' ? '#25D366' : f.confianca === 'media' ? '#ffb020' : '#ff6b6b' }}>
                      {f.status === 'erro' ? `Não consegui identificar — escolha manualmente` :
                        f.confianca === 'manual' ? 'Escolhido por você' :
                        f.produto_id ? `Certeza ${f.confianca || '?'}${f.cor ? ` · cor: ${f.cor}` : ''}` : 'Não achei esse produto no catálogo'}
                    </p>
                  </>
                )}
              </div>
              <button style={btnRemover} onClick={() => removerFoto(f.chave)}>✕</button>
            </div>
          ))}
          <button style={{ ...btnVerde, opacity: salvandoFotos || lendo || !fotosParaSalvar ? 0.5 : 1 }}
            disabled={!!salvandoFotos || lendo || !fotosParaSalvar} onClick={salvarFotos}>
            {salvandoFotos ? `Salvando ${salvandoFotos.feitas}/${salvandoFotos.total}...` : lendo ? '🤖 Aguarde a IA terminar...' : `💾 Salvar ${fotosParaSalvar} foto(s)`}
          </button>
          <p style={{ ...ajuda, fontSize: 12 }}>📷 = produto que ainda não tem foto. A 1ª foto vira a capa; as outras entram na galeria do produto.</p>
        </div>
      )}
    </div>
  )
}

// ─── Estilos ───
const titulo: React.CSSProperties = { color: '#ff6600', fontSize: 20, fontWeight: 800, margin: '0 0 6px' }
const ajuda: React.CSSProperties = { color: '#888', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }
const caixaTexto: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #2a2a2a', background: '#0f0f0f', color: 'white', fontSize: 16, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }
const chip: React.CSSProperties = { padding: '7px 11px', borderRadius: 16, border: '1px solid #333', background: '#141414', color: '#bbb', fontSize: 12, cursor: 'pointer', textAlign: 'left' }
const btnLaranja: React.CSSProperties = { width: '100%', padding: 15, borderRadius: 12, border: 'none', background: '#ff6600', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer' }
const btnVerde: React.CSSProperties = { width: '100%', padding: 15, borderRadius: 12, border: 'none', background: '#25D366', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer' }
const btnCinza: React.CSSProperties = { padding: '15px 18px', borderRadius: 12, border: '1px solid #333', background: 'none', color: '#aaa', fontSize: 15, cursor: 'pointer' }
const caixaResposta: React.CSSProperties = { marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,102,0,0.1)', border: '1px solid rgba(255,102,0,0.35)', color: '#ffb27a', fontSize: 14, lineHeight: 1.5 }
const cartaoAcao: React.CSSProperties = { background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: 12, marginBottom: 10 }
const btnVerMais: React.CSSProperties = { background: 'none', border: 'none', color: '#ff8a3d', fontSize: 12, cursor: 'pointer', padding: '6px 0 0 28px' }
const previewBanner: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(135deg, #fff, #ffe9da)' }
const caixaUpload: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, border: '2px dashed #333', borderRadius: 12, marginBottom: 14, cursor: 'pointer', background: '#0f0f0f', color: '#ccc', fontSize: 15, fontWeight: 600 }
const cartaoFoto: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: 10 }
const seletor: React.CSSProperties = { width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #2a2a2a', background: '#151515', color: 'white', fontSize: 14, boxSizing: 'border-box' }
const btnRemover: React.CSSProperties = { background: '#2a0d0d', border: '1px solid #5a1a1a', color: '#ff6b6b', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', flexShrink: 0 }
