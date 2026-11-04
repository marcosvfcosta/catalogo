// Recorte de produto com IA grátis, rodando no próprio aparelho (sem servidor e sem pagar nada).
// IA leve (U²-Net pequeno, ~4,5 MB, licença Apache 2.0) que aponta ONDE está o produto.
// Ela protege o produto na hora de apagar o fundo: assim produto branco em fundo branco
// (carregador, cabo, fone) não é mais "comido". O fundo liso continua sendo tirado pela cor,
// o que mantém detalhes finos como cabos. Em foto com cenário, a IA recorta sozinha.

import { ajustarFoto } from './ajustarFoto'

const VERSAO_ORT = '1.20.1'
const CDN_ORT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${VERSAO_ORT}/dist/`
const MODELO_URL = '/modelos/u2netp.onnx'
const LADO = 320

type OrtTensor = { data: Float32Array; dims: number[] }
type Ort = {
  env: { wasm: { wasmPaths: string; numThreads: number; proxy?: boolean } }
  Tensor: new (tipo: string, dados: Float32Array, dims: number[]) => OrtTensor
  InferenceSession: { create: (url: string, op: Record<string, unknown>) => Promise<Sessao> }
}
type Sessao = { inputNames: string[]; outputNames: string[]; run: (e: Record<string, OrtTensor>) => Promise<Record<string, OrtTensor>> }

let carregando: Promise<{ ort: Ort; sessao: Sessao }> | null = null

function carregarScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src; s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Sem internet para baixar a IA'))
    document.head.appendChild(s)
  })
}

function carregarIA(aviso?: (t: string) => void) {
  if (carregando) return carregando
  carregando = (async () => {
    aviso?.('Preparando a IA (só na primeira vez)...')
    const w = window as unknown as { ort?: Ort }
    if (!w.ort) await carregarScript(CDN_ORT + 'ort.min.js')
    const ort = w.ort!
    ort.env.wasm.wasmPaths = CDN_ORT
    ort.env.wasm.numThreads = 1 // iPhone: sem multithread (evita travar)
    const sessao = await ort.InferenceSession.create(MODELO_URL, { executionProviders: ['wasm'] })
    return { ort, sessao }
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

// Máscara do produto (0 = fundo, 1 = produto) em 320x320
async function mascaraDoProduto(arquivo: Blob, aviso?: (t: string) => void) {
  const { ort, sessao } = await carregarIA(aviso)
  aviso?.('Recortando o produto...')
  const img = await carregarImagem(arquivo)
  const c = document.createElement('canvas')
  c.width = LADO; c.height = LADO
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Sem canvas')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, LADO, LADO)
  ctx.drawImage(img, 0, 0, LADO, LADO)
  const px = ctx.getImageData(0, 0, LADO, LADO).data
  let max = 1
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2])
  const media = [0.485, 0.456, 0.406], desvio = [0.229, 0.224, 0.225]
  const n = LADO * LADO
  const entrada = new Float32Array(3 * n)
  for (let p = 0; p < n; p++) {
    for (let k = 0; k < 3; k++) entrada[k * n + p] = (px[p * 4 + k] / max - media[k]) / desvio[k]
  }
  const saida = await sessao.run({ [sessao.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, LADO, LADO]) })
  const bruto = saida[sessao.outputNames[0]].data
  let mn = Infinity, mx = -Infinity
  for (let p = 0; p < n; p++) { mn = Math.min(mn, bruto[p]); mx = Math.max(mx, bruto[p]) }
  const dados = new Float32Array(n)
  for (let p = 0; p < n; p++) dados[p] = (bruto[p] - mn) / (mx - mn || 1)
  return { w: LADO, h: LADO, dados }
}

export async function recortarProduto(original: Blob, aviso?: (t: string) => void): Promise<File> {
  const arquivo = original instanceof File ? original
    : new File([original], 'foto.' + ((original.type.split('/')[1] || 'png').replace('jpeg', 'jpg')), { type: original.type || 'image/png' })
  let mascara
  try { mascara = await mascaraDoProduto(arquivo, aviso) }
  catch (e) { console.error('IA do recorte:', e) } // sem IA: faz só o ajuste normal
  const aj = await ajustarFoto(arquivo, mascara)
  if (!aj.ajustou || !aj.semFundo) throw new Error('Não consegui separar o produto do fundo nessa foto')
  return aj.arquivo
}
