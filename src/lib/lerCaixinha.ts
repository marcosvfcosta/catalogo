// Lê os códigos de barras da caixinha do celular (IMEI, IMEI 2 e nº de série).
// Grátis e no próprio aparelho: leitor ZXing (WebAssembly) baixado do CDN na primeira vez.

const VERSAO = '3.0.2'
const SCRIPT = `https://cdn.jsdelivr.net/npm/zxing-wasm@${VERSAO}/dist/iife/reader/index.js`

type Resultado = { text: string; format: string }
type ZX = { readBarcodes: (img: ImageData | Blob, op: Record<string, unknown>) => Promise<Resultado[]> }

let carregando: Promise<ZX> | null = null

function carregarLeitor(): Promise<ZX> {
  const w = window as unknown as { ZXingWASM?: ZX }
  if (w.ZXingWASM) return Promise.resolve(w.ZXingWASM)
  if (carregando) return carregando
  carregando = new Promise<ZX>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT; s.async = true
    s.onload = () => w.ZXingWASM ? resolve(w.ZXingWASM) : reject(new Error('Leitor não carregou'))
    s.onerror = () => reject(new Error('Sem internet para baixar o leitor'))
    document.head.appendChild(s)
  })
  carregando.catch(() => { carregando = null })
  return carregando
}

// Foto grande do iPhone fica pesada: reduz para no máximo 2400px
async function imagemReduzida(arquivo: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Foto inválida')); i.src = url
    })
    const esc = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * esc); c.height = Math.round(img.naturalHeight * esc)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return ctx.getImageData(0, 0, c.width, c.height)
  } finally { URL.revokeObjectURL(url) }
}

// IMEI válido: 15 dígitos com dígito verificador (Luhn)
function imeiValido(t: string) {
  if (!/^\d{15}$/.test(t)) return false
  let soma = 0
  for (let i = 0; i < 15; i++) {
    let d = Number(t[i])
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    soma += d
  }
  return soma % 10 === 0
}

export type DadosCaixinha = { imeis: string[]; serie: string | null }

export async function lerCaixinha(foto: Blob): Promise<DadosCaixinha> {
  const zx = await carregarLeitor()
  const op = { tryHarder: true, maxNumberOfSymbols: 12 }
  let res = await zx.readBarcodes(await imagemReduzida(foto), op)
  if (!res.length) res = await zx.readBarcodes(foto, op) // tenta na foto original
  const textos = res.map(r => (r.text || '').trim()).filter(Boolean)
  const imeis = Array.from(new Set(textos.filter(imeiValido)))
  // Série da Apple vem como "S" + 10/12 letras e números (ex: SFPJ9J36QP1)
  let serie: string | null = null
  for (const bruto of textos) {
    let t = bruto.toUpperCase()
    if (!/^[A-Z0-9]+$/.test(t)) continue
    if (t.startsWith('S') && (t.length === 11 || t.length === 13)) t = t.slice(1)
    if ((t.length === 10 || t.length === 12) && /[A-Z]/.test(t) && /\d/.test(t)) { serie = t; break }
  }
  return { imeis, serie }
}
