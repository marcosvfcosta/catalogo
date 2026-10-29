import { useEffect, useMemo, useRef, useState } from 'react'

// ─── Abertura "parede de vitrine" (estilo loja de tênis) ─────────────────────
// Parede cinza com prateleiras de acrílico. Abre com zoom no celular em destaque
// e a câmera se afasta mostrando a parede inteira. Ao tocar num celular, a câmera
// vai até ele, a prateleira acende em laranja e aparecem o nome e o botão
// "Ver no catálogo". Sem bibliotecas: só React + CSS.

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
  const palcoRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [, forcar] = useState(0)

  // Abertura: começa no destaque e, depois de um instante, a câmera se afasta (como no vídeo)
  useEffect(() => {
    if (mexeu) return
    const t = setTimeout(() => setFoco(null), 2600)
    return () => clearTimeout(t)
  }, [mexeu])

  useEffect(() => {
    const medir = () => {
      const p = palcoRef.current
      if (p) setTam({ w: p.clientWidth, h: p.clientHeight })
      forcar(n => n + 1)
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    if (ro && palcoRef.current) ro.observe(palcoRef.current)
    return () => ro?.disconnect()
  }, [lista.length])

  if (lista.length === 0) return null
  const atual = lista.find(i => i.id === foco) || null

  // Câmera: leva o celular em foco para o centro e aproxima
  let transform = 'translate3d(0,0,0) scale(1)'
  const el = foco ? itemRefs.current[foco] : null
  if (el && tam.w) {
    let x = 0, y = 0
    let n: HTMLElement | null = el
    while (n && n !== palcoRef.current) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null }
    const cx = x + el.offsetWidth / 2, cy = y + el.offsetHeight / 2
    const s = Math.max(1, Math.min((tam.h * 0.62) / el.offsetHeight, (tam.w * 0.62) / el.offsetWidth))
    const alvoX = tam.w / 2, alvoY = tam.h * 0.43
    transform = `translate3d(${alvoX - cx * s}px, ${alvoY - cy * s}px, 0) scale(${s})`
  }

  function tocar(id: string) {
    setMexeu(true)
    if (foco === id) onVerProduto(id)
    else setFoco(id)
  }

  return (
    <section className="vt">
      <style>{CSS}</style>
      <div ref={palcoRef} className="vt-palco" style={{ backgroundImage: `${TEXTURA}, radial-gradient(90% 70% at 50% 18%, #8d8791 0%, #6f6973 55%, #4f4a54 100%)` }}>
        <div className="vt-cena" style={{ transform }}>
          <div className="vt-parede">
            {prateleiras.map((linha, li) => (
              <div key={li} className="vt-linha">
                {linha.map(it => (
                  <div key={it.id} ref={r => { itemRefs.current[it.id] = r }}
                    className={foco === it.id ? 'vt-item on' : 'vt-item'}
                    style={{ opacity: foco && foco !== it.id ? 0.55 : 1 }}
                    onClick={() => tocar(it.id)}>
                    <img src={it.foto} alt={it.nome} draggable={false} />
                    <div className="vt-acrilico" />
                    <div className="vt-luz" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="vt-sombra" />

        <div className="vt-topo" style={{ opacity: foco ? 0 : 1 }}>
          <span>VITRINE</span>
          <h2>{titulo}</h2>
        </div>

        {foco && mexeu && (
          <button className="vt-voltar" onClick={() => { setMexeu(true); setFoco(null) }}>✕ Ver vitrine</button>
        )}

        <div className="vt-info" style={{ opacity: atual ? 1 : 0, transform: `translateY(${atual ? 0 : 16}px)`, pointerEvents: atual ? 'auto' : 'none' }}>
          {atual?.detalhe && <span className="vt-etiqueta">{atual.detalhe}</span>}
          <h3>{atual?.nome}</h3>
          <button onClick={() => atual && onVerProduto(atual.id)}>Ver no catálogo <b>›</b></button>
        </div>

        <p className="vt-dica" style={{ opacity: foco ? 0 : 1 }}>Toque em um celular</p>
      </div>
    </section>
  )
}

const CSS = `
.vt { position: relative; }
.vt-palco { position: relative; height: min(78svh, 640px); min-height: 440px; overflow: hidden; background-color: #6f6973;
  background-size: 220px 220px, cover; isolation: isolate; user-select: none; -webkit-user-select: none; }
.vt-cena { position: absolute; inset: 0; transform-origin: 0 0; will-change: transform;
  transition: transform .95s cubic-bezier(.22,.8,.2,1); display: flex; align-items: center; justify-content: center; }
.vt-parede { display: flex; flex-direction: column; gap: clamp(26px, 6vh, 56px); width: min(96%, 1000px); padding-top: 4%; }
.vt-linha { display: flex; justify-content: center; align-items: flex-end; gap: 3%; }
.vt-item { position: relative; flex: 0 1 17%; max-width: 160px; display: flex; flex-direction: column; align-items: center; cursor: pointer;
  transition: opacity .6s ease; }
.vt-item img { display: block; width: 100%; aspect-ratio: 0.55; object-fit: contain; object-position: bottom;
  filter: drop-shadow(0 6px 6px rgba(0,0,0,0.35)) drop-shadow(0 14px 18px rgba(0,0,0,0.18)); transition: transform .4s ease; }
.vt-item:active img { transform: scale(0.97); }
.vt-acrilico { width: 104%; height: 5px; margin-top: 1px; border-radius: 2px;
  background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12));
  box-shadow: 0 1px 0 rgba(255,255,255,0.35) inset, 0 6px 10px rgba(0,0,0,0.35); transition: all .6s ease; }
.vt-luz { position: absolute; left: -20%; right: -20%; top: 100%; height: 70%; pointer-events: none; opacity: 0;
  background: radial-gradient(50% 60% at 50% 0%, rgba(255,110,30,0.75), rgba(255,90,20,0.25) 45%, transparent 75%);
  filter: blur(4px); transition: opacity .7s ease; }
.vt-item.on .vt-acrilico { background: linear-gradient(180deg, #ffd2a8, #ff8a3d); box-shadow: 0 0 8px #ff7a1a, 0 0 22px rgba(255,122,26,0.8), 0 6px 10px rgba(0,0,0,0.3); }
.vt-item.on .vt-luz { opacity: 1; }
.vt-sombra { position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 22%, transparent 62%, rgba(0,0,0,0.55) 100%); }
.vt-topo { position: absolute; left: 0; right: 0; top: 18px; text-align: center; color: #fff; transition: opacity .5s ease; pointer-events: none; }
.vt-topo span { font-size: 11px; letter-spacing: 4px; font-weight: 700; color: #ffb27a; }
.vt-topo h2 { margin: 4px 0 0; font-size: clamp(20px, 5vw, 32px); font-weight: 800; letter-spacing: -0.5px; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.3); }
.vt-dica { position: absolute; left: 0; right: 0; bottom: 18px; margin: 0; text-align: center; color: rgba(255,255,255,0.85); font-size: 14px; transition: opacity .5s ease; pointer-events: none; }
.vt-voltar { position: absolute; top: 14px; left: 14px; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700;
  color: #fff; background: rgba(0,0,0,0.35); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 8px 14px; border-radius: 20px; }
.vt-info { position: absolute; left: 0; right: 0; bottom: 22px; text-align: center; color: #fff; padding: 0 16px; transition: opacity .5s ease .25s, transform .5s ease .25s; }
.vt-etiqueta { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #fff;
  background: rgba(255,102,0,0.9); border-radius: 20px; padding: 4px 12px; }
.vt-info h3 { margin: 8px 0 12px; font-size: clamp(26px, 7vw, 44px); font-weight: 800; letter-spacing: -0.8px; line-height: 1.05; color: #fff; text-shadow: 0 2px 16px rgba(0,0,0,0.35); }
.vt-info button { display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer; font-family: inherit;
  background: #fff; color: #111; font-size: 16px; font-weight: 800; padding: 13px 26px; border-radius: 30px; box-shadow: 0 10px 28px rgba(0,0,0,0.3); }
.vt-info button b { font-size: 21px; line-height: 0; color: #ff6600; }
@media (prefers-reduced-motion: reduce) { .vt-cena { transition: none; } }
`
