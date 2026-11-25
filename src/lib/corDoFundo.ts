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

// ── capinhas: deixa o FUNDO da foto branco puro sem recortar nada.
// Lê a cor do fundo (cantos) e clareia a foto inteira na mesma proporção: o fundo vira #fff,
// a capinha e a sombra continuam inteiras e suaves (sem quadrado, sem borda cortada).
const cacheBranco = new Map<string, Promise<string | null>>()
export function fundoBranco(url: string, lado = 700): Promise<string | null> {
  const chave = url + '#' + lado
  if (!cacheBranco.has(chave)) {
    cacheBranco.set(chave, carregar(url).then(img => {
      if (!img) return null
      try {
        const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * esc)), h = Math.max(1, Math.round(img.naturalHeight * esc))
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const ctx = c.getContext('2d'); if (!ctx) return null
        ctx.drawImage(img, 0, 0, w, h)
        const dados = ctx.getImageData(0, 0, w, h), px = dados.data
        // cor do fundo: olha a borda inteira da foto e pega o tom MAIS ESCURO dela
        // (o fundo da foto costuma ter degradê; assim a borda toda vira branca)
        const m = Math.max(2, Math.round(Math.min(w, h) * 0.04))
        const faixas: number[][] = []
        const passo = Math.max(1, Math.round(Math.max(w, h) / 40))
        const media = (x0: number, y0: number) => {
          let r = 0, g = 0, b = 0, n = 0
          for (let y = y0; y < Math.min(h, y0 + m); y++) for (let x = x0; x < Math.min(w, x0 + m); x++) { const i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++ }
          return [r / n, g / n, b / n]
        }
        for (let x = 0; x < w - m; x += passo) { faixas.push(media(x, 0), media(x, h - m)) }
        for (let y = 0; y < h - m; y += passo) { faixas.push(media(0, y), media(w - m, y)) }
        // ignora pedaços da capinha que encostam na borda (bem mais escuros), e pega o mais escuro do resto
        const lum = (c: number[]) => c[0] + c[1] + c[2]
        faixas.sort((a, c) => lum(a) - lum(c))
        const claros = faixas.slice(Math.floor(faixas.length * 0.15))
        let [r, g, b] = claros[0] || [255, 255, 255]
        r *= 0.985; g *= 0.985; b *= 0.985 // folguinha pra não sobrar nada cinza
        if (Math.min(r, g, b) < 170) return null // fundo escuro/colorido: deixa como está
        if (Math.min(r, g, b) >= 253) return null // já é branco
        const fr = 255 / r, fg = 255 / g, fb = 255 / b
        for (let i = 0; i < px.length; i += 4) {
          let R = px[i] * fr, G = px[i + 1] * fg, B = px[i + 2] * fb
          if (R > 246 && G > 246 && B > 246) { R = 255; G = 255; B = 255 } // quase branco vira branco
          px[i] = Math.min(255, R); px[i + 1] = Math.min(255, G); px[i + 2] = Math.min(255, B)
        }
        ctx.putImageData(dados, 0, 0)
        return c.toDataURL('image/jpeg', 0.92)
      } catch { return null }
    }))
  }
  return cacheBranco.get(chave)!
}
export function branquear(e: { currentTarget: HTMLImageElement }) {
  const el = e.currentTarget
  if (el.src.startsWith('data:')) { el.classList.add('pronto'); return } // já é a versão clareada
  fundoBranco(el.src, Number(el.dataset.lado) || 700).then(nova => {
    if (nova) el.src = nova
    el.classList.add('pronto')
  })
}
