import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// ─── Abertura "parede de vitrine" (estilo loja de tênis) ─────────────────────
// Parede cinza com prateleiras de acrílico. Abre com zoom no celular em destaque
// e a câmera se afasta mostrando a parede inteira. Ao tocar num celular, a câmera
// vai até ele, a prateleira acende em laranja e aparecem o nome e o botão
// "Ver no catálogo". Sem bibliotecas: só React + CSS.
//
// O zoom muda o TAMANHO real da parede (e não um "scale" de imagem), por isso
// as fotos continuam nítidas mesmo bem de perto.

export type ItemVitrine = {
  id: string
  nome: string
  foto: string          // de preferência a foto sem fundo (PNG transparente)
  detalhe?: string      // ex: "256GB · Lançamento"
  cor?: string          // (opcional) não usado neste estilo
}

type Props = {
  itens: ItemVitrine[]               // até 10 (2 prateleiras de 5)
  destaqueId?: string                // começa com zoom nele (padrão: o primeiro)
  onVerProduto: (id: string) => void
  titulo?: string
}

// Textura fosca da parede (gerada pelo navegador, sem imagem externa)
const TEXTURA = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.46  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
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
        if (sobra < 0.08) { cacheRecorte[url] = url; return } // já está justa
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
      } catch { /* foto sem permissão de leitura: usa a original */ }
    }
    img.src = url
    return () => { vivo = false }
  }, [url])
  return final
}

function FotoVitrine({ url, nome }: { url: string; nome: string }) {
  const src = useFotoRecortada(url)
  return <img src={src} alt={nome} draggable={false} />
}

export default function VitrineHero({ itens, destaqueId, onVerProduto, titulo = 'Vitrine Marcos Magazine' }: Props) {
  const lista = useMemo(() => itens.filter(i => i.foto).slice(0, 10), [itens])
  const prateleiras = useMemo(() => {
    if (lista.length <= 5) return [lista]
    const meio = Math.ceil(lista.length / 2)
    return [lista.slice(0, meio), lista.slice(meio)]
  }, [lista])

  const inicial = lista.find(i => i.id === destaqueId)?.id || lista[0]?.id || null
  const [foco, setFoco] = useState<string | null>(inicial)
  const [mexeu, setMexeu] = useState(false)
  const [iniciou, setIniciou] = useState(!!inicial)
  const [animar, setAnimar] = useState(false) // a 1ª posição aparece direto, sem animação

  const palcoRef = useRef<HTMLDivElement>(null)
  const paredeRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [camera, setCamera] = useState({ left: 0, top: 0, largura: 0 })

  // Os produtos podem chegar depois (Supabase): quando chegarem, começa no destaque
  useEffect(() => {
    if (!iniciou && inicial) { setFoco(inicial); setIniciou(true) }
  }, [inicial, iniciou])

  // Abertura: começa no destaque e, depois de um instante, a câmera se afasta (como no vídeo)
  useEffect(() => {
    if (mexeu || !iniciou) return
    const t = setTimeout(() => setFoco(null), 2600)
    return () => clearTimeout(t)
  }, [mexeu, iniciou])

  useEffect(() => {
    const medir = () => { const p = palcoRef.current; if (p) setTam({ w: p.clientWidth, h: p.clientHeight }) }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    if (ro && palcoRef.current) ro.observe(palcoRef.current)
    window.addEventListener('resize', medir)
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir) }
  }, [lista.length])

  // Câmera: tudo na parede é proporcional à largura dela. Mede as proporções e calcula
  // a largura/posição para mostrar a parede inteira ou o celular em foco no centro.
  useLayoutEffect(() => {
    const parede = paredeRef.current
    if (!parede || !tam.w) return
    const W = parede.offsetWidth || 1
    const larguraBase = Math.min(tam.w * 0.96, 1000)
    const alturaRel = parede.offsetHeight / W
    const el = foco ? itemRefs.current[foco] : null
    if (!el) {
      setCamera({ left: (tam.w - larguraBase) / 2, top: Math.max(0, (tam.h - alturaRel * larguraBase) / 2 + tam.h * 0.03), largura: larguraBase })
    } else {
      let x = 0, y = 0
      let n: HTMLElement | null = el
      while (n && n !== parede) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null }
      const rx = (x + el.offsetWidth / 2) / W, ry = (y + el.offsetHeight / 2) / W
      const rw = el.offsetWidth / W, rh = el.offsetHeight / W
      const largura = Math.max(larguraBase, Math.min((tam.h * 0.6) / rh, (tam.w * 0.6) / rw))
      setCamera({ left: tam.w / 2 - rx * largura, top: tam.h * 0.42 - ry * largura, largura })
    }
    if (!animar && iniciou) setTimeout(() => setAnimar(true), 80)
  }, [foco, tam.w, tam.h, lista.length, iniciou])

  const toque = useRef<{ x: number; y: number } | null>(null)
  const ultimaRoda = useRef(0)
  if (lista.length === 0) return null
  const atual = lista.find(i => i.id === foco) || null

  function tocar(id: string) {
    setMexeu(true)
    if (foco === id) onVerProduto(id)
    else setFoco(id)
  }

  // Deslizar para o lado passa para o próximo/anterior celular (como rolar fotos)
  function passar(direcao: 1 | -1) {
    setMexeu(true)
    const i = foco ? lista.findIndex(x => x.id === foco) : -1
    const prox = i < 0 ? (direcao === 1 ? 0 : lista.length - 1) : (i + direcao + lista.length) % lista.length
    setFoco(lista[prox].id)
  }

  return (
    <section className="vt">
      <style>{CSS}</style>
      <div ref={palcoRef} className="vt-palco"
        onTouchStart={e => { toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={e => {
          const t = toque.current; toque.current = null
          if (!t) return
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) passar(dx < 0 ? 1 : -1)
        }}
        onWheel={e => {
          if (Math.abs(e.deltaX) < 30 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
          const agora = Date.now(); if (agora - ultimaRoda.current < 700) return
          ultimaRoda.current = agora; passar(e.deltaX > 0 ? 1 : -1)
        }}
        style={{ backgroundImage: `${TEXTURA}, radial-gradient(90% 70% at 50% 18%, #8d8791 0%, #6f6973 55%, #4f4a54 100%)` }}>
        <div ref={paredeRef} className={animar ? 'vt-parede vt-anima' : 'vt-parede'}
          style={{ left: camera.left, top: camera.top, width: camera.largura || 400, fontSize: (camera.largura || 400) / 100, visibility: camera.largura ? 'visible' : 'hidden' }}>
          {prateleiras.map((linha, li) => (
            <div key={li} className="vt-linha">
              {linha.map(it => (
                <div key={it.id} ref={r => { itemRefs.current[it.id] = r }}
                  className={foco === it.id ? 'vt-item on' : 'vt-item'}
                  style={{ opacity: foco && foco !== it.id ? 0.55 : 1 }}
                  onClick={() => tocar(it.id)}>
                  <FotoVitrine url={it.foto} nome={it.nome} />
                  <div className="vt-acrilico" />
                  <div className="vt-luz" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="vt-sombra" />

        <div className="vt-topo" style={{ opacity: foco ? 0 : 1 }}>
          <span>VITRINE</span>
          <h2>{titulo}</h2>
        </div>

        {foco && mexeu && (
          <button className="vt-voltar" onClick={() => { setMexeu(true); setFoco(null) }}>✕ Ver vitrine</button>
        )}
        {foco && lista.length > 1 && (
          <>
            <button className="vt-seta vt-seta-esq" aria-label="Anterior" onClick={() => passar(-1)}>‹</button>
            <button className="vt-seta vt-seta-dir" aria-label="Próximo" onClick={() => passar(1)}>›</button>
          </>
        )}

        <div className="vt-info" style={{ opacity: atual ? 1 : 0, transform: `translateY(${atual ? 0 : 16}px)`, pointerEvents: atual ? 'auto' : 'none' }}>
          {atual?.detalhe && <span className="vt-etiqueta">{atual.detalhe}</span>}
          <h3>{atual?.nome}</h3>
          <button onClick={() => atual && onVerProduto(atual.id)}>Ver no catálogo <b>›</b></button>
        </div>

        <p className="vt-dica" style={{ opacity: foco ? 0 : 1 }}>Toque em um celular ou deslize para o lado</p>
      </div>
    </section>
  )
}

// Medidas da parede em "em" (1em = 1% da largura da parede): tudo cresce junto no zoom
const CSS = `
.vt { position: relative; }
.vt-palco { position: relative; height: min(78svh, 640px); min-height: 440px; overflow: hidden; background-color: #6f6973;
  background-size: 220px 220px, cover; isolation: isolate; user-select: none; -webkit-user-select: none; }
.vt-parede { position: absolute; display: flex; flex-direction: column; gap: 9em; }
.vt-parede.vt-anima { transition: left .95s cubic-bezier(.22,.8,.2,1), top .95s cubic-bezier(.22,.8,.2,1), width .95s cubic-bezier(.22,.8,.2,1), font-size .95s cubic-bezier(.22,.8,.2,1); }
.vt-linha { display: flex; justify-content: center; align-items: flex-end; gap: 3em; }
.vt-item { position: relative; flex: 0 0 16.5em; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: opacity .6s ease; }
.vt-item img { display: block; width: 100%; height: 30em; object-fit: contain; object-position: bottom;
  filter: drop-shadow(0 0.6em 0.6em rgba(0,0,0,0.35)) drop-shadow(0 1.4em 1.8em rgba(0,0,0,0.18)); }
.vt-acrilico { width: 104%; height: 0.5em; margin-top: 0.1em; border-radius: 0.2em;
  background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12));
  box-shadow: 0 0.1em 0 rgba(255,255,255,0.35) inset, 0 0.6em 1em rgba(0,0,0,0.35); transition: background .6s ease, box-shadow .6s ease; }
.vt-luz { position: absolute; left: -20%; right: -20%; top: 100%; height: 12em; pointer-events: none; opacity: 0;
  background: radial-gradient(50% 60% at 50% 0%, rgba(255,110,30,0.75), rgba(255,90,20,0.25) 45%, transparent 75%);
  filter: blur(0.4em); transition: opacity .7s ease; }
.vt-item.on .vt-acrilico { background: linear-gradient(180deg, #ffd2a8, #ff8a3d); box-shadow: 0 0 0.8em #ff7a1a, 0 0 2.2em rgba(255,122,26,0.8), 0 0.6em 1em rgba(0,0,0,0.3); }
.vt-item.on .vt-luz { opacity: 1; }
.vt-sombra { position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 22%, transparent 62%, rgba(0,0,0,0.55) 100%); }
.vt-topo { position: absolute; left: 0; right: 0; top: 18px; text-align: center; color: #fff; transition: opacity .5s ease; pointer-events: none; }
.vt-topo span { font-size: 11px; letter-spacing: 4px; font-weight: 700; color: #ffb27a; }
.vt-topo h2 { margin: 4px 0 0; font-size: clamp(20px, 5vw, 32px); font-weight: 800; letter-spacing: -0.5px; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.3); }
.vt-dica { position: absolute; left: 0; right: 0; bottom: 18px; margin: 0; text-align: center; color: rgba(255,255,255,0.85); font-size: 14px; transition: opacity .5s ease; pointer-events: none; }
.vt-palco { touch-action: pan-y; }
.vt .vt-seta { position: absolute; top: 42%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 26px; line-height: 1; color: #fff; font-family: inherit;
  background: rgba(0,0,0,0.28); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); animation: vtSeta .5s ease .6s both; }
.vt .vt-seta-esq { left: 10px; } .vt .vt-seta-dir { right: 10px; }
@keyframes vtSeta { from { opacity: 0 } to { opacity: 1 } }
.vt .vt-voltar { position: absolute; top: 14px; left: 14px; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700;
  color: #fff; background: rgba(0,0,0,0.35); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 8px 14px; border-radius: 20px; }
.vt-info { position: absolute; left: 0; right: 0; bottom: 22px; text-align: center; color: #fff; padding: 0 16px; transition: opacity .5s ease .25s, transform .5s ease .25s; }
.vt-etiqueta { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #fff;
  background: rgba(255,102,0,0.9); border-radius: 20px; padding: 4px 12px; }
.vt-info h3 { margin: 8px 0 12px; font-size: clamp(26px, 7vw, 44px); font-weight: 800; letter-spacing: -0.8px; line-height: 1.05; color: #fff; text-shadow: 0 2px 16px rgba(0,0,0,0.35); }
.vt .vt-info button { display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer; font-family: inherit;
  background: #fff; color: #111; font-size: 16px; font-weight: 800; padding: 13px 26px; border-radius: 30px; box-shadow: 0 10px 28px rgba(0,0,0,0.3); }
.vt .vt-info button b { font-size: 21px; line-height: 0; color: #ff6600; }
@media (prefers-reduced-motion: reduce) { .vt-parede.vt-anima { transition: none; } }
`
