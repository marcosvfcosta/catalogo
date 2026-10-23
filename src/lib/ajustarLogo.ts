// Padroniza logos de marca (roda no navegador, sem custo):
// 1) tira o fundo (transparente, branco ou de cor lisa)
// 2) recorta as sobras
// 3) pinta tudo de grafite (ou mantém as cores, se pedir)
// 4) centraliza num retângulo padrão 600x240 com fundo transparente

const LARGURA = 600
const ALTURA = 240
const MARGEM = 0.1
const COR_PADRAO = [29, 29, 31] // #1d1d1f

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')) }
    img.src = url
  })
}

export async function ajustarLogo(original: File, manterCores = false): Promise<{ arquivo: File; ajustou: boolean }> {
  try {
    const img = await carregarImagem(original)
    const escala = Math.min(1, 1400 / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * escala))
    const h = Math.max(1, Math.round(img.height * escala))
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { arquivo: original, ajustou: false }
    ctx.drawImage(img, 0, 0, w, h)
    const dados = ctx.getImageData(0, 0, w, h)
    const px = dados.data

    // Já tem fundo transparente?
    let transparentes = 0, bordas = 0
    const amostra = (i: number) => { bordas++; if (px[i + 3] < 200) transparentes++ }
    for (let x = 0; x < w; x += 2) { amostra(x * 4); amostra(((h - 1) * w + x) * 4) }
    for (let y = 0; y < h; y += 2) { amostra(y * w * 4); amostra((y * w + w - 1) * 4) }
    const jaTransparente = transparentes / bordas > 0.6

    // Cor do fundo = cor mais comum nas bordas
    let fr = 255, fg = 255, fb = 255
    if (!jaTransparente) {
      const grupos = new Map<string, { r: number; g: number; b: number; n: number }>()
      const conta = (i: number) => {
        const k = `${px[i] >> 4}-${px[i + 1] >> 4}-${px[i + 2] >> 4}`
        const gr = grupos.get(k) || { r: 0, g: 0, b: 0, n: 0 }
        gr.r += px[i]; gr.g += px[i + 1]; gr.b += px[i + 2]; gr.n++
        grupos.set(k, gr)
      }
      for (let x = 0; x < w; x += 2) { conta(x * 4); conta(((h - 1) * w + x) * 4) }
      for (let y = 0; y < h; y += 2) { conta(y * w * 4); conta((y * w + w - 1) * 4) }
      const top = Array.from(grupos.values()).sort((a, b) => b.n - a.n)[0]
      if (top) { fr = top.r / top.n; fg = top.g / top.n; fb = top.b / top.n }
    }

    // Transparência suave: quanto mais diferente do fundo, mais visível
    const alfa = new Float32Array(w * h)
    for (let p = 0; p < w * h; p++) {
      const i = p * 4
      if (jaTransparente) { alfa[p] = px[i + 3] / 255; continue }
      const d = Math.abs(px[i] - fr) + Math.abs(px[i + 1] - fg) + Math.abs(px[i + 2] - fb)
      alfa[p] = Math.max(0, Math.min(1, (d - 30) / 90)) * (px[i + 3] / 255)
    }

    // Apaga linhas soltas (bordas, separadores) e pontinhos de sujeira
    const rotulo = new Int32Array(w * h)
    const fila = new Int32Array(w * h)
    let id = 0
    for (let p0 = 0; p0 < w * h; p0++) {
      if (alfa[p0] <= 0.15 || rotulo[p0]) continue
      id++
      let ini = 0, fim = 0, x0 = w, y0 = h, x1 = 0, y1 = 0
      fila[fim++] = p0; rotulo[p0] = id
      while (ini < fim) {
        const p = fila[ini++]
        const x = p % w, y = (p - x) / w
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
        for (const q of viz) if (q >= 0 && !rotulo[q] && alfa[q] > 0.15) { rotulo[q] = id; fila[fim++] = q }
      }
      const cw0 = x1 - x0 + 1, ch0 = y1 - y0 + 1
      const linhaVertical = cw0 <= Math.max(4, w * 0.012) && ch0 > h * 0.3
      const linhaHorizontal = ch0 <= Math.max(4, h * 0.012) && cw0 > w * 0.3
      const sujeira = fim < w * h * 0.00005
      if (linhaVertical || linhaHorizontal || sujeira) for (let k = 0; k < fim; k++) alfa[fila[k]] = 0
    }

    // Recorte (caixa em volta do que é visível)
    let minX = w, minY = h, maxX = -1, maxY = -1
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (alfa[y * w + x] > 0.15) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
    if (maxX < 0) return { arquivo: original, ajustou: false }

    for (let p = 0; p < w * h; p++) {
      const i = p * 4
      if (!manterCores) { px[i] = COR_PADRAO[0]; px[i + 1] = COR_PADRAO[1]; px[i + 2] = COR_PADRAO[2] }
      px[i + 3] = Math.round(alfa[p] * 255)
    }
    ctx.putImageData(dados, 0, 0)

    const cw = maxX - minX + 1, ch = maxY - minY + 1
    const saida = document.createElement('canvas')
    saida.width = LARGURA; saida.height = ALTURA
    const s = saida.getContext('2d')
    if (!s) return { arquivo: original, ajustou: false }
    s.imageSmoothingEnabled = true; s.imageSmoothingQuality = 'high'
    const fator = Math.min((LARGURA * (1 - MARGEM * 2)) / cw, (ALTURA * (1 - MARGEM * 2)) / ch)
    const dw = cw * fator, dh = ch * fator
    s.drawImage(c, minX, minY, cw, ch, (LARGURA - dw) / 2, (ALTURA - dh) / 2, dw, dh)

    const blob: Blob | null = await new Promise(r => saida.toBlob(r, 'image/png'))
    if (!blob) return { arquivo: original, ajustou: false }
    const nome = (original.name.replace(/\.[^.]+$/, '') || 'logo') + '_logo.png'
    return { arquivo: new File([blob], nome, { type: 'image/png' }), ajustou: true }
  } catch (e) {
    console.error('Não foi possível ajustar o logo:', e)
    return { arquivo: original, ajustou: false }
  }
}
