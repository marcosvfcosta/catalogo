import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

// ─── Tipos ─────────────────────────────────────────
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
  disponivel?: boolean
  destaque?: boolean
  lancamento?: boolean
  promocao?: boolean
  mais_procurado?: boolean
}

type Banner = {
  id: string
  url: string
  ordem: number
  ativo: boolean
  etiqueta?: string | null
  titulo?: string | null
  subtitulo?: string | null
  produto_id?: string | null
}

type FiltroEspecial = 'destaques' | 'lancamentos' | 'promocoes' | 'mais_procurados' | null

// ─── Dados fixos da loja ───────────────────────────
const WHATSAPP = '5564993374281'
const PARCELAS = 21
const STORAGE = 'https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public'

const categorias = [
  { nome: 'Celulares',    img: `${STORAGE}/categorias/celulares.png` },
  { nome: 'Capas',        img: `${STORAGE}/categorias/capas.png` },
  { nome: 'Tablet',       img: `${STORAGE}/categorias/tablet.png` },
  { nome: 'Carregadores', img: `${STORAGE}/categorias/carregadores%20(1).png` },
  { nome: 'Fones',        img: `${STORAGE}/categorias/fones.png` },
  { nome: 'Smartwatch',   img: `${STORAGE}/categorias/smartwatch%20(1).png` },
  { nome: 'Caixa de som', img: `${STORAGE}/categorias/caixasom%20(1).png` },
]

const marcas = [
  { nome: 'Apple',    img: `${STORAGE}/marcas/apple.png` },
  { nome: 'Samsung',  img: `${STORAGE}/marcas/samsung.png` },
  { nome: 'Xiaomi',   img: `${STORAGE}/marcas/xiaomi%20(1).png` },
  { nome: 'Motorola', img: `${STORAGE}/marcas/motorola.png` },
  { nome: 'Realme',   img: `${STORAGE}/marcas/realme%20(2).png` },
]

const CORES_HEX: Record<string, string> = {
  preto: '#1d1d1f', branco: '#f5f5f5', azul: '#3b6fd8', verde: '#3e9b6a', vermelho: '#d0312d', rosa: '#f4a7b9',
  roxo: '#7b4bb3', lilas: '#c8a2c8', amarelo: '#f5d04c', laranja: '#ff7a1a', cinza: '#8e8e93', prata: '#d9d9de',
  dourado: '#d4b26a', grafite: '#3a3a3c', 'titanio natural': '#8a8272', 'titanio preto': '#2d2926',
  'titanio branco': '#e8e4dc', 'titanio deserto': '#c2a882', 'meia-noite': '#1c2340', estelar: '#f0ece2',
  'azul-sierra': '#4a7fa5', 'verde-agua': '#00b4d8', cobre: '#b87333', bordo: '#6d1a2a',
}

// iPad (inclusive iPadOS 13+, que se identifica como Mac com tela de toque)
const ehIpad = typeof navigator !== 'undefined' && (
  /iPad/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
)

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function coresDoProduto(cor?: string) {
  if (!cor) return []
  return cor.split(/[,/;]| e /).map(c => c.trim()).filter(Boolean).slice(0, 5)
    .map(nome => ({ nome, hex: CORES_HEX[semAcento(nome)] || CORES_HEX[semAcento(nome).split(' ')[0]] || '#cfcfd4' }))
}

function abrirWhatsApp(texto: string) {
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`, '_blank')
}

function textoInteresse(p: Produto) {
  return `Olá! Tenho interesse no ${[p.marca === 'Apple' ? '' : p.marca, p.modelo, p.memoria].filter(Boolean).join(' ')} que vi no catálogo da Marcos Magazine.`
}

function App() {
  const navigate = useNavigate()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [carregando, setCarregando] = useState(true)
  const [menuAberto, setMenuAberto] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null)
  const [marcaAtiva, setMarcaAtiva] = useState<string | null>(null)
  const [filtroEspecial, setFiltroEspecial] = useState<FiltroEspecial>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [selecionado, setSelecionado] = useState<Produto | null>(null)
  const [fotosDetalhe, setFotosDetalhe] = useState<string[]>([])
  const [fotoIndex, setFotoIndex] = useState(0)
  const toqueInicio = useRef<number | null>(null)
  const topoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('produtos_catalogo').select('*').order('created_at', { ascending: false }),
      supabase.from('hero_imagens').select('*').eq('ativo', true).order('ordem', { ascending: true }),
    ]).then(([p, h]) => {
      setProdutos(((p.data || []) as Produto[]).filter(x => x.disponivel !== false))
      setBanners((h.data || []) as Banner[])
      setCarregando(false)
    })
  }, [])

  // Botão "voltar" do celular fecha o produto aberto
  useEffect(() => {
    const aoVoltar = () => { setSelecionado(null); setFotosDetalhe([]) }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  // Carrossel automático
  useEffect(() => {
    if (banners.length < 2 || selecionado) return
    const t = setInterval(() => setHeroIndex(i => (i + 1) % banners.length), 5500)
    return () => clearInterval(t)
  }, [banners.length, heroIndex, selecionado])

  async function abrirProduto(p: Produto) {
    setSelecionado(p); setFotoIndex(0); setFotosDetalhe(p.foto_url ? [p.foto_url] : [])
    window.history.pushState({ produto: p.id }, '')
    window.scrollTo(0, 0)
    const { data } = await supabase.from('produto_fotos').select('url').eq('produto_id', p.id).order('ordem')
    const extras = ((data || []) as { url: string }[]).map(f => f.url)
    setFotosDetalhe([...(p.foto_url ? [p.foto_url] : []), ...extras])
  }

  function fecharProduto() {
    if (window.history.state?.produto) window.history.back()
    else { setSelecionado(null); setFotosDetalhe([]) }
  }

  function limparFiltros() {
    setBusca(''); setCategoriaAtiva(null); setMarcaAtiva(null); setFiltroEspecial(null)
  }

  function aplicarFiltro(f: { categoria?: string; marca?: string; especial?: FiltroEspecial }) {
    setBusca('')
    setCategoriaAtiva(f.categoria || null)
    setMarcaAtiva(f.marca || null)
    setFiltroEspecial(f.especial || null)
    setMenuAberto(false)
    setTimeout(() => topoRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const filtrando = !!(busca.trim() || categoriaAtiva || marcaAtiva || filtroEspecial)

  const resultados = useMemo(() => {
    const termo = semAcento(busca.trim())
    return produtos.filter(p => {
      if (termo && !semAcento(`${p.marca} ${p.modelo} ${p.memoria || ''} ${p.categoria} ${p.cor || ''}`).includes(termo)) return false
      if (categoriaAtiva && p.categoria !== categoriaAtiva) return false
      if (marcaAtiva && p.marca !== marcaAtiva) return false
      if (filtroEspecial === 'destaques' && !p.destaque) return false
      if (filtroEspecial === 'lancamentos' && !p.lancamento) return false
      if (filtroEspecial === 'promocoes' && !p.promocao) return false
      if (filtroEspecial === 'mais_procurados' && !p.mais_procurado) return false
      return true
    })
  }, [produtos, busca, categoriaAtiva, marcaAtiva, filtroEspecial])

  const tituloResultados =
    filtroEspecial === 'destaques' ? 'Destaques' :
    filtroEspecial === 'lancamentos' ? 'Lançamentos' :
    filtroEspecial === 'promocoes' ? 'Promoções' :
    filtroEspecial === 'mais_procurados' ? 'Mais procurados' :
    categoriaAtiva || marcaAtiva || `Busca: "${busca.trim()}"`

  const destaques = produtos.filter(p => p.destaque)
  const lancamentos = produtos.filter(p => p.lancamento)
  const promocoes = produtos.filter(p => p.promocao)
  const maisProcurados = produtos.filter(p => p.mais_procurado)

  // ─── Pedaços da tela ─────────────────────────────
  const cartao = (p: Produto, grade = false) => {
    const cores = coresDoProduto(p.cor)
    const selo = p.lancamento ? { t: 'LANÇAMENTO', c: '#1d1d1f' } : p.promocao ? { t: 'OFERTA', c: '#e5332a' } : p.mais_procurado ? { t: 'TOP', c: '#ff6600' } : null
    return (
      <div key={p.id} className={grade ? 'mm-card mm-card-grade' : 'mm-card'} onClick={() => abrirProduto(p)}>
        <div className="mm-card-foto">
          {selo && <span className="mm-selo" style={{ background: selo.c }}>{selo.t}</span>}
          {p.foto_url ? <img src={p.foto_url} alt={p.modelo} loading="lazy" /> : <span className="mm-sem-foto">{p.marca}</span>}
        </div>
        <b className="mm-card-nome">{p.modelo}</b>
        <small className="mm-card-info">{[p.memoria, p.condicao].filter(Boolean).join(' · ') || p.marca}</small>
        <div className="mm-cores">
          {cores.map(c => <i key={c.nome} title={c.nome} style={{ background: c.hex }} />)}
        </div>
        <button className="mm-btn-zap" onClick={e => { e.stopPropagation(); abrirWhatsApp(textoInteresse(p)) }}>💬 Tenho interesse</button>
      </div>
    )
  }

  const secao = (titulo: string, lista: Produto[], especial: FiltroEspecial) => lista.length === 0 ? null : (
    <section className="mm-secao">
      <div className="mm-secao-topo">
        <h2>{titulo}</h2>
        {lista.length > 2 && especial && <button className="mm-link" onClick={() => aplicarFiltro({ especial })}>Ver todos ›</button>}
      </div>
      <div className="mm-trilho">{lista.slice(0, 12).map(p => cartao(p))}</div>
    </section>
  )

  // ─── DETALHE DO PRODUTO ──────────────────────────
  if (selecionado) {
    const p = selecionado
    const cores = coresDoProduto(p.cor)
    const specs = [
      p.memoria && { icone: '💾', nome: 'Memória', valor: p.memoria },
      p.cor && { icone: '🎨', nome: cores.length > 1 ? 'Cores' : 'Cor', valor: p.cor },
      p.condicao && { icone: '✅', nome: 'Condição', valor: p.condicao },
      p.bateria_saude && { icone: '🔋', nome: 'Bateria', valor: p.bateria_saude },
    ].filter(Boolean) as { icone: string; nome: string; valor: string }[]
    return (
      <div className="mm">
        <style>{CSS}</style>
        <header className="mm-topo mm-topo-detalhe">
          <button className="mm-voltar" onClick={fecharProduto}>‹ Voltar</button>
          <Logo />
          <button className="mm-icone" onClick={() => abrirWhatsApp('Olá! Vim pelo catálogo da Marcos Magazine.')} aria-label="WhatsApp">💬</button>
        </header>
        <main className="mm-detalhe">
          <div className="mm-galeria"
            onScroll={e => { const el = e.currentTarget; setFotoIndex(Math.round(el.scrollLeft / el.clientWidth)) }}>
            {fotosDetalhe.length > 0
              ? fotosDetalhe.map((f, i) => <div key={i} className="mm-galeria-item"><img src={f} alt={`${p.modelo} ${i + 1}`} /></div>)
              : <div className="mm-galeria-item"><span className="mm-sem-foto mm-sem-foto-grande">{p.marca}</span></div>}
          </div>
          {fotosDetalhe.length > 1 && (
            <div className="mm-pontos">{fotosDetalhe.map((_, i) => <i key={i} className={i === fotoIndex ? 'on' : ''} />)}</div>
          )}
          <div className="mm-detalhe-info">
            <p className="mm-detalhe-marca">{p.marca}</p>
            <h1 className="mm-detalhe-nome">{p.modelo}</h1>
            {cores.length > 0 && (
              <div className="mm-cores mm-cores-grandes">
                {cores.map(c => <span key={c.nome}><i style={{ background: c.hex }} />{c.nome}</span>)}
              </div>
            )}
            {specs.length > 0 && (
              <div className="mm-specs">
                {specs.map(s => (
                  <div key={s.nome} className="mm-spec"><span>{s.icone}</span><small>{s.nome}</small><b>{s.valor}</b></div>
                ))}
              </div>
            )}
            {p.descricao && <p className="mm-descricao">{p.descricao}</p>}
            <div className="mm-beneficios mm-beneficios-detalhe">
              <div><span>💳</span><p><b>Até {PARCELAS}x</b>no cartão</p></div>
              <div onClick={() => navigate('/entrada')}><span>⇄</span><p><b>Seu usado</b>vale como entrada</p></div>
            </div>
            <button className="mm-btn-contorno" onClick={() => navigate('/comparar')}>⚖ Comparar com outro celular</button>
          </div>
        </main>
        <div className="mm-barra-fixa">
          <button className="mm-btn-verde" onClick={() => abrirWhatsApp(textoInteresse(p))}>💬 Tenho interesse</button>
        </div>
      </div>
    )
  }

  // ─── CATÁLOGO ────────────────────────────────────
  const banner = banners.length ? banners[heroIndex % banners.length] : null
  const produtoDoBanner = banner?.produto_id ? produtos.find(x => x.id === banner.produto_id) : undefined

  return (
    <div className="mm">
      <style>{CSS}</style>

      {/* Menu lateral */}
      {menuAberto && <div className="mm-fundo-menu" onClick={() => setMenuAberto(false)} />}
      <aside className={menuAberto ? 'mm-menu aberto' : 'mm-menu'}>
        <div className="mm-menu-topo"><Logo /><button className="mm-icone" onClick={() => setMenuAberto(false)}>✕</button></div>
        <nav>
          <button onClick={() => { limparFiltros(); setMenuAberto(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>⌂ Início</button>
          <button onClick={() => navigate('/comparar')}>⚖ Comparar celulares</button>
          <button onClick={() => navigate('/entrada')}>⇄ Avaliar meu usado</button>
          <button onClick={() => navigate('/capas')}>📱 Capinhas</button>
          {ehIpad && <button className="mm-menu-destaque" onClick={() => navigate('/negociacao')}>💼 Negociação</button>}
          <hr />
          <button onClick={() => aplicarFiltro({ especial: 'destaques' })}>☆ Destaques</button>
          <button onClick={() => aplicarFiltro({ especial: 'lancamentos' })}>🚀 Lançamentos</button>
          <button onClick={() => aplicarFiltro({ especial: 'promocoes' })}>🏷 Promoções</button>
          <button onClick={() => aplicarFiltro({ especial: 'mais_procurados' })}>🔥 Mais procurados</button>
          <hr />
          <button onClick={() => window.open('https://www.google.com/maps/search/Avenida+Goiás+686+Centro+Bom+Jesus+de+Goiás+GO', '_blank')}>📍 Localização</button>
          <button onClick={() => window.open('https://www.instagram.com/marcosmagazinee', '_blank')}>📷 Instagram</button>
          <button onClick={() => abrirWhatsApp('Olá! Vim pelo catálogo da Marcos Magazine.')}>💬 WhatsApp</button>
        </nav>
      </aside>

      {/* Faixa de aviso */}
      <div className="mm-aviso">💳 <b>Parcele em até {PARCELAS}x</b> · ⇄ Aceitamos seu usado</div>

      {/* Topo */}
      <header className="mm-topo">
        <button className="mm-icone" onClick={() => setMenuAberto(true)} aria-label="Menu">☰</button>
        <Logo />
        <button className="mm-icone" onClick={() => setBuscaAberta(!buscaAberta)} aria-label="Buscar">🔍</button>
        <button className="mm-icone mm-icone-zap" onClick={() => abrirWhatsApp('Olá! Vim pelo catálogo da Marcos Magazine.')} aria-label="WhatsApp">💬</button>
      </header>
      {(buscaAberta || busca) && (
        <div className="mm-busca">
          <input autoFocus placeholder="Buscar celular, fone, capinha..." value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button onClick={() => setBusca('')}>✕</button>}
        </div>
      )}

      <div ref={topoRef} />

      {filtrando ? (
        /* ─── Resultado de filtro / busca ─── */
        <main className="mm-conteudo">
          <div className="mm-chips">
            <button className={!categoriaAtiva && !marcaAtiva && !filtroEspecial ? 'on' : ''} onClick={() => { setCategoriaAtiva(null); setMarcaAtiva(null); setFiltroEspecial(null) }}>Tudo</button>
            {categorias.filter(c => c.nome !== 'Capas').map(c => (
              <button key={c.nome} className={categoriaAtiva === c.nome ? 'on' : ''} onClick={() => setCategoriaAtiva(categoriaAtiva === c.nome ? null : c.nome)}>{c.nome}</button>
            ))}
          </div>
          <div className="mm-secao-topo">
            <h2>{tituloResultados}</h2>
            <button className="mm-link" onClick={limparFiltros}>✕ Limpar</button>
          </div>
          {resultados.length === 0 ? (
            <div className="mm-vazio">
              <p>Não encontramos esse produto no catálogo agora.</p>
              <button className="mm-btn-verde" onClick={() => abrirWhatsApp(`Olá! Vocês têm ${busca.trim() || tituloResultados}?`)}>💬 Perguntar no WhatsApp</button>
            </div>
          ) : (
            <div className="mm-grade">{resultados.map(p => cartao(p, true))}</div>
          )}
        </main>
      ) : (
        <main>
          {/* ─── Banner carrossel ─── */}
          <section className="mm-hero"
            onTouchStart={e => { toqueInicio.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              if (toqueInicio.current === null || banners.length < 2) return
              const dx = e.changedTouches[0].clientX - toqueInicio.current
              if (Math.abs(dx) > 40) setHeroIndex(i => (i + (dx < 0 ? 1 : banners.length - 1)) % banners.length)
              toqueInicio.current = null
            }}>
            <div className="mm-hero-slide" key={banner?.id || 'padrao'}>
              <span className="mm-hero-etiqueta">{banner?.titulo ? (banner.etiqueta || 'DESTAQUE') : 'MARCOS MAGAZINE'}</span>
              <h1>{banner?.titulo || 'Os melhores celulares'}</h1>
              <p>{banner?.titulo ? (banner.subtitulo || '') : 'e acessórios. Você só encontra aqui!'}</p>
              <div className="mm-hero-botoes">
                <button className="mm-btn-laranja" onClick={() => abrirWhatsApp(produtoDoBanner ? textoInteresse(produtoDoBanner) : banner?.titulo ? `Olá! Tenho interesse no ${banner.titulo} que vi no catálogo.` : 'Olá! Vim pelo catálogo da Marcos Magazine.')}>
                  {banner?.titulo ? 'Tenho interesse' : 'Fale com a gente'}
                </button>
                <button className="mm-btn-contorno-laranja" onClick={() => navigate('/comparar')}>Comparar</button>
              </div>
              {banner && (
                <img className="mm-hero-img" src={banner.url} alt={banner.titulo || 'Destaque'}
                  onClick={() => produtoDoBanner && abrirProduto(produtoDoBanner)} />
              )}
            </div>
          </section>
          {banners.length > 1 && (
            <div className="mm-pontos">
              {banners.map((b, i) => <i key={b.id} className={i === heroIndex % banners.length ? 'on' : ''} onClick={() => setHeroIndex(i)} />)}
            </div>
          )}

          {/* ─── Categorias ─── */}
          <div className="mm-categorias">
            {categorias.map(c => (
              <button key={c.nome} className="mm-categoria"
                onClick={() => c.nome === 'Capas' ? navigate('/capas') : aplicarFiltro({ categoria: c.nome })}>
                <span><img src={c.img} alt="" /></span>
                {c.nome}
              </button>
            ))}
          </div>

          {/* ─── Vantagens ─── */}
          <div className="mm-beneficios">
            <div><span>💳</span><p><b>Até {PARCELAS}x</b>no cartão</p></div>
            <div onClick={() => navigate('/entrada')}><span>⇄</span><p><b>Seu usado</b>vale como entrada</p></div>
            <div><span>🛡️</span><p><b>Garantia</b>e procedência</p></div>
            <div><span>🔧</span><p><b>Assistência</b>técnica própria</p></div>
          </div>

          {carregando ? (
            <div className="mm-trilho mm-carregando">{[0, 1, 2].map(i => <div key={i} className="mm-card mm-card-fantasma" />)}</div>
          ) : (
            <>
              {secao('Destaques da semana', destaques.length ? destaques : produtos.slice(0, 10), destaques.length ? 'destaques' : null)}

              {/* ─── Cartões: usado e comparar ─── */}
              <div className="mm-duo">
                <button className="mm-duo-escuro" onClick={() => navigate('/entrada')}>
                  <span className="mm-novo">NOVO</span>
                  <b>Avalie seu usado</b>
                  <small>Use como entrada no novo ›</small>
                  <i className="mm-duo-celular" />
                </button>
                <button className="mm-duo-claro" onClick={() => navigate('/comparar')}>
                  <b>Compare celulares</b>
                  <small>Veja qual é o melhor ›</small>
                  <span className="mm-duo-icone">⚖️</span>
                </button>
              </div>

              {secao('Lançamentos', lancamentos, 'lancamentos')}
              {secao('Promoções', promocoes, 'promocoes')}
              {secao('Mais procurados', maisProcurados, 'mais_procurados')}

              {/* ─── Todos ─── */}
              <section className="mm-secao">
                <div className="mm-secao-topo"><h2>Todos os produtos</h2><small className="mm-contador">{produtos.length}</small></div>
                <div className="mm-chips">
                  {categorias.filter(c => c.nome !== 'Capas' && produtos.some(p => p.categoria === c.nome)).map(c => (
                    <button key={c.nome} onClick={() => aplicarFiltro({ categoria: c.nome })}>{c.nome}</button>
                  ))}
                </div>
                <div className="mm-grade">{produtos.slice(0, 24).map(p => cartao(p, true))}</div>
                {produtos.length > 24 && (
                  <button className="mm-btn-contorno mm-ver-mais" onClick={() => aplicarFiltro({ categoria: 'Celulares' })}>Ver todos os celulares ›</button>
                )}
              </section>
            </>
          )}

          {/* ─── Marcas ─── */}
          <section className="mm-secao">
            <div className="mm-secao-topo"><h2>Marcas</h2></div>
            <div className="mm-marcas">
              {marcas.map(m => (
                <button key={m.nome} onClick={() => aplicarFiltro({ marca: m.nome })}>
                  <img src={m.img} alt={m.nome} />
                </button>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* ─── Rodapé ─── */}
      <footer className="mm-rodape">
        <b>Marcos Magazine</b>
        <p>Avenida Goiás, 686, sala 3 · Centro · Bom Jesus</p>
        <p>Seg a sex 08:00–18:00 · Sáb 08:00–12:30</p>
        <div className="mm-rodape-links">
          <button className="mm-zap" onClick={() => abrirWhatsApp('Olá! Vim pelo catálogo da Marcos Magazine.')}>💬 (64) 99337-4281</button>
          <button onClick={() => window.open('https://www.instagram.com/marcosmagazinee', '_blank')}>📷 @marcosmagazinee</button>
          <button onClick={() => window.open('https://www.google.com/maps/search/Avenida+Goiás+686+Centro+Bom+Jesus+de+Goiás+GO', '_blank')}>📍 Como chegar</button>
        </div>
      </footer>
    </div>
  )
}

function Logo() {
  return <div className="mm-logo"><b>Marcos</b><i>Magazine</i></div>
}

// ─── Visual (branco, inspirado em lojas premium) ───
const CSS = `
html, body { background: #fff !important; }
body { display: block !important; place-items: normal !important; margin: 0 !important; min-width: 0 !important; color: #1d1d1f !important; }
#root { width: 100% !important; max-width: none !important; justify-self: stretch !important; padding: 0 !important; margin: 0 !important; text-align: left !important; }
.mm { --laranja: #ff6600; --tinta: #1d1d1f; --cinza: #f5f5f7; --borda: #ececf0;
  min-height: 100vh; background: #fff; color: var(--tinta); font-family: Poppins, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased; overflow-x: hidden; padding-bottom: 0; }
.mm * { box-sizing: border-box; }
.mm button { all: unset; box-sizing: border-box; cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent; }
.mm h1, .mm h2, .mm p { margin: 0; }
.mm img { display: block; max-width: 100%; }
.mm main, .mm-rodape, .mm-busca { max-width: 1100px; margin-left: auto; margin-right: auto; }

.mm .mm-aviso { background: var(--tinta); color: #fff; font-size: 12px; text-align: center; padding: 8px 12px; }
.mm .mm-aviso b { color: #ff8a3d; }

.mm .mm-topo { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 4px; padding: 10px 12px;
  background: rgba(255,255,255,0.92); backdrop-filter: saturate(180%) blur(14px); -webkit-backdrop-filter: saturate(180%) blur(14px); border-bottom: 1px solid var(--borda); }
.mm .mm-logo { line-height: 1; margin-right: auto; margin-left: 4px; }
.mm .mm-logo b { display: block; color: var(--laranja); font-weight: 800; font-size: 22px; letter-spacing: -0.5px; font-family: Nunito, Poppins, sans-serif; }
.mm .mm-logo i { display: block; color: var(--laranja); font-style: normal; font-weight: 700; font-size: 10px; text-align: right; margin-top: -2px; }
.mm .mm-icone { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 19px; color: var(--tinta); }
.mm .mm-icone:active { background: var(--cinza); }
.mm .mm-icone-zap { color: #25D366; }

.mm .mm-busca { display: flex; align-items: center; gap: 8px; margin: 10px 16px 0; background: var(--cinza); border-radius: 14px; padding: 4px 6px 4px 14px; }
.mm .mm-busca input { flex: 1; border: none; outline: none; background: none; font-size: 16px; padding: 9px 0; font-family: inherit; color: var(--tinta); min-width: 0; }
.mm .mm-busca button { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #888; }

/* Banner */
.mm .mm-hero { position: relative; overflow: hidden; background: linear-gradient(180deg, #f5f5f7 0%, #fbe9dc 100%); text-align: center; touch-action: pan-y; }
.mm .mm-hero-slide { display: flex; flex-direction: column; align-items: center; padding: 26px 20px 0; min-height: 360px; animation: mmEntra .6s ease; }
@keyframes mmEntra { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.mm .mm-hero-etiqueta { font-size: 11px; font-weight: 700; color: var(--laranja); letter-spacing: 1.8px; }
.mm .mm-hero h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.8px; line-height: 1.1; margin-top: 6px; }
.mm .mm-hero p { font-size: 14px; color: #555; margin-top: 6px; max-width: 320px; }
.mm .mm-hero-botoes { display: flex; gap: 8px; margin-top: 14px; }
.mm .mm-btn-laranja { background: var(--laranja); color: #fff; border-radius: 22px; padding: 9px 20px; font-size: 13px; font-weight: 700; }
.mm .mm-btn-contorno-laranja { border: 1.5px solid var(--laranja); color: var(--laranja); border-radius: 22px; padding: 8px 18px; font-size: 13px; font-weight: 700; }
.mm .mm-hero-img { width: auto; max-width: 92%; height: 210px; object-fit: contain; margin-top: 14px; mix-blend-mode: multiply; }

.mm .mm-pontos { display: flex; justify-content: center; gap: 6px; padding: 12px 0 4px; }
.mm .mm-pontos i { width: 7px; height: 7px; border-radius: 4px; background: #d2d2d7; transition: all .3s; cursor: pointer; }
.mm .mm-pontos i.on { width: 20px; background: var(--laranja); }

/* Categorias */
.mm .mm-categorias { display: flex; gap: 10px; overflow-x: auto; padding: 12px 16px 14px; scrollbar-width: none; }
.mm .mm-categorias::-webkit-scrollbar { display: none; }
.mm .mm-categoria { flex: 0 0 auto; width: 72px; text-align: center; font-size: 11px; font-weight: 600; color: var(--tinta); }
.mm .mm-categoria span { width: 64px; height: 64px; border-radius: 50%; background: var(--cinza); margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.mm .mm-categoria img { width: 44px; height: 44px; object-fit: contain; }
.mm .mm-categoria:active span { background: #ffe9da; }

/* Vantagens */
.mm .mm-beneficios { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 16px 6px; }
.mm .mm-beneficios div { background: var(--cinza); border-radius: 14px; padding: 11px 12px; display: flex; gap: 10px; align-items: center; cursor: default; }
.mm .mm-beneficios span { font-size: 20px; }
.mm .mm-beneficios p { font-size: 11px; color: #666; line-height: 1.35; }
.mm .mm-beneficios b { display: block; color: var(--tinta); font-size: 12.5px; }

/* Seções */
.mm .mm-secao { padding-top: 22px; }
.mm .mm-secao-topo { display: flex; justify-content: space-between; align-items: baseline; padding: 0 16px 12px; gap: 10px; }
.mm .mm-secao-topo h2 { font-size: 21px; font-weight: 800; letter-spacing: -0.4px; }
.mm .mm-link { color: var(--laranja); font-size: 13px; font-weight: 700; white-space: nowrap; }
.mm .mm-contador { color: #999; font-size: 13px; }
.mm .mm-trilho { display: flex; gap: 10px; overflow-x: auto; padding: 0 16px 6px; scroll-snap-type: x mandatory; scrollbar-width: none; }
.mm .mm-trilho::-webkit-scrollbar { display: none; }

/* Cartão de produto */
.mm .mm-card { flex: 0 0 auto; width: 172px; border: 1px solid var(--borda); border-radius: 20px; padding: 10px; background: #fff; scroll-snap-align: start; cursor: pointer; display: flex; flex-direction: column; transition: transform .15s; }
.mm .mm-card:active { transform: scale(0.98); }
.mm .mm-card-grade { width: auto; }
.mm .mm-card-foto { position: relative; height: 140px; background: var(--cinza); border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.mm .mm-card-foto img { width: 88%; height: 88%; object-fit: contain; mix-blend-mode: multiply; }
.mm .mm-selo { position: absolute; top: 8px; left: 8px; z-index: 1; color: #fff; font-size: 9px; font-weight: 800; border-radius: 6px; padding: 3px 7px; letter-spacing: .5px; }
.mm .mm-sem-foto { color: #aaa; font-weight: 700; font-size: 14px; }
.mm .mm-card-nome { display: block; font-size: 13.5px; font-weight: 700; margin-top: 9px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mm .mm-card-info { color: #888; font-size: 11.5px; margin-top: 2px; }
.mm .mm-cores { display: flex; gap: 4px; margin: 7px 0 10px; min-height: 11px; flex-wrap: wrap; }
.mm .mm-cores i { width: 11px; height: 11px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); }
.mm .mm-btn-zap { display: block; width: 100%; text-align: center; background: var(--tinta); color: #fff; border-radius: 18px; padding: 9px 6px; font-size: 12px; font-weight: 700; margin-top: auto; }
.mm .mm-card-fantasma { height: 270px; background: linear-gradient(90deg, #f3f3f5, #fafafa, #f3f3f5); background-size: 200% 100%; animation: mmBrilhoCarregando 1.2s infinite; border: none; }
@keyframes mmBrilhoCarregando { to { background-position: -200% 0 } }
.mm .mm-carregando { padding-top: 22px; }

.mm .mm-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; padding: 0 16px; }
.mm .mm-chips { display: flex; gap: 6px; overflow-x: auto; padding: 14px 16px 12px; scrollbar-width: none; }
.mm .mm-chips::-webkit-scrollbar { display: none; }
.mm .mm-chips button { flex: 0 0 auto; padding: 7px 14px; border-radius: 18px; background: var(--cinza); font-size: 12.5px; font-weight: 600; color: #444; }
.mm .mm-chips button.on { background: var(--tinta); color: #fff; }
.mm .mm-conteudo { padding-bottom: 20px; }
.mm .mm-vazio { text-align: center; padding: 40px 24px; color: #777; font-size: 14px; display: flex; flex-direction: column; gap: 16px; align-items: center; }

/* Cartões duplos */
.mm .mm-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 24px 16px 0; }
.mm .mm-duo button { position: relative; overflow: hidden; border-radius: 20px; padding: 16px 14px; min-height: 150px; display: flex; flex-direction: column; gap: 4px; }
.mm .mm-duo b { font-size: 16px; font-weight: 800; line-height: 1.2; }
.mm .mm-duo small { font-size: 11.5px; position: relative; z-index: 1; }
.mm .mm-duo-escuro { background: var(--tinta); color: #fff; }
.mm .mm-duo-escuro small { color: #ff9a55; }
.mm .mm-duo-escuro::after { content: ''; position: absolute; top: 0; left: 0; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); animation: mmBrilho 3.5s ease-in-out infinite; }
@keyframes mmBrilho { 0% { transform: translateX(-120%) skewX(-20deg) } 60%, 100% { transform: translateX(320%) skewX(-20deg) } }
.mm .mm-duo-celular { position: absolute; right: -6px; bottom: -16px; width: 58px; height: 108px; border-radius: 14px; background: linear-gradient(160deg, #8a8a8e, #3a3a3c); border: 2px solid #555; }
.mm .mm-novo { align-self: flex-start; background: var(--laranja); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 8px; margin-bottom: 4px; animation: mmPulso 1.6s ease-in-out infinite; }
@keyframes mmPulso { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.1) } }
.mm .mm-duo-claro { background: #fff3ea; color: var(--tinta); }
.mm .mm-duo-claro small { color: #d4560a; }
.mm .mm-duo-icone { position: absolute; right: 10px; bottom: 8px; font-size: 40px; }

/* Marcas */
.mm .mm-marcas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 0 16px 24px; }
.mm .mm-marcas button { background: var(--cinza); border-radius: 14px; height: 54px; display: flex; align-items: center; justify-content: center; padding: 10px; }
.mm .mm-marcas img { max-height: 30px; max-width: 80%; object-fit: contain; filter: grayscale(1) brightness(0.3); }
.mm .mm-ver-mais { display: block; width: calc(100% - 32px); margin: 16px 16px 0; text-align: center; }

/* Rodapé */
.mm .mm-rodape { background: var(--cinza); padding: 22px 16px 30px; font-size: 12.5px; color: #666; line-height: 1.7; max-width: none; margin-top: 10px; }
.mm .mm-rodape > * { max-width: 1100px; margin-left: auto; margin-right: auto; }
.mm .mm-rodape b { color: var(--tinta); font-size: 14px; display: block; }
.mm .mm-rodape-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.mm .mm-rodape-links button { background: #fff; border-radius: 18px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; color: #444; }
.mm .mm-rodape-links .mm-zap { color: #1a9e4a; }

/* Menu lateral */
.mm .mm-fundo-menu { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 90; animation: mmFade .2s; }
@keyframes mmFade { from { opacity: 0 } }
.mm .mm-menu { position: fixed; top: 0; left: 0; bottom: 0; width: 280px; max-width: 85vw; background: #fff; z-index: 100; transform: translateX(-100%); transition: transform .25s ease; overflow-y: auto; box-shadow: 0 0 40px rgba(0,0,0,0.15); }
.mm .mm-menu.aberto { transform: none; }
.mm .mm-menu-topo { display: flex; align-items: center; padding: 14px 12px 10px 16px; border-bottom: 1px solid var(--borda); }
.mm .mm-menu nav { display: flex; flex-direction: column; padding: 8px; }
.mm .mm-menu nav button { width: 100%; padding: 13px 12px; border-radius: 12px; font-size: 15px; font-weight: 500; color: var(--tinta); }
.mm .mm-menu nav button:active { background: var(--cinza); }
.mm .mm-menu nav .mm-menu-destaque { color: var(--laranja); font-weight: 700; }
.mm .mm-menu hr { border: none; border-top: 1px solid var(--borda); margin: 6px 12px; }

/* Detalhe do produto */
.mm .mm-topo-detalhe { gap: 8px; }
.mm .mm-voltar { font-size: 15px; font-weight: 600; color: var(--laranja); padding: 8px 6px; }
.mm .mm-topo-detalhe .mm-logo { margin: 0 auto; }
.mm .mm-detalhe { max-width: 640px; padding-bottom: 100px; }
.mm .mm-galeria { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; background: var(--cinza); }
.mm .mm-galeria::-webkit-scrollbar { display: none; }
.mm .mm-galeria-item { flex: 0 0 100%; scroll-snap-align: center; height: 360px; display: flex; align-items: center; justify-content: center; padding: 20px; }
.mm .mm-galeria-item img { max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.mm .mm-sem-foto-grande { font-size: 24px; }
.mm .mm-detalhe-info { padding: 14px 20px 10px; }
.mm .mm-detalhe-marca { color: var(--laranja); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 2.5px; }
.mm .mm-detalhe-nome { font-size: 28px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.15; margin-top: 4px; }
.mm .mm-cores-grandes { gap: 12px; margin-top: 12px; }
.mm .mm-cores-grandes span { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #555; }
.mm .mm-cores-grandes i { width: 16px; height: 16px; }
.mm .mm-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 18px; }
.mm .mm-spec { background: var(--cinza); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 2px; }
.mm .mm-spec span { font-size: 18px; }
.mm .mm-spec small { font-size: 10.5px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
.mm .mm-spec b { font-size: 14px; }
.mm .mm-descricao { font-size: 14.5px; color: #555; line-height: 1.65; margin-top: 18px; }
.mm .mm-beneficios-detalhe { padding: 0; margin-top: 18px; }
.mm .mm-beneficios-detalhe div:nth-child(2) { cursor: pointer; }
.mm .mm-btn-contorno { display: block; width: 100%; text-align: center; border: 1.5px solid var(--borda); border-radius: 16px; padding: 13px; font-size: 14px; font-weight: 700; color: var(--tinta); margin-top: 12px; }
.mm .mm-barra-fixa { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.94); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--borda); }
.mm .mm-btn-verde { display: block; width: 100%; text-align: center; background: #25D366; color: #fff; border-radius: 16px; padding: 15px 22px; font-size: 16px; font-weight: 800; max-width: 600px; margin: 0 auto; }

/* Telas maiores (iPad / computador) */
@media (min-width: 760px) {
  .mm .mm-hero { border-radius: 28px; margin: 16px 16px 0; }
  .mm .mm-hero-slide { min-height: 440px; padding-top: 40px; }
  .mm .mm-hero h1 { font-size: 44px; }
  .mm .mm-hero-img { height: 270px; }
  .mm .mm-categorias { justify-content: center; }
  .mm .mm-beneficios { grid-template-columns: repeat(4, 1fr); }
  .mm .mm-card { width: 210px; }
  .mm .mm-card-grade { width: auto; }
  .mm .mm-card-foto { height: 170px; }
  .mm .mm-grade { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
  .mm .mm-marcas { grid-template-columns: repeat(5, 1fr); }
  .mm .mm-duo button { min-height: 180px; }
}
@media (prefers-reduced-motion: reduce) { .mm *, .mm *::after { animation: none !important; transition: none !important; } }
`

export default App
