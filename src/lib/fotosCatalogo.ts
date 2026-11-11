// Fotos já cadastradas (catálogo e aparelhos) reaproveitadas nos aparelhos que vêm das listas.
// A lista escreve o nome de outro jeito ("Galaxy A07 128GB 4GB RAM 4G"), então a comparação
// ignora armazenamento, RAM, 4G/5G, CPO e marca: a foto do "Galaxy A07" serve para todos.

import { supabase } from '../supabase'

export type ComFotos = { modelo: string; cores?: string[] | null; fotos?: Record<string, string[]> | null }

const tirarAcento = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const MARCAS = /\b(apple|samsung|xiaomi|motorola|realme|infinix|tecno|honor|huawei|oppo|vivo|nokia|lg|asus|zte|google)\b/g

export function baseModelo(nome: string) {
  return tirarAcento(nome)
    .replace(/\b\d+\s*(gb|tb)\b(\s*(de\s*)?ram)?/g, ' ')
    .replace(/\b(ram|4g|5g|cpo|dual\s*chip|lacrado|novo|seminovo)\b/g, ' ')
    .replace(MARCAS, ' ')
    .replace(/[^a-z0-9]/g, '')
}

const chaveCor = (c: string) => tirarAcento(c).replace(/[^a-z0-9]/g, '')

// Celulares/tablets do catálogo com as fotos de cada cor
export async function carregarFotosCatalogo(): Promise<ComFotos[]> {
  const [prod, fts] = await Promise.all([
    supabase.from('produtos_catalogo').select('id, categoria, modelo, memoria, cor, foto_url, foto_cor'),
    supabase.from('produto_fotos').select('produto_id, url, cor').order('ordem'),
  ])
  const fotos = (fts.data || []) as { produto_id: string; url: string; cor: string | null }[]
  type P = { id: string; categoria?: string | null; modelo: string; memoria?: string | null; cor?: string | null; foto_url?: string | null; foto_cor?: string | null }
  return ((prod.data || []) as P[])
    .filter(p => /celular|tablet|ipad/.test(tirarAcento(p.categoria || '')))
    .map(p => {
      const cores = (p.cor || '').split(/[,/;]| e /).map(c => c.trim()).filter(Boolean)
      const porCor: Record<string, string[]> = {}
      const guardar = (cor: string | null | undefined, url: string | null | undefined) => {
        if (!url) return
        const nome = cores.find(c => cor && chaveCor(c) === chaveCor(cor)) || cor || cores[0] || 'Padrão'
        porCor[nome] = [...(porCor[nome] || []), url]
      }
      guardar(p.foto_cor, p.foto_url)
      fotos.filter(f => f.produto_id === p.id).forEach(f => guardar(f.cor, f.url))
      return { modelo: [p.modelo, p.memoria].filter(Boolean).join(' '), cores, fotos: porCor }
    })
    .filter(p => Object.keys(p.fotos).length > 0)
}

// Completa as fotos que faltam de cada aparelho com as de outro cadastro do mesmo modelo.
// Cor igual → foto daquela cor; as outras cores entram também (o cartão usa como reserva).
export function completarFotos<T extends ComFotos>(aparelhos: T[], fontes: ComFotos[]): T[] {
  const porBase = new Map<string, Record<string, string[]>>()
  for (const f of fontes) {
    const b = baseModelo(f.modelo)
    if (!b) continue
    const atual = porBase.get(b) || {}
    for (const [cor, urls] of Object.entries(f.fotos || {})) if (urls?.length && !atual[cor]?.length) atual[cor] = urls
    porBase.set(b, atual)
  }
  return aparelhos.map(a => {
    const achadas = porBase.get(baseModelo(a.modelo))
    if (!achadas) return a
    const fotos: Record<string, string[]> = { ...(a.fotos || {}) }
    const nomes = Object.keys(achadas)
    for (const cor of a.cores || []) {
      if (fotos[cor]?.length) continue
      const k = chaveCor(cor)
      const igual = nomes.find(n => chaveCor(n) === k) || nomes.find(n => chaveCor(n).includes(k) || k.includes(chaveCor(n)))
      if (igual) fotos[cor] = achadas[igual]
    }
    for (const n of nomes) if (!Object.keys(fotos).some(c => chaveCor(c) === chaveCor(n))) fotos[n] = achadas[n]
    return { ...a, fotos }
  })
}
