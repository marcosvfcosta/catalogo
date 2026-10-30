// Ajuste automático de fotos de produto (roda no navegador, grátis, sem bibliotecas):
// 1) remove fundo liso (branco, cinza, cor única) a partir das bordas da imagem
// 2) descarta pedacinhos soltos (textos, preços, logos de site) e mantém o aparelho
// 3) recorta as sobras e centraliza num quadrado padrão com fundo transparente
// Se o fundo não for liso (foto com cenário), não remove o fundo: só centraliza no quadrado.

const TAMANHO_FINAL = 1000
const MARGEM = 0.06            // 6% de respiro em volta do aparelho
const LIMITE_TRABALHO = 1200   // reduz fotos grandes antes de processar (mais rápido)
const TOLERANCIA = 38          // diferença de cor aceita como "fundo"

export type FotoAjustada = { arquivo: File; ajustou: boolean; semFundo: boolean }

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')) }
    img.src = url
  })
}

function paraArquivo(canvas: HTMLCanvasElement, nomeBase: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Falha ao gerar imagem')); return }
      resolve(new File([blob], `${nomeBase}.png`, { type: 'image/png' }))
    }, 'image/png')
  })
}

export async function ajustarFoto(original: File): Promise<FotoAjustada> {
  try {
    const img = await carregarImagem(original)
    const escala = Math.min(1, LIMITE_TRABALHO / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * escala))
    const h = Math.max(1, Math.round(img.height * escala))

    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { arquivo: original, ajustou: false, semFundo: false }
    ctx.drawImage(img, 0, 0, w, h)
    const dados = ctx.getImageData(0, 0, w, h)
    const px = dados.data

    // ── 1. Cores do fundo: as cores mais comuns nas bordas (ex: branco + barra cinza de um print)
    const amostras: number[] = []
    const passo = Math.max(1, Math.floor((w + h) / 400))
    for (let x = 0; x < w; x += passo) { amostras.push(x * 4, ((h - 1) * w + x) * 4) }
    for (let y = 0; y < h; y += passo) { amostras.push(y * w * 4, (y * w + w - 1) * 4) }
    const grupos = new Map<string, { r: number; g: number; b: number; n: number }>()
    for (const i of amostras) {
      const k = `${px[i] >> 4}-${px[i + 1] >> 4}-${px[i + 2] >> 4}`
      const gr = grupos.get(k) || { r: 0, g: 0, b: 0, n: 0 }
      gr.r += px[i]; gr.g += px[i + 1]; gr.b += px[i + 2]; gr.n++
      grupos.set(k, gr)
    }
    // Só aceita como fundo: a cor principal da borda (se for clara, ou se cobrir quase toda a borda)
    // e, além dela, apenas cores claras e neutras (ex: barra cinza de um print).
    // Isso evita apagar o próprio aparelho quando ele encosta na borda da foto.
    const ordenados = Array.from(grupos.values()).sort((x, y) => y.n - x.n)
      .map(gr => ({ r: gr.r / gr.n, g: gr.g / gr.n, b: gr.b / gr.n, parte: gr.n / amostras.length }))
    const claroNeutro = (c: { r: number; g: number; b: number }) =>
      Math.min(c.r, c.g, c.b) > 170 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 40
    const principal = ordenados[0]
    const principalOk = !!principal && (claroNeutro(principal) ? principal.parte >= 0.35 : principal.parte >= 0.85)
    const brancoPuro = (c: { r: number; g: number; b: number }) =>
      Math.min(c.r, c.g, c.b) > 228 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 25
    const distDe = (cores: number[][], i: number) => Math.min(...cores.map(([r, g, b]) =>
      Math.abs(px[i] - r) + Math.abs(px[i + 1] - g) + Math.abs(px[i + 2] - b)))
    const fracaoBorda = (cores: number[][], tol: number) => cores.length ? amostras.filter(i => distDe(cores, i) < tol).length / amostras.length : 0

    // Jeito normal: fundo liso cobrindo boa parte da borda
    const coresNormais = principalOk
      // cores extras de fundo (ex: barra cinza de print). Se o fundo é branco puro, só aceita outras quase brancas,
      // senão um produto cinza/branco encostando na borda (cabo, fone) seria apagado como se fosse fundo
      ? [principal, ...ordenados.slice(1, 3).filter(c => c.parte >= 0.08 && claroNeutro(c) && (!brancoPuro(principal) || Math.min(c.r, c.g, c.b) > 240))].map(c => [c.r, c.g, c.b])
      : []
    // Fundo claro: basta 40% da borda (o aparelho pode encostar nas laterais). Fundo colorido: precisa de 75%.
    const minimoBorda = principal && claroNeutro(principal) ? 0.4 : 0.75
    const normalOk = fracaoBorda(coresNormais, TOLERANCIA) > minimoBorda
    // Aparelho ocupando quase a foto toda (encosta nas bordas) e só sobram pontas/faixas brancas:
    // apaga só o branco bem puro que encosta na borda (as "pontas")
    const coresPontas = ordenados.filter(c => brancoPuro(c) && c.parte >= 0.02).slice(0, 3).map(c => [c.r, c.g, c.b])
    const soPontas = !normalOk && fracaoBorda(coresPontas, 26) > 0.02
    const coresFundo = normalOk ? coresNormais : soPontas ? coresPontas : []
    // Fundo bem branco: tolerância menor, pra não "comer" produto branco (cabo, carregador, fone)
    const fundoBranco = coresFundo.length > 0 && Math.min(...coresFundo[0]) > 236
    const TOL = soPontas ? 22 : fundoBranco ? 22 : TOLERANCIA
    const dist = (i: number) => distDe(coresFundo, i)
    const bordasLisas = normalOk || soPontas

    const fundo = new Uint8Array(w * h) // 1 = fundo
    if (bordasLisas) {
      // ── 2. Pinta o fundo a partir das bordas (só o que encosta na borda some)
      const fila = new Int32Array(w * h)
      let ini = 0, fim = 0
      // Em fundo branco o "pintar" só avança por degraus suaves: na borda do produto (contorno/sombra) ele para
      const lum = (p: number) => px[p * 4] * 0.3 + px[p * 4 + 1] * 0.59 + px[p * 4 + 2] * 0.11
      const tentar = (p: number, de = -1) => {
        if (fundo[p]) return
        if (dist(p * 4) >= TOL) return
        if (fundoBranco && de >= 0 && Math.abs(lum(p) - lum(de)) > 5) return
        fundo[p] = 1; fila[fim++] = p
      }
      for (let x = 0; x < w; x++) { tentar(x); tentar((h - 1) * w + x) }
      for (let y = 0; y < h; y++) { tentar(y * w); tentar(y * w + w - 1) }
      while (ini < fim) {
        const p = fila[ini++]
        const x = p % w, y = (p - x) / w
        if (x > 0) tentar(p - 1, p)
        if (x < w - 1) tentar(p + 1, p)
        if (y > 0) tentar(p - w, p)
        if (y < h - 1) tentar(p + w, p)
      }

      // Fecha "rasgos" finos: o fundo que entrou por frestas estreitas dentro do produto volta a ser produto
      // (abertura morfológica: encolhe o fundo e cresce de novo; o que era fino demais some)
      {
        const R = Math.max(2, Math.round(Math.min(w, h) / 220))
        const tmp = new Uint8Array(w * h), enc = new Uint8Array(w * h)
        // encolhe (erosão) em x depois em y
        for (let y = 0; y < h; y++) {
          let cont = 0
          for (let x = 0; x < w; x++) { cont = fundo[y * w + x] ? cont + 1 : 0; tmp[y * w + x] = cont }
          for (let x = w - 1, run = 0; x >= 0; x--) { run = fundo[y * w + x] ? run + 1 : 0; tmp[y * w + x] = Math.min(tmp[y * w + x], run) > R ? 1 : 0 }
        }
        for (let x = 0; x < w; x++) {
          let cont = 0
          const col = new Uint16Array(h)
          for (let y = 0; y < h; y++) { cont = tmp[y * w + x] ? cont + 1 : 0; col[y] = cont }
          for (let y = h - 1, run = 0; y >= 0; y--) { run = tmp[y * w + x] ? run + 1 : 0; enc[y * w + x] = Math.min(col[y], run) > R ? 1 : 0 }
        }
        // cresce de volta (dilatação), só dentro do que já era fundo
        const cres = new Uint8Array(w * h)
        for (let y = 0; y < h; y++) {
          let ult = -1e9
          for (let x = 0; x < w; x++) { if (enc[y * w + x]) ult = x; if (x - ult <= R) cres[y * w + x] = 1 }
          ult = 1e9
          for (let x = w - 1; x >= 0; x--) { if (enc[y * w + x]) ult = x; if (ult - x <= R) cres[y * w + x] = 1 }
        }
        const cres2 = new Uint8Array(w * h)
        for (let x = 0; x < w; x++) {
          let ult = -1e9
          for (let y = 0; y < h; y++) { if (cres[y * w + x]) ult = y; if (y - ult <= R) cres2[y * w + x] = 1 }
          ult = 1e9
          for (let y = h - 1; y >= 0; y--) { if (cres[y * w + x]) ult = y; if (ult - y <= R) cres2[y * w + x] = 1 }
        }
        // bordas da foto continuam fundo (a erosão não alcança a margem)
        for (let p = 0; p < w * h; p++) {
          if (!fundo[p]) continue
          const x = p % w, y = (p - x) / w
          const margem = x <= R || y <= R || x >= w - 1 - R || y >= h - 1 - R
          if (!cres2[p] && !margem) fundo[p] = 0
        }
      }

      // Só pontas: se apagou demais (ex: aparelho branco encostando na borda), desiste e usa a original
      if (soPontas) {
        let apagados = 0
        for (let p = 0; p < w * h; p++) apagados += fundo[p]
        if (apagados > w * h * 0.35) return { arquivo: original, ajustou: false, semFundo: false }
      }

      // ── 3. Mantém só os blocos grandes (aparelho), descarta textos e logos soltos
      const rotulo = new Int32Array(w * h)
      const tamanhos: number[] = [0]
      for (let p0 = 0; p0 < w * h; p0++) {
        if (fundo[p0] || rotulo[p0]) continue
        const id = tamanhos.length
        let qtd = 0
        let a = 0, z = 0
        fila[z++] = p0; rotulo[p0] = id
        while (a < z) {
          const p = fila[a++]; qtd++
          const x = p % w, y = (p - x) / w
          const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
          for (const q of viz) {
            if (q >= 0 && !fundo[q] && !rotulo[q]) { rotulo[q] = id; fila[z++] = q }
          }
        }
        tamanhos.push(qtd)
      }
      const maior = Math.max(0, ...tamanhos)
      if (maior > 0) {
        const manter = tamanhos.map(t => t >= maior * 0.15)
        for (let p = 0; p < w * h; p++) {
          if (!fundo[p] && !manter[rotulo[p]]) fundo[p] = 1
        }
      }

      // Se quase nada do produto sobrou, o "fundo" era o próprio produto (ex: aparelho branco ocupando a foto): não mexe
      {
        let resto = 0
        for (let p = 0; p < w * h; p++) resto += fundo[p] ? 0 : 1
        if (resto < w * h * 0.06) return { arquivo: original, ajustou: false, semFundo: false }
      }

      // Aplica transparência, com borda suave para não ficar serrilhado
      for (let p = 0; p < w * h; p++) {
        if (fundo[p]) { px[p * 4 + 3] = 0; continue }
        const x = p % w, y = (p - x) / w
        const vizFundo = (x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (y > 0 && fundo[p - w]) || (y < h - 1 && fundo[p + w])
        if (vizFundo) px[p * 4 + 3] = Math.min(px[p * 4 + 3], 170)
      }
      ctx.putImageData(dados, 0, 0)
    }

    // ── 4. Recorta as sobras (caixa em volta do que sobrou)
    let minX = w, minY = h, maxX = -1, maxY = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!fundo[y * w + x]) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return { arquivo: original, ajustou: false, semFundo: false } // tudo virou fundo: usa original
    const cw = maxX - minX + 1, ch = maxY - minY + 1
    // Se quase nada sobrou (ex: removeu errado), usa a original
    if (bordasLisas && cw * ch < w * h * 0.02) return { arquivo: original, ajustou: false, semFundo: false }

    // ── 5. Centraliza no quadrado padrão
    const saida = document.createElement('canvas')
    saida.width = TAMANHO_FINAL; saida.height = TAMANHO_FINAL
    const sctx = saida.getContext('2d')
    if (!sctx) return { arquivo: original, ajustou: false, semFundo: false }
    sctx.imageSmoothingEnabled = true
    sctx.imageSmoothingQuality = 'high'
    const util = TAMANHO_FINAL * (1 - MARGEM * 2)
    const fator = Math.min(util / cw, util / ch)
    const dw = cw * fator, dh = ch * fator
    sctx.drawImage(c, minX, minY, cw, ch, (TAMANHO_FINAL - dw) / 2, (TAMANHO_FINAL - dh) / 2, dw, dh)

    const nomeBase = (original.name.replace(/\.[^.]+$/, '') || 'foto') + '_ajustada'
    const arquivo = await paraArquivo(saida, nomeBase)
    return { arquivo, ajustou: true, semFundo: bordasLisas }
  } catch (e) {
    console.error('Não foi possível ajustar a foto, usando a original:', e)
    return { arquivo: original, ajustou: false, semFundo: false }
  }
}
