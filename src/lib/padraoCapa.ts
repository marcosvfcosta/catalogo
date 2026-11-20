// Padrão das fotos de capinha no catálogo branco:
// só a capa, centralizada, em pé, ocupando ~84% da altura, fundo BRANCO puro, formato 3:4 (1200x1600),
// com uma sombra bem suave embaixo. Recebe a foto já recortada (PNG com fundo transparente).

const LARGURA = 1200
const ALTURA = 1600
const ALTURA_PRODUTO = 0.80
const LARGURA_MAX = 0.86

function carregar(arquivo: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')) }
    img.src = url
  })
}

export async function padraoCapa(recortada: Blob): Promise<File> {
  const img = await carregar(recortada)
  const w = img.width, h = img.height
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Sem canvas')
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(0, 0, w, h).data

  // Caixa em volta da capa (pixels visíveis)
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 24) {
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
  if (x1 < 0) throw new Error('Capa não encontrada na foto')
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1

  const fator = Math.min((ALTURA * ALTURA_PRODUTO) / ch, (LARGURA * LARGURA_MAX) / cw)
  const dw = cw * fator, dh = ch * fator
  const dx = (LARGURA - dw) / 2, dy = (ALTURA - dh) / 2 - ALTURA * 0.03

  const out = document.createElement('canvas')
  out.width = LARGURA; out.height = ALTURA
  const o = out.getContext('2d')
  if (!o) throw new Error('Sem canvas')
  o.fillStyle = '#ffffff'
  o.fillRect(0, 0, LARGURA, ALTURA)

  // Sombra suave embaixo da capa (elipse borrada)
  o.save()
  o.filter = 'blur(22px)'
  o.fillStyle = 'rgba(0,0,0,0.16)'
  o.beginPath()
  o.ellipse(LARGURA / 2, dy + dh + 6, dw * 0.42, 16, 0, 0, Math.PI * 2)
  o.fill()
  o.restore()

  o.imageSmoothingEnabled = true
  o.imageSmoothingQuality = 'high'

  // Realce leve: um pouco mais de brilho, contraste e cor (fica com cara de foto de estúdio)
  const capa = document.createElement('canvas')
  capa.width = Math.round(dw); capa.height = Math.round(dh)
  const k = capa.getContext('2d')
  if (!k) throw new Error('Sem canvas')
  k.imageSmoothingEnabled = true
  k.imageSmoothingQuality = 'high'
  k.filter = 'brightness(1.05) contrast(1.08) saturate(1.08)'
  k.drawImage(c, x0, y0, cw, ch, 0, 0, capa.width, capa.height)

  // Fundo que aparece através da capa transparente (folha branca acinzentada): clareia até o branco
  {
    const d = k.getImageData(0, 0, capa.width, capa.height)
    const q = d.data
    for (let i = 0; i < q.length; i += 4) {
      const mx = Math.max(q[i], q[i + 1], q[i + 2]), mn = Math.min(q[i], q[i + 1], q[i + 2])
      if (q[i + 3] > 0 && mn > 200 && mx - mn < 20) {
        const t = Math.min(1, (mn - 200) / 35) * 0.75
        q[i] += (255 - q[i]) * t; q[i + 1] += (255 - q[i + 1]) * t; q[i + 2] += (255 - q[i + 2]) * t
      }
    }
    k.putImageData(d, 0, 0)
  }

  // Reflexo no chão: a capa espelhada, bem clarinha e sumindo
  const reflexo = Math.min(dh * 0.22, ALTURA - (dy + dh) - 4)
  if (reflexo > 20) {
    const r = document.createElement('canvas')
    r.width = capa.width; r.height = Math.round(reflexo)
    const rc = r.getContext('2d')
    if (rc) {
      rc.translate(0, capa.height)
      rc.scale(1, -1)
      rc.drawImage(capa, 0, 0)
      rc.setTransform(1, 0, 0, 1, 0, 0)
      rc.globalCompositeOperation = 'destination-in'
      const g = rc.createLinearGradient(0, 0, 0, r.height)
      g.addColorStop(0, 'rgba(0,0,0,0.22)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      rc.fillStyle = g
      rc.fillRect(0, 0, r.width, r.height)
      o.drawImage(r, dx, dy + dh + 2)
    }
  }

  o.drawImage(capa, dx, dy)

  const blob: Blob = await new Promise((resolve, reject) =>
    out.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))), 'image/jpeg', 0.92))
  return new File([blob], 'capa_padrao.jpg', { type: 'image/jpeg' })
}
