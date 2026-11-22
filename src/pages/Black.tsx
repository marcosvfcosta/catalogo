// Site da Black — catálogo só de capinhas e cordinhas (Esquenta Black).
// Lê tudo do painel (Admin → Capas). Separado do catálogo e da Negociação.
import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { supabase } from '../supabase'
import {
  BLACK_PADRAO, emPromocao, lerConfig, precoFinal, reais, soNumeros,
  type BlackConfig, type BlackModelo, type BlackProduto, type BlackVideo,
} from '../lib/blackConfig'
import './black.css'

type ItemSacola = { id: string; modelo: string; q: number }
type TipoFiltro = 'tudo' | 'capa' | 'cordinha'
const CHAVE_SACOLA = 'mm-black-sacola'

function lerSacola(): ItemSacola[] {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_SACOLA) || '[]')
    return Array.isArray(s) ? s : []
  } catch { return [] }
}

function Relogio({ alvo }: { alvo: string }) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const fim = new Date(alvo).getTime()
  if (!alvo || isNaN(fim)) return null
  let s = Math.max(0, Math.floor((fim - agora) / 1000))
  const d = Math.floor(s / 86400); s %= 86400
  const h = Math.floor(s / 3600); s %= 3600
  const m = Math.floor(s / 60); s %= 60
  const caixa = (n: number, l: string) => <div><b>{String(n).padStart(2, '0')}</b><small>{l}</small></div>
  return <div className="relogio">{caixa(d, 'dias')}{caixa(h, 'horas')}{caixa(m, 'min')}{caixa(s, 'seg')}</div>
}

export default function Black() {
  const raiz = useRef<HTMLDivElement>(null)
  const btnSacola = useRef<HTMLButtonElement>(null)
  const filtroRef = useRef<HTMLElement>(null)
  const [carregando, setCarregando] = useState(true)
  const [produtos, setProdutos] = useState<BlackProduto[]>([])
  const [modelos, setModelos] = useState<BlackModelo[]>([])
  const [videos, setVideos] = useState<BlackVideo[]>([])
  const [cfg, setCfg] = useState<BlackConfig>(BLACK_PADRAO)
  const [filtroModelo, setFiltroModelo] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>('tudo')
  const [aberto, setAberto] = useState<BlackProduto | null>(null)
  const [fotoAtual, setFotoAtual] = useState(0)
  const [modeloEsc, setModeloEsc] = useState('')
  const [sacola, setSacola] = useState<ItemSacola[]>(lerSacola)
  const [sacolaAberta, setSacolaAberta] = useState(false)
  const [toastTxt, setToastTxt] = useState('')
  const [pulo, setPulo] = useState(0)
  const [story, setStory] = useState<number | null>(null)
  const [clipeAtivo, setClipeAtivo] = useState(0)
  const timerToast = useRef<number | undefined>(undefined)

  useEffect(() => {
    document.title = 'Marcos Magazine · Esquenta Black'
    const corAntiga = document.body.style.background
    document.body.style.background = '#fff'
    ;(async () => {
      const [p, m, v, c] = await Promise.all([
        supabase.from('black_produtos').select('*').eq('no_site', true).order('ordem').order('criado_em', { ascending: false }),
        supabase.from('black_modelos').select('*').order('ordem'),
        supabase.from('black_videos').select('*').order('ordem'),
        supabase.from('black_config').select('dados').eq('id', 1).maybeSingle(),
      ])
      setProdutos((p.data || []) as BlackProduto[])
      setModelos((m.data || []) as BlackModelo[])
      setVideos((v.data || []) as BlackVideo[])
      setCfg(lerConfig(c.data?.dados))
      setCarregando(false)
    })()
    return () => { document.body.style.background = corAntiga }
  }, [])

  useEffect(() => { try { localStorage.setItem(CHAVE_SACOLA, JSON.stringify(sacola)) } catch { /* sem espaço */ } }, [sacola])

  function toast(t: string) {
    setToastTxt(t)
    window.clearTimeout(timerToast.current)
    timerToast.current = window.setTimeout(() => setToastTxt(''), 1800)
  }

  const porId = useMemo(() => new Map(produtos.map(p => [p.id, p])), [produtos])
  const serveNo = (p: BlackProduto, m: string) => p.tipo === 'cordinha' || p.modelos.includes(m)
  const base = produtos.filter(p => (filtroTipo === 'tudo' || p.tipo === filtroTipo) && (!filtroModelo || serveNo(p, filtroModelo)))
  const lancamentos = base.filter(p => p.lancamento)
  const maisVendidos = base.filter(p => p.destaque)
  const promocao = base.filter(emPromocao)
  const listaVideos = videos.filter(v => !v.produto_id || (porId.has(v.produto_id) && base.includes(porId.get(v.produto_id) as BlackProduto)))
  const totalItens = sacola.reduce((s, i) => s + i.q, 0)
  const itensSacola = sacola.map(i => ({ ...i, p: porId.get(i.id) })).filter((i): i is ItemSacola & { p: BlackProduto } => !!i.p)
  const totalSacola = itensSacola.reduce((s, i) => s + precoFinal(i.p) * i.q, 0)
  const zap = (msg: string) => window.open('https://wa.me/' + soNumeros(cfg.whatsapp) + '?text=' + encodeURIComponent(msg), '_blank')

  function abrirProduto(p: BlackProduto) {
    setAberto(p)
    setFotoAtual(0)
    setModeloEsc(filtroModelo && serveNo(p, filtroModelo) && p.tipo === 'capa' ? filtroModelo : '')
  }
  function fechar() { setAberto(null); setSacolaAberta(false) }

  // ── animação: sacola preta abre, a capinha cai dentro e o conjunto sobe pra sacola do topo ──
  function voarParaSacola(origem: DOMRect, foto: string, aoChegar: () => void) {
    const casa = raiz.current, btn = btnSacola.current
    if (!casa || !btn) return aoChegar()
    const alvo = btn.getBoundingClientRect()
    const ax = alvo.left + alvo.width / 2, ay = alvo.top + alvo.height / 2
    const W = 200, H = 240
    const bx = window.innerWidth / 2 - W / 2, by = window.innerHeight * 0.5 - H / 2

    const veu = document.createElement('div'); veu.className = 'veu'
    casa.appendChild(veu)
    veu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' })

    const cj = document.createElement('div'); cj.className = 'conjunto'
    cj.style.left = bx + 'px'; cj.style.top = by + 'px'
    cj.innerHTML = `
      <svg class="peca" width="${W}" height="${H}" viewBox="0 0 200 240">
        <path d="M38 78 L162 78 L150 62 L50 62 Z" fill="#2a2a2a"/><rect x="30" y="70" width="140" height="20" rx="3" fill="#000"/>
      </svg>
      <div class="capa-voo"></div>
      <svg class="peca" width="${W}" height="${H}" viewBox="0 0 200 240">
        <path class="alca1" d="M70 82 C70 30, 130 30, 130 82" fill="none" stroke="#EE6F2D" stroke-width="8" stroke-linecap="round"/>
        <path d="M26 84 L174 84 L186 226 Q186 234 178 234 L22 234 Q14 234 14 226 Z" fill="#111"/>
        <path d="M26 84 L174 84 L176 104 L24 104 Z" fill="#fff" opacity=".06"/>
        <path d="M150 84 L174 84 L186 226 Q186 234 178 234 L160 234 Z" fill="#fff" opacity=".05"/>
        <text x="100" y="160" text-anchor="middle" font-family="Nunito, Avenir Next, Arial" font-weight="900" font-size="30" fill="#EE6F2D">Marcos</text>
        <text x="128" y="182" text-anchor="middle" font-family="Nunito, Avenir Next, Arial" font-weight="800" font-size="15" fill="#EE6F2D">Magazine</text>
        <text x="100" y="214" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="12" letter-spacing="3" fill="#fff" opacity=".85">ESQUENTA BLACK</text>
      </svg>`
    casa.appendChild(cj)

    const cw = 90, ch = 120
    const capa = cj.querySelector('.capa-voo') as HTMLDivElement
    capa.style.width = cw + 'px'; capa.style.height = ch + 'px'
    capa.style.left = (W - cw) / 2 + 'px'; capa.style.top = '0px'
    const img = document.createElement('img'); img.src = foto; img.alt = ''
    capa.appendChild(img)
    const esc0 = Math.min(origem.width / cw, origem.height / ch) || 1
    const dx0 = origem.left + origem.width / 2 - (bx + W / 2)
    const dy0 = origem.top + origem.height / 2 - (by + ch / 2)

    const surge = cj.animate([
      { transform: 'scale(.2) translateY(60px)', opacity: 0 },
      { transform: 'scale(1.06)', opacity: 1, offset: 0.7 },
      { transform: 'scale(1)', opacity: 1 },
    ], { duration: 380, easing: 'ease-out', fill: 'forwards' })

    capa.animate([
      { transform: `translate(${dx0}px, ${dy0}px) scale(${esc0})` },
      { transform: 'translate(0px, -70px) scale(1.05) rotate(-8deg)', offset: 0.45 },
      { transform: 'translate(0px, -76px) scale(1) rotate(4deg)', offset: 0.58 },
      { transform: 'translate(0px, 105px) scale(.92) rotate(0deg)' },
    ], { duration: 950, easing: 'cubic-bezier(.5,0,.4,1)', fill: 'forwards' })

    surge.onfinish = () => {
      window.setTimeout(() => {
        cj.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08,.9)' }, { transform: 'scale(.96,1.05)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' })
        const alca = cj.querySelector('.alca1') as SVGPathElement
        alca.style.transformOrigin = '100px 60px'
        alca.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(.55) translateY(-6px)' }], { duration: 300, fill: 'forwards', easing: 'ease-in-out' })
      }, 520)

      window.setTimeout(() => {
        veu.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = () => veu.remove()
        const ox = bx + W / 2, oy = by + H / 2
        const cx = ox + (ax - ox) * 0.3 - 40, cy = Math.min(oy, ay) - 60
        const quadros: Keyframe[] = []
        for (let i = 0; i <= 20; i++) {
          const t = i / 20
          const x = (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * cx + t * t * ax
          const y = (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * cy + t * t * ay
          quadros.push({ transform: `translate(${x - ox}px, ${y - oy}px) scale(${1 - t * 0.88}) rotate(${Math.sin(t * Math.PI) * -14}deg)`, opacity: t > 0.9 ? (1 - t) / 0.1 : 1, offset: t })
        }
        cj.animate(quadros, { duration: 800, easing: 'cubic-bezier(.5,.05,.3,1)', fill: 'forwards' }).onfinish = () => {
          cj.remove()
          const o = document.createElement('span'); o.className = 'onda'
          o.style.left = ax - 22 + 'px'; o.style.top = ay - 22 + 'px'
          casa.appendChild(o)
          o.animate([{ transform: 'scale(.6)', opacity: 0.9 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 600, easing: 'ease-out' }).onfinish = () => o.remove()
          const m = document.createElement('span'); m.className = 'mais1'; m.textContent = '+1'
          m.style.left = ax - 30 + 'px'; m.style.top = ay + 8 + 'px'
          casa.appendChild(m)
          m.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(22px)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = () => m.remove()
          aoChegar()
        }
      }, 1050)
    }
  }

  function porNaSacola() {
    const p = aberto
    if (!p) return
    if (p.tipo === 'capa' && !modeloEsc) return toast('Escolha o modelo do celular 👆')
    const modelo = p.tipo === 'capa' ? modeloEsc : ''
    const el = raiz.current?.querySelector('.gaveta.on .img img') as HTMLImageElement | null
    const origem = el ? el.getBoundingClientRect() : new DOMRect(window.innerWidth / 2 - 60, window.innerHeight / 2, 120, 160)
    voarParaSacola(origem, p.fotos[fotoAtual] || p.fotos[0] || '', () => {
      setSacola(s => {
        const igual = s.find(i => i.id === p.id && i.modelo === modelo)
        const nova = igual ? s.map(i => (i === igual ? { ...i, q: i.q + 1 } : i)) : [...s, { id: p.id, modelo, q: 1 }]
        const n = nova.reduce((t, i) => t + i.q, 0)
        toast(n === 1 ? '1 item na sacola ✓' : n + ' itens na sacola ✓')
        return nova
      })
      setPulo(x => x + 1)
    })
    window.setTimeout(() => setAberto(null), 120)
  }

  function mudarQtd(i: number, d: number) {
    setSacola(s => s.map((x, k) => (k === i ? { ...x, q: x.q + d } : x)).filter(x => x.q > 0))
  }
  function finalizar() {
    const linhas = itensSacola.map(i => `• ${i.q}x ${i.p.nome}${i.modelo ? ' (' + i.modelo + ')' : ''} — ${reais(precoFinal(i.p) * i.q)}`).join('\n')
    zap(`Olá! Meu pedido da Black 🔥\n${linhas}\nTotal: ${reais(totalSacola)}`)
  }

  // pulinho da sacola do topo quando chega item
  useEffect(() => {
    if (!pulo || !btnSacola.current) return
    const b = btnSacola.current
    b.classList.remove('recebe'); void b.offsetWidth; b.classList.add('recebe')
  }, [pulo])

  // vídeo do meio do carrossel toca, os outros pausam
  function aoRolarVideos(e: UIEvent<HTMLDivElement>) {
    const tv = e.currentTarget
    const c = tv.scrollLeft + tv.clientWidth / 2
    let melhor = 0, dist = 1e9
    Array.from(tv.children).forEach((el, i) => {
      const h = el as HTMLElement
      const d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - c)
      if (d < dist) { dist = d; melhor = i }
    })
    setClipeAtivo(melhor)
  }
  useEffect(() => {
    raiz.current?.querySelectorAll<HTMLVideoElement>('.trilho-video video').forEach((v, i) => {
      if (i === clipeAtivo) v.play().catch(() => {}); else v.pause()
    })
  }, [clipeAtivo, listaVideos.length])

  // ── pedaços da tela ──
  function card(p: BlackProduto) {
    const promo = emPromocao(p)
    return (
      <article className="card" key={p.id} onClick={() => abrirProduto(p)}>
        <div className="foto">
          {p.fotos[0] ? <img src={p.fotos[0]} alt={p.nome} loading="lazy" /> : <span className="semfoto">sem foto</span>}
          {promo ? <span className="badge">BLACK -{Math.round((1 - (p.preco_promo as number) / p.preco) * 100)}%</span> : p.lancamento ? <span className="badge novo">NOVO</span> : null}
          <button className="add" aria-label="Adicionar" onClick={e => { e.stopPropagation(); abrirProduto(p) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="#111" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        <span className="nome">{p.nome}</span>
        {promo && <s>{reais(p.preco)}</s>}
        <span className="preco">{reais(precoFinal(p))}</span>
        <span className="parc">ou 18x no cartão</span>
      </article>
    )
  }
  function vitrine(chave: 'lancamentos' | 'mais' | 'promo', lista: BlackProduto[]) {
    const s = cfg.secoes[chave]
    if (!s.ativo) return null
    if (!lista.length && !filtroModelo && filtroTipo === 'tudo') return null
    const [antes, depois] = chave === 'promo' && /black/i.test(s.titulo) ? s.titulo.split(/(?=black)/i) : [s.titulo, '']
    return (
      <section className="vitrine">
        <div className="vitrine-topo"><h2>{antes}{depois && <span className="fogo">{depois}</span>}</h2></div>
        {s.texto && <p className="vitrine-desc">{s.texto}</p>}
        {lista.length ? <div className="trilho sem-barra">{lista.map(card)}</div>
          : <p className="vazio">Nada nessa vitrine pro filtro escolhido. Toque em "Limpar filtro".</p>}
      </section>
    )
  }

  const fundosClipe = ['linear-gradient(160deg,#2b2b2b,#0b0b0b)', 'linear-gradient(160deg,#3a1d10,#0b0b0b)', 'linear-gradient(160deg,#1c2533,#0b0b0b)', 'linear-gradient(160deg,#2e1630,#0b0b0b)']
  const storyAtual = story !== null ? listaVideos[story] : null
  const produtoStory = storyAtual?.produto_id ? porId.get(storyAtual.produto_id) : undefined

  return (
    <div className="bk" ref={raiz}>
      <div className="aviso"><div className="rolo"><span className="cartao" /><b>{cfg.faixa.split('·')[0].trim()}</b>{cfg.faixa.includes('·') && <> · {cfg.faixa.split('·').slice(1).join('·').trim()}</>}</div></div>

      <header className="topo">
        <button className="icone" aria-label="Ir pro filtro" onClick={() => filtroRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <a className="logo" href="/black"><span className="m">Marcos</span><span className="g">Magazine</span></a>
        <div className="direita">
          <button className="icone" aria-label="Buscar" onClick={() => filtroRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </button>
          <button className="icone" id="btnSacola" ref={btnSacola} aria-label="Sacola" onClick={() => setSacolaAberta(true)}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.3" strokeLinejoin="round" style={{ overflow: 'visible' }}><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" /><g className="boca"><path d="M9 8V6a3 3 0 0 1 6 0v2" /></g></svg>
            <span className={`contador ${totalItens ? 'on' : ''}`} key={pulo}>{totalItens}</span>
          </button>
        </div>
      </header>

      <section className="black">
        <div className="esquenta">{cfg.linha1}
          <svg className="chama" viewBox="0 0 40 56" fill="none" stroke="#EE6F2D" strokeWidth="4" strokeLinejoin="round"><path d="M20 3c2 9 12 15 12 29a12 12 0 0 1-24 0c0-7 4-11 6-15 1 5 3 7 5 8-1-8 0-15 1-22z" /><circle cx="20" cy="44" r="4.5" fill="#EE6F2D" stroke="none" /></svg>
        </div>
        <div className="linha-black">
          <div className="selo">
            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#EE6F2D" strokeWidth="4" strokeDasharray="230 60" strokeLinecap="round" /></svg>
            <span className="m">Marcos</span><span className="g">Magazine</span>
          </div>
          <div className="palavra-black" data-texto={cfg.linha2}>{cfg.linha2}</div>
        </div>
        <div className="caixa-cta">
          <span>{cfg.frase}</span>
          <button className="btn-laranja" onClick={() => filtroRef.current?.scrollIntoView({ behavior: 'smooth' })}>{cfg.botao}</button>
        </div>
        {cfg.contagem && new Date(cfg.contagem).getTime() > Date.now() && (
          <>
            <div className="relogio-titulo">{cfg.contagem_titulo}</div>
            <Relogio alvo={cfg.contagem} />
          </>
        )}
      </section>

      {cfg.secoes.filtro.ativo && (
        <section className="filtro" id="filtro" ref={filtroRef}>
          <h2>{cfg.secoes.filtro.titulo}</h2>
          {cfg.secoes.filtro.texto && <p>{cfg.secoes.filtro.texto}</p>}
          <div className="abas">
            {(['tudo', 'capa', 'cordinha'] as TipoFiltro[]).map(t => (
              <button key={t} className={filtroTipo === t ? 'on' : ''} onClick={() => setFiltroTipo(t)}>{t === 'tudo' ? 'Tudo' : t === 'capa' ? 'Capinhas' : 'Cordinhas'}</button>
            ))}
          </div>
          <div className="chips sem-barra">
            {modelos.map(m => (
              <button key={m.id} className={`chip ${filtroModelo === m.nome ? 'on' : ''}`}
                onClick={() => { const novo = filtroModelo === m.nome ? '' : m.nome; setFiltroModelo(novo); if (novo) toast('Mostrando o que serve no ' + novo) }}>
                📱 {m.nome}
              </button>
            ))}
          </div>
          {(filtroModelo || filtroTipo !== 'tudo') && <button className="limpar on" onClick={() => { setFiltroModelo(''); setFiltroTipo('tudo') }}>Limpar filtro</button>}
        </section>
      )}

      {carregando ? <p className="carregando">Carregando as ofertas...</p> : !produtos.length ? (
        <p className="carregando">Em breve as ofertas da Black aparecem aqui 🔥</p>
      ) : (
        <>
          {vitrine('lancamentos', lancamentos)}

          {cfg.secoes.videos.ativo && listaVideos.length > 0 && (
            <section className="videos">
              <h2>{cfg.secoes.videos.titulo}</h2>
              {cfg.secoes.videos.texto && <p>{cfg.secoes.videos.texto}</p>}
              <div className="trilho-video sem-barra" onScroll={aoRolarVideos}>
                {listaVideos.map((v, i) => {
                  const p = v.produto_id ? porId.get(v.produto_id) : undefined
                  return (
                    <button key={v.id} className={`clipe ${i === clipeAtivo ? 'ativo' : ''}`} style={{ background: fundosClipe[i % fundosClipe.length] }} onClick={() => setStory(i)}>
                      <video src={v.video_url} poster={v.capa_url || undefined} muted loop playsInline preload="metadata" />
                      <span className="play"><svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M7 4l14 8-14 8z" /></svg></span>
                      {p && (
                        <span className="mini">
                          <span className="ico">{p.fotos[0] && <img src={p.fotos[0]} alt="" />}</span>
                          <span><span>{p.nome}</span><b>{reais(precoFinal(p))}</b></span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {vitrine('mais', maisVendidos)}
          {vitrine('promo', promocao)}
        </>
      )}

      <footer className="rodape">
        <div className="logo"><span className="m">Marcos</span><span className="g">Magazine</span></div>
        <p>{cfg.endereco}<br />{cfg.horario}<br />{cfg.faixa}</p>
        {cfg.instagram && <p style={{ marginTop: 12 }}><a href={'https://instagram.com/' + cfg.instagram.replace('@', '')} target="_blank" rel="noreferrer">{cfg.instagram}</a></p>}
      </footer>

      <button className="zap-fixo" aria-label="WhatsApp" onClick={() => zap('Olá! Vim pelo catálogo da Black e tenho uma dúvida 😊')}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z" /></svg>
      </button>

      {/* gaveta do produto */}
      <div className={`fundo-escuro ${aberto || sacolaAberta ? 'on' : ''}`} onClick={fechar} />
      <div className={`gaveta ${aberto ? 'on' : ''}`}>
        {aberto && (
          <>
            <div className="pega" />
            <div className="galeria sem-barra" onScroll={e => { const g = e.currentTarget; setFotoAtual(Math.round(g.scrollLeft / Math.max(1, g.clientWidth))) }}>
              {(aberto.fotos.length ? aberto.fotos : ['']).map((f, i) => <div className="img" key={i}>{f && <img src={f} alt={aberto.nome} />}</div>)}
            </div>
            {aberto.fotos.length > 1 && <div className="pontos">{aberto.fotos.map((_, i) => <i key={i} className={i === fotoAtual ? 'on' : ''} />)}</div>}
            <div className="corpo">
              <h3>{aberto.nome}</h3>
              <div className="p">{reais(precoFinal(aberto))}{emPromocao(aberto) && <s>{reais(aberto.preco)}</s>}</div>
              <div className="parc2">ou em até 18x no cartão</div>
              {aberto.descricao && <p className="desc">{aberto.descricao}</p>}
              {aberto.tipo === 'cordinha' ? (
                <><label>Serve em</label><p style={{ fontSize: 14 }}>Todos os celulares</p></>
              ) : (
                <>
                  <label>Escolha o seu modelo</label>
                  <div className="modelos">
                    {aberto.modelos.map(m => <button key={m} className={m === modeloEsc ? 'on' : ''} onClick={() => setModeloEsc(m)}>{m}</button>)}
                  </div>
                </>
              )}
              <div className="acoes"><button className="btn-preto" onClick={porNaSacola}>Pôr na sacola</button></div>
            </div>
          </>
        )}
      </div>

      {/* sacola */}
      <div className={`gaveta ${sacolaAberta ? 'on' : ''}`}>
        <div className="pega" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 4px' }}>
          <h3 style={{ fontSize: 20 }}>Sua sacola {totalItens > 0 && <span style={{ color: '#EE6F2D' }}>({totalItens} {totalItens === 1 ? 'item' : 'itens'})</span>}</h3>
          <button onClick={fechar} aria-label="Fechar"><svg width="24" height="24" viewBox="0 0 24 24" stroke="#111" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        {itensSacola.length ? (
          <>
            <div className="sacola-lista">
              {itensSacola.map((it, i) => (
                <div className="sacola-item" key={it.id + it.modelo}>
                  <div className="mini-foto">{it.p.fotos[0] && <img src={it.p.fotos[0]} alt="" />}</div>
                  <div className="t"><b>{it.p.nome}</b><small>{it.modelo || 'Serve em todos'}</small><span>{reais(precoFinal(it.p) * it.q)}</span></div>
                  <div className="qtd"><button onClick={() => mudarQtd(i, -1)}>−</button><i>{it.q}</i><button onClick={() => mudarQtd(i, 1)}>+</button></div>
                </div>
              ))}
            </div>
            <div className="sacola-total"><span>Total</span><div><b>{reais(totalSacola)}</b><small>ou em até 18x no cartão</small></div></div>
            <div style={{ padding: 18 }}>
              <button className="btn-laranja" style={{ width: '100%', fontSize: 18, padding: 16 }} onClick={finalizar}>Finalizar pedido</button>
              <button style={{ width: '100%', marginTop: 12, fontSize: 14, textDecoration: 'underline', color: '#777' }} onClick={fechar}>Continuar comprando</button>
            </div>
          </>
        ) : (
          <>
            <p className="sacola-vazia">Sua sacola está vazia.<br />Escolha uma capinha ou cordinha 😊</p>
            <div style={{ padding: 18 }}><button className="btn-preto" style={{ width: '100%', height: 52, borderRadius: 14, fontWeight: 900 }} onClick={fechar}>Ver produtos</button></div>
          </>
        )}
      </div>

      {/* stories dos vídeos */}
      {storyAtual && (
        <div className="stories on">
          <div className="barras">{listaVideos.map((_, i) => <i key={i}><b style={{ width: story !== null && i < story ? '100%' : '0' }} /></i>)}</div>
          <div className="topo-st"><span className="av">M</span>Marcos Magazine<span style={{ flex: 1 }} />
            <button onClick={() => setStory(null)} aria-label="Fechar"><svg width="26" height="26" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </div>
          <div className="palco">
            <video key={storyAtual.id} src={storyAtual.video_url} autoPlay playsInline muted={false}
              onEnded={() => setStory(s => (s !== null && s + 1 < listaVideos.length ? s + 1 : null))}
              onTimeUpdate={e => {
                const v = e.currentTarget
                const b = raiz.current?.querySelectorAll<HTMLElement>('.stories .barras b')[story as number]
                if (b && v.duration) b.style.width = (v.currentTime / v.duration) * 100 + '%'
              }} />
            <button className="lado" style={{ left: 0 }} onClick={() => setStory(s => (s ? s - 1 : 0))} aria-label="Anterior" />
            <button className="lado" style={{ right: 0 }} onClick={() => setStory(s => (s !== null && s + 1 < listaVideos.length ? s + 1 : null))} aria-label="Próximo" />
          </div>
          {produtoStory && (
            <div className="comprar">
              <div className="t"><b>{produtoStory.nome}</b><small>{reais(precoFinal(produtoStory))} · até 18x</small></div>
              <button className="btn-laranja" style={{ fontSize: 15, padding: '11px 16px' }} onClick={() => { setStory(null); abrirProduto(produtoStory) }}>Comprar</button>
            </div>
          )}
        </div>
      )}

      <div className={`toast ${toastTxt ? 'on' : ''}`}>{toastTxt}</div>
    </div>
  )
}
