// Tira o fundo da foto do iPhone (só no navegador, a foto original não muda)
// pra aparecer só o aparelho, sem quadrado em volta.
const cache = new Map<string, Promise<string | null>>()

function carregar(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url.startsWith('data:') ? url : url + (url.includes('?') ? '&' : '?') + 'cor=1'
  })
}

export function semFundo(url: string, lado = 360): Promise<string | null> {
  const chave = url + '#' + lado
  if (!cache.has(chave)) {
    cache.set(chave, carregar(url).then(img => {
      if (!img) return null
      try {
        const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * esc))
        const h = Math.max(1, Math.round(img.naturalHeight * esc))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, w, h)
        const dados = ctx.getImageData(0, 0, w, h)
        const px = dados.data
        // cor de fundo = média dos 4 cantos
        const cantos = [0, w - 1, (h - 1) * w, h * w - 1]
        let r = 0, g = 0, b = 0
        for (const i of cantos) { r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2] }
        r /= 4; g /= 4; b /= 4
        const tol = 14
        const parecido = (i: number) =>
          px[i * 4 + 3] > 0 &&
          Math.abs(px[i * 4] - r) <= tol && Math.abs(px[i * 4 + 1] - g) <= tol && Math.abs(px[i * 4 + 2] - b) <= tol
        // pinta de transparente a partir das bordas (não entra no aparelho)
        const visto = new Uint8Array(w * h)
        const fila: number[] = []
        for (let x = 0; x < w; x++) { fila.push(x, (h - 1) * w + x) }
        for (let y = 0; y < h; y++) { fila.push(y * w, y * w + w - 1) }
        let apagados = 0
        while (fila.length) {
          const i = fila.pop()!
          if (visto[i]) continue
          visto[i] = 1
          if (!parecido(i)) continue
          px[i * 4 + 3] = 0; apagados++
          const x = i % w, y = (i / w) | 0
          if (x > 0) fila.push(i - 1)
          if (x < w - 1) fila.push(i + 1)
          if (y > 0) fila.push(i - w)
          if (y < h - 1) fila.push(i + w)
        }
        if (apagados < w * h * 0.05) return null // foto sem fundo liso: deixa como está
        ctx.putImageData(dados, 0, 0)
        // corta a sobra transparente em volta pra o aparelho/capinha ocupar o espaço todo
        let x0 = w, y0 = h, x1 = -1, y1 = -1
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (px[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
        }
        if (x1 < 0) return null
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1
        if (cw < w || ch < h) {
          const c2 = document.createElement('canvas')
          c2.width = cw; c2.height = ch
          c2.getContext('2d')?.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch)
          return c2.toDataURL('image/png')
        }
        return c.toDataURL('image/png')
      } catch { return null }
    }))
  }
  return cache.get(chave)!
}

export function pintarFundo(e: { currentTarget: HTMLImageElement }) {
  const el = e.currentTarget
  if (el.dataset.recortado) { el.classList.add('pronto'); return }
  el.dataset.recortado = '1'
  semFundo(el.src, Number(el.dataset.lado) || 360).then(nova => {
    if (nova) el.src = nova
    el.classList.add('pronto')
  })
}

// ── capinhas: NÃO recorta a foto. Lê a cor do fundo dela (média dos cantos) e pinta o que está em volta igual,
// assim a foto fica "sem quadrado" e sem borda/sombra estranha.
const cacheCor = new Map<string, Promise<string | null>>()
export function corDoCanto(url: string): Promise<string | null> {
  if (!cacheCor.has(url)) {
    cacheCor.set(url, carregar(url).then(img => {
      if (!img) return null
      try {
        const w = 60, h = Math.max(1, Math.round(60 * img.naturalHeight / img.naturalWidth))
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const ctx = c.getContext('2d'); if (!ctx) return null
        ctx.drawImage(img, 0, 0, w, h)
        const pts = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]
        let r = 0, g = 0, b = 0
        for (const [x, y] of pts) { const d = ctx.getImageData(x, y, 1, 1).data; r += d[0]; g += d[1]; b += d[2] }
        return `rgb(${Math.round(r / 4)},${Math.round(g / 4)},${Math.round(b / 4)})`
      } catch { return null }
    }))
  }
  return cacheCor.get(url)!
}
// pinta o elemento indicado (o quadrado do card ou a tela inteira da capinha) com a cor do fundo da foto
export function pintarEmVolta(alvo: (img: HTMLImageElement) => HTMLElement | null) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const el = e.currentTarget
    el.classList.add('pronto')
    corDoCanto(el.currentSrc || el.src).then(cor => { const a = alvo(el); if (cor && a) a.style.background = cor })
  }
}
