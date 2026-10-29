import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// ─── Abertura "parede de nichos" (estilo loja de perfumes) ───────────────────
// Parede de pedra escura com nichos iluminados. Ao escolher um celular, a luz dos
// outros nichos apaga, a câmera aproxima do escolhido e aparecem o nome e as
// especificações. O "✕" (ou tocar fora) volta e as luzes acendem de novo.
// Passando o dedo na parede, o celular cresce e o nicho acende em laranja.
// Sem bibliotecas: só React + CSS. O zoom muda o tamanho real da parede
// (não é "scale" de imagem), então as fotos continuam nítidas.

export type ItemVitrine = {
  id: string
  nome: string
  foto: string                                  // de preferência sem fundo (PNG transparente)
  detalhe?: string                              // ex: "256GB · Lançamento"
  marca?: string
  specs?: { rotulo: string; valor: string }[]   // memória, condição, bateria, cores...
  preco?: string                                // só se estiver liberado para mostrar
  cor?: string                                  // (não usado neste estilo)
}

type Props = {
  itens: ItemVitrine[]                  // até 10
  destaqueId?: string                   // (opcional) celular aberto ao carregar
  onVerProduto: (id: string) => void
  onInteresse?: (id: string) => void
  titulo?: string
}

// Textura de pedra escura (gerada pelo navegador, sem imagem externa)
const PEDRA = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.62' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.54  0 0 0 0 0.58  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`

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

function FotoNicho({ url, nome }: { url: string; nome: string }) {
  const src = useFotoRecortada(url)
  return <img src={src} alt={nome} draggable={false} />
}

export default function VitrineHero({ itens, destaqueId, onVerProduto, onInteresse, titulo = 'A coleção Marcos Magazine' }: Props) {
  const lista = useMemo(() => itens.filter(i => i.foto).slice(0, 10), [itens])
  const linhas = useMemo(() => {
    if (lista.length <= 5) return [lista]
    const meio = Math.ceil(lista.length / 2)
    return [lista.slice(0, meio), lista.slice(meio)]
  }, [lista])

  const [foco, setFoco] = useState<string | null>(lista.find(i => i.id === destaqueId)?.id || null)
  const [realce, setRealce] = useState<string | null>(null)
  const [animar, setAnimar] = useState(false)
  const palcoRef = useRef<HTMLDivElement>(null)
  const paredeRef = useRef<HTMLDivElement>(null)
  const nichoRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const toque = useRef<{ x: number; y: number } | null>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [camera, setCamera] = useState({ left: 0, top: 0, largura: 0 })
  const largo = tam.w >= 760 // iPad/computador: especificações ao lado

  useEffect(() => {
    const medir = () => { const p = palcoRef.current; if (p) setTam({ w: p.clientWidth, h: p.clientHeight }) }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    if (ro && palcoRef.current) ro.observe(palcoRef.current)
    window.addEventListener('resize', medir)
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir) }
  }, [lista.length])

  // Câmera: a parede inteira, ou o nicho escolhido grande (no celular fica em cima; no iPad, à direita)
  useLayoutEffect(() => {
    const parede = paredeRef.current
    if (!parede || !tam.w) return
    const W = parede.offsetWidth || 1
    const larguraBase = Math.min(tam.w * 0.94, 1100)
    const alturaRel = parede.offsetHeight / W
    const el = foco ? nichoRefs.current[foco] : null
    if (!el) {
      setCamera({ left: (tam.w - larguraBase) / 2, top: Math.max(10, (tam.h - alturaRel * larguraBase) / 2 + tam.h * 0.04), largura: larguraBase })
    } else {
      let x = 0, y = 0
      let n: HTMLElement | null = el
      while (n && n !== parede) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null }
      const rx = (x + el.offsetWidth / 2) / W, ry = (y + el.offsetHeight / 2) / W
      const rw = el.offsetWidth / W, rh = el.offsetHeight / W
      const altura = largo ? tam.h * 0.86 : tam.h * 0.58
      const largura = Math.max(larguraBase, Math.min(altura / rh, (largo ? tam.w * 0.42 : tam.w * 0.62) / rw))
      const alvoX = largo ? tam.w * 0.66 : tam.w / 2
      const alvoY = largo ? tam.h * 0.5 : tam.h * 0.33
      setCamera({ left: alvoX - rx * largura, top: alvoY - ry * largura, largura })
    }
    if (!animar) setTimeout(() => setAnimar(true), 80)
  }, [foco, tam.w, tam.h, lista.length, largo])

  function idNoPonto(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest('.vn-nicho') as HTMLElement | null
    return el?.dataset.id || null
  }
  function passar(direcao: 1 | -1) {
    const i = foco ? lista.findIndex(x => x.id === foco) : -1
    const prox = i < 0 ? 0 : (i + direcao + lista.length) % lista.length
    setFoco(lista[prox].id)
  }

  if (lista.length === 0) return null
  const atual = lista.find(i => i.id === foco) || null

  return (
    <section className="vn">
      <style>{CSS}</style>
      <div ref={palcoRef} className={'vn-palco' + (foco ? ' vn-focado' : '') + (largo ? ' vn-largo' : '')}
        style={{ backgroundImage: `${PEDRA}, radial-gradient(80% 60% at 50% 20%, #2b2a2f 0%, #18171b 60%, #0d0c0f 100%)` }}
        onTouchStart={e => {
          toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          if (!foco) setRealce(idNoPonto(e.touches[0].clientX, e.touches[0].clientY))
        }}
        onTouchMove={e => { if (!foco) setRealce(idNoPonto(e.touches[0].clientX, e.touches[0].clientY)) }}
        onTouchEnd={e => {
          const t = toque.current; toque.current = null
          setRealce(null)
          if (!t || !foco) return
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) passar(dx < 0 ? 1 : -1)
        }}
        onMouseMove={e => { if (!foco) setRealce(idNoPonto(e.clientX, e.clientY)) }}
        onMouseLeave={() => setRealce(null)}>

        <div ref={paredeRef} className={animar ? 'vn-parede vn-anima' : 'vn-parede'}
          style={{ left: camera.left, top: camera.top, width: camera.largura || 400, fontSize: (camera.largura || 400) / 100, visibility: camera.largura ? 'visible' : 'hidden' }}>
          {linhas.map((linha, li) => (
            <div key={li} className="vn-linha">
              {linha.map(it => {
                const estado = foco ? (foco === it.id ? ' escolhido' : ' apagado') : realce === it.id ? ' realce' : ''
                return (
                  <div key={it.id} data-id={it.id} ref={r => { nichoRefs.current[it.id] = r }}
                    className={'vn-nicho' + estado}
                    onClick={e => { e.stopPropagation(); if (foco === it.id) onVerProduto(it.id); else setFoco(it.id) }}>
                    <div className="vn-fundo" />
                    <div className="vn-luz" />
                    <FotoNicho url={it.foto} nome={it.nome} />
                    <div className="vn-base" />
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="vn-sombra" />

        <div className="vn-topo" style={{ opacity: foco ? 0 : 1 }}>
          <span>VITRINE</span>
          <h2>{titulo}</h2>
        </div>

        {foco && <button className="vn-fechar" onClick={() => setFoco(null)} aria-label="Voltar para a vitrine">✕</button>}

        <div className={largo ? 'vn-info vn-info-lado' : 'vn-info'} style={{ opacity: atual ? 1 : 0, transform: atual ? 'none' : 'translateY(18px)', pointerEvents: atual ? 'auto' : 'none' }}>
          {atual?.marca && <span className="vn-marca">{atual.marca}</span>}
          <h3>{atual?.nome}</h3>
          {atual?.detalhe && <p className="vn-detalhe">{atual.detalhe}</p>}
          {!!atual?.specs?.length && (
            <ul className="vn-specs">
              {atual.specs.map(s => <li key={s.rotulo}><span>{s.rotulo}</span><b>{s.valor}</b></li>)}
            </ul>
          )}
          {atual?.preco && <p className="vn-preco">{atual.preco}</p>}
          <div className="vn-botoes">
            <button className="vn-bt-claro" onClick={() => atual && onVerProduto(atual.id)}>Ver no catálogo</button>
            {onInteresse && <button className="vn-bt-verde" onClick={() => atual && onInteresse(atual.id)}>Tenho interesse</button>}
          </div>
        </div>
      </div>
    </section>
  )
}

// 1em = 1% da largura da parede: tudo cresce junto no zoom (fotos nítidas)
const CSS = `
.vn { position: relative; }
.vn-palco { position: relative; height: min(84svh, 720px); min-height: 520px; overflow: hidden; background-color: #141317;
  background-size: 260px 260px, cover; isolation: isolate; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
.vn-parede { position: absolute; display: flex; flex-direction: column; gap: 4em; }
.vn-parede.vn-anima { transition: left 1.05s cubic-bezier(.22,.8,.2,1), top 1.05s cubic-bezier(.22,.8,.2,1), width 1.05s cubic-bezier(.22,.8,.2,1), font-size 1.05s cubic-bezier(.22,.8,.2,1); }
.vn-linha { display: flex; justify-content: center; gap: 2.6em; }
.vn-nicho { position: relative; flex: 0 0 16.8em; height: 36em; border-radius: 0.6em 0.6em 0.3em 0.3em; cursor: pointer; overflow: hidden;
  box-shadow: inset 0 0 0 0.12em rgba(255,255,255,0.05), inset 0 1.8em 3em rgba(0,0,0,0.85), inset 0 -1em 2.4em rgba(0,0,0,0.7), 0 1.6em 3em rgba(0,0,0,0.6);
  transition: filter .7s ease; }
.vn-fundo { position: absolute; inset: 0; background: linear-gradient(180deg, #3a383f 0%, #222126 55%, #141317 100%); transition: background .7s ease; }
.vn-luz { position: absolute; inset: 0; pointer-events: none; transition: opacity .7s ease;
  background: radial-gradient(55% 9% at 50% 0%, rgba(255,250,240,0.95), rgba(255,250,240,0) 100%),
    linear-gradient(180deg, rgba(255,244,230,0.42) 0%, rgba(255,244,230,0.14) 45%, rgba(255,244,230,0) 78%);
  clip-path: polygon(36% 0, 64% 0, 100% 100%, 0 100%); mix-blend-mode: screen; }
.vn-nicho img { position: absolute; left: 50%; bottom: 4.2em; width: 78%; height: 62%; object-fit: contain; object-position: bottom; transform: translateX(-50%);
  transform-origin: 50% 100%; filter: drop-shadow(0 1em 1.2em rgba(0,0,0,0.7)); transition: transform .25s ease, filter .7s ease; }
.vn-base { position: absolute; left: 8%; right: 8%; bottom: 3.6em; height: 0.35em; border-radius: 0.2em; background: rgba(255,255,255,0.16); transition: background .3s, box-shadow .3s; }

/* passando o dedo: cresce e o nicho acende em laranja */
.vn-nicho.realce img { transform: translateX(-50%) translateY(-0.8em) scale(1.14); }
.vn-nicho.realce .vn-base { background: #ff7a1a; box-shadow: 0 0 0.8em #ff7a1a, 0 0 2.4em rgba(255,122,26,0.8); }
.vn-nicho.realce .vn-fundo { background: linear-gradient(180deg, #4a3a32 0%, #2a2220 55%, #161315 100%); }

/* escolhido: luz forte; os outros apagam */
.vn-nicho.escolhido .vn-luz { opacity: 1; }
.vn-nicho.escolhido .vn-base { background: #ff7a1a; box-shadow: 0 0 0.8em #ff7a1a, 0 0 2.4em rgba(255,122,26,0.8); }
.vn-nicho.apagado .vn-luz { opacity: 0; }
.vn-nicho.apagado { filter: brightness(0.32) saturate(0.6); }

.vn-sombra { position: absolute; inset: 0; pointer-events: none; transition: background .8s ease;
  background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 20%, transparent 70%, rgba(0,0,0,0.6) 100%); }
.vn-focado .vn-sombra { background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 18%, transparent 46%, rgba(10,9,12,0.92) 72%, #0b0a0d 100%); }
.vn-largo.vn-focado .vn-sombra { background: linear-gradient(90deg, rgba(11,10,13,0.94) 0%, rgba(11,10,13,0.8) 34%, transparent 52%), linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 16%); }
.vn-topo { position: absolute; left: 0; right: 0; top: 20px; text-align: center; color: #fff; transition: opacity .5s ease; pointer-events: none; }
.vn-topo span { font-size: 11px; letter-spacing: 5px; font-weight: 700; color: #ffb27a; }
.vn-topo h2 { margin: 6px 0 0; font-size: clamp(22px, 5.6vw, 36px); font-weight: 800; letter-spacing: -0.6px; color: #fff; }
.vn .vn-fechar { position: absolute; top: 14px; left: 14px; width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.18); cursor: pointer;
  color: #fff; font-size: 16px; font-family: inherit; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }

.vn-info { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 20px 22px; color: #fff; transition: opacity .55s ease .35s, transform .55s ease .35s; }
.vn-info-lado { left: 6%; right: auto; top: 0; bottom: 0; width: 38%; display: flex; flex-direction: column; justify-content: center; padding: 0; }
.vn-marca { font-size: 11px; letter-spacing: 4px; font-weight: 700; color: #ffb27a; text-transform: uppercase; }
.vn-info h3 { margin: 4px 0 2px; font-size: clamp(28px, 7.4vw, 50px); font-weight: 800; letter-spacing: -1px; line-height: 1.05; color: #fff; }
.vn-detalhe { margin: 0; font-size: 13px; color: rgba(255,255,255,0.6); }
.vn-specs { list-style: none; margin: 14px 0 0; padding: 0; border-top: 1px solid rgba(255,255,255,0.12); }
.vn-specs li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; }
.vn-specs span { color: rgba(255,255,255,0.55); }
.vn-specs b { color: #fff; font-weight: 600; text-align: right; }
.vn-preco { margin: 12px 0 0; font-size: 22px; font-weight: 800; color: #fff; }
.vn-botoes { display: flex; gap: 8px; margin-top: 14px; }
.vn .vn-botoes button { flex: 1; text-align: center; border: none; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 800; padding: 13px 10px; border-radius: 26px; }
.vn .vn-bt-claro { background: #fff; color: #111; }
.vn .vn-bt-verde { background: #25D366; color: #fff; }
@media (prefers-reduced-motion: reduce) { .vn-parede.vn-anima { transition: none; } }
`
