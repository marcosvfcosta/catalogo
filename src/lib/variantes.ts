// Mesmo celular com memórias diferentes (ex: iPhone 15 128GB e 256GB) vira um modelo só,
// com a memória escolhida por botões. Usado no catálogo e na Negociação.

const tirarAcento = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Armazenamento: primeiro "NNN GB/TB" que não seja RAM
export function memoriaDe(nome: string, memoria?: string | null): { rotulo: string; valor: number } | null {
  const texto = `${memoria || ''} ${nome || ''}`
  const re = /(\d+(?:[.,]\d+)?)\s*(gb|tb)\b(\s*(de\s*)?ram)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) {
    if (m[3]) continue // é RAM
    const n = Number(m[1].replace(',', '.'))
    const tb = m[2].toLowerCase() === 'tb'
    return { rotulo: `${m[1]}${tb ? 'TB' : 'GB'}`, valor: tb ? n * 1024 : n }
  }
  return null
}

// Nome sem armazenamento e sem RAM: "Redmi Note 15 256GB 8GB RAM" → "Redmi Note 15"
export function nomeSemMemoria(nome: string) {
  return (nome || '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(gb|tb)\b(\s*(de\s*)?ram)?/gi, ' ')
    .replace(/\bram\b/gi, ' ')
    .replace(/\b4g\b/gi, ' ')
    .replace(/\s*[·|-]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Chave do grupo: marca + nome sem memória. "4G" é o mesmo aparelho; só "5G" separa
export function chaveVariante(marca: string | null | undefined, nome: string) {
  return tirarAcento(marca || '') + '|' + tirarAcento(nomeSemMemoria(nome)).replace(/\b4g\b/g, ' ').replace(/[^a-z0-9]/g, '')
}

// Agrupa e ordena por memória (menor primeiro)
export function agruparVariantes<T>(lista: T[], marca: (x: T) => string | null | undefined, nome: (x: T) => string, mem?: (x: T) => string | null | undefined) {
  const grupos = new Map<string, T[]>()
  for (const x of lista) {
    const k = chaveVariante(marca(x), nome(x))
    grupos.set(k, [...(grupos.get(k) || []), x])
  }
  for (const [k, g] of grupos) {
    grupos.set(k, [...g].sort((a, b) => (memoriaDe(nome(a), mem?.(a))?.valor || 0) - (memoriaDe(nome(b), mem?.(b))?.valor || 0)))
  }
  return grupos
}
