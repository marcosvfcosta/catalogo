import { appendFileSync } from 'fs'

const p3 = `
        {aba === 'relatorios' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>Relatórios</h1>
            <p style={s.pageSubtitle}>Clique em um card para ver os clientes</p>
            <div style={s.relGrid}>
              {[
                { label: 'Vendas Fechadas', status: 'Venda Fechada', icon: '✅', cor: '#25D366' },
                { label: 'Em Andamento', status: 'Venda Pendente', icon: '⏳', cor: '#ffc800' },
                { label: 'Desistiram', status: 'Desistiram', icon: '❌', cor: '#ff3333' },
              ].map(({ label, status, icon, cor }) => {
                const lista = clientes.filter(c => c.status === status)
                const aberto = filtro === status
                return (
                  <div key={status}>
                    <div style={{ ...s.relCard, border: \`1px solid \${cor}\`, cursor: 'pointer', background: aberto ? \`rgba(\${cor === '#25D366' ? '37,211,102' : cor === '#ffc800' ? '255,200,0' : '255,51,51'},0.08)\` : '#0f0f0f' }} onClick={() => setFiltro(aberto ? 'Todos' : status)}>
                      <p style={s.relIcon}>{icon}</p>
                      <p style={{ ...s.relNumero, color: cor }}>{lista.length}</p>
                      <p style={s.relLabel}>{label}</p>
                      <p style={{ color: '#555', fontSize: 12, marginTop: 8 }}>{aberto ? '▲ fechar' : '▼ ver lista'}</p>
                    </div>
                    {aberto && lista.length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {lista.map(c => (
                          <div key={c.id} style={{ ...s.clienteCard, cursor: 'pointer' }} onClick={() => { setClienteSelecionado(c); setFiltro('Todos') }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={s.clienteNome}>{c.nome}</p>
                                <p style={s.clienteModelo}>{c.modelo || '-'}{c.cor ? ' · ' + c.cor : ''}</p>
                                <p style={s.clienteTel}>📱 {c.telefone || '-'}{c.vendedor ? ' · ' + c.vendedor : ''}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ color: '#ff6600', fontWeight: 900, fontSize: 18 }}>{fmt(c.valor_parcela)}</p>
                                <p style={{ color: '#888', fontSize: 12 }}>{c.parcelas === 1 ? 'À vista' : c.parcelas + 'x'}</p>
                                <p style={{ color: '#555', fontSize: 11 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {aberto && lista.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 20, color: '#555' }}>Nenhum cliente nesta categoria</div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ ...s.relCard, border: '1px solid #ff6600', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', marginTop: 0 }}>
              <p style={{ ...s.relLabel, fontSize: 16 }}>Total de Negociações</p>
              <p style={{ ...s.relNumero, color: '#ff6600', fontSize: 48, margin: 0 }}>{clientes.length}</p>
            </div>
          </div>
        )}
        {aba === 'admin' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>Admin — Aparelhos</h1>
            <p style={s.pageSubtitle}>Cadastre modelos com cores disponíveis</p>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>{aparelhoEditandoId ? '✏️ Editando Aparelho' : '➕ Novo Aparelho'}</h3>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Modelo</label>
                <input style={s.input} value={adminModelo} onChange={e => setAdminModelo(e.target.value)} placeholder="Ex: iPhone 17 128GB" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Cores disponíveis — toque para selecionar</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                  {CORES_LISTA.map(c => {
                    const sel = adminCoresSelecionadas.includes(c.nome)
                    const ativa = adminCorAtiva === c.nome
                    const temFoto = (adminFotos[c.nome] || []).length > 0
                    return (
                      <div key={c.nome} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                        onClick={() => { toggleCorAdmin(c.nome); setAdminCorAtiva(c.nome) }}>
                        <div style={{ position: 'relative', width: 40, height: 40 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%', background: c.hex,
                            border: ativa ? '3px solid #ff6600' : sel ? '3px solid #25D366' : '3px solid transparent',
                            outline: c.nome === 'Branco' ? '1px solid #444' : 'none',
                            boxShadow: ativa ? '0 0 0 2px rgba(255,102,0,0.3)' : 'none',
                            transition: 'all 0.2s'
                          }} />
                          {temFoto && (
                            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700 }}>✓</div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: ativa ? '#ff6600' : sel ? '#25D366' : '#555', textAlign: 'center', maxWidth: 56 }}>{c.nome}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {adminCorAtiva && adminCoresSelecionadas.includes(adminCorAtiva) && (
                <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <p style={{ color: '#ff6600', fontWeight: 700, marginBottom: 12 }}>📷 Fotos — {adminCorAtiva}</p>
                  <label style={{ display: 'block', border: '2px dashed #333', borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', color: '#666', marginBottom: 12 }}>
                    Toque para adicionar fotos
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                      const files = Array.from(e.target.files || [])
                      files.forEach(f => {
                        const reader = new FileReader()
                        reader.onload = ev => {
                          setAdminFotos(prev => ({ ...prev, [adminCorAtiva!]: [...(prev[adminCorAtiva!] || []), ev.target!.result as string] }))
                        }
                        reader.readAsDataURL(f)
                      })
                      e.target.value = ''
                    }} />
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {(adminFotos[adminCorAtiva] || []).map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '2px solid #333' }} />
                        <button onClick={() => setAdminFotos(prev => ({ ...prev, [adminCorAtiva!]: prev[adminCorAtiva!].filter((_, j) => j !== i) }))}
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ff3333', border: 'none', color: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                {aparelhoEditandoId && (
                  <button onClick={() => { setAdminModelo(''); setAdminCoresSelecionadas([]); setAdminCorAtiva(null); setAdminFotos({}); setAparelhoEditandoId(null) }}
                    style={{ ...s.btnLimpar, flex: 1 }}>Cancelar</button>
                )}
                <button onClick={salvarAparelho} disabled={adminSalvando}
                  style={{ ...s.btnFechar, flex: 2, padding: 16, fontSize: 16 }}>
                  {adminSalvando ? 'Salvando...' : aparelhoEditandoId ? '✅ Atualizar' : '✅ Salvar Aparelho'}
                </button>
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Aparelhos Cadastrados ({aparelhos.length})</h3>
              {aparelhos.length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center', padding: 20 }}>Nenhum aparelho cadastrado ainda</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {aparelhos.map(a => (
                    <div key={a.id} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <p style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{a.modelo}</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => editarAparelho(a)} style={{ ...s.btnAlterar, padding: '8px 14px', fontSize: 13 }}>✏️ Editar</button>
                          <button onClick={() => excluirAparelho(a.id)} style={{ ...s.btnExcluir, padding: '8px 14px', fontSize: 13 }}>🗑️</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {a.cores.map((cor: string) => {
                          const MAPA: Record<string,string> = {"Preto":"#1a1a1a","Branco":"#f0f0f0","Vermelho (RED)":"#cc0000","Estelar":"#f5e6c8","Meia-Noite":"#1c2026","Titânio Natural":"#c4b49a","Titânio Preto":"#2c2c2c","Titânio Branco":"#e8e4dc","Titânio Desert":"#c8a97a","Titânio Rosa":"#e8b4a0","Azul":"#4a90d9","Azul Sierra":"#5b7fa6","Azul Alpino":"#2d5f8a","Verde":"#5ab878","Verde Alpino":"#4a7c59","Verde Floresta":"#2d5c3a","Rosa":"#e8799e","Roxo":"#7b5ea7","Violeta":"#9b59b6","Amarelo":"#f5c842","Coral":"#ff6b5b","Laranja":"#ff8c00","Ciano":"#00bcd4","Dourado":"#c9a84c","Prateado":"#b0b8c1","Grafite":"#4a4a4a","Azul Pacífico":"#1a4a6b","Luz das Estrelas":"#f0e8d0"}
                          return (
                            <div key={cor} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1a1a1a', borderRadius: 20, padding: '4px 10px' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: MAPA[cor] || '#888', border: cor === 'Branco' ? '1px solid #555' : 'none', flexShrink: 0 }} />
                              <span style={{ color: '#aaa', fontSize: 12 }}>{cor}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
  abas: { display: 'flex', gap: 8, overflowX: 'auto' },
  abaAtiva: { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#ff6600', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  abaInativa: { padding: '10px 18px', borderRadius: 10, border: '1px solid #333', background: 'none', color: '#888', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  content: { padding: '28px 20px', maxWidth: 1100, width: '100%', margin: '0 auto' },
  pageTitle: { fontSize: 28, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', marginBottom: 6 },
  pageSubtitle: { color: '#666', fontSize: 14, marginBottom: 28 },
  section: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 },
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
  btnPendente: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#ffc800', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnFechar: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#25D366', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnAlterar: { padding: '14px 28px', borderRadius: 12, border: 'none', background: '#ff6600', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnDesistiram: { padding: '14px 24px', borderRadius: 12, border: '1px solid #ff3333', background: '#3a0000', color: '#ff6666', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  btnBack: { padding: '10px 18px', borderRadius: 10, border: '1px solid #333', background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14 },
  btnExcluir: { padding: '14px 24px', borderRadius: 12, border: '1px solid #ff3333', background: '#7a1111', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  erro: { color: '#ff4444', fontSize: 12, marginTop: 4 },
  filtrosRow: { display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  filtroBtn: { padding: '8px 18px', borderRadius: 20, border: '1px solid #333', background: 'none', color: '#888', cursor: 'pointer', fontSize: 14 },
  filtroBtnAtivo: { padding: '8px 18px', borderRadius: 20, border: '1px solid #ff6600', background: 'rgba(255,102,0,0.15)', color: '#ff6600', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  clientesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  clienteCard: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, cursor: 'pointer' },
  clienteNome: { fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 },
  clienteModelo: { fontSize: 14, color: '#aaa', marginBottom: 4 },
  clienteTel: { fontSize: 13, color: '#666' },
  statusBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  detalheContainer: { padding: '28px 20px', maxWidth: 900, margin: '0 auto' },
  detalheTitle: { fontSize: 28, fontWeight: 900, color: '#ff6600', fontFamily: 'Nunito, sans-serif', marginBottom: 24 },
  detalheGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  detalheCard: { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 16 },
  detalheLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detalheValor: { color: 'white', fontSize: 16, fontWeight: 600 },
  sugestoesBox: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: 10, zIndex: 50, overflow: 'hidden' },
  sugestaoItem: { padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' },
  relGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 },
  relCard: { background: '#0f0f0f', borderRadius: 16, padding: 28, textAlign: 'center' },
  relIcon: { fontSize: 40, marginBottom: 12 },
  relNumero: { fontSize: 56, fontWeight: 900, color: 'white', fontFamily: 'Nunito, sans-serif', lineHeight: 1, marginBottom: 8 },
  relLabel: { color: '#888', fontSize: 14, fontWeight: 600 },
}
`

appendFileSync('src/pages/Negociacao.tsx', p3, 'utf8')
console.log('parte 3 ok')