import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

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

const CORES_LISTA = ["Preto","Branco","Vermelho","Azul","Verde","Amarelo","Rosa","Roxo","Laranja","Cinza","Dourado","Prata","Titânio Natural","Titânio Preto","Titânio Branco","Titânio Deserto","Meia-Noite","Estelar","Azul-Sierra","Rosa-Claro","Verde-Água","Azul-Alpino","Verde-Floresta","Vermelho-Produto","Luz das Estrelas","Azul-Pacífico","Roxo-Profundo","Cobre","Bordô"]

const CORES_HEX: Record<string, string> = {
  "Preto": "#1a1a1a", "Branco": "#f5f5f5", "Vermelho": "#c0392b", "Azul": "#2980b9",
  "Verde": "#27ae60", "Amarelo": "#f1c40f", "Rosa": "#e91e8c", "Roxo": "#8e44ad",
  "Laranja": "#e67e22", "Cinza": "#7f8c8d", "Dourado": "#d4af37", "Prata": "#bdc3c7",
  "Titânio Natural": "#8a8272", "Titânio Preto": "#2d2926", "Titânio Branco": "#e8e4dc",
  "Titânio Deserto": "#c2a882", "Meia-Noite": "#1c2340", "Estelar": "#f0ece2",
  "Azul-Sierra": "#4a7fa5", "Rosa-Claro": "#f4a7b9", "Verde-Água": "#00b4d8",
  "Azul-Alpino": "#5b8db8", "Verde-Floresta": "#2d6a4f", "Vermelho-Produto": "#a4161a",
  "Luz das Estrelas": "#f8f4e8", "Azul-Pacífico": "#005f73", "Roxo-Profundo": "#4a0e5e",
  "Cobre": "#b87333", "Bordô": "#6d1a2a"
}

export default function Admin() {
  const navigate = useNavigate()
  const [logado, setLogado] = useState(false)
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aba, setAba] = useState<'cadastrar' | 'lista' | 'capas' | 'aparelhos' | 'hero'>('cadastrar')
  const [uploadando, setUploadando] = useState(false)
  const [uploadandoHero, setUploadandoHero] = useState(false)
  const [uploadandoFotos, setUploadandoFotos] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [heroImagens, setHeroImagens] = useState<HeroImagem[]>([])
  const [fotosNovas, setFotosNovas] = useState<string[]>([])
  const [fotosEdicao, setFotosEdicao] = useState<ProdutoFoto[]>([])

  const [aparelhos, setAparelhos] = useState<Aparelho[]>([])
  const [novoModelo, setNovoModelo] = useState('')
  const [coresSelecionadas, setCoresSelecionadas] = useState<string[]>([])
  const [fotosAparelho, setFotosAparelho] = useState<Record<string, string[]>>({})
  const [uploadandoFotoAp, setUploadandoFotoAp] = useState<string | null>(null)
  const [editandoAparelho, setEditandoAparelho] = useState<Aparelho | null>(null)
  const [salvandoAparelho, setSalvandoAparelho] = useState(false)

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
    if (logado) { carregarProdutos(); carregarHeroImagens(); carregarAparelhos(); carregarCapas() }
  }, [logado])

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

  async function enviarArquivoCapa(arquivo: File, prefixo: string) {
    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase()
    const nomeArquivo = `capas/${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true, contentType: arquivo.type })
    if (error) throw error
    return supabase.storage.from('fotos').getPublicUrl(nomeArquivo).data.publicUrl
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
    const { error } = capaEditandoId
      ? await supabase.from('capas_modelos').update(dados).eq('id', capaEditandoId)
      : await supabase.from('capas_modelos').insert([dados])
    setCapaSalvando(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    limparCapaForm()
    carregarCapas()
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

  async function uploadFotoPrincipal(arquivo: File) {
    setUploadando(true)
    const ext = arquivo.name.split('.').pop()
    const nomeArquivo = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload da foto'); setUploadando(false); return }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeArquivo)
    setNovoProduto(prev => ({ ...prev, foto_url: data.publicUrl }))
    setUploadando(false)
  }

  async function uploadFotoPrincipalEdicao(arquivo: File) {
    setUploadando(true)
    const ext = arquivo.name.split('.').pop()
    const nomeArquivo = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload da foto'); setUploadando(false); return }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeArquivo)
    setEditando(prev => prev ? { ...prev, foto_url: data.publicUrl } : null)
    setUploadando(false)
  }

  async function uploadFotoExtra(arquivo: File, produtoId?: string) {
    setUploadandoFotos(true)
    const ext = arquivo.name.split('.').pop()
    const nomeArquivo = `extra_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload'); setUploadandoFotos(false); return }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeArquivo)
    if (produtoId) {
      const ordem = fotosEdicao.length + 1
      await supabase.from('produto_fotos').insert([{ produto_id: produtoId, url: data.publicUrl, ordem }])
      carregarFotosEdicao(produtoId)
    } else {
      setFotosNovas(prev => [...prev, data.publicUrl])
    }
    setUploadandoFotos(false)
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

  function fazerLogin() {
    if (login === 'Admin' && senha === '1020') {
      setLogado(true); setErroLogin('')
    } else {
      setErroLogin('Login ou senha incorretos!')
    }
  }

  async function salvarProduto() {
    if (!novoProduto.marca || !novoProduto.modelo || !novoProduto.categoria) {
      alert('Preencha categoria, marca e modelo.'); return
    }
    const { data, error } = await supabase.from('produtos_catalogo').insert([{
      categoria: novoProduto.categoria, marca: novoProduto.marca, modelo: novoProduto.modelo,
      memoria: novoProduto.memoria, cor: novoProduto.cor, condicao: novoProduto.condicao,
      bateria_saude: novoProduto.bateria_saude, preco: novoProduto.preco ? Number(novoProduto.preco) : null,
      foto_url: novoProduto.foto_url, descricao: novoProduto.descricao, disponivel: novoProduto.disponivel,
      destaque: novoProduto.destaque, lancamento: novoProduto.lancamento,
      promocao: novoProduto.promocao, mais_procurado: novoProduto.mais_procurado,
    }]).select()
    if (error) { alert('Erro ao salvar produto'); return }
    if (data && data[0] && fotosNovas.length > 0) {
      const produtoId = data[0].id
      for (let i = 0; i < fotosNovas.length; i++) {
        await supabase.from('produto_fotos').insert([{ produto_id: produtoId, url: fotosNovas[i], ordem: i + 1 }])
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

  async function uploadFotoAparelho(cor: string, arquivo: File) {
    setUploadandoFotoAp(cor)
    const ext = arquivo.name.split('.').pop()
    const nomeArquivo = `ap_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro upload'); setUploadandoFotoAp(null); return }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeArquivo)
    if (editandoAparelho) {
      const fotosAtuais = editandoAparelho.fotos[cor] || []
      setEditandoAparelho({ ...editandoAparelho, fotos: { ...editandoAparelho.fotos, [cor]: [...fotosAtuais, data.publicUrl] } })
    } else {
      setFotosAparelho(prev => ({ ...prev, [cor]: [...(prev[cor] || []), data.publicUrl] }))
    }
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

  async function salvarAparelho() {
    const modelo = editandoAparelho ? editandoAparelho.modelo : novoModelo.trim()
    const cores = editandoAparelho ? editandoAparelho.cores : coresSelecionadas
    const fotos = editandoAparelho ? editandoAparelho.fotos : fotosAparelho
    if (!modelo) { alert('Informe o modelo'); return }
    if (cores.length === 0) { alert('Selecione ao menos uma cor'); return }
    setSalvandoAparelho(true)
    if (editandoAparelho) {
      await supabase.from('aparelhos').update({ modelo, cores, fotos }).eq('id', editandoAparelho.id)
      setEditandoAparelho(null)
    } else {
      await supabase.from('aparelhos').insert([{ modelo, cores, fotos }])
      setNovoModelo('')
      setCoresSelecionadas([])
      setFotosAparelho({})
    }
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

  if (!logado) {
    return (
      <div style={loginPage}>
        <div style={loginBox}>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={logoMarcas}>Marcos</span>
            <span style={logoMag}>Magazine</span>
          </div>
          <p style={loginSub}>Painel Administrativo</p>
          <input style={inputStyle} placeholder="Login" value={login} onChange={e => setLogin(e.target.value)} />
          <input style={inputStyle} placeholder="Senha" type="password" value={senha}
            onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          {erroLogin && <p style={{ color: '#ff4444', fontSize: 13, textAlign: 'center' }}>{erroLogin}</p>}
          <button style={btnLogin} onClick={fazerLogin}>Entrar</button>
          <button style={btnVoltar} onClick={() => navigate('/')}>← Voltar ao catálogo</button>
        </div>
      </div>
    )
  }

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
          <label style={labelStyle}>Foto principal</label>
          <label style={uploadBox}>
            {uploadando ? '⏳ Enviando...' : '📷 Trocar foto principal'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoPrincipalEdicao(f) }} />
          </label>
          {editando.foto_url && (
            <img src={editando.foto_url} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10, marginBottom: 12 }} />
          )}
          <label style={labelStyle}>Fotos extras</label>
          <label style={uploadBox}>
            {uploadandoFotos ? '⏳ Enviando...' : '📸 Adicionar foto extra'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoExtra(f, editando.id) }} />
          </label>
          {fotosEdicao.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {fotosEdicao.map(foto => (
                <div key={foto.id} style={{ position: 'relative' }}>
                  <img src={foto.url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  <button onClick={() => excluirFotoExtra(foto.id, editando.id)}
                    style={{ position: 'absolute', top: 2, right: 2, background: '#7a1111', border: 'none', color: 'white', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>✕</button>
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
          <button style={btnSecundario} onClick={() => setLogado(false)}>Sair</button>
        </div>
      </div>

      <div style={abasContainer}>
        <button style={aba === 'cadastrar' ? abaAtiva : abaInativa} onClick={() => setAba('cadastrar')}>+ Cadastrar</button>
        <button style={aba === 'lista' ? abaAtiva : abaInativa} onClick={() => setAba('lista')}>📦 ({produtos.length})</button>
        <button style={aba === 'capas' ? abaAtiva : abaInativa} onClick={() => { setAba('capas'); setCapaAberta(null) }}>📱 Capas</button>
        <button style={aba === 'aparelhos' ? abaAtiva : abaInativa} onClick={() => setAba('aparelhos')}>🤝</button>
        <button style={aba === 'hero' ? abaAtiva : abaInativa} onClick={() => setAba('hero')}>🖼 Hero</button>
      </div>

      {aba === 'cadastrar' && (
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
          <label style={labelStyle}>Foto principal</label>
          <label style={uploadBox}>
            {uploadando ? '⏳ Enviando foto...' : '📷 Foto principal'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoPrincipal(f) }} />
          </label>
          {novoProduto.foto_url && (
            <img src={novoProduto.foto_url} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10, marginBottom: 12 }} />
          )}
          <label style={labelStyle}>Fotos extras (opcional)</label>
          <label style={uploadBox}>
            {uploadandoFotos ? '⏳ Enviando...' : '📸 Adicionar foto extra'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoExtra(f) }} />
          </label>
          {fotosNovas.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {fotosNovas.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  <button onClick={() => excluirFotoNova(url)}
                    style={{ position: 'absolute', top: 2, right: 2, background: '#7a1111', border: 'none', color: 'white', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>✕</button>
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
          {produtos.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>Nenhum produto ainda.</p>
          ) : (
            produtos.map(p => (
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
            <label style={labelStyle}>Foto do celular (aparece na lista)</label>
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
                {capaSalvando ? '⏳ Salvando...' : capaEditandoId ? '✅ Salvar alteração' : '✅ Cadastrar modelo'}
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

          <label style={{ ...uploadBox, borderColor: '#ff6600', color: '#ff6600' }}>
            {capaEnviando
              ? `⏳ Enviando ${capaEnviando.feitas} de ${capaEnviando.total}...`
              : `＋ Adicionar fotos em "${capaTipo}"`}
            <span style={{ color: '#777', fontSize: 12 }}>Pode escolher várias de uma vez</span>
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
              {CORES_LISTA.map(cor => {
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
                {coresAtivas.map(cor => (
                  <div key={cor} style={{ marginBottom: 14, background: '#111', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: CORES_HEX[cor], border: '1px solid #333', flexShrink: 0 }} />
                      <span style={{ color: '#ccc', fontSize: 13, fontWeight: 600 }}>{cor}</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1a1a1a', border: '1px dashed #333', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#aaa', fontSize: 12, marginBottom: 6 }}>
                      {uploadandoFotoAp === cor ? '⏳ Enviando...' : '📷 Adicionar foto'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoAparelho(cor, f) }} />
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSalvar} onClick={salvarAparelho} disabled={salvandoAparelho}>
                {salvandoAparelho ? '⏳ Salvando...' : '✅ Salvar aparelho'}
              </button>
              {editandoAparelho && (
                <button style={{ ...btnSecundario, padding: '14px 16px' }} onClick={() => setEditandoAparelho(null)}>Cancelar</button>
              )}
            </div>
          </div>
          <h3 style={{ color: '#aaa', fontSize: 14, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Cadastrados ({aparelhos.length})
          </h3>
          {aparelhos.length === 0 ? (
            <p style={{ color: '#555', textAlign: 'center', padding: 30 }}>Nenhum aparelho cadastrado.</p>
          ) : (
            aparelhos.map(ap => (
              <div key={ap.id} style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 6 }}>{ap.modelo}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(ap.cores || []).map(cor => (
                      <div key={cor} title={cor} style={{ width: 20, height: 20, borderRadius: '50%', background: CORES_HEX[cor] || '#555', border: '1px solid #333' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button style={btnEditar} onClick={() => { setEditandoAparelho(ap); window.scrollTo(0, 0) }}>✏️</button>
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
                  <img src={img.url} alt="hero" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
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

const loginPage: React.CSSProperties = { minHeight: '100vh', background: '#050505', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, overflowX: 'hidden' }
const loginBox: React.CSSProperties = { background: '#0f0f0f', border: '1px solid #222', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }
const logoMarcas: React.CSSProperties = { color: '#ff6600', fontSize: 32, fontWeight: 900, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'center' }
const logoMag: React.CSSProperties = { color: '#ff6600', fontSize: 16, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'center', marginTop: -6, opacity: 0.85 }
const loginSub: React.CSSProperties = { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }
const btnLogin: React.CSSProperties = { background: '#ff6600', color: 'white', border: 'none', borderRadius: 10, padding: '14px', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4 }
const btnVoltar: React.CSSProperties = { background: 'none', color: '#666', border: '1px solid #222', borderRadius: 10, padding: '12px', fontSize: 14, cursor: 'pointer' }
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
const tagStyle: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#aaa' }