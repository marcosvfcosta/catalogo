import { useEffect, useState } from 'react'

// iPad (tela larga): modelo, descrição, valor e foto maiores. No celular fica igual.
function useTelaGrande() {
  const medir = () => typeof window !== 'undefined' && window.innerWidth >= 700
  const [grande, setGrande] = useState(medir)
  useEffect(() => {
    const f = () => setGrande(medir())
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return grande
}

// Cartão de aparelho da lista de preços (Admin → Preços e Negociação → escolher o celular).
// Foco no modelo e no valor final; cada cor numa linha com a bolinha e o preço.
// Custo e fornecedor: na Negociação ficam escondidos no olhinho (o cliente pode estar vendo a tela).

export type Oferta = { f: string; cor: string; custo: number }
export type AparelhoPreco = {
  id: string
  modelo: string
  marca?: string | null
  cores: string[]
  fotos?: Record<string, string[]> | null
  preco?: number | null
  custo?: number | null
  precos_cor?: Record<string, number> | null
  fornecedor?: string | null
  ofertas?: { dia: string; itens: Oferta[] } | null
  ultima_lista?: string | null
}

export const CORES_BOLINHA: Record<string, string> = {
  "Prata": "#c0c0c0", "Lilás": "#c8a2c8", "Cinza": "#7f8c8d", "Preto": "#1a1a1a", "Branco": "#f0f0f0", "Vermelho (RED)": "#cc0000",
  "Estelar": "#f5e6c8", "Meia-Noite": "#1c2026", "Titânio Natural": "#c4b49a", "Natural": "#c4b49a", "Titânio Preto": "#2c2c2c",
  "Titânio Branco": "#e8e4dc", "Titânio Desert": "#c8a97a", "Titânio Rosa": "#e8b4a0", "Azul": "#4a90d9", "Azul Sierra": "#5b7fa6",
  "Azul Alpino": "#2d5f8a", "Verde": "#5ab878", "Verde Alpino": "#4a7c59", "Verde Floresta": "#2d5c3a", "Rosa": "#e8799e",
  "Roxo": "#7b5ea7", "Purple": "#8a6fd1", "Violeta": "#9b59b6", "Lavanda": "#c8b6e8", "Amarelo": "#f5c842", "Coral": "#ff6b5b",
  "Laranja": "#ff8c00", "Ciano": "#00bcd4", "Dourado": "#c9a84c", "Prateado": "#b0b8c1", "Grafite": "#4a4a4a",
  "Azul Pacífico": "#1a4a6b", "Luz das Estrelas": "#f0e8d0", "Vermelho": "#cc0000",
}

const real = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const diaDeHoje = () => new Date().toLocaleDateString('sv-SE')

// Marca: a cadastrada ou deduzida pelo nome
export function marcaDoAparelho(a: { marca?: string | null; modelo: string }) {
  if (a.marca?.trim()) return a.marca.trim()
  const m = a.modelo.toLowerCase()
  if (/^(iphone|ipad|apple|airpods)/.test(m)) return 'Apple'
  if (/^(galaxy|samsung)/.test(m)) return 'Samsung'
  if (/^(redmi|poco|xiaomi|note )/.test(m)) return 'Xiaomi'
  if (/^(moto|motorola|edge)/.test(m)) return 'Motorola'
  if (/^realme/.test(m)) return 'Realme'
  return 'Outros'
}

// "Redmi Note 15 256GB 8GB RAM 4G" → título "Redmi Note 15" + detalhe "256GB · 8GB RAM · 4G"
export function separarNome(modelo: string) {
  const m = modelo.match(/^(.*?)\s+(\d+\s?(?:GB|TB)\b.*)$/i)
  if (!m) return { titulo: modelo, detalhe: '' }
  const detalhe = m[2].replace(/(\d+GB) RAM/i, '|$1 RAM').replace(/\s([45]G)\b/, '|$1').replace(/\sCPO$/i, '|CPO')
    .split('|').map(x => x.trim()).filter(Boolean).join(' · ')
  return { titulo: m[1], detalhe }
}

// Preço de venda de cada cor
export function precoDaCor(a: AparelhoPreco, cor: string) {
  const v = a.precos_cor?.[cor]
  return v != null ? Number(v) : a.preco != null ? Number(a.preco) : null
}

// Novos preços se trocar para outro fornecedor (mesmo lucro de hoje)
export function precosComFornecedor(a: AparelhoPreco, fornecedor: string) {
  const ofertas = (a.ofertas?.dia === diaDeHoje() ? a.ofertas.itens : []).filter(o => o.f === fornecedor)
  if (!ofertas.length) return null
  const lucro = Number(a.preco || 0) - Number(a.custo || 0)
  const precos_cor: Record<string, number> = {}
  for (const c of a.cores) {
    const o = ofertas.find(x => x.cor === c)
    const atual = precoDaCor(a, c)
    precos_cor[c] = o ? o.custo + lucro : (atual ?? 0)
  }
  for (const o of ofertas) if (precos_cor[o.cor] == null) precos_cor[o.cor] = o.custo + lucro
  const custo = Math.min(...ofertas.map(o => o.custo))
  return { custo, preco: custo + lucro, precos_cor, fornecedor }
}

type Props = {
  ap: AparelhoPreco
  corEscolhida?: string
  selecionado?: boolean
  onEscolherCor?: (cor: string) => void
  onTocarCartao?: () => void
  custoEscondido?: boolean // Negociação: começa escondido no olhinho
  listaAntiga?: boolean
  fornecedorUsado?: string | null // fornecedor escolhido (se trocou)
  onUsarFornecedor?: (fornecedor: string) => void
  // Menu sanfona: fechado mostra só uma linha (modelo + preço); tocando abre
  sanfona?: { aberto: boolean; alternar: () => void; ultimo?: boolean }
}

export default function CartaoAparelho({ ap, corEscolhida, selecionado, onEscolherCor, onTocarCartao, custoEscondido, listaAntiga, fornecedorUsado, onUsarFornecedor, sanfona }: Props) {
  const [verCusto, setVerCusto] = useState(!custoEscondido)
  const [verFornecedores, setVerFornecedores] = useState(false)
  const g = useTelaGrande()
  const [verCores, setVerCores] = useState(false)
  const { titulo, detalhe } = separarNome(ap.modelo)
  const fornecedorAtual = fornecedorUsado || ap.fornecedor || null
  const ofertas = ap.ofertas?.dia === diaDeHoje() ? ap.ofertas.itens : []
  const fornecedores = Array.from(new Set(ofertas.map(o => o.f)))
    .map(f => {
      const os = ofertas.filter(o => o.f === f)
      const daCor = corEscolhida ? os.find(o => o.cor === corEscolhida) : null
      return { f, custo: daCor ? daCor.custo : Math.min(...os.map(o => o.custo)), temCor: !corEscolhida || !!daCor }
    })
    .sort((x, y) => Number(y.temCor) - Number(x.temCor) || x.custo - y.custo)
  const precos = ap.cores.map(c => precoDaCor(ap, c)).filter((v): v is number => v != null)
  const menor = precos.length ? Math.min(...precos) : ap.preco != null ? Number(ap.preco) : null
  const variosPrecos = new Set(precos).size > 1
  const valorMostrado = corEscolhida ? precoDaCor(ap, corEscolhida) : menor
  const fotoDe = (c?: string) => (c && ap.fotos?.[c]?.[0]) || null
  const foto = fotoDe(corEscolhida) || ap.cores.map(c => fotoDe(c)).find(Boolean) || Object.values(ap.fotos || {}).flat()[0] || null
  const custoCor = corEscolhida && fornecedorAtual ? ofertas.find(o => o.f === fornecedorAtual && o.cor === corEscolhida)?.custo : null
  const custoMostrado = custoCor ?? ap.custo

  // Valor final: no celular embaixo do modelo; no iPad do lado direito
  const blocoPreco = (
    <>
      <p style={{ color: '#888', fontSize: g ? 15 : 11, margin: g ? 0 : '8px 0 0' }}>{corEscolhida ? corEscolhida : variosPrecos ? 'a partir de' : 'Valor final'}</p>
      <p style={{ color: '#25D366', fontSize: g ? 46 : 26, fontWeight: 900, margin: 0, letterSpacing: -0.5, whiteSpace: 'nowrap' }}>{real(valorMostrado)}</p>
      <p style={{ color: '#888', fontSize: g ? 15 : 11, margin: 0 }}>até 18x no cartão</p>
    </>
  )

  if (sanfona && !sanfona.aberto) {
    return (
      <div onClick={sanfona.alternar}
        style={{ padding: '14px 16px 6px', background: '#111', borderBottom: sanfona.ultimo ? 'none' : '1px solid #1e1e1e', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: g ? 24 : 17, fontWeight: 800, color: '#fff', margin: 0 }}>{titulo}</p>
          {detalhe && <p style={{ color: '#888', fontSize: g ? 16 : 12, margin: '2px 0 0' }}>{detalhe}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {variosPrecos && <p style={{ color: '#888', fontSize: g ? 13 : 10, margin: 0 }}>a partir de</p>}
          <p style={{ color: '#25D366', fontSize: g ? 24 : 16, fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>{real(menor)}</p>
          {listaAntiga && <p style={{ color: '#ffc800', fontSize: 9, fontWeight: 800, margin: '2px 0 0' }}>LISTA ANTIGA</p>}
        </div>
        </div>
        <div style={{ textAlign: 'center', color: '#666', fontSize: 16, lineHeight: 1, marginTop: 4 }}>▾</div>
      </div>
    )
  }

  return (
    <div onClick={onTocarCartao || sanfona?.alternar}
      style={sanfona
        ? { background: '#1a120b', padding: '16px 16px 6px', cursor: 'pointer', borderBottom: sanfona.ultimo ? 'none' : '1px solid #1e1e1e', textAlign: 'left' }
        : { background: '#111', border: selecionado ? '2px solid #25D366' : '1px solid #222', boxShadow: selecionado ? '0 0 0 4px rgba(37,211,102,0.12)' : 'none', borderRadius: 18, padding: 16, marginBottom: 12, cursor: onTocarCartao ? 'pointer' : 'default', textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: g ? 28 : 14, alignItems: 'center' }}>
        <div style={{ flex: g ? '0 0 200px' : '0 0 92px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: g ? 200 : 92, height: g ? 250 : 116, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(60% 60% at 50% 55%, rgba(255,255,255,0.08), transparent)' }}>
          {foto
            ? <img src={foto} alt={ap.modelo} loading="lazy" style={{ maxWidth: '90%', maxHeight: g ? 236 : 108, objectFit: 'contain' }} />
            : <div style={{ textAlign: 'center', opacity: 0.5, fontSize: 28 }}>📱<small style={{ display: 'block', fontSize: 10, color: '#888' }}>sem foto</small></div>}
        </div>
        {/* Setinha das cores, embaixo da foto: tocando mostra cada cor com o valor */}
        {ap.cores.length > 0 && (
          <div onClick={e => { e.stopPropagation(); setVerCores(v => !v) }}
            style={{ color: '#ff6600', fontSize: g ? 30 : 22, lineHeight: 1, padding: g ? '6px 24px 2px' : '4px 16px 0', cursor: 'pointer', textAlign: 'center' }}>
            {verCores ? '▴' : '▾'}
            {corEscolhida && !verCores && <div style={{ color: '#25D366', fontSize: g ? 14 : 11, fontWeight: 700, marginTop: 2 }}>{corEscolhida}</div>}
          </div>
        )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <p style={{ fontSize: g ? 32 : 19, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.3, lineHeight: 1.15 }}>{titulo}</p>
            {listaAntiga && <span style={{ border: '1px solid #ffc800', color: '#ffc800', fontSize: 9, fontWeight: 800, borderRadius: 7, padding: '3px 6px', whiteSpace: 'nowrap' }}>LISTA ANTIGA</span>}
          </div>
          {detalhe && <p style={{ color: '#aaa', fontSize: g ? 20 : 13, margin: '3px 0 0' }}>{detalhe}</p>}
          {!g && blocoPreco}
        </div>
        {g && <div style={{ textAlign: 'right', flex: '0 0 auto' }}>{blocoPreco}</div>}
      </div>

      {ap.cores.length > 0 && (
        <>
          {verCores && <div style={{ background: '#0b0b0b', borderRadius: 12, padding: '4px 12px', marginTop: 12 }}>
            {ap.cores.map((c, k) => {
              const on = c === corEscolhida
              return (
                <div key={c} onClick={e => { if (onEscolherCor) { e.stopPropagation(); onEscolherCor(c) } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: k < ap.cores.length - 1 ? '1px solid #1d1d1d' : 'none', cursor: onEscolherCor ? 'pointer' : 'default', ...(on ? { background: '#0f2417', margin: '0 -12px', padding: '10px 12px', borderRadius: 10 } : {}) }}>
                  <span className="sem-inverter" style={{ width: 13, height: 13, borderRadius: '50%', background: CORES_BOLINHA[c] || '#888', border: '1px solid #555', flexShrink: 0 }} />
                  <span style={{ color: '#ddd', fontSize: 15, flex: 1 }}>{c}</span>
                  <b style={{ color: '#25D366', fontSize: 15 }}>{real(precoDaCor(ap, c))}</b>
                  {on && <span style={{ background: '#25D366', color: '#000', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>✓</span>}
                </div>
              )
            })}
          </div>}
        </>
      )}

      {/* Custo e fornecedor (escondidos no olhinho na Negociação) */}
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: verCusto ? 10 : 0, borderTop: verCusto ? '1px solid #1e1e1e' : 'none' }}>
        {verCusto ? (
          <>
            <span style={{ color: '#ff4d4d', fontWeight: 700, fontSize: 13, flex: 1 }}>Custo {real(custoMostrado)}</span>
            {(fornecedorAtual || fornecedores.length > 0) && (
              <button type="button" onClick={() => setVerFornecedores(v => !v)}
                style={{ background: verFornecedores ? '#2a1a0e' : 'none', color: '#ffb27a', border: '1px solid ' + (verFornecedores ? '#ff6600' : '#3a2a1c'), borderRadius: 14, padding: '4px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                🏷 {fornecedorAtual || 'Fornecedores'} {verFornecedores ? '▴' : '▾'}
              </button>
            )}
          </>
        ) : <span style={{ flex: 1 }} />}
        {custoEscondido && (
          <button type="button" onClick={() => { setVerCusto(v => !v); setVerFornecedores(false) }} title="Mostrar/ocultar custo"
            style={{ background: 'none', border: 'none', fontSize: 15, opacity: verCusto ? 0.8 : 0.35, cursor: 'pointer', padding: '2px 4px' }}>
            {verCusto ? '🙈' : '👁'}
          </button>
        )}
      </div>

      {verCusto && verFornecedores && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, background: '#0b0b0b', border: '1px solid #2a1a0e', borderRadius: 12, padding: '10px 12px' }}>
          {fornecedores.length === 0 ? (
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Fornecedor: <b style={{ color: '#ffb27a' }}>{fornecedorAtual}</b> · sem outras listas de hoje.</p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 6px' }}>
                Escolha o fornecedor <small style={{ color: '#666' }}>(se o atual não tiver mais){corEscolhida ? ` · ${corEscolhida}` : ''}</small>
              </p>
              {fornecedores.map((o, k) => {
                const usando = o.f === fornecedorAtual
                return (
                  <div key={o.f} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: k < fornecedores.length - 1 ? '1px solid #1d1d1d' : 'none', fontSize: 14, opacity: o.temCor ? 1 : 0.45 }}>
                    <span style={{ flex: 1, color: usando ? '#25D366' : '#ddd', fontWeight: usando ? 700 : 400 }}>{usando ? '✓ ' : ''}{o.f}</span>
                    <span style={{ color: '#ff4d4d', fontWeight: 700 }}>{real(o.custo)}</span>
                    {k > 0 && o.temCor && <span style={{ color: '#888', fontSize: 12 }}>+{real(o.custo - fornecedores[0].custo)}</span>}
                    {usando
                      ? <span style={{ background: '#25D366', color: '#000', borderRadius: 12, padding: '5px 10px', fontSize: 12, fontWeight: 800 }}>Usando</span>
                      : onUsarFornecedor && o.temCor
                        ? <button type="button" onClick={() => onUsarFornecedor(o.f)}
                            style={{ background: 'none', border: '1px solid #ff6600', color: '#ff8a3d', borderRadius: 12, padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Usar este</button>
                        : !o.temCor ? <span style={{ fontSize: 11, color: '#666' }}>sem essa cor</span> : null}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
      {sanfona && (
        <div onClick={e => { e.stopPropagation(); sanfona.alternar() }} style={{ textAlign: 'center', color: '#ff6600', fontSize: 20, lineHeight: 1, padding: '10px 0 4px', cursor: 'pointer' }}>▴</div>
      )}
    </div>
  )
}
