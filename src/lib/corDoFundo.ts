// Descobre a cor do fundo da foto (canto superior esquerdo) pra pintar o quadradinho igual.
const cache = new Map<string, Promise<string | null>>()

export function corDoFundo(url: string): Promise<string | null> {
  if (!cache.has(url)) {
    cache.set(url, new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const c = document.createElement('canvas')
          c.width = 4; c.height = 4
          const ctx = c.getContext('2d')
          if (!ctx) return resolve(null)
          ctx.drawImage(img, 0, 0, img.naturalWidth * 0.03 || 1, img.naturalHeight * 0.03 || 1, 0, 0, 4, 4)
          const d = ctx.getImageData(1, 1, 1, 1).data
          resolve(d[3] < 200 ? null : `rgb(${d[0]},${d[1]},${d[2]})`)
        } catch { resolve(null) }
      }
      img.onerror = () => resolve(null)
      img.src = url + (url.includes('?') ? '&' : '?') + 'cor=1'
    }))
  }
  return cache.get(url)!
}

export function pintarFundo(e: { currentTarget: HTMLImageElement }) {
  const el = e.currentTarget
  const pai = el.parentElement
  if (!pai) return
  corDoFundo(el.src).then(cor => { if (cor) pai.style.background = cor })
}
