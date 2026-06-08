import { useEffect, useState, useRef } from 'react'
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

function formatarPreco(preco?: number) {
  if (!preco) return null
  return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function Loja() {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  const [marcaAtiva, setMarcaAtiva] = useState<string | null>(null)
  const [filtroEspecial, setFiltroEspecial] = useState<FiltroEspecial>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroFade, setHeroFade] = useState(true)
  const [heroImagens, setHeroImagens] = useState<HeroImagem[]>([])
  const [fotosExtras, setFotosExtras] = useState<string[]>([])
  const [fotoIndex, setFotoIndex] = useState(0)
  const carrosselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregarProdutos()
    carregarHeroImagens()
  }, [])

  useEffect(() => {
    const ativas = heroImagens.filter(h => h.ativo)
    if (ativas.length === 0) return
    const intervalo = setInterval(() => {
      setHeroFade(false)
      setTimeout(() => {
        setHeroIndex(i => (i + 1) % ativas.length)
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
    const { data } = await supabase
      .from('produtos_catalogo')
      .select('*')
      .eq('disponivel', true)
      .order('created_at', { ascending: false })
    setProdutos(data || [])
  }

  async function carregarHeroImagens() {
    const { data } = await supabase.from('hero_imagens').select('*').order('ordem', { ascending: true })
    setHeroImagens(data || [])
  }

  async function carregarFotosExtras(produtoId: string) {
    const { data } = await supabase
      .from('produto_fotos')
      .select('*')
      .eq('produto_id', produtoId)
      .order('ordem')
    setFotosExtras((data || []).map((f: any) => f.url))
    setFotoIndex(0)
  }

  function ativarFiltroEspecial(f: FiltroEspecial) {
    setFiltroEspecial(filtroEspecial === f ? null : f)
    setCategoriaAtiva(null)
    setMarcaAtiva(null)
    setMenuAberto(false)
  }

  const produtosFiltrados = produtos.filter(p => {
    const buscaOk = `${p.modelo} ${p.marca} ${p.categoria}`.toLowerCase().includes(busca.toLowerCase())
    const categoriaOk = categoriaAtiva ? p.categoria === categoriaAtiva : true
    const marcaOk = marcaAtiva ? p.marca === marcaAtiva : true
    const especialOk =
      filtroEspecial === 'destaques' ? p.destaque :
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
    return 'Produtos disponíveis'
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
        <button
          style={detalheStyles.backBtn}
          onClick={() => { setProdutoSelecionado(null); setFotosExtras([]); setFotoIndex(0) }}
        >
          ← Voltar
        </button>
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

          {/* PREÇO em destaque */}
          <div style={detalheStyles.precoBox}>
            {produtoSelecionado.preco ? (
              <>
                <span style={detalheStyles.precoLabel}>Preço</span>
                <span style={detalheStyles.precoValor}>{formatarPreco(produtoSelecionado.preco)}</span>
                <span style={detalheStyles.precoAVista}>à vista</span>
              </>
            ) : (
              <span style={detalheStyles.precoConsulte}>Consulte o vendedor</span>
            )}
          </div>

          <div style={detalheStyles.specsGrid}>
            {produtoSelecionado.memoria && (
              <div style={detalheStyles.specItem}>
                <span style={detalheStyles.specIcon}>💾</span>
                <span style={detalheStyles.specLabel}>Memória</span>
                <span style={detalheStyles.specValor}>{produtoSelecionado.memoria}</span>
              </div>
            )}
            {produtoSelecionado.cor && (
              <div style={detalheStyles.specItem}>
                <span style={detalheStyles.specIcon}>🎨</span>
                <span style={detalheStyles.specLabel}>Cor</span>
                <span style={detalheStyles.specValor}>{produtoSelecionado.cor}</span>
              </div>
            )}
            {produtoSelecionado.condicao && (
              <div style={detalheStyles.specItem}>
                <span style={detalheStyles.specIcon}>✅</span>
                <span style={detalheStyles.specLabel}>Condição</span>
                <span style={detalheStyles.specValor}>{produtoSelecionado.condicao}</span>
              </div>
            )}
            {produtoSelecionado.bateria_saude && (
              <div style={detalheStyles.specItem}>
                <span style={detalheStyles.specIcon}>🔋</span>
                <span style={detalheStyles.specLabel}>Bateria</span>
                <span style={detalheStyles.specValor}>{produtoSelecionado.bateria_saude}</span>
              </div>
            )}
          </div>

          {produtoSelecionado.descricao && (
            <p style={detalheStyles.descricao}>{produtoSelecionado.descricao}</p>
          )}

          <div style={detalheStyles.tagsRow}>
            {produtoSelecionado.destaque && <span style={{ ...detalheStyles.tag, borderColor: '#ff6600', color: '#ff6600' }}>☆ Destaque</span>}
            {produtoSelecionado.lancamento && <span style={{ ...detalheStyles.tag, borderColor: '#4af', color: '#4af' }}>🚀 Lançamento</span>}
            {produtoSelecionado.promocao && <span style={{ ...detalheStyles.tag, borderColor: '#f4a', color: '#f4a' }}>🏷 Promoção</span>}
            {produtoSelecionado.mais_procurado && <span style={{ ...detalheStyles.tag, borderColor: '#fa4', color: '#fa4' }}>🔥 Mais Procurado</span>}
          </div>
        </div>
      </div>
    )
  }

  // ─── PÁGINA PRINCIPAL DA LOJA ─────────────────
  return (
    <div className="page">
      {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)} />}

      <aside className={menuAberto ? 'sidebar open' : 'sidebar'}>
        <div className="sideLogo"><strong>Marcos</strong><span>Magazine</span></div>
        <nav>
          <p
            className={!filtroEspecial && !categoriaAtiva && !marcaAtiva ? 'active' : ''}
            onClick={() => { setFiltroEspecial(null); setCategoriaAtiva(null); setMarcaAtiva(null); setMenuAberto(false) }}
          >⌂ Início</p>
          <p onClick={() => { setMenuAberto(false); navigate('/comparar') }}>⚖ Comparar Celulares</p>
          <p className={filtroEspecial === 'destaques' ? 'active' : ''} onClick={() => ativarFiltroEspecial('destaques')}>☆ Destaques</p>
          <p className={filtroEspecial === 'lancamentos' ? 'active' : ''} onClick={() => ativarFiltroEspecial('lancamentos')}>🚀 Lançamentos</p>
          <p className={filtroEspecial === 'promocoes' ? 'active' : ''} onClick={() => ativarFiltroEspecial('promocoes')}>🏷 Promoções</p>
          <p className={filtroEspecial === 'mais_procurados' ? 'active' : ''} onClick={() => ativarFiltroEspecial('mais_procurados')}>🔥 Mais Procurados</p>
          <p onClick={() => window.open('https://www.google.com/maps/search/Avenida+Goiás+686+Centro+Bom+Jesus+de+Goiás+GO', '_blank')}>📍 Localização</p>
          <p onClick={() => window.open('https://www.instagram.com/marcosmagazinee', '_blank')}>📷 Instagram</p>
        </nav>
      </aside>

      <main className="main">
        <header className="top">
          <button className="hamburger" onClick={() => setMenuAberto(!menuAberto)}>☰</button>
          <div className="mainLogo"><strong>Marcos</strong><span>Magazine</span></div>
          <div className="search">
            <input placeholder="Buscar produtos..." value={busca} onChange={e => setBusca(e.target.value)} />
            <span>🔍</span>
          </div>
        </header>

        {/* Hero */}
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

        {/* Categorias */}
        <h2 className="sectionTitle">Categorias<span></span></h2>
        <section style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", padding: "0 16px 16px" }}>
          {categorias.map(({ nome, img }) => (
            <div
              className={`categoryCard ${categoriaAtiva === nome ? 'ativo' : ''}`}
              key={nome}
              onClick={() => { setCategoriaAtiva(categoriaAtiva === nome ? null : nome); setMarcaAtiva(null); setFiltroEspecial(null) }}
            >
              <div className="categoryImgWrap"><img src={img} alt={nome} /></div>
              <p>{nome}</p>
            </div>
          ))}
        </section>

        {/* Marcas */}
        <h2 className="sectionTitle">Marcas<span></span></h2>
        <section style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", padding: "0 16px 16px" }}>
          {marcas.map(({ nome, img }) => (
            <div
              className={`brandCard ${marcaAtiva === nome ? 'ativo' : ''}`}
              key={nome}
              onClick={() => { setMarcaAtiva(marcaAtiva === nome ? null : nome); setCategoriaAtiva(null); setFiltroEspecial(null) }}
            >
              <img src={img} alt={nome} />
            </div>
          ))}
        </section>

        {/* Produtos COM PREÇO */}
        <h2 className="sectionTitle">{tituloSecao()}<span></span></h2>
        <section className="products" ref={carrosselRef}>
          {produtosFiltrados.length === 0 ? (
            <p style={{ color: '#666', padding: '0 30px 30px' }}>Nenhum produto encontrado.</p>
          ) : (
            produtosFiltrados.map(produto => (
              <div
                className="productCard"
                key={produto.id}
                onClick={() => { setProdutoSelecionado(produto); carregarFotosExtras(produto.id) }}
                style={{ position: 'relative' }}
              >
                {/* Badges */}
                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 2 }}>
                  {produto.lancamento && (
                    <span style={badgeStyle('#1a4a6a', '#4af')}>🚀 Novo</span>
                  )}
                  {produto.promocao && (
                    <span style={badgeStyle('#4a1a3a', '#f4a')}>🏷 Oferta</span>
                  )}
                  {produto.mais_procurado && (
                    <span style={badgeStyle('#4a2a0a', '#fa4')}>🔥 Top</span>
                  )}
                </div>

                {produto.foto_url
                  ? <img src={produto.foto_url} alt={produto.modelo} />
                  : <div className="phonePlaceholder">{produto.marca}</div>
                }
                <h3>{produto.modelo}</h3>
                {produto.memoria && <p>{produto.memoria}</p>}

                {/* PREÇO no card */}
                <div style={cardPrecoBox}>
                  {produto.preco ? (
                    <span style={cardPrecoValor}>{formatarPreco(produto.preco)}</span>
                  ) : (
                    <span style={cardPrecoConsulte}>Consulte</span>
                  )}
                </div>
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

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${color}`,
    borderRadius: 6,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    display: 'inline-block',
  }
}

const cardPrecoBox: React.CSSProperties = {
  marginTop: 6,
  padding: '6px 10px',
  background: 'rgba(255,102,0,0.12)',
  border: '1px solid rgba(255,102,0,0.3)',
  borderRadius: 8,
  textAlign: 'center',
}

const cardPrecoValor: React.CSSProperties = {
  color: '#ff6600',
  fontWeight: 900,
  fontSize: 15,
  fontFamily: 'Nunito, sans-serif',
}

const cardPrecoConsulte: React.CSSProperties = {
  color: '#666',
  fontSize: 11,
  fontStyle: 'italic',
}

const detalheStyles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'Poppins, sans-serif', padding: '20px 16px 60px' },
  backBtn: { background: '#ff6600', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 24, display: 'block' },
  card: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 20, padding: '24px 20px', textAlign: 'center', maxWidth: 480, margin: '0 auto' },
  fotoWrap: { width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 20 },
  foto: { width: '100%', maxWidth: 300, borderRadius: 16, objectFit: 'cover' },
  fotoPlaceholder: { width: 200, height: 200, background: 'linear-gradient(135deg, #222, #111)', borderRadius: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 16, fontWeight: 700, color: '#555' },
  marca: { color: '#ff6600', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 },
  modelo: { fontSize: 24, fontWeight: 900, fontFamily: 'Nunito, sans-serif', marginBottom: 20, color: 'white', lineHeight: 1.2 },
  precoBox: { background: 'linear-gradient(135deg, #1a0a00, #2a1200)', border: '1px solid rgba(255,102,0,0.4)', borderRadius: 16, padding: '18px 24px', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  precoLabel: { color: '#ff6600', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 },
  precoValor: { color: '#ff6600', fontSize: 36, fontWeight: 900, fontFamily: 'Nunito, sans-serif', lineHeight: 1 },
  precoAVista: { color: '#aa4400', fontSize: 12, marginTop: 2 },
  precoConsulte: { color: '#888', fontSize: 16, fontStyle: 'italic' },
  specsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 },
  specItem: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  specIcon: { fontSize: 20 },
  specLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  specValor: { fontSize: 14, fontWeight: 700, color: 'white' },
  descricao: { fontSize: 14, color: '#aaa', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' },
  tagsRow: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  tag: { border: '1px solid', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700 },
}