// Recorte de produto com IA grátis, rodando no próprio aparelho (sem servidor e sem pagar nada).
// Usa o modelo BiRefNet (licença MIT, liberado para uso comercial), que reconhece o OBJETO na foto,
// então funciona até com produto branco em fundo branco (carregador, cabo, fone, capinha transparente).
//
// - Na primeira vez baixa o modelo (~115 MB) e o navegador guarda; nas próximas é rápido.
// - Resultado: só o produto, fundo transparente, centralizado num quadrado padrão.

const TAMANHO_FINAL = 1000
const MARGEM = 0.06
const LIMITE_TRABALHO = 1400
const VERSAO_LIB = '3.7.2'
const MODELO = 'onnx-community/BiRefNet_lite-ONNX'

type Lib = {
  AutoModel: { from_pretrained: (id: string, op: Record<string, unknown>) => Promise<Modelo> }
  AutoProcessor: { from_pretrained: (id: string) => Promise<Processador> }
  RawImage: { fromBlob: (b: Blob) => Promise<ImagemRaw>; fromTensor: (t: unknown) => ImagemRaw }
}
type ImagemRaw = { width: number; height: number; data: Uint8Array | Uint8ClampedArray; channels: number; resize: (w: number, h: number) => Promise<ImagemRaw> }
type Tensor = { sigmoid: () => Tensor; mul: (n: number) => Tensor; to: (t: string) => Tensor }
type Modelo = (entrada: { input_image: unknown }) => Promise<{ output_image: Tensor[] }>
type Processador = (img: ImagemRaw) => Promise<{ pixel_values: unknown }>

let carregando: Promise<{ lib: Lib; modelo: Modelo; processador: Processador }> | null = null

function carregarModelo(aviso?: (t: string) => void) {
  if (carregando) return carregando
  carregando = (async () => {
    aviso?.('Baixando a IA (só na primeira vez)...')
    const url = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${VERSAO_LIB}`
    const lib = (await import(/* @vite-ignore */ url)) as unknown as Lib
    const temWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator
    let modelo: Modelo
    try {
      modelo = await lib.AutoModel.from_pretrained(MODELO, { dtype: 'fp16', device: temWebGPU ? 'webgpu' : 'wasm' })
    } catch (e) {
      if (!temWebGPU) throw e
      // WebGPU falhou nesse aparelho: tenta pelo modo normal
      modelo = await lib.AutoModel.from_pretrained(MODELO, { dtype: 'fp16', device: 'wasm' })
    }
    const processador = await lib.AutoProcessor.from_pretrained(MODELO)
    return { lib, modelo, processador }
  })()
  carregando.catch(() => { carregando = null })
  return carregando
}

function carregarImagem(arquivo: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')) }
    img.src = url
  })
}

function paraArquivo(canvas: HTMLCanvasElement, nome: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(new File([b], nome, { type: 'image/png' })) : reject(new Error('Falha ao gerar imagem')), 'image/png')
  })
}

export async function recortarProduto(original: Blob, aviso?: (t: string) => void): Promise<File> {
  const { lib, modelo, processador } = await carregarModelo(aviso)
  aviso?.('Recortando o produto...')

  // Foto num tamanho de trabalho (fotos enormes deixam o celular lento)
  const img = await carregarImagem(original)
  const esc = Math.min(1, LIMITE_TRABALHO / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * esc)), h = Math.max(1, Math.round(img.height * esc))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Sem canvas')
  ctx.fillStyle = '#fff' // foto com transparência: fundo branco para a IA enxergar
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const base = await new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Falha')), 'image/png'))

  // IA: máscara do produto (0 = fundo, 255 = produto)
  const raw = await lib.RawImage.fromBlob(base)
  const { pixel_values } = await processador(raw)
  const { output_image } = await modelo({ input_image: pixel_values })
  const mascara = await lib.RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8')).resize(w, h)

  // Aplica a máscara como transparência
  const dados = ctx.getImageData(0, 0, w, h)
  const px = dados.data
  const m = mascara.data, canais = mascara.channels || 1
  let minX = w, minY = h, maxX = -1, maxY = -1, produto = 0
  for (let p = 0; p < w * h; p++) {
    let a = m[p * canais]
    if (a < 12) a = 0
    else if (a > 243) a = 255
    px[p * 4 + 3] = a
    if (a > 40) {
      produto++
      const x = p % w, y = (p - x) / w
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
  if (maxX < 0 || produto < w * h * 0.01) throw new Error('A IA não encontrou o produto nessa foto')
  ctx.putImageData(dados, 0, 0)

  // Centraliza no quadrado padrão
  const cw = maxX - minX + 1, ch = maxY - minY + 1
  const saida = document.createElement('canvas')
  saida.width = TAMANHO_FINAL; saida.height = TAMANHO_FINAL
  const s = saida.getContext('2d')
  if (!s) throw new Error('Sem canvas')
  s.imageSmoothingEnabled = true
  s.imageSmoothingQuality = 'high'
  const util = TAMANHO_FINAL * (1 - MARGEM * 2)
  const f = Math.min(util / cw, util / ch)
  const dw = cw * f, dh = ch * f
  s.drawImage(c, minX, minY, cw, ch, (TAMANHO_FINAL - dw) / 2, (TAMANHO_FINAL - dh) / 2, dw, dh)
  return paraArquivo(saida, 'produto_recortado.png')
}
