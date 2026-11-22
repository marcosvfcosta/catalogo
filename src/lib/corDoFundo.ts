// Tira o fundo da foto do iPhone (só no navegador, a foto original não muda)
// pra aparecer só o aparelho, sem quadrado em volta.
const cache = new Map<string, Promise<string | null>>()

function carregar(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url + (url.includes('?') ? '&' : '?') + 'cor=1'
  })
}

export function semFundo(url: string): Promise<string | null> {
  if (!cache.has(url)) {
    cache.set(url, carregar(url).then(img => {
      if (!img) return null
      try {
        const esc = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight))
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
        return c.toDataURL('image/png')
      } catch { return null }
    }))
  }
  return cache.get(url)!
}

export function pintarFundo(e: { currentTarget: HTMLImageElement }) {
  const el = e.currentTarget
  if (el.dataset.recortado) { el.classList.add('pronto'); return }
  el.dataset.recortado = '1'
  semFundo(el.src).then(nova => {
    if (nova) el.src = nova
    el.classList.add('pronto')
  })
}
