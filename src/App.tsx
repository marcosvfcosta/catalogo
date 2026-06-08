import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import './App.css'

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

const categorias = [
  { nome: 'Celulares',    img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/categorias/celulares.png' },
  { nome: 'Tablet',       img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/categorias/tablet.png' },
  { nome: 'Carregadores', img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/categorias/carregadores%20(1).png' },
  { nome: 'Fones',        img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/categorias/fones.png' },
  { nome: 'Smartwatch',   img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/categorias/smartwatch%20(1).png' },
  { nome: 'Caixa de som', img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/categorias/caixasom%20(1).png' },
]

const marcas = [
  { nome: 'Apple',    img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/marcas/apple.png' },
  { nome: 'Samsung',  img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/marcas/samsung.png' },
  { nome: 'Xiaomi',   img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/marcas/xiaomi%20(1).png' },
  { nome: 'Motorola', img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/marcas/motorola.png' },
  { nome: 'Realme',   img: 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/marcas/realme%20(2).png' },
]

type FiltroEspecial = 'destaques' | 'lancamentos' | 'promocoes' | 'mais_procurados' | null

function App() {
  const navigate = useNavigate()
  const [tela, setTela] = useState<'catalogo' | 'admin'>('catalogo')
  const [menuAberto, setMenuAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  const [marcaAtiva, setMarcaAtiva] = useState<string | null>(null)
  const [filtroEspecial, setFiltroEspecial] = useState<FiltroEspecial>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroFade, setHeroFade] = useState(true)
  const [heroImagens, setHeroImagens] = useState<HeroImagem[]>([])
  const [uploadandoHero, setUploadandoHero] = useState(false)
  const [fotosExtras, setFotosExtras] = useState<string[]>([])
  const [fotoIndex, setFotoIndex] = useState(0)
  const carrosselRef = useRef<HTMLDivElement>(null)

  const [novoProduto, setNovoProduto] = useState({
    categoria: 'Celulares', marca: '', modelo: '', memoria: '', cor: '',
    condicao: '', bateria_saude: '', preco: '', foto_url: '', descricao: '',
    disponivel: true, destaque: false, lancamento: false, promocao: false, mais_procurado: false,
  })

  useEffect(() => {
    carregarProdutos()
    carregarHeroImagens()
  }, [])

  // Carrossel do hero
  useEffect(() => {
    const ativas = heroImagens.filter(h => h.ativo)
    if (ativas.length === 0) return
    const intervalo = setInterval(() => {
      setHeroFade(false)
      setTimeout(() => {
        setHeroIndex((i) => (i + 1) % ativas.length)
        setHeroFade(true)
      }, 400)
    }, 6000)
    return () => clearInterval(intervalo)
  }, [heroImagens])

  useEffect(() => {
    const el = carrosselRef.current
    if (!el) return
    const intervalo = setInterval(() => {
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: 193, behavior: 'smooth' })
      }
    }, 2500)
    return () => clearInterval(intervalo)
  }, [produtos])

  async function carregarProdutos() {
    const { data, error } = await supabase.from('produtos_catalogo').select('*').order('created_at', { ascending: false })
    if (error) { alert('Erro ao carregar produtos'); return }
    setProdutos(data || [])
  }

  async function carregarHeroImagens() {
    const { data } = await supabase.from('hero_imagens').select('*').order('ordem', { ascending: true })
    setHeroImagens(data || [])
  }

  async function carregarFotosExtras(produtoId: string) {
    const { data } = await supabase.from("produto_fotos").select("*").eq("produto_id", produtoId).order("ordem")
    setFotosExtras((data || []).map((f: any) => f.url))
    setFotoIndex(0)
  }

  async function uploadHeroImagem(file: File) {
    setUploadandoHero(true)
    try {
      const nomeArquivo = `hero_${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('hero')
        .upload(nomeArquivo, file, { contentType: file.type, upsert: true })

      if (uploadError) { alert('Erro ao fazer upload'); return }

      const url = `https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/hero/${nomeArquivo}`
      const ordem = heroImagens.length + 1

      const { error: dbError } = await supabase.from('hero_imagens').insert([{ url, ordem, ativo: true }])
      if (dbError) { alert('Erro ao salvar no banco'); return }

      carregarHeroImagens()
    } finally {
      setUploadandoHero(false)
    }
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
    setHeroIndex(0)
    carregarHeroImagens()
  }

  async function salvarProduto() {
    if (!novoProduto.marca || !novoProduto.modelo || !novoProduto.categoria) {
      alert('Preencha categoria, marca e modelo.'); return
    }
    const { error } = await supabase.from('produtos_catalogo').insert([{
      categoria: novoProduto.categoria, marca: novoProduto.marca, modelo: novoProduto.modelo,
      memoria: novoProduto.memoria, cor: novoProduto.cor, condicao: novoProduto.condicao,
      bateria_saude: novoProduto.bateria_saude, preco: novoProduto.preco ? Number(novoProduto.preco) : null,
      foto_url: novoProduto.foto_url, descricao: novoProduto.descricao, disponivel: novoProduto.disponivel,
      destaque: novoProduto.destaque, lancamento: novoProduto.lancamento,
      promocao: novoProduto.promocao, mais_procurado: novoProduto.mais_procurado,
    }])
    if (error) { alert('Erro ao salvar produto'); return }
    alert('Produto cadastrado com sucesso!')
    setNovoProduto({ categoria: 'Celulares', marca: '', modelo: '', memoria: '', cor: '', condicao: '', bateria_saude: '', preco: '', foto_url: '', descricao: '', disponivel: true, destaque: false, lancamento: false, promocao: false, mais_procurado: false })
    carregarProdutos()
  }

  async function excluirProduto(id: string) {
    if (!confirm('Deseja excluir este produto?')) return
    await supabase.from('produtos_catalogo').delete().eq('id', id)
    carregarProdutos()
  }

  function ativarFiltroEspecial(f: FiltroEspecial) {
    setFiltroEspecial(filtroEspecial === f ? null : f)
    setCategoriaAtiva(null)
    setMarcaAtiva(null)
    setMenuAberto(false)
  }

  const produtosFiltrados = produtos.filter((p) => {
    const buscaOk = `${p.modelo} ${p.marca} ${p.categoria}`.toLowerCase().includes(busca.toLowerCase())
    const categoriaOk = categoriaAtiva ? p.categoria === categoriaAtiva : true
    const marcaOk = marcaAtiva ? p.marca === marcaAtiva : true
    const especialOk = filtroEspecial === 'destaques' ? p.destaque :
                       filtroEspecial === 'lancamentos' ? p.lancamento :
                       filtroEspecial === 'promocoes' ? p.promocao :
                       filtroEspecial === 'mais_procurados' ? p.mais_procurado : true
    return buscaOk && categoriaOk && marcaOk && especialOk
  })

  function tituloSecao() {
    if (filtroEspecial === 'destaques') return '☆ Destaques'
    if (filtroEspecial === 'lancamentos') return '🚀 Lançamentos'
    if (filtroEspecial === 'promocoes') return '🏷 Promoções'
    if (filtroEspecial === 'mais_procurados') return '🔥 Mais Procurados'
    if (categoriaAtiva || marcaAtiva) return `${categoriaAtiva || marcaAtiva}`
    return 'Destaque da Semana'
  }

  function abrirWhatsApp(produto?: Produto) {
    const texto = produto
      ? `Olá! Tenho interesse no ${produto.modelo} ${produto.memoria || ''} que vi no catálogo da Marcos Magazine.`
      : 'Olá! Vim pelo catálogo da Marcos Magazine e gostaria de mais informações.'
    window.open(`https://wa.me/5564993374281?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const heroAtivas = heroImagens.filter(h => h.ativo)

  // ─── DETALHE DO PRODUTO ───────────────────────
  if (produtoSelecionado) {
    const todasFotos = [
      ...(produtoSelecionado.foto_url ? [produtoSelecionado.foto_url] : []),
      ...fotosExtras,
    ]
    return (
      <div style={detalheStyles.page}>
        <button style={detalheStyles.backBtn} onClick={() => { setProdutoSelecionado(null); setFotosExtras([]); setFotoIndex(0) }}>← Voltar</button>
        <div style={detalheStyles.card}>
          <div style={detalheStyles.fotoWrap}>
            {todasFotos.length > 0
              ? <img src={todasFotos[fotoIndex]} alt={produtoSelecionado.modelo} style={detalheStyles.foto} />
              : <div style={detalheStyles.fotoPlaceholder}>{produtoSelecionado.marca}</div>}
          </div>
          {todasFotos.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
              {todasFotos.map((_, i) => (
                <button key={i} onClick={() => setFotoIndex(i)} style={{
                  width: i === fotoIndex ? 20 : 8, height: 8, borderRadius: 4,
                  border: 'none', background: i === fotoIndex ? '#ff6600' : '#333',
                  cursor: 'pointer', padding: 0, transition: 'all 0.3s ease',
                }} />
              ))}
            </div>
          )}
          <p style={detalheStyles.marca}>{produtoSelecionado.marca}</p>
          <h1 style={detalheStyles.modelo}>{produtoSelecionado.modelo}</h1>
          <div style={detalheStyles.specsGrid}>
            {produtoSelecionado.memoria && (<div style={detalheStyles.specItem}><span style={detalheStyles.specIcon}>💾</span><span style={detalheStyles.specLabel}>Memória</span><span style={detalheStyles.specValor}>{produtoSelecionado.memoria}</span></div>)}
            {produtoSelecionado.cor && (<div style={detalheStyles.specItem}><span style={detalheStyles.specIcon}>🎨</span><span style={detalheStyles.specLabel}>Cor</span><span style={detalheStyles.specValor}>{produtoSelecionado.cor}</span></div>)}
            {produtoSelecionado.condicao && (<div style={detalheStyles.specItem}><span style={detalheStyles.specIcon}>✅</span><span style={detalheStyles.specLabel}>Condição</span><span style={detalheStyles.specValor}>{produtoSelecionado.condicao}</span></div>)}
            {produtoSelecionado.bateria_saude && (<div style={detalheStyles.specItem}><span style={detalheStyles.specIcon}>🔋</span><span style={detalheStyles.specLabel}>Bateria</span><span style={detalheStyles.specValor}>{produtoSelecionado.bateria_saude}</span></div>)}
          </div>
          {produtoSelecionado.descricao && <p style={detalheStyles.descricao}>{produtoSelecionado.descricao}</p>}
          <button style={detalheStyles.whatsappBtn} onClick={() => abrirWhatsApp(produtoSelecionado)}>💬 Tenho interesse</button>
        </div>
      </div>
    )
  }

  // ─── TELA ADMIN ───────────────────────────────
  if (tela === 'admin') {
    return (
      <div className="page" style={{ padding: 30 }}>
        <button className="backButton" onClick={() => setTela('catalogo')}>← Voltar para catálogo</button>
        <h1 style={{ color: '#ff6600', marginBottom: 25, fontFamily: 'Nunito, sans-serif' }}>Admin — Marcos Magazine</h1>

        {/* Seção Hero */}
        <div style={{ ...adminCard, marginBottom: 25 }}>
          <h2 style={{ marginBottom: 16, color: '#fff' }}>🖼 Fotos do Hero</h2>

          {/* Upload */}
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: '#ff6600', color: 'white', padding: '12px 20px', borderRadius: 10,
            cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 20, width: '100%', boxSizing: 'border-box'
          }}>
            {uploadandoHero ? '⏳ Enviando...' : '📸 Adicionar foto ao Hero'}
            <input
              type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) uploadHeroImagem(e.target.files[0]) }}
            />
          </label>

          {/* Lista de fotos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {heroImagens.map((img) => (
              <div key={img.id} style={{
                background: '#0a0a0a', border: `1px solid ${img.ativo ? '#ff6600' : '#222'}`,
                borderRadius: 12, overflow: 'hidden', position: 'relative'
              }}>
                <img src={img.url} alt="hero" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '8px 6px', display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => toggleHeroImagem(img.id, img.ativo)}
                    style={{ flex: 1, padding: '5px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: img.ativo ? '#1a4a1a' : '#2a2a2a', color: img.ativo ? '#25D366' : '#888' }}
                  >
                    {img.ativo ? '● Ativo' : '○ Inativo'}
                  </button>
                  <button
                    onClick={() => excluirHeroImagem(img.id, img.url)}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #ff3333', background: '#7a1111', color: '#fff', cursor: 'pointer', fontSize: 11 }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
            {heroImagens.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nenhuma foto cadastrada ainda.</p>}
          </div>
        </div>

        <div style={adminGrid}>
          <div style={adminCard}>
            <h2 style={{ marginBottom: 20 }}>Cadastrar produto</h2>
            <select style={adminInput} value={novoProduto.categoria} onChange={(e) => setNovoProduto({ ...novoProduto, categoria: e.target.value })}>
              <option>Celulares</option><option>Tablet</option><option>Carregadores</option>
              <option>Fones</option><option>Smartwatch</option><option>Caixa de som</option>
            </select>
            <input style={adminInput} placeholder="Marca. Ex: Apple" value={novoProduto.marca} onChange={(e) => setNovoProduto({ ...novoProduto, marca: e.target.value })} />
            <input style={adminInput} placeholder="Modelo. Ex: iPhone 15 Pro Max" value={novoProduto.modelo} onChange={(e) => setNovoProduto({ ...novoProduto, modelo: e.target.value })} />
            <input style={adminInput} placeholder="Memória. Ex: 256GB" value={novoProduto.memoria} onChange={(e) => setNovoProduto({ ...novoProduto, memoria: e.target.value })} />
            <input style={adminInput} placeholder="Cor. Ex: Preto" value={novoProduto.cor} onChange={(e) => setNovoProduto({ ...novoProduto, cor: e.target.value })} />
            <input style={adminInput} placeholder="Condição. Ex: Novo ou Seminovo" value={novoProduto.condicao} onChange={(e) => setNovoProduto({ ...novoProduto, condicao: e.target.value })} />
            <input style={adminInput} placeholder="Saúde da bateria. Ex: 89%" value={novoProduto.bateria_saude} onChange={(e) => setNovoProduto({ ...novoProduto, bateria_saude: e.target.value })} />
            <input style={adminInput} placeholder="Preço interno. Ex: 2999" value={novoProduto.preco} onChange={(e) => setNovoProduto({ ...novoProduto, preco: e.target.value })} />
            <input style={adminInput} placeholder="URL da foto" value={novoProduto.foto_url} onChange={(e) => setNovoProduto({ ...novoProduto, foto_url: e.target.value })} />
            <textarea style={{ ...adminInput, height: 90 }} placeholder="Descrição" value={novoProduto.descricao} onChange={(e) => setNovoProduto({ ...novoProduto, descricao: e.target.value })} />
            <div style={checkboxGroup}>
              <p style={checkboxTitle}>Tags do produto:</p>
              <label style={checkboxLabel}><input type="checkbox" checked={novoProduto.disponivel} onChange={(e) => setNovoProduto({ ...novoProduto, disponivel: e.target.checked })} />✅ Disponível no catálogo</label>
              <label style={checkboxLabel}><input type="checkbox" checked={novoProduto.destaque} onChange={(e) => setNovoProduto({ ...novoProduto, destaque: e.target.checked })} />☆ Destaque</label>
              <label style={checkboxLabel}><input type="checkbox" checked={novoProduto.lancamento} onChange={(e) => setNovoProduto({ ...novoProduto, lancamento: e.target.checked })} />🚀 Lançamento</label>
              <label style={checkboxLabel}><input type="checkbox" checked={novoProduto.promocao} onChange={(e) => setNovoProduto({ ...novoProduto, promocao: e.target.checked })} />🏷 Promoção</label>
              <label style={checkboxLabel}><input type="checkbox" checked={novoProduto.mais_procurado} onChange={(e) => setNovoProduto({ ...novoProduto, mais_procurado: e.target.checked })} />🔥 Mais Procurado</label>
            </div>
            <button style={adminButton} onClick={salvarProduto}>Salvar produto</button>
          </div>
          <div style={adminCard}>
            <h2 style={{ marginBottom: 20 }}>Produtos cadastrados ({produtos.length})</h2>
            {produtos.length === 0 ? <p style={{ color: '#666' }}>Nenhum produto cadastrado ainda.</p> : (
              produtos.map((produto) => (
                <div key={produto.id} style={adminProduct}>
                  <div>
                    <strong>{produto.marca} {produto.modelo}</strong>
                    <p style={{ color: '#aaa', fontSize: 13 }}>{produto.categoria} {produto.memoria ? '| ' + produto.memoria : ''}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      <span style={{ color: produto.disponivel ? '#25D366' : '#ff4444', fontSize: 11 }}>{produto.disponivel ? '● Disponível' : '● Indisponível'}</span>
                      {produto.destaque && <span style={tag}>☆ Destaque</span>}
                      {produto.lancamento && <span style={tag}>🚀 Lançamento</span>}
                      {produto.promocao && <span style={tag}>🏷 Promoção</span>}
                      {produto.mais_procurado && <span style={tag}>🔥 Mais Procurado</span>}
                    </div>
                  </div>
                  <button style={deleteButton} onClick={() => excluirProduto(produto.id)}>Excluir</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── CATÁLOGO PRINCIPAL ───────────────────────
  return (
    <div className="page">
      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)} />}
      <aside className={menuAberto ? 'sidebar open' : 'sidebar'}>
        <div className="sideLogo"><strong>Marcos</strong><span>Magazine</span></div>
        <nav>
          <p className={!filtroEspecial && !categoriaAtiva && !marcaAtiva ? 'active' : ''} onClick={() => { setFiltroEspecial(null); setCategoriaAtiva(null); setMarcaAtiva(null); setMenuAberto(false) }}>⌂ Início</p>
          <p onClick={() => { setMenuAberto(false); navigate('/comparar') }}>⚖ Comparar Celulares</p>
          <p className={filtroEspecial === 'destaques' ? 'active' : ''} onClick={() => ativarFiltroEspecial('destaques')}>☆ Destaques</p>
          <p className={filtroEspecial === 'lancamentos' ? 'active' : ''} onClick={() => ativarFiltroEspecial('lancamentos')}>🚀 Lançamentos</p>
          <p className={filtroEspecial === 'promocoes' ? 'active' : ''} onClick={() => ativarFiltroEspecial('promocoes')}>🏷 Promoções</p>
          <p className={filtroEspecial === 'mais_procurados' ? 'active' : ''} onClick={() => ativarFiltroEspecial('mais_procurados')}>🔥 Mais Procurados</p>
          <p onClick={() => window.open('https://www.google.com/maps/search/Avenida+Goiás+686+Centro+Bom+Jesus+de+Goiás+GO', '_blank')}>📍 Localização</p>
          <p onClick={() => window.open('https://www.instagram.com/marcosmagazinee', '_blank')}>📷 Instagram</p>
          <p onClick={() => abrirWhatsApp()}>📞 WhatsApp</p>
        </nav>
      </aside>

      <main className="main">
        <header className="top">
          <button className="hamburger" onClick={() => setMenuAberto(!menuAberto)}>☰</button>
          <div className="mainLogo"><strong>Marcos</strong><span>Magazine</span></div>
          <div className="search">
            <input placeholder="Buscar produtos..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span>🔍</span>
          </div>
        </header>

        {/* Hero com carrossel */}
        <section className="hero">
          <div className="heroText">
            <h1>
              <span className="thin">Os melhores</span>
              <span>celulares</span>
              <span>e acessórios</span>
            </h1>
            <p>Você só encontra aqui!</p>
          </div>
          <div className="heroPhones">
            {heroAtivas.length > 0 && (
              <img
                src={heroAtivas[heroIndex % heroAtivas.length]?.url}
                alt="celular"
                style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: heroFade ? 1 : 0, transition: 'opacity 0.4s ease' }}
              />
            )}
          </div>
        </section>

        {/* Pontinhos do carrossel */}
        {heroAtivas.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '10px 0 4px' }}>
            {heroAtivas.map((_, i) => (
              <button
                key={i}
                onClick={() => { setHeroFade(false); setTimeout(() => { setHeroIndex(i); setHeroFade(true) }, 400) }}
                style={{ width: i === heroIndex % heroAtivas.length ? 20 : 8, height: 8, borderRadius: 4, border: 'none', background: i === heroIndex % heroAtivas.length ? '#ff6600' : '#333', cursor: 'pointer', padding: 0, transition: 'all 0.3s ease' }}
              />
            ))}
          </div>
        )}

        <Section title="Categorias" />
        <section className="categories">
          {categorias.map(({ nome, img }) => (
            <div className={`categoryCard ${categoriaAtiva === nome ? 'ativo' : ''}`} key={nome}
              onClick={() => { setCategoriaAtiva(categoriaAtiva === nome ? null : nome); setMarcaAtiva(null); setFiltroEspecial(null) }}>
              <div className="categoryImgWrap"><img src={img} alt={nome} /></div>
              <p>{nome}</p>
            </div>
          ))}
        </section>

        <Section title="Marcas" />
        <section className="brands">
          {marcas.map(({ nome, img }) => (
            <div className={`brandCard ${marcaAtiva === nome ? 'ativo' : ''}`} key={nome}
              onClick={() => { setMarcaAtiva(marcaAtiva === nome ? null : nome); setCategoriaAtiva(null); setFiltroEspecial(null) }}>
              <img src={img} alt={nome} />
            </div>
          ))}
        </section>

        <Section title={tituloSecao()} />
        <section className="products" ref={carrosselRef}>
          {produtosFiltrados.length === 0 ? (
            <p style={{ color: '#666', padding: '0 30px 30px' }}>Nenhum produto encontrado.</p>
          ) : (
            produtosFiltrados.map((produto) => (
              <div className="productCard" key={produto.id} onClick={() => { setProdutoSelecionado(produto); carregarFotosExtras(produto.id) }}>
                {produto.foto_url ? <img src={produto.foto_url} alt={produto.modelo} /> : <div className="phonePlaceholder">{produto.marca}</div>}
                <h3>{produto.modelo}</h3>
                {produto.memoria && <p>{produto.memoria}</p>}
              </div>
            ))
          )}
        </section>

        <footer className="footer">
          <div><span>📞</span><strong>Contato</strong><p>(64) 99337-4281</p></div>
          <div><span>📍</span><strong>Localização</strong><p>Avenida Goiás n 686 sala 3, Centro Bom Jesus</p></div>
          <div>
            <span>🕐</span><strong>Horário de funcionamento</strong>
            <p>Segunda - sexta 08:00 às 18:00</p>
            <p>Sábados 08:00 às 12:30</p>
          </div>
        </footer>
      </main>
    </div>
  )
}

function Section({ title }: { title: string }) {
  return <h2 className="sectionTitle">{title}<span></span></h2>
}

const detalheStyles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'Poppins, sans-serif', padding: '20px 16px 60px' },
  backBtn: { background: '#ff6600', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 24, display: 'block' },
  card: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 20, padding: '24px 20px', textAlign: 'center', maxWidth: 480, margin: '0 auto' },
  fotoWrap: { width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 20 },
  foto: { width: '100%', maxWidth: 300, borderRadius: 16, objectFit: 'cover' },
  fotoPlaceholder: { width: 200, height: 200, background: 'linear-gradient(135deg, #222, #111)', borderRadius: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 16, fontWeight: 700, color: '#555' },
  marca: { color: '#ff6600', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 },
  modelo: { fontSize: 24, fontWeight: 900, fontFamily: 'Nunito, sans-serif', marginBottom: 24, color: 'white', lineHeight: 1.2 },
  specsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 },
  specItem: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  specIcon: { fontSize: 20 },
  specLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  specValor: { fontSize: 14, fontWeight: 700, color: 'white' },
  descricao: { fontSize: 14, color: '#aaa', lineHeight: 1.6, marginBottom: 24, textAlign: 'center' },
  whatsappBtn: { background: '#25D366', border: 'none', color: 'white', padding: '16px 32px', borderRadius: 14, cursor: 'pointer', fontSize: 17, fontWeight: 700, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
}

const adminGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 25 }
const adminCard = { background: '#111', border: '1px solid #222', borderRadius: 12, padding: 22 }
const adminInput: React.CSSProperties = { width: '100%', padding: 12, marginBottom: 12, borderRadius: 8, border: '1px solid #333', background: '#050505', color: '#fff', fontSize: 15 }
const adminButton: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#ff6600', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: 16 }
const adminProduct: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050505', border: '1px solid #222', padding: 12, borderRadius: 8, marginBottom: 10 }
const deleteButton: React.CSSProperties = { background: '#7a1111', color: '#fff', border: '1px solid #ff3333', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }
const checkboxGroup: React.CSSProperties = { background: '#0a0a0a', border: '1px solid #222', borderRadius: 10, padding: 16, marginBottom: 16 }
const checkboxTitle: React.CSSProperties = { color: '#ff6600', fontWeight: 700, fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }
const checkboxLabel: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, fontSize: 14, color: '#ccc', cursor: 'pointer' }
const tag: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#aaa' }

export default App