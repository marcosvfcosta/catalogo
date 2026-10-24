import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { ajustarFoto } from '../lib/ajustarFoto'
import { ajustarLogo } from '../lib/ajustarLogo'

// Aba "🏷 Vitrine" do Admin: categorias (com foto) e marcas (com logo) do catálogo

export type Categoria = { id: string; nome: string; foto_url: string | null; ordem: number; ativo: boolean; tipo: string }
export type Marca = { id: string; nome: string; logo_url: string | null; ordem: number; ativo: boolean }

type ProdutoBase = { categoria: string; marca: string }
type Props = { produtos: ProdutoBase[]; aoMudar: () => void }

type Edicao = {
  id: string | null
  nome: string
  nomeAntigo: string
  url: string | null
  ativo: boolean
  tipo: string
}

const semAcento = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function VitrineAdmin({ produtos, aoMudar }: Props) {
  const [modo, setModo] = useState<'categorias' | 'marcas'>('categorias')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [ed, setEd] = useState<Edicao | null>(null)
  const [arquivoOriginal, setArquivoOriginal] = useState<File | null>(null)
  const [arquivoAjustado, setArquivoAjustado] = useState<File | null>(null)
  const [previaOriginal, setPreviaOriginal] = useState('')
  const [previaAjustada, setPreviaAjustada] = useState('')
  const [usarOriginal, setUsarOriginal] = useState(false)
  const [ajustar, setAjustar] = useState(true)
  const [manterCores, setManterCores] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [c, m] = await Promise.all([
      supabase.from('catalogo_categorias').select('*').order('ordem'),
      supabase.from('catalogo_marcas').select('*').order('ordem'),
    ])
    setCategorias((c.data || []) as Categoria[])
    setMarcas((m.data || []) as Marca[])
  }

  const ehMarca = modo === 'marcas'
  const lista = (ehMarca ? marcas : categorias) as (Categoria | Marca)[]
  const urlDe = (x: Categoria | Marca) => ('logo_url' in x ? x.logo_url : x.foto_url)

  function contar(nome: string) {
    return ehMarca
      ? produtos.filter(p => semAcento(p.marca) === semAcento(nome)).length
      : produtos.filter(p => p.categoria === nome).length
  }

  function limparArquivos() {
    setArquivoOriginal(null); setArquivoAjustado(null); setPreviaOriginal(''); setPreviaAjustada(''); setUsarOriginal(false)
  }

  function abrir(x: Categoria | Marca | null) {
    limparArquivos()
    setManterCores(false)
    if (!x) { setEd({ id: null, nome: '', nomeAntigo: '', url: null, ativo: true, tipo: 'produtos' }); return }
    setEd({ id: x.id, nome: x.nome, nomeAntigo: x.nome, url: urlDe(x), ativo: x.ativo, tipo: 'tipo' in x ? x.tipo : 'produtos' })
  }

  async function processar(arquivo: File, cores = manterCores, auto = ajustar) {
    setProcessando(true)
    setArquivoOriginal(arquivo)
    setPreviaOriginal(URL.createObjectURL(arquivo))
    let final = arquivo
    if (auto) final = ehMarca ? (await ajustarLogo(arquivo, cores)).arquivo : (await ajustarFoto(arquivo)).arquivo
    setArquivoAjustado(final)
    setPreviaAjustada(URL.createObjectURL(final))
    setUsarOriginal(false)
    setProcessando(false)
  }

  async function salvar() {
    if (!ed) return
    const nome = ed.nome.trim()
    if (!nome) { alert('Digite o nome'); return }
    const tabela = ehMarca ? 'catalogo_marcas' : 'catalogo_categorias'
    const repetido = lista.some(x => x.id !== ed.id && semAcento(x.nome) === semAcento(nome))
    if (repetido) { alert('Já existe com esse nome'); return }
    setSalvando(true)
    try {
      let url = ed.url
      const arquivo = usarOriginal ? arquivoOriginal : arquivoAjustado
      if (arquivo) {
        const ext = (arquivo.name.split('.').pop() || 'png').toLowerCase()
        const caminho = `${ehMarca ? 'logo' : 'categoria'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`
        const bucket = ehMarca ? 'marcas' : 'categorias'
        const up = await supabase.storage.from(bucket).upload(caminho, arquivo, { upsert: true, contentType: arquivo.type || 'image/png' })
        if (up.error) throw up.error
        url = supabase.storage.from(bucket).getPublicUrl(caminho).data.publicUrl
      }
      const campos = ehMarca
        ? { nome, logo_url: url, ativo: ed.ativo }
        : { nome, foto_url: url, ativo: ed.ativo, tipo: ed.tipo }
      if (ed.id) {
        const { error } = await supabase.from(tabela).update(campos).eq('id', ed.id)
        if (error) throw error
        // Renomeou? Leva os produtos junto
        if (ed.nomeAntigo && ed.nomeAntigo !== nome) {
          const coluna = ehMarca ? 'marca' : 'categoria'
          const qtd = contar(ed.nomeAntigo)
          if (qtd > 0 && confirm(`Mudar também os ${qtd} produto(s) de "${ed.nomeAntigo}" para "${nome}"?`)) {
            await supabase.from('produtos_catalogo').update({ [coluna]: nome }).eq(coluna, ed.nomeAntigo)
          }
        }
      } else {
        const ordem = Math.max(0, ...lista.map(x => x.ordem || 0)) + 1
        const { error } = await supabase.from(tabela).insert([{ ...campos, ordem }])
        if (error) throw error
      }
      setEd(null); limparArquivos()
      await carregar(); aoMudar()
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar. Tente de novo.')
    }
    setSalvando(false)
  }

  async function excluir() {
    if (!ed?.id) return
    const qtd = contar(ed.nomeAntigo)
    const aviso = qtd > 0 ? `\n\nAtenção: ${qtd} produto(s) usam "${ed.nomeAntigo}". Eles continuam cadastrados.` : ''
    if (!confirm(`Excluir "${ed.nomeAntigo}"?${aviso}`)) return
    await supabase.from(ehMarca ? 'catalogo_marcas' : 'catalogo_categorias').delete().eq('id', ed.id)
    setEd(null); limparArquivos()
    await carregar(); aoMudar()
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    const a = lista[i], b = lista[j]
    const tabela = ehMarca ? 'catalogo_marcas' : 'catalogo_categorias'
    const oa = a.ordem === b.ordem ? i : a.ordem
    const ob = a.ordem === b.ordem ? j : b.ordem
    await Promise.all([
      supabase.from(tabela).update({ ordem: ob }).eq('id', a.id),
      supabase.from(tabela).update({ ordem: oa }).eq('id', b.id),
    ])
    await carregar(); aoMudar()
  }

  // ─── Tela de edição ───
  if (ed) {
    const previaAtual = usarOriginal ? previaOriginal : (previaAjustada || ed.url || '')
    return (
      <div style={conteudo}>
        <button style={btnVoltar} onClick={() => { setEd(null); limparArquivos() }}>← Voltar</button>
        <h2 style={titulo}>{ed.id ? '✏️ Editar' : '+ Nova'} {ehMarca ? 'marca' : 'categoria'}</h2>

        <label style={rotulo}>Nome</label>
        <input style={campo} value={ed.nome} placeholder={ehMarca ? 'Ex: Apple' : 'Ex: Carregadores'}
          onChange={e => setEd({ ...ed, nome: e.target.value })} />

        <label style={rotulo}>{ehMarca ? 'Logo' : 'Foto'}</label>
        {previaOriginal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ ...caixaPrevia, borderColor: usarOriginal ? '#25D366' : '#2a2a2a' }} onClick={() => setUsarOriginal(true)}>
              <div style={ehMarca ? fundoLogo : fundoFoto}><img src={previaOriginal} alt="" style={imgPrevia} /></div>
              <span style={{ color: usarOriginal ? '#25D366' : '#888' }}>{usarOriginal ? '✓ ' : ''}Original</span>
            </div>
            <span style={{ color: '#ff6600', fontWeight: 900, fontSize: 20 }}>→</span>
            <div style={{ ...caixaPrevia, borderColor: !usarOriginal ? '#25D366' : '#2a2a2a' }} onClick={() => setUsarOriginal(false)}>
              <div style={ehMarca ? fundoLogo : { ...fundoFoto, background: '#fff' }}>
                {processando ? <span style={{ color: '#888', fontSize: 12 }}>Ajustando...</span> : <img src={previaAjustada} alt="" style={imgPrevia} />}
              </div>
              <span style={{ color: !usarOriginal ? '#25D366' : '#888', fontWeight: 700 }}>{!usarOriginal ? '✓ ' : ''}Ajustada</span>
            </div>
          </div>
        ) : ed.url ? (
          <div style={{ ...(ehMarca ? fundoLogo : { ...fundoFoto, background: '#fff', width: 130, margin: '0 auto' }), marginBottom: 10 }}>
            <img src={ed.url} alt="" style={imgPrevia} />
          </div>
        ) : null}

        <label style={caixaUpload}>
          📸 {previaAtual ? 'Trocar' : 'Escolher'} {ehMarca ? 'logo' : 'foto'}
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) processar(f) }} />
        </label>

        <label style={check}>
          <input type="checkbox" checked={ajustar} style={caixinha}
            onChange={e => { setAjustar(e.target.checked); if (arquivoOriginal) processar(arquivoOriginal, manterCores, e.target.checked) }} />
          🪄 Ajustar automaticamente {ehMarca ? '(tira o fundo e padroniza)' : '(tira o fundo e centraliza)'}
        </label>
        {ehMarca && (
          <label style={check}>
            <input type="checkbox" checked={manterCores} style={caixinha}
              onChange={e => { setManterCores(e.target.checked); if (arquivoOriginal) processar(arquivoOriginal, e.target.checked) }} />
            Manter cores originais do logo
          </label>
        )}

        {!ehMarca && (
          <>
            <label style={rotulo}>Ao tocar no catálogo, abre</label>
            <select style={campo} value={ed.tipo} onChange={e => setEd({ ...ed, tipo: e.target.value })}>
              <option value="produtos">Produtos desta categoria</option>
              <option value="capas">Página de capinhas</option>
            </select>
          </>
        )}

        <label style={check}>
          <input type="checkbox" checked={ed.ativo} style={caixinha} onChange={e => setEd({ ...ed, ativo: e.target.checked })} />
          Mostrar no catálogo
        </label>

        <button style={{ ...btnLaranja, opacity: salvando || processando ? 0.5 : 1 }} disabled={salvando || processando} onClick={salvar}>
          {salvando ? 'Salvando...' : `💾 Salvar ${ehMarca ? 'marca' : 'categoria'}`}
        </button>
        {ed.id && <button style={btnExcluir} onClick={excluir}>🗑 Excluir {ehMarca ? 'marca' : 'categoria'}</button>}
      </div>
    )
  }

  // ─── Lista ───
  return (
    <div style={conteudo}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['categorias', 'marcas'] as const).map(m => (
          <button key={m} style={modo === m ? segAtivo : segInativo} onClick={() => setModo(m)}>
            {m === 'categorias' ? 'Categorias' : 'Marcas'}
          </button>
        ))}
      </div>
      <button style={btnLaranja} onClick={() => abrir(null)}>+ Nova {ehMarca ? 'marca' : 'categoria'}</button>

      {lista.length === 0 && (
        <p style={{ color: '#888', textAlign: 'center', padding: 30, fontSize: 14 }}>
          Nada cadastrado ainda. Rode o SQL de instalação para trazer {ehMarca ? 'as marcas' : 'as categorias'} atuais.
        </p>
      )}

      {lista.map((x, i) => {
        const url = urlDe(x)
        const qtd = contar(x.nome)
        const capas = 'tipo' in x && x.tipo === 'capas'
        return (
          <div key={x.id} style={{ ...linha, opacity: x.ativo ? 1 : 0.45 }}>
            {ehMarca ? (
              <div style={{ ...fundoLogo, flex: 1, height: 56 }}>
                {url ? <img src={url} alt={x.nome} style={{ maxHeight: 40, maxWidth: '80%', objectFit: 'contain' }} /> : <b style={{ color: '#1d1d1f' }}>{x.nome}</b>}
              </div>
            ) : (
              <>
                <div style={bolinha}>{url ? <img src={url} alt="" style={{ width: 42, height: 42, objectFit: 'contain' }} /> : '📦'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                    {x.nome} {capas && <span style={selo}>abre Capinhas</span>}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#888' }}>
                    {!x.ativo ? 'escondida do catálogo' : capas ? 'página de capinhas' : `${qtd} produto${qtd === 1 ? '' : 's'}`}
                  </p>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 5 }}>
              <button style={btnIcone} onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
              <button style={btnIcone} onClick={() => mover(i, 1)} disabled={i === lista.length - 1}>↓</button>
              <button style={btnIcone} onClick={() => abrir(x)}>✏️</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Estilos ───
const conteudo: React.CSSProperties = { padding: '20px 16px', boxSizing: 'border-box', width: '100%' }
const titulo: React.CSSProperties = { color: '#ff6600', fontSize: 20, fontWeight: 800, margin: '0 0 16px' }
const rotulo: React.CSSProperties = { color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }
const campo: React.CSSProperties = { width: '100%', padding: '12px 14px', marginBottom: 14, borderRadius: 10, border: '1px solid #2a2a2a', background: '#0f0f0f', color: 'white', fontSize: 16, outline: 'none', boxSizing: 'border-box' }
const btnLaranja: React.CSSProperties = { width: '100%', padding: 15, borderRadius: 12, border: 'none', background: '#ff6600', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 14 }
const btnExcluir: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: 'none', background: 'none', color: '#ff4444', fontSize: 14, cursor: 'pointer' }
const btnVoltar: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#ccc', fontSize: 13, cursor: 'pointer', marginBottom: 16 }
const segAtivo: React.CSSProperties = { flex: 1, padding: '11px 8px', borderRadius: 10, border: '1px solid #ff6600', background: 'rgba(255,102,0,0.15)', color: '#ff6600', fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const segInativo: React.CSSProperties = { flex: 1, padding: '11px 8px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0f0f0f', color: '#888', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 14, padding: '9px 10px', marginBottom: 9, color: 'white' }
const bolinha: React.CSSProperties = { width: 54, height: 54, borderRadius: '50%', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }
const btnIcone: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, background: '#151515', border: '1px solid #2a2a2a', color: '#aaa', fontSize: 14, cursor: 'pointer' }
const selo: React.CSSProperties = { background: 'rgba(255,102,0,0.15)', color: '#ff8a3d', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700, marginLeft: 4 }
const caixaPrevia: React.CSSProperties = { flex: 1, background: '#151515', border: '2px solid #2a2a2a', borderRadius: 12, padding: 8, textAlign: 'center', fontSize: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }
const fundoFoto: React.CSSProperties = { width: '100%', aspectRatio: '1 / 1', background: '#f5f5f7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
const fundoLogo: React.CSSProperties = { width: '100%', height: 90, background: '#f5f5f7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
const imgPrevia: React.CSSProperties = { maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }
const caixaUpload: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, border: '2px dashed #333', borderRadius: 12, marginBottom: 12, cursor: 'pointer', background: '#0f0f0f', color: '#ccc', fontSize: 15, fontWeight: 600 }
const check: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 14, color: '#ccc', cursor: 'pointer' }
const caixinha: React.CSSProperties = { accentColor: '#25D366', width: 18, height: 18 }
