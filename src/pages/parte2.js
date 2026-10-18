import { appendFileSync } from 'fs'

const CORES_HEX = {
  'Preto': '#1a1a1a', 'Branco': '#f0f0f0', 'Vermelho (RED)': '#cc0000',
  'Estelar': '#f5e6c8', 'Meia-Noite': '#1c2026', 'Titânio Natural': '#c4b49a',
  'Titânio Preto': '#2c2c2c', 'Titânio Branco': '#e8e4dc', 'Titânio Desert': '#c8a97a',
  'Titânio Rosa': '#e8b4a0', 'Azul': '#4a90d9', 'Azul Sierra': '#5b7fa6',
  'Azul Alpino': '#2d5f8a', 'Verde': '#5ab878', 'Verde Alpino': '#4a7c59',
  'Verde Floresta': '#2d5c3a', 'Rosa': '#e8799e', 'Roxo': '#7b5ea7',
  'Violeta': '#9b59b6', 'Amarelo': '#f5c842', 'Coral': '#ff6b5b',
  'Laranja': '#ff8c00', 'Ciano': '#00bcd4', 'Dourado': '#c9a84c',
  'Prateado': '#b0b8c1', 'Grafite': '#4a4a4a', 'Azul Pacífico': '#1a4a6b',
  'Luz das Estrelas': '#f0e8d0',
}

const p2 = `
  const CORES_HEX: Record<string, string> = ${JSON.stringify(CORES_HEX)}

  const aparelhoSelecionado = aparelhos.find(a => a.modelo === form.modelo)
  const coresDisponiveis = aparelhoSelecionado?.cores || []
  const fotoAtual = form.cor && aparelhoSelecionado?.fotos?.[form.cor]?.[0] || null

  if (clienteSelecionado) return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.btnBack} onClick={() => setClienteSelecionado(null)}>← Voltar</button>
        <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
      </header>
      <div style={s.detalheContainer}>
        <h2 style={s.detalheTitle}>Detalhes da Negociacao</h2>
        <div style={s.detalheGrid}>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Cliente</p><p style={s.detalheValor}>{clienteSelecionado.nome}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>WhatsApp</p><p style={s.detalheValor}>{clienteSelecionado.telefone || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Instagram</p><p style={s.detalheValor}>{clienteSelecionado.instagram || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Modelo</p><p style={s.detalheValor}>{clienteSelecionado.modelo || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Cor</p><p style={s.detalheValor}>{clienteSelecionado.cor || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Vendedor</p><p style={s.detalheValor}>{clienteSelecionado.vendedor || '-'}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Valor</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_aparelho)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Entrada</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_entrada || 0)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Parcelas</p><p style={s.detalheValor}>{clienteSelecionado.parcelas === 1 ? 'A vista' : clienteSelecionado.parcelas + 'x'} ({clienteSelecionado.taxa}%)</p></div>
          <div style={{ ...s.detalheCard, background: 'rgba(255,102,0,0.1)', border: '1px solid #ff6600' }}>
            <p style={s.detalheLabel}>Parcela</p>
            <p style={{ ...s.detalheValor, color: '#ff6600', fontSize: 24, fontWeight: 900 }}>{fmt(clienteSelecionado.valor_parcela)}</p>
          </div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Total</p><p style={s.detalheValor}>{fmt(clienteSelecionado.valor_total)}</p></div>
          <div style={s.detalheCard}><p style={s.detalheLabel}>Data</p><p style={s.detalheValor}>{new Date(clienteSelecionado.created_at).toLocaleDateString('pt-BR')}</p></div>
        </div>
        {clienteSelecionado.observacoes && <div style={{ ...s.detalheCard, marginTop: 12 }}><p style={s.detalheLabel}>Obs</p><p style={s.detalheValor}>{clienteSelecionado.observacoes}</p></div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={() => editarNegociacao(clienteSelecionado)} style={{ ...s.btnAlterar, flex: 1 }}>✏️ Alterar Negociacao</button>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Venda Fechada')} style={{ ...s.btnFechar, flex: 1 }}>Fechada</button>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Venda Pendente')} style={{ ...s.btnPendente, flex: 1 }}>Pendente</button>
          <button onClick={() => alterarStatus(clienteSelecionado.id, 'Desistiram')} style={{ ...s.btnDesistiram, flex: 1 }}>Desistiram</button>
          <button onClick={() => excluirNegociacao(clienteSelecionado.id)} style={{ ...s.btnExcluir, flex: 1 }}>Excluir</button>
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
          <p style={{ ...s.navItem, ...(aba === 'negociacao' ? s.navAtivo : {}) }} onClick={() => { setAba('negociacao'); setMenuAberto(false) }}>Negociacao</p>
          <p style={{ ...s.navItem, ...(aba === 'clientes' ? s.navAtivo : {}) }} onClick={() => { setAba('clientes'); setMenuAberto(false) }}>Clientes</p>
          <p style={{ ...s.navItem, ...(aba === 'relatorios' ? s.navAtivo : {}) }} onClick={() => { setAba('relatorios'); setMenuAberto(false) }}>Relatorios</p>
          <p style={{ ...s.navItem, ...(aba === 'admin' ? s.navAtivo : {}) }} onClick={() => { setAba('admin'); setMenuAberto(false) }}>Admin</p>
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={s.header}>
          <button style={s.hamburger} onClick={() => setMenuAberto(!menuAberto)}>☰</button>
          <div style={s.logo}><span style={s.logoM}>Marcos</span><span style={s.logoMag}>Magazine</span></div>
          <div style={s.abas}>
            <button style={aba === 'negociacao' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('negociacao')}>{editandoId ? '✏️' : 'Negociacao'}</button>
            <button style={aba === 'clientes' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('clientes')}>Clientes</button>
            <button style={aba === 'relatorios' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('relatorios')}>Relatorios</button>
            <button style={aba === 'admin' ? s.abaAtiva : s.abaInativa} onClick={() => setAba('admin')}>Admin</button>
          </div>
        </header>
        {aba === 'negociacao' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>{editandoId ? 'Alterar Negociacao' : 'Nova Negociacao'}</h1>
            <p style={s.pageSubtitle}>{editandoId ? 'Edite os dados e salve para atualizar' : 'Cadastre os dados e calcule o valor da venda'}</p>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Cliente</h3>
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
              <h3 style={s.sectionTitle}>Aparelho</h3>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Modelo</label>
                <div style={{ position: 'relative' }}>
                  <input style={s.input} value={buscaModelo} onChange={e => buscarModelo(e.target.value)} placeholder="Buscar modelo cadastrado..." />
                  {modeloSugestoes.length > 0 && (
                    <div style={s.sugestoesBox}>
                      {modeloSugestoes.map(a => (
                        <div key={a.id} style={s.sugestaoItem} onClick={() => selecionarAparelho(a)}>
                          <span style={{ color: 'white', fontWeight: 600 }}>{a.modelo}</span>
                          <span style={{ color: '#666', fontSize: 12 }}>{a.cores.length} cor(es)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {coresDisponiveis.length > 0 && (
                <div>
                  <label style={{ ...s.label, textAlign: 'center', display: 'block' }}>Cor</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, justifyContent: 'center' }}>
                    {coresDisponiveis.map(cor => (
                      <div key={cor} onClick={() => setForm({ ...form, cor })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: CORES_HEX[cor] || '#888', border: form.cor === cor ? '3px solid #ff6600' : '3px solid transparent', boxShadow: form.cor === cor ? '0 0 0 2px rgba(255,102,0,0.4)' : 'none', outline: cor === 'Branco' ? '1px solid #444' : 'none', transition: 'all 0.2s' }} />
                        <span style={{ fontSize: 10, color: form.cor === cor ? '#ff6600' : '#666', textAlign: 'center', maxWidth: 60 }}>{cor}</span>
                      </div>
                    ))}
                  </div>
                  {form.cor && <p style={{ color: '#ff6600', fontSize: 13, marginTop: 10, textAlign: 'center' }}>✓ {form.cor}</p>}
                  {fotoAtual && (
                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                      <img src={fotoAtual} alt={form.cor} onClick={() => window.open(fotoAtual, '_blank')}
                        style={{ width: 200, height: 200, objectFit: 'contain', borderRadius: 16, border: '1px solid #2a2a2a', background: '#0a0a0a', cursor: 'zoom-in' }} />
                    </div>
                  )}
                </div>
              )}
              {coresDisponiveis.length === 0 && (
                <div>
                  <label style={s.label}>Cor</label>
                  <input style={s.input} value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} placeholder="Ex: Preto Titânio" />
                </div>
              )}
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Valores</h3>
              <div style={s.formGrid3}>
                <div>
                  <label style={s.label}>Valor do Aparelho *</label>
                  <div style={s.inputPrefix}><span style={s.prefix}>R$</span><input style={{ ...s.input, borderRadius: '0 10px 10px 0', borderColor: erros.valor_aparelho ? '#ff4444' : '#2a2a2a' }} value={form.valor_aparelho} onChange={e => { setForm({ ...form, valor_aparelho: e.target.value }); setErros({...erros, valor_aparelho: ''}) }} placeholder="0,00" /></div>
                  {erros.valor_aparelho && <p style={s.erro}>{erros.valor_aparelho}</p>}
                </div>
                <div>
                  <label style={s.label}>Entrada</label>
                  <div style={s.inputPrefix}><span style={s.prefix}>R$</span><input style={{ ...s.input, borderRadius: '0 10px 10px 0' }} value={form.valor_entrada} onChange={e => setForm({ ...form, valor_entrada: e.target.value })} placeholder="0,00" /></div>
                </div>
                <div style={s.resumoBox}><p style={s.resumoLabel}>A Financiar</p><p style={s.resumoValor}>{fmt(valorFinanciar)}</p></div>
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Parcelamento {erros.parcelas && <span style={{ color: '#ff4444', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>{erros.parcelas}</span>}</h3>
              <div style={s.parcelasGrid}>
                {TAXAS.map(t => {
                  const vC = valorFinanciar / (1 - t.taxa / 100)
                  const vP = t.parcelas === 1 ? vC : vC / t.parcelas
                  const ativo = parcelaSelecionada === t.parcelas
                  return (
                    <div key={t.parcelas} onClick={() => { setParcelaSelecionada(t.parcelas); setErros({...erros, parcelas: ''}) }} style={{ ...s.parcelaCard, border: ativo ? '1px solid #ff6600' : erros.parcelas ? '1px solid #ff4444' : '1px solid #1e1e1e', ...(ativo ? s.parcelaAtiva : {}) }}>
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
              <h3 style={s.sectionTitle}>Observacoes</h3>
              <textarea style={{ ...s.input, height: 80, resize: 'none' }} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Anotacoes sobre a negociacao..." />
            </div>
            <div style={s.botoesRow}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flex: 1 }}>
                <div style={{ flex: 1 }}>
                  <input style={{ ...s.input, borderColor: erros.vendedor ? '#ff4444' : '#2a2a2a' }} value={form.vendedor} onChange={e => { setForm({ ...form, vendedor: e.target.value }); setErros({...erros, vendedor: ''}) }} placeholder="Nome do vendedor" />
                  {erros.vendedor && <p style={s.erro}>{erros.vendedor}</p>}
                </div>
                <button style={s.btnLimpar} onClick={limpar}>Limpar</button>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <button style={s.btnPendente} onClick={() => salvar('Venda Pendente')} disabled={salvando}>{salvando ? '...' : 'Em Andamento'}</button>
                <button style={s.btnFechar} onClick={() => salvar('Venda Fechada')} disabled={salvando}>{salvando ? '...' : editandoId ? 'Salvar Alteracao' : 'Fechar Venda'}</button>
              </div>
            </div>
          </div>
        )}
        {aba === 'clientes' && (
          <div style={s.content}>
            <h1 style={s.pageTitle}>Clientes</h1>
            <div style={s.filtrosRow}>
              {['Todos', 'Em Andamento', 'Venda Fechada', 'Desistiram'].map(f => (
                <button key={f} style={filtro === f ? s.filtroBtnAtivo : s.filtroBtn} onClick={() => setFiltro(f)}>{f}</button>
              ))}
            </div>
            {(() => {
              const lista = filtro === 'Todos' ? clientes
                : filtro === 'Em Andamento' ? clientes.filter(c => c.status === 'Venda Pendente')
                : clientes.filter(c => c.status === filtro)
              return lista.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#666' }}><p style={{ fontSize: 48 }}>📋</p><p>Nenhuma negociacao encontrada</p></div>
              ) : (
                <div style={s.clientesGrid}>
                  {lista.map(c => (
                    <div key={c.id} style={s.clienteCard} onClick={() => setClienteSelecionado(c)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <p style={s.clienteNome}>{c.nome}</p>
                          <p style={s.clienteModelo}>{c.modelo || '-'}{c.cor ? ' · ' + c.cor : ''}</p>
                          <p style={s.clienteTel}>📱 {c.telefone || '-'}</p>
                          {c.vendedor && <p style={s.clienteTel}>{c.vendedor}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ ...s.statusBadge, background: c.status === 'Venda Fechada' ? 'rgba(37,211,102,0.15)' : c.status === 'Desistiram' ? 'rgba(255,51,51,0.15)' : 'rgba(255,200,0,0.15)', color: c.status === 'Venda Fechada' ? '#25D366' : c.status === 'Desistiram' ? '#ff3333' : '#ffc800', border: '1px solid ' + (c.status === 'Venda Fechada' ? '#25D366' : c.status === 'Desistiram' ? '#ff3333' : '#ffc800') }}>{c.status === 'Venda Fechada' ? 'Fechada' : c.status === 'Desistiram' ? 'Desistiram' : 'Pendente'}</span>
                          <p style={{ color: '#ff6600', fontWeight: 900, fontSize: 18, marginTop: 8 }}>{fmt(c.valor_parcela)}</p>
                          <p style={{ color: '#888', fontSize: 12 }}>{c.parcelas === 1 ? 'A vista' : c.parcelas + 'x'}</p>
                        </div>
                      </div>
                      <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
`

appendFileSync('src/pages/Negociacao.tsx', p2, 'utf8')
console.log('parte 2 ok')