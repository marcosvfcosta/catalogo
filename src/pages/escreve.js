import { writeFileSync } from 'fs'

const code = `import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type Negociacao = {
  id: string; nome: string; telefone: string; instagram: string
  modelo: string; cor: string; valor_aparelho: number; valor_entrada: number
  parcelas: number; taxa: number; valor_parcela: number; valor_total: number
  observacoes: string; status: string; vendedor: string; created_at: string
}

const TAXAS = [
  { label: 'A vista', parcelas: 1, taxa: 4.10 },
  { label: '2x', parcelas: 2, taxa: 5.37 },
  { label: '3x', parcelas: 3, taxa: 6.25 },
  { label: '4x', parcelas: 4, taxa: 7.13 },
  { label: '5x', parcelas: 5, taxa: 8.01 },
  { label: '6x', parcelas: 6, taxa: 8.89 },
  { label: '7x', parcelas: 7, taxa: 9.77 },
  { label: '8x', parcelas: 8, taxa: 10.65 },
  { label: '9x', parcelas: 9, taxa: 11.53 },
  { label: '10x', parcelas: 10, taxa: 12.41 },
  { label: '11x', parcelas: 11, taxa: 13.29 },
  { label: '12x', parcelas: 12, taxa: 14.17 },
  { label: '13x', parcelas: 13, taxa: 15.05 },
  { label: '14x', parcelas: 14, taxa: 15.93 },
  { label: '15x', parcelas: 15, taxa: 16.81 },
  { label: '16x', parcelas: 16, taxa: 17.69 },
  { label: '17x', parcelas: 17, taxa: 18.57 },
  { label: '18x', parcelas: 18, taxa: 19.45 },
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Negociacao() {
  const [aba, setAba] = useState<'negociacao' | 'clientes'>('negociacao')
  const [menuAberto, setMenuAberto] = useState(false)
  const [clientes, setClientes] = useState<Negociacao[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Negociacao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [parcelaSelecionada, setParcelaSelecionada] = useState<number | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nome: '', telefone: '', instagram: '',
    modelo: '', cor: '',
    valor_aparelho: '', valor_entrada: '',
    observacoes: '', vendedor: '',
  })

  useEffect(() => { if (aba === 'clientes') carregarClientes() }, [aba])

  async function carregarClientes() {
    const { data } = await supabase.from('negociacoes').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
  }

  const taxaAtual = TAXAS.find(t => t.parcelas === parcelaSelecionada) || TAXAS[0]
  const valorAparelho = parseFloat(form.valor_aparelho.replace(',', '.')) || 0
  const valorEntrada = parseFloat(form.valor_entrada.replace(',', '.')) || 0
  const valorFinanciar = Math.max(0, valorAparelho - valorEntrada)
  const valorComTaxa = valorFinanciar * (1 + (parcelaSelecionada ? taxaAtual.taxa : 0) / 100)
  const valorParcela = !parcelaSelecionada ? 0 : parcelaSelecionada === 1 ? valorComTaxa : valorComTaxa / parcelaSelecionada
  const valorTotal = valorComTaxa + valorEntrada

  function validar() {
    const e: Record<string, string> = {}
    if (!form.nome.trim()) e.nome = 'Nome do cliente obrigatório'
    if (!form.telefone.trim()) e.telefone = 'WhatsApp obrigatório'
    if (!form.vendedor.trim()) e.vendedor = 'Nome do vendedor obrigatório'
    if (!valorAparelho) e.valor_aparelho = 'Valor do aparelho obrigatório'
    if (!parcelaSelecionada) e.parcelas = 'Selecione o parcelamento'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar(status: 'Venda Fechada' | 'Venda Pendente') {
    if (!validar()) return
    setSalvando(true)
    const { error } = await supabase.from('negociacoes').insert([{
      nome: form.nome, telefone: form.telefone, instagram: form.instagram,
      modelo: form.modelo, cor: form.cor,
      valor_aparelho: valorAparelho, valor_entrada: valorEntrada,
      parcelas: parcelaSelecionada, taxa: taxaAtual.taxa,
      valor_parcela: valorParcela, valor_total: valorTotal,
      observacoes: form.observacoes, vendedor: form.vendedor, status,
    }])
    setSalvando(false)
    if (error) { alert('Erro ao salvar!'); return }
    alert('Negociação salva!')
    limpar()
  }

  function limpar() {
    setForm({ nome: '', telefone: '', instagram: '', modelo: '', cor: '', valor_aparelho: '', valor_entrada: '', observacoes: '', vendedor: '' })
    setParcelaSelecionada(null)
    setErros({})
  }

  async function alterarStatus(id: string, status: string) {
    await supabase.from('negociacoes').update({ status }).eq('id', id)
    carregarClientes(); setClienteSelecionado(null)
  }

  async function excluirNegociacao(id: string) {
    if (!confirm('Excluir esta negociação?')) return
    await supabase.from('negociacoes').delete().eq('id', id)
    carregarClientes(); setClienteSelecionado(null)
  }

  if (clienteSelecionado) return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.btnBack} onClick={() => setClienteSelecionado(null)}>← Voltar</button>
        <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
      </header>
      <div style={s.detalheContainer}>
        <h2 style={s.detalheTitle}>📋 Detalhes da Negociação</h2>
        <div style={s.detalheGrid}>
          <div style={s.detalheCard}><p style={s.detalheLabel}>👤 Cliente</p><p style={s.detalheValor}>{clienteSelecionado.nome}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>📱 WhatsApp</p><p style={s.detalheValor}>{clienteSelecionado.telefone || '—'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>📷 Instagram</p><p style={s.detalheValor}>{clienteSelecionado.instagram || '—'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>📲 Modelo</p><p style={s.detalheValor}>{clienteSelecionado.modelo || '—'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>🎨 Cor</p><p style={s.detalheValor}>{clienteSelecionado.cor || '—'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>🧑‍💼 Vendedor</p><p style={s.detalheValor}>{clienteSelecionado.vendedor || '—'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>💰 Valor Aparelho</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_aparelho)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>🔄 Entrada</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_entrada || 0)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>💳 Parcelamento</p><p style={s.detalheValor}>{clienteSelecionado.parcelas === 1 ? 'A vista' : clienteSelecionado.parcelas + 'x'} ({clienteSelecionado.taxa}%)</p></div>
          <div style={{ ...s.detalheCard, background: 'rgba(255,102,0,0.1)', border: '1px solid #ff6600', gridColumn: 'span 1' }}>
            <p style={s.detalheLabel}>💵 Valor da Parcela</p>
            <p style={{ ...s.detalheValor, color: '#ff6600', fontSize: 24, fontWeight: 900 }}>{fmt(clienteSelecionado.valor_parcela)}</p>
          </div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>🧾 Total</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_total)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>📅 Data</p><p style={s.detalheValor}>{new Date(clienteSelecionado.created_at).toLocaleDateString('pt-BR')}</p></div>
        </div>
        {clienteSelecionado.observacoes && <div style={{ ...s.detalheCard, marginTop: 12 }}><p style={s.detalheLabel}>📝 Observações</p><p style={s.detalheValor}>{clienteSelecionado.observacoes}</p></div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Venda Fechada')} style={{ ...s.btnFechar, flex: 1 }}>✅ Marcar Fechada</button>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Venda Pendente')} style={{ ...s.btnPendente, flex: 1 }}>⏳ Marcar Pendente</button>
          <button onClick={() => excluirNegociacao(clienteSelecionado.id)} style={{ ...s.btnExcluir, flex: 1 }}>🗑 Excluir</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      {menuAberto && <div style={s.overlay} onClick={() => setMenuAberto(false)} />}
      <aside style={{ ...s.sidebar, left: menuAberto ? 0 : -280 }}>
        <div style={s.sidebarLogo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
        <nav>
          <p style={{ ...s.navItem, ...(aba === 'negociacao' ? s.navAtivo : {}) }} onClick={() => { setAba('negociacao'); setMenuAberto(false) }}>🤝 Negociação</p>
          <p style={{ ...s.navItem, ...(aba === 'clientes' ? s.navAtivo : {}) }} onClick={() => { setAba('clientes'); setMenuAberto(false) }}>👥 Clientes</p>
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={s.header}>
          <button style={s.hamburger} onClick={() => setMenuAberto(!menuAberto)}>☰</button>
          <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
          <div style={s.abas}>
            <button style={aba === 'negociacao' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('negociacao')}>🤝 Negociação</button>
            <button style={aba === 'clientes' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('clientes')}>👥 Clientes</button>
          </div>
        </header>

        {aba === 'negociacao' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>🤝 Nova Negociação</h1>
            <p style={s.pageSubtitle}>Cadastre os dados e calcule o valor da venda</p>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>👤 Cliente</h3>
              <div style={s.formGrid3}>
                <div>
                  <label style={s.label}>Nome do Cliente *</label>
                  <input style={{ ...s.input, borderColor: erros.nome ? '#ff4444' : '#2a2a2a' }} value={form.nome} onChange={e => { setForm({ ...form, nome: e.target.value }); setErros({...erros, nome: ''}) }} placeholder="Nome completo" />
                  {erros.nome && <p style={s.erro}>{erros.nome}</p>}
                </div>
                <div>
                  <label style={s.label}>WhatsApp *</label>
                  <input style={{ ...s.input, borderColor: erros.telefone ? '#ff4444' : '#2a2a2a' }} value={form.telefone} onChange={e => { setForm({ ...form, telefone: e.target.value }); setErros({...erros, telefone: ''}) }} placeholder="(64) 9 9999-9999" />
                  {erros.telefone && <p style={s.erro}>{erros.telefone}</p>}
                </div>
                <div>
                  <label style={s.label}>Instagram</label>
                  <input style={s.input} value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" />
                </div>
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>📲 Aparelho</h3>
              <div style={s.formGrid2}>
                <div>
                  <label style={s.label}>Modelo</label>
                  <input style={s.input} value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} placeholder="Ex: iPhone 15 Pro" />
                </div>
                <div>
                  <label style={s.label}>Cor</label>
                  <input style={s.input} value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} placeholder="Ex: Preto Titânio" />
                </div>
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>💰 Valores</h3>
              <div style={s.formGrid3}>
                <div>
                  <label style={s.label}>Valor do Aparelho *</label>
                  <div style={s.inputPrefix}>
                    <span style={s.prefix}>R\$</span>
                    <input style={{ ...s.input, borderRadius: '0 10px 10px 0', borderColor: erros.valor_aparelho ? '#ff4444' : '#2a2a2a' }} value={form.valor_aparelho} onChange={e => { setForm({ ...form, valor_aparelho: e.target.value }); setErros({...erros, valor_aparelho: ''}) }} placeholder="0,00" />
                  </div>
                  {erros.valor_aparelho && <p style={s.erro}>{erros.valor_aparelho}</p>}
                </div>
                <div>
                  <label style={s.label}>Entrada</label>
                  <div style={s.inputPrefix}>
                    <span style={s.prefix}>R\$</span>
                    <input style={{ ...s.input, borderRadius: '0 10px 10px 0' }} value={form.valor_entrada} onChange={e => setForm({ ...form, valor_entrada: e.target.value })} placeholder="0,00" />
                  </div>
                </div>
                <div style={s.resumoBox}>
                  <p style={s.resumoLabel}>A Financiar</p>
                  <p style={s.resumoValor}>{fmt(valorFinanciar)}</p>
                </div>
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>💳 Parcelamento {erros.parcelas && <span style={{ color: '#ff4444', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>{erros.parcelas}</span>}</h3>
              <div style={s.parcelasGrid}>
                {TAXAS.map(t => {
                  const vC = valorFinanciar * (1 + t.taxa / 100)
                  const vP = t.parcelas === 1 ? vC : vC / t.parcelas
                  const ativo = parcelaSelecionada === t.parcelas
                  return (
                    <div key={t.parcelas} onClick={() => { setParcelaSelecionada(t.parcelas); setErros({...erros, parcelas: ''}) }} style={{ ...s.parcelaCard, ...(ativo ? s.parcelaAtiva : {}), border: erros.parcelas && !ativo ? '1px solid #ff4444' : ativo ? '1px solid #ff6600' : '1px solid #1e1e1e' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid ' + (ativo ? '#ff6600' : '#555'), background: ativo ? '#ff6600' : 'transparent', flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, color: ativo ? '#ff6600' : '#fff' }}>{t.label}</span>
                          <span style={{ color: '#888', fontSize: 12 }}>{t.taxa}%</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ color: ativo ? '#ff6600' : '#fff', fontWeight: 700, margin: 0 }}>{fmt(vP)}</p>
                          <p style={{ color: '#888', fontSize: 11, margin: 0 }}>Total: {fmt(vC + valorEntrada)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {parcelaSelecionada && (
              <div style={s.resumoFinal}>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Parcelas</span><span style={s.resumoItemValor}>{parcelaSelecionada === 1 ? 'A vista' : parcelaSelecionada + 'x'}</span></div>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Taxa</span><span style={s.resumoItemValor}>{taxaAtual.taxa}%</span></div>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Parcela</span><span style={{ ...s.resumoItemValor, color: '#ff6600', fontSize: 26, fontWeight: 900 }}>{fmt(valorParcela)}</span></div>
                <div style={s.resumoItem}><span style={s.resumoItemLabel}>Total</span><span style={s.resumoItemValor}>{fmt(valorTotal)}</span></div>
              </div>
            )}

            <div style={s.section}>
              <h3 style={s.sectionTitle}>📝 Observações</h3>
              <textarea style={{ ...s.input, height: 80, resize: 'none' }} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Anotações sobre a negociação..." />
            </div>

            <div style={s.botoesRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...s.label, marginBottom: 4 }}>🧑‍💼 Vendedor *</label>
                  <input style={{ ...s.input, borderColor: erros.vendedor ? '#ff4444' : '#2a2a2a' }} value={form.vendedor} onChange={e => { setForm({ ...form, vendedor: e.target.value }); setErros({...erros, vendedor: ''}) }} placeholder="Nome do vendedor" />
                  {erros.vendedor && <p style={s.erro}>{erros.vendedor}</p>}
                </div>
                <button style={{ ...s.btnLimpar, marginTop: erros.vendedor ? 0 : 20 }} onClick={limpar}>🗑 Limpar</button>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <button style={s.btnPendente} onClick={() => salvar('Venda Pendente')} disabled={salvando}>{salvando ? 'Salvando...' : '⏳ Em Andamento'}</button>
                <button style={s.btnFechar} onClick={() => salvar('Venda Fechada')} disabled={salvando}>{salvando ? 'Salvando...' : '✅ Fechar Venda'}</button>
              </div>
            </div>
          </div>
        )}

        {aba === 'clientes' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>👥 Clientes</h1>
            {clientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
                <p style={{ fontSize: 48 }}>📋</p>
                <p>Nenhuma negociação cadastrada ainda</p>
              </div>
            ) : (
              <div style={s.clientesGrid}>
                {clientes.map(c => (
                  <div key={c.id} style={s.clienteCard} onClick={() => setClienteSelecionado(c)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <p style={s.clienteNome}>{c.nome}</p>
                        <p style={s.clienteModelo}>{c.modelo || '—'}{c.cor ? ' · ' + c.cor : ''}</p>
                        <p style={s.clienteTel}>📱 {c.telefone || '—'}</p>
                        {c.vendedor && <p style={s.clienteTel}>🧑‍💼 {c.vendedor}</p>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ ...s.statusBadge, background: c.status === 'Venda Fechada' ? 'rgba(37,211,102,0.15)' : 'rgba(255,200,0,0.15)', color: c.status === 'Venda Fechada' ? '#25D366' : '#ffc800', border: '1px solid ' + (c.status === 'Venda Fechada' ? '#25D366' : '#ffc800') }}>
                          {c.status === 'Venda Fechada' ? '✅ Fechada' : '⏳ Pendente'}
                        </span>
                        <p style={{ color: '#ff6600', fontWeight: 900, fontSize: 18, marginTop: 8 }}>{fmt(c.valor_parcela)}</p>
                        <p style={{ color: '#888', fontSize: 12 }}>{c.parcelas === 1 ? 'A vista' : c.parcelas + 'x'}</p>
                      </div>
                    </div>
                    <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'Poppins, sans-serif', display: 'flex', overflowX: 'hidden' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 150 },
  sidebar: { position: 'fixed', top: 0, width: 260, height: '100vh', background: '#0a0a0a', borderRight: '1px solid #1a1a1a', zIndex: 200, padding: '30px 0', transition: 'left 0.3s ease' },
  sidebarLogo: { padding: '0 20px 25px', borderBottom: '1px solid #1a1a1a', marginBottom: 10 },
  navItem: { padding: '14px 20px', cursor: 'pointer', fontSize: 16, color: '#ccc' },
  navAtivo: { color: '#ff6600', fontWeight: 700, background: 'rgba(255,102,0,0.07)' },
  header: { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', background: '#080808', borderBottom: '1px solid #1a1a1a', position: 'sticky', top: 0, zIndex: 100 },
  hamburger: { border: 'none', background: 'none', color: '#ff6600', fontSize: 28, cursor: 'pointer' },
  logo: { lineHeight: 1, marginRight: 'auto' },
  logoM: { color: '#ff6600', fontSize: 28, fontWeight: 900, fontFamily: 'Nunito, sans-serif', display: 'block' },
  logoMag: { color: '#ff6600', fontSize: 13, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'right', opacity: 0.85 },
  abas: { display: 'flex', gap: 8 },
  abaAtiva: { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#ff6600', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  abaInativa: { padding: '10px 20px', borderRadius: 10, border: '1px solid #333', background: 'none', color: '#888', cursor: 'pointer', fontSize: 14 },
  content: { padding: '28px 32px', maxWidth: 1100, width: '100%', margin: '0 auto' },
  pageTitle: { fontSize: 32, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', marginBottom: 6 },
  pageSubtitle: { color: '#666', fontSize: 14, marginBottom: 28 },
  section: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center' },
  formGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  formGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  label: { display: 'block', color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0a0a0a', color: 'white', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  inputPrefix: { display: 'flex', alignItems: 'center', border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#0a0a0a' },
  prefix: { padding: '13px 14px', color: '#ff6600', fontWeight: 700, background: '#111', borderRight: '1px solid #2a2a2a', whiteSpace: 'nowrap' },
  resumoBox: { background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.3)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  resumoLabel: { color: '#ff6600', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 },
  resumoValor: { color: '#ff6600', fontSize: 24, fontWeight: 900 },
  parcelasGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  parcelaCard: { background: '#0a0a0a', borderRadius: 10, padding: '12px 16px', cursor: 'pointer' },
  parcelaAtiva: { background: 'rgba(255,102,0,0.1)' },
  resumoFinal: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 },
  resumoItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  resumoItemLabel: { color: '#666', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  resumoItemValor: { color: 'white', fontSize: 18, fontWeight: 700 },
  botoesRow: { display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 8, marginBottom: 40, flexWrap: 'wrap' },
  btnLimpar: { padding: '13px 20px', borderRadius: 12, border: '1px solid #333', background: 'none', color: '#888', cursor: 'pointer', fontSize: 15, whiteSpace: 'nowrap' },
  btnPendente: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#ffc800', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15, whiteSpace: 'nowrap' },
  btnFechar: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#25D366', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15, whiteSpace: 'nowrap' },
  btnBack: { padding: '10px 18px', borderRadius: 10, border: '1px solid #333', background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14 },
  btnExcluir: { padding: '14px 24px', borderRadius: 12, border: '1px solid #ff3333', background: '#7a1111', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  erro: { color: '#ff4444', fontSize: 12, marginTop: 4 },
  clientesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  clienteCard: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, cursor: 'pointer' },
  clienteNome: { fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 },
  clienteModelo: { fontSize: 14, color: '#aaa', marginBottom: 4 },
  clienteTel: { fontSize: 13, color: '#666' },
  statusBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  detalheContainer: { padding: '28px 32px', maxWidth: 900, margin: '0 auto' },
  detalheTitle: { fontSize: 28, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', marginBottom: 24 },
  detalheGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  detalheCard: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 16 },
  detalheLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detalheValor: { color: 'white', fontSize: 16, fontWeight: 600 },
}
`

writeFileSync('src/pages/Negociacao.tsx', code, 'utf8')
console.log('OK! Linhas:', code.split('\\n').length)