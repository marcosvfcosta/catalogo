import { useEffect, useMemo, useRef, useState, type TouchEvent as ToqueEvento } from 'react'

// ─── Abertura "parede de nichos" (estilo loja de perfumes) ───────────────────
// Nichos cavados numa parede de rocha escura. Dentro de cada nicho: fundo de pedra
// iluminado por uma luz de teto (spot), paredes laterais acesas com a cor do produto
// e chão de vidro com reflexo. Deslizando para o lado, o nicho do meio acende em
// laranja e o celular cresce um pouco. Tocando, a luz dos outros nichos apaga e
// aparecem o nome e as especificações. Sem bibliotecas: só React + CSS.

export type ItemVitrine = {
  id: string
  nome: string
  foto: string                                  // de preferência sem fundo (PNG transparente)
  detalhe?: string                              // ex: "Lançamento"
  marca?: string
  specs?: { rotulo: string; valor: string }[]   // memória, condição, bateria, cores...
  preco?: string                                // só se estiver liberado para mostrar
  cor?: string                                  // cor da luz do nicho (#hex)
}

type Props = {
  itens: ItemVitrine[]                  // até 8
  destaqueId?: string                   // (opcional) começa centralizado nele
  onVerProduto: (id: string) => void
  onInteresse?: (id: string) => void
  titulo?: string
}

// Rocha com relevo (gerada pelo navegador, sem imagem externa)
const rocha = (claridade: number, freq: number) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='5' seed='7' stitchTiles='stitch' result='n'/><feDiffuseLighting in='n' surfaceScale='7' lighting-color='rgb(${claridade},${claridade},${claridade + 6})'><feDistantLight azimuth='235' elevation='38'/></feDiffuseLighting></filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`,
)}")`
const ROCHA_ESCURA = rocha(48, 0.02)
const PEDRA_CLARA = rocha(228, 0.03)

// ─── Corta as sobras transparentes da foto (foto quadrada sem fundo deixa o celular pequeno) ───
const cacheRecorte: Record<string, string> = {}
function useFotoRecortada(url: string) {
  const [final, setFinal] = useState(cacheRecorte[url] || url)
  useEffect(() => {
    if (cacheRecorte[url]) { setFinal(cacheRecorte[url]); return }
    let vivo = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight
        const red = Math.min(1, 240 / Math.max(w, h))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(w * red)); c.height = Math.max(1, Math.round(h * red))
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, c.width, c.height)
        const px = ctx.getImageData(0, 0, c.width, c.height).data
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          if (px[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
        }
        if (x1 < 0) return
        const sobra = 1 - ((x1 - x0 + 1) * (y1 - y0 + 1)) / (c.width * c.height)
        if (sobra < 0.08) { cacheRecorte[url] = url; return }
        const fx = w / c.width, fy = h / c.height, m = 2
        const sx = Math.max(0, (x0 - m) * fx), sy = Math.max(0, (y0 - m) * fy)
        const sw = Math.min(w - sx, (x1 - x0 + 1 + 2 * m) * fx), sh = Math.min(h - sy, (y1 - y0 + 1 + 2 * m) * fy)
        const out = document.createElement('canvas')
        out.width = Math.round(sw); out.height = Math.round(sh)
        out.getContext('2d')?.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height)
        out.toBlob(b => {
          if (!b || !vivo) return
          cacheRecorte[url] = URL.createObjectURL(b)
          setFinal(cacheRecorte[url])
        }, 'image/png')
      } catch { /* sem permissão de leitura: usa a original */ }
    }
    img.src = url
    return () => { vivo = false }
  }, [url])
  return final
}

function Nicho({ it, estado, onToque }: { it: ItemVitrine; estado: string; onToque: () => void }) {
  const foto = useFotoRecortada(it.foto)
  return (
    <div className={'vn-coluna ' + estado} data-id={it.id} onClick={onToque}>
      <div className="vn-nicho" style={{ ['--cor' as string]: it.cor || '#ffd9b0' }}>
        <div className="vn-costas" />
        <div className="vn-tinta" />
        <div className="vn-teto" />
        <div className="vn-lado vn-esq" />
        <div className="vn-lado vn-dir" />
        <div className="vn-cone" />
        <div className="vn-led" />
        <div className="vn-chao"><img src={foto} alt="" aria-hidden draggable={false} /></div>
        <img className="vn-foto" src={foto} alt={it.nome} draggable={false} />
        <div className="vn-laranja" />
      </div>
      <p className="vn-nome">{it.nome}</p>
    </div>
  )
}

export default function VitrineHero({ itens, destaqueId, onVerProduto, onInteresse, titulo = 'A coleção Marcos Magazine' }: Props) {
  const lista = useMemo(() => itens.filter(i => i.foto).slice(0, 8), [itens])
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [ativo, setAtivo] = useState<string | null>(null)        // nicho no meio da tela (aceso em laranja)
  const [escolhido, setEscolhido] = useState<string | null>(null) // tocado: os outros apagam
  const [largo, setLargo] = useState(false)
  const fimRolagem = useRef(0)
  const travado = useRef(0)
  const [dedo, setDedo] = useState<string | null>(null)          // nicho embaixo do dedo/mouse: a luz acende
  const ponto = useRef<{ x: number; y: number } | null>(null)    // onde o dedo está na tela

  // Começa com o destaque (ou o 1º) no meio
  useEffect(() => {
    const t = trilhoRef.current
    if (!t || !lista.length) return
    const colunas = t.querySelectorAll('.vn-coluna')
    // começa com o 2º no meio, assim já aparecem 3 celulares lado a lado
    const alvo = (destaqueId && t.querySelector(`[data-id="${destaqueId}"]`)) || colunas[Math.min(1, colunas.length - 1)]
    if (alvo) centralizar(alvo as HTMLElement, false)
    medirMeio()
  }, [lista.length])

  useEffect(() => {
    const medir = () => setLargo(window.innerWidth >= 760)
    medir(); window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  // Fechado: nicho no meio da tela. Aberto: nicho encostado à esquerda e as especificações do lado.
  const MARGEM_ABERTO = largo ? 48 : 14
  function centralizar(el: HTMLElement, suave = true, aberto = !!escolhido) {
    const t = trilhoRef.current
    if (!t) return
    const left = aberto ? el.offsetLeft - MARGEM_ABERTO : el.offsetLeft + el.offsetWidth / 2 - t.clientWidth / 2
    clearTimeout(fimRolagem.current)
    travado.current = Date.now() + (suave ? 700 : 450) // rolagem feita pelo código não troca o celular escolhido
    if (!suave) {
      // ao abrir/fechar o layout muda: desliga o "encaixe" um instante para o navegador não voltar pro celular antigo
      t.style.scrollSnapType = 'none'
      t.scrollLeft = left
      window.setTimeout(() => { t.style.scrollSnapType = '' }, 300)
      return
    }
    t.scrollTo({ left, behavior: 'smooth' })
  }

  // Depois que o layout muda (abre/fecha), reposiciona o nicho escolhido
  useEffect(() => {
    const t = trilhoRef.current
    const id = escolhido || ativo
    if (!t || !id) return
    const el = t.querySelector(`[data-id="${id}"]`) as HTMLElement | null
    if (!el) return
    const q = requestAnimationFrame(() => centralizar(el, false, !!escolhido))
    return () => cancelAnimationFrame(q)
  }, [!!escolhido])

  // Qual nicho está no meio da tela
  function medirMeio() {
    const t = trilhoRef.current
    if (!t) return null
    const primeira = t.querySelector<HTMLElement>('.vn-coluna')
    const meio = escolhido && primeira ? t.scrollLeft + MARGEM_ABERTO + primeira.offsetWidth / 2 : t.scrollLeft + t.clientWidth / 2
    let melhor: string | null = null, dist = Infinity
    t.querySelectorAll<HTMLElement>('.vn-coluna').forEach(c => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - meio)
      if (d < dist) { dist = d; melhor = c.dataset.id || null }
    })
    setAtivo(melhor)
    return melhor
  }

  // Descobre qual nicho está embaixo do dedo (ou do mouse)
  function nichoNoPonto(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest('.vn-coluna') as HTMLElement | null
    const id = el && trilhoRef.current?.contains(el) ? el.dataset.id || null : null
    setDedo(atual => (atual === id ? atual : id))
  }
  function dedoDesceu(e: ToqueEvento) {
    if (escolhido) return
    const t = e.touches[0]; ponto.current = { x: t.clientX, y: t.clientY }; nichoNoPonto(t.clientX, t.clientY)
  }
  function dedoMexeu(e: ToqueEvento) {
    if (escolhido || !ponto.current) return
    const t = e.touches[0]; ponto.current = { x: t.clientX, y: t.clientY }; nichoNoPonto(t.clientX, t.clientY)
  }
  function dedoSaiu() { ponto.current = null; setDedo(null) }

  function aoRolar() {
    // dedo parado enquanto a vitrine passa embaixo dele: a luz vai acendendo em cada celular que passa
    if (ponto.current && !escolhido) nichoNoPonto(ponto.current.x, ponto.current.y)
    const id = medirMeio()
    if (Date.now() < travado.current) return
    // Com um celular aberto, deslizar para o lado passa para o próximo (já com as especificações)
    clearTimeout(fimRolagem.current)
    fimRolagem.current = window.setTimeout(() => { if (Date.now() >= travado.current && escolhido && id && id !== escolhido) setEscolhido(id) }, 140)
  }

  function tocar(id: string, el: HTMLElement | null) {
    if (escolhido === id) { onVerProduto(id); return }
    const jaAberto = !!escolhido
    clearTimeout(fimRolagem.current)
    travado.current = Date.now() + 700
    setEscolhido(id)
    if (el && jaAberto) centralizar(el, true, true)
  }

  if (lista.length === 0) return null
  const atual = lista.find(i => i.id === escolhido) || null

  return (
    <section className={'vn' + (escolhido ? ' vn-aberto' : '') + (largo ? ' vn-largo' : '')} style={{ backgroundImage: `${ROCHA_ESCURA}` }}>
      <style>{CSS}</style>
      <div className="vn-cabeca">
        <span>VITRINE</span>
        <h2>{titulo}</h2>
      </div>
      {escolhido && <button className="vn-fechar" onClick={() => setEscolhido(null)} aria-label="Voltar">✕</button>}

      <div className="vn-palco">
      <div ref={trilhoRef} className="vn-trilho" onScroll={aoRolar}
        onTouchStart={dedoDesceu} onTouchMove={dedoMexeu} onTouchEnd={dedoSaiu} onTouchCancel={dedoSaiu}
        onPointerMove={e => { if (!escolhido && e.pointerType === 'mouse') nichoNoPonto(e.clientX, e.clientY) }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') dedoSaiu() }}>
        {lista.map((it, i) => {
          const iDedo = dedo ? lista.findIndex(x => x.id === dedo) : -99
          const estado = escolhido ? (escolhido === it.id ? 'escolhido' : 'apagado')
            : i === iDedo ? 'luz' : Math.abs(i - iDedo) === 1 ? 'meia' : 'fraca'
          return <Nicho key={it.id} it={it} estado={estado}
            onToque={() => tocar(it.id, trilhoRef.current?.querySelector(`[data-id="${it.id}"]`) as HTMLElement | null)} />
        })}
      </div>

      <div className="vn-info" aria-hidden={!atual}>
        {atual && (
          <div className="vn-info-dentro" key={atual.id}>
            {atual.marca && <span className="vn-marca">{atual.marca}</span>}
            <h3>{atual.nome}</h3>
            {atual.detalhe && <p className="vn-detalhe">{atual.detalhe}</p>}
            {!!atual.specs?.length && (
              <ul className="vn-specs">
                {atual.specs.map(s => <li key={s.rotulo}><span>{s.rotulo}</span><b>{s.valor}</b></li>)}
              </ul>
            )}
            {atual.preco && <p className="vn-preco">{atual.preco}</p>}
            <div className="vn-botoes">
              <button className="vn-bt-claro" onClick={() => onVerProduto(atual.id)}>Ver no catálogo</button>
              {onInteresse && <button className="vn-bt-verde" onClick={() => onInteresse(atual.id)}>Tenho interesse</button>}
            </div>
          </div>
        )}
      </div>
      </div>
    </section>
  )
}

const CSS = `
.vn { position: relative; background-color: #0e0d10; background-size: 420px 420px; padding: 22px 0 26px; overflow: hidden; }
.vn::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 70% at 50% 40%, transparent 30%, rgba(0,0,0,0.75) 100%), linear-gradient(180deg, rgba(0,0,0,0.45), transparent 18%, transparent 80%, rgba(0,0,0,0.6)); }
.vn-cabeca { position: relative; text-align: center; color: #fff; padding: 0 20px 14px; transition: opacity .5s; }
.vn-aberto .vn-cabeca { opacity: 0.25; }
.vn-cabeca span { font-size: 11px; letter-spacing: 5px; font-weight: 700; color: #ffb27a; }
.vn-cabeca h2 { margin: 4px 0 0; font-size: clamp(22px, 5.6vw, 34px); font-weight: 800; letter-spacing: -0.6px; color: #fff; }
.vn .vn-fechar { position: absolute; top: 16px; left: 14px; z-index: 5; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 16px; font-family: inherit; background: rgba(0,0,0,0.45);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }

/* trilho que desliza para o lado */
.vn-trilho { position: relative; display: flex; gap: 7px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
  padding: 6px calc(50% - 15.5vw) 4px; -webkit-overflow-scrolling: touch; }
.vn-trilho::-webkit-scrollbar { display: none; }
.vn-coluna { flex: 0 0 31vw; min-width: 0; max-width: none; overflow: hidden; scroll-snap-align: center; cursor: pointer; transition: opacity .7s ease, filter .7s ease; }
.vn-palco { position: relative; }
/* aberto: nicho encosta à esquerda e as especificações ficam do lado */
.vn-aberto .vn-trilho { padding-left: 14px; padding-right: 60vw; scroll-padding-left: 14px; }
.vn-aberto .vn-coluna { flex-basis: 44vw; scroll-snap-align: start; }
.vn-largo.vn-aberto .vn-trilho { padding-left: 48px; scroll-padding-left: 48px; }
.vn-largo.vn-aberto .vn-coluna { flex-basis: 240px; }
.vn-largo .vn-trilho { padding: 6px 48px 4px; gap: 18px; }
.vn-largo .vn-trilho::after { content: ''; flex: 0 0 24px; }
.vn-largo .vn-coluna { flex-basis: 200px; }

/* o nicho cavado na rocha */
.vn-nicho { position: relative; height: 64vw; max-height: 300px; transition: height .55s ease; overflow: hidden; background: #040405;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04), 0 30px 60px rgba(0,0,0,0.75); }
.vn-largo .vn-nicho { height: 420px; max-height: none; }
.vn-aberto .vn-nicho { height: 122vw; max-height: 520px; }
.vn-largo.vn-aberto .vn-nicho { height: 470px; }
/* parede de pedra do fundo: só aparece onde a luz bate (cone que abre de cima para baixo) */
.vn-costas { position: absolute; inset: 0; background-image: ${PEDRA_CLARA}; background-size: 180px 180px; background-position: center top;
  -webkit-mask-image: radial-gradient(46% 80% at 50% 0%, #000 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.4) 62%, rgba(0,0,0,0.14) 85%, rgba(0,0,0,0.06) 100%);
  mask-image: radial-gradient(46% 80% at 50% 0%, #000 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.4) 62%, rgba(0,0,0,0.14) 85%, rgba(0,0,0,0.06) 100%);
  transition: opacity .8s ease; }
/* cor da luz (tom do aparelho) */
.vn-tinta { position: absolute; inset: 0; mix-blend-mode: color; opacity: .5;
  background: radial-gradient(80% 90% at 50% 10%, var(--cor), transparent 80%); transition: opacity .8s ease; }
/* sombra de profundidade nas bordas de dentro */
.vn-teto { position: absolute; inset: 0; pointer-events: none;
  box-shadow: inset 0 26px 30px -10px #000, inset 18px 0 26px -8px rgba(0,0,0,0.85), inset -26px 0 30px -8px #000, inset 0 -10px 20px -6px #000; }
/* filete de luz na lateral de dentro, como no vídeo */
.vn-lado { position: absolute; top: 3%; bottom: 7%; width: 3px; transition: opacity .8s ease, background .4s; pointer-events: none; }
.vn-esq { left: 3.5%; border-radius: 3px; opacity: .95;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--cor) 55%, #fff) 25%, #fff 55%, color-mix(in srgb, var(--cor) 60%, #fff) 85%, transparent);
  box-shadow: 0 0 12px 2px color-mix(in srgb, var(--cor) 70%, transparent), 10px 0 40px 6px color-mix(in srgb, var(--cor) 25%, transparent); }
.vn-dir { right: 3.5%; width: 3px; opacity: .35; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.7) 50%, transparent); }
/* feixe de luz do spot */
.vn-cone { position: absolute; left: 50%; top: 2.5%; width: 64%; height: 82%; transform: translateX(-50%); pointer-events: none;
  background: linear-gradient(180deg, rgba(255,253,248,1), rgba(255,250,242,0.45) 35%, rgba(255,250,242,0.14) 75%, rgba(255,250,242,0.04));
  clip-path: polygon(45% 0, 55% 0, 100% 100%, 0 100%); filter: blur(16px); mix-blend-mode: screen; transition: opacity .8s ease; }
.vn-led { position: absolute; left: 50%; top: 2.2%; width: 28%; height: 5px; transform: translateX(-50%); border-radius: 50%;
  background: #fff; box-shadow: 0 0 8px 3px #fff, 0 0 28px 10px rgba(255,245,230,0.9), 0 10px 60px 24px rgba(255,240,220,0.45); transition: opacity .6s ease; }
/* prateleira: borda de vidro acesa + reflexo */
.vn-chao { position: absolute; left: 0; right: 0; bottom: 0; height: 9%; overflow: hidden;
  background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 45%, rgba(0,0,0,0.7)); }
.vn-chao::before { content: ''; position: absolute; left: 3%; right: 3%; top: 0; height: 2px; background: rgba(255,255,255,0.75);
  box-shadow: 0 0 10px rgba(255,255,255,0.55); }
.vn-chao img { position: absolute; left: 50%; top: 3px; width: 100%; transform: translateX(-50%) scaleY(-1); opacity: .2; filter: blur(2px); }
.vn-foto { position: absolute; left: 50%; bottom: 9%; height: 49%; width: auto; max-width: 100%; object-fit: contain; object-position: bottom;
  transform: translateX(-50%); transform-origin: 50% 100%; transition: transform .45s cubic-bezier(.2,.8,.2,1), filter .8s ease;
  filter: drop-shadow(0 14px 14px rgba(0,0,0,0.6)) brightness(1.12); }
.vn-laranja { position: absolute; left: 3%; right: 3%; bottom: 9%; height: 3px; border-radius: 2px; opacity: 0; transition: opacity .35s ease;
  background: #ff7a1a; box-shadow: 0 0 10px #ff7a1a, 0 0 26px rgba(255,122,26,0.85), 0 -18px 50px rgba(255,122,26,0.4); }
.vn-nome { margin: 8px 0 0; text-align: center; font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,0.45); letter-spacing: .3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .4s; }

/* Luz fraca em todos; o dedo passando acende o nicho (e um pouco os vizinhos), igual ao vídeo */
.vn-coluna .vn-led, .vn-coluna .vn-cone, .vn-coluna .vn-costas, .vn-coluna .vn-tinta, .vn-coluna .vn-lado { transition: opacity .9s ease; }
.vn-coluna .vn-foto { transition: transform .45s cubic-bezier(.2,.8,.2,1), filter .9s ease; }
.vn-coluna.fraca .vn-led { opacity: .6; }
.vn-coluna.fraca .vn-cone { opacity: .42; }
.vn-coluna.fraca .vn-costas { opacity: .58; }
.vn-coluna.fraca .vn-tinta, .vn-coluna.fraca .vn-lado { opacity: .4; }
.vn-coluna.fraca .vn-foto { filter: drop-shadow(0 14px 14px rgba(0,0,0,0.6)) brightness(0.88); }
.vn-coluna.meia .vn-led { opacity: .8; }
.vn-coluna.meia .vn-cone { opacity: .7; }
.vn-coluna.meia .vn-costas { opacity: .8; }
.vn-coluna.meia .vn-tinta, .vn-coluna.meia .vn-lado { opacity: .65; }
.vn-coluna.meia .vn-foto { filter: drop-shadow(0 14px 14px rgba(0,0,0,0.6)) brightness(1); }
/* acendendo: mais rápido para subir do que para apagar */
.vn-coluna.luz .vn-led, .vn-coluna.luz .vn-cone, .vn-coluna.luz .vn-costas, .vn-coluna.luz .vn-tinta, .vn-coluna.luz .vn-lado { transition: opacity .4s ease; }
.vn-coluna.luz .vn-foto { transition: transform .35s cubic-bezier(.2,.8,.2,1), filter .4s ease; }

/* embaixo do dedo (ou escolhido): cresce e acende laranja */
.vn-coluna.luz .vn-foto, .vn-coluna.escolhido .vn-foto { transform: translateX(-50%) scale(1.07); }
.vn-coluna.luz .vn-laranja, .vn-coluna.escolhido .vn-laranja { opacity: 1; }
.vn-coluna.luz .vn-esq, .vn-coluna.escolhido .vn-esq { background: linear-gradient(180deg, transparent, #ffb27a 25%, #fff 55%, #ff7a1a 85%, transparent); box-shadow: 0 0 12px 2px rgba(255,122,26,0.8), 10px 0 40px 6px rgba(255,122,26,0.3); }
.vn-coluna.luz .vn-nome, .vn-coluna.escolhido .vn-nome { color: #fff; }

/* tocou: a luz dos outros apaga */
.vn-coluna.apagado { filter: brightness(0.28) saturate(0.5); }
.vn-coluna.apagado .vn-led, .vn-coluna.apagado .vn-cone, .vn-coluna.apagado .vn-lado { opacity: 0; }
.vn-coluna.apagado .vn-costas, .vn-coluna.apagado .vn-tinta { opacity: .2; }
.vn-coluna.escolhido .vn-led { box-shadow: 0 0 10px 3px #fff, 0 0 30px 10px rgba(255,245,230,0.85), 0 6px 50px 18px rgba(255,240,220,0.45); }

/* especificações */
.vn-info { position: absolute; top: 6px; bottom: 34px; left: calc(14px + 44vw + 8px); right: 0; z-index: 3; display: flex; align-items: flex-start;
  pointer-events: none; opacity: 0; transition: opacity .5s ease; overflow-y: auto; scrollbar-width: none;
  background: linear-gradient(90deg, rgba(6,6,8,0.7), rgba(6,6,8,0.94) 18%); }
.vn-largo .vn-info { left: calc(48px + 240px + 24px); }
.vn-aberto .vn-info { opacity: 1; pointer-events: auto; }
.vn-info-dentro { width: 100%; padding: 8px 14px 8px 8px; color: #fff; animation: vnSobe .55s ease .2s both; max-width: 440px; margin: auto 0; }
.vn-largo .vn-info-dentro { padding: 10px 40px; }
@keyframes vnSobe { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: none } }
.vn-marca { font-size: 11px; letter-spacing: 4px; font-weight: 700; color: #ffb27a; text-transform: uppercase; }
.vn-info h3 { margin: 4px 0 2px; font-size: clamp(22px, 6vw, 44px); font-weight: 800; letter-spacing: -1px; line-height: 1.05; color: #fff; }
.vn-detalhe { margin: 0; font-size: 13px; color: rgba(255,255,255,0.6); }
.vn-specs { list-style: none; margin: 14px 0 0; padding: 0; border-top: 1px solid rgba(255,255,255,0.12); }
.vn-specs li { display: flex; flex-direction: column; gap: 1px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13.5px; }
.vn-specs span { color: rgba(255,255,255,0.5); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
.vn-specs b { color: #fff; font-weight: 600; }
.vn-largo .vn-specs li { flex-direction: row; justify-content: space-between; gap: 12px; padding: 9px 0; font-size: 14px; }
.vn-largo .vn-specs span { font-size: 14px; text-transform: none; letter-spacing: 0; }
.vn-preco { margin: 12px 0 0; font-size: 20px; font-weight: 800; color: #fff; }
.vn-botoes { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.vn-largo .vn-botoes { flex-direction: row; }
.vn .vn-botoes button { flex: 1; text-align: center; border: none; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 800; padding: 12px 10px; border-radius: 26px; }
.vn .vn-bt-claro { background: #fff; color: #111; }
.vn .vn-bt-verde { background: #25D366; color: #fff; }
`
