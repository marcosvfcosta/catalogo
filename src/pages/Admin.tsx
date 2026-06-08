import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

type Produto = {
  id: string
  categoria: string
  marca: string
  modelo: string
  memoria?: string
  cor?: string
  condicao?: string
  bateria_saude?: string
  descricao?: string
  foto_url?: string
  preco?: number
  disponivel?: boolean
  destaque?: boolean
  lancamento?: boolean
  promocao?: boolean
  mais_procurado?: boolean
}

type HeroImagem = {
  id: string
  url: string
  ordem: number
  ativo: boolean
}

type ProdutoFoto = {
  id: string
  produto_id: string
  url: string
  ordem: number
}

export default function Admin() {
  const navigate = useNavigate()
  const [logado, setLogado] = useState(false)
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aba, setAba] = useState<'cadastrar' | 'lista' | 'hero'>('cadastrar')
  const [uploadando, setUploadando] = useState(false)
  const [uploadandoHero, setUploadandoHero] = useState(false)
  const [uploadandoFotos, setUploadandoFotos] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [heroImagens, setHeroImagens] = useState<HeroImagem[]>([])
  const [fotosNovas, setFotosNovas] = useState<string[]>([])
  const [fotosEdicao, setFotosEdicao] = useState<ProdutoFoto[]>([])

  const [novoProduto, setNovoProduto] = useState({
    categoria: 'Celulares',
    marca: '', modelo: '', memoria: '', cor: '', condicao: '',
    bateria_saude: '', preco: '', foto_url: '', descricao: '',
    disponivel: true, destaque: false, lancamento: false,
    promocao: false, mais_procurado: false,
  })

  useEffect(() => {
    if (logado) { carregarProdutos(); carregarHeroImagens() }
  }, [logado])

  async function carregarProdutos() {
    const { data } = await supabase.from('produtos_catalogo').select('*').order('created_at', { ascending: false })
    setProdutos(data || [])
  }

  async function carregarHeroImagens() {
    const { data } = await supabase.from('hero_imagens').select('*').order('ordem', { ascending: true })
    setHeroImagens(data || [])
  }

  async function carregarFotosEdicao(produtoId: string) {
    const { data } = await supabase.from('produto_fotos').select('*').eq('produto_id', produtoId).order('ordem')
    setFotosEdicao(data || [])
  }

  async function uploadFotoPrincipal(arquivo: File) {
    setUploadando(true)
    const ext = arquivo.name.split('.').pop()
    const nomeArquivo = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload da foto'); setUploadando(false); return }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeArquivo)
    setNovoProduto(prev => ({ ...prev, foto_url: data.publicUrl }))
    setUploadando(false)
  }

  async function uploadFotoPrincipalEdicao(arquivo: File) {
    setUploadando(true)
    const ext = arquivo.name.split('.').pop()
    const nomeArquivo = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload da foto'); setUploadando(false); return }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeArquivo)
    setEditando(prev => prev ? { ...prev, foto_url: data.publicUrl } : null)
    setUploadando(false)
  }

  async function uploadFotoExtra(arquivo: File, produtoId?: string) {
    setUploadandoFotos(true)
    const ext = arquivo.name.split('.').pop()
    const nomeArquivo = `extra_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload'); setUploadandoFotos(false); return }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeArquivo)
    if (produtoId) {
      const ordem = fotosEdicao.length + 1
      await supabase.from('produto_fotos').insert([{ produto_id: produtoId, url: data.publicUrl, ordem }])
      carregarFotosEdicao(produtoId)
    } else {
      setFotosNovas(prev => [...prev, data.publicUrl])
    }
    setUploadandoFotos(false)
  }

  async function excluirFotoExtra(fotoId: string, produtoId: string) {
    await supabase.from('produto_fotos').delete().eq('id', fotoId)
    carregarFotosEdicao(produtoId)
  }

  async function excluirFotoNova(url: string) {
    setFotosNovas(prev => prev.filter(f => f !== url))
  }

  async function uploadHeroImagem(arquivo: File) {
    setUploadandoHero(true)
    const nomeArquivo = `hero_${Date.now()}.png`
    const { error } = await supabase.storage.from('hero').upload(nomeArquivo, arquivo, { upsert: true })
    if (error) { alert('Erro ao fazer upload'); setUploadandoHero(false); return }
    const url = `https://bahcoajavayvdfavdhpg.supabase.co/storage/v1/object/public/hero/${nomeArquivo}`
    const ordem = heroImagens.length + 1
    await supabase.from('hero_imagens').insert([{ url, ordem, ativo: true }])
    carregarHeroImagens()
    setUploadandoHero(false)
  }

  async function toggleHeroImagem(id: string, ativo: boolean) {
    await supabase.from('hero_imagens').update({ ativo: !ativo }).eq('id', id)
    carregarHeroImagens()
  }

  async function excluirHeroImagem(id: string, url: string) {
    if (!confirm('Deseja excluir esta foto do hero?')) return
    const nomeArquivo = url.split('/').pop()
    await supabase.storage.from('hero').remove([nomeArquivo!])
    await supabase.from('hero_imagens').delete().eq('id', id)
    carregarHeroImagens()
  }

  function fazerLogin() {
    if (login === 'Admin' && senha === '1020') {
      setLogado(true); setErroLogin('')
    } else {
      setErroLogin('Login ou senha incorretos!')
    }
  }

  async function salvarProduto() {
    if (!novoProduto.marca || !novoProduto.modelo || !novoProduto.categoria) {
      alert('Preencha categoria, marca e modelo.'); return
    }
    const { data, error } = await supabase.from('produtos_catalogo').insert([{
      categoria: novoProduto.categoria, marca: novoProduto.marca, modelo: novoProduto.modelo,
      memoria: novoProduto.memoria, cor: novoProduto.cor, condicao: novoProduto.condicao,
      bateria_saude: novoProduto.bateria_saude, preco: novoProduto.preco ? Number(novoProduto.preco) : null,
      foto_url: novoProduto.foto_url, descricao: novoProduto.descricao, disponivel: novoProduto.disponivel,
      destaque: novoProduto.destaque, lancamento: novoProduto.lancamento,
      promocao: novoProduto.promocao, mais_procurado: novoProduto.mais_procurado,
    }]).select()
    if (error) { alert('Erro ao salvar produto'); return }
    if (data && data[0] && fotosNovas.length > 0) {
      const produtoId = data[0].id
      for (let i = 0; i < fotosNovas.length; i++) {
        await supabase.from('produto_fotos').insert([{ produto_id: produtoId, url: fotosNovas[i], ordem: i + 1 }])
      }
    }
    alert('Produto cadastrado!')
    setNovoProduto({ categoria: 'Celulares', marca: '', modelo: '', memoria: '', cor: '', condicao: '', bateria_saude: '', preco: '', foto_url: '', descricao: '', disponivel: true, destaque: false, lancamento: false, promocao: false, mais_procurado: false })
    setFotosNovas([])
    carregarProdutos()
    setAba('lista')
  }

  async function salvarEdicao() {
    if (!editando) return
    const { error } = await supabase.from('produtos_catalogo').update({
      categoria: editando.categoria, marca: editando.marca, modelo: editando.modelo,
      memoria: editando.memoria, cor: editando.cor, condicao: editando.condicao,
      bateria_saude: editando.bateria_saude, preco: editando.preco,
      foto_url: editando.foto_url, descricao: editando.descricao, disponivel: editando.disponivel,
      destaque: editando.destaque, lancamento: editando.lancamento,
      promocao: editando.promocao, mais_procurado: editando.mais_procurado,
    }).eq('id', editando.id)
    if (error) { alert('Erro ao editar produto'); return }
    alert('Produto atualizado!')
    setEditando(null)
    setFotosEdicao([])
    carregarProdutos()
  }

  async function excluirProduto(id: string) {
    if (!confirm('Deseja excluir este produto?')) return
    await supabase.from('produto_fotos').delete().eq('produto_id', id)
    await supabase.from('produtos_catalogo').delete().eq('id', id)
    carregarProdutos()
  }

  // ─── LOGIN ───────────────────────────────────
  if (!logado) {
    return (
      <div style={loginPage}>
        <div style={loginBox}>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={logoMarcas}>Marcos</span>
            <span style={logoMag}>Magazine</span>
          </div>
          <p style={loginSub}>Painel Administrativo</p>
          <input style={inputStyle} placeholder="Login" value={login} onChange={e => setLogin(e.target.value)} />
          <input style={inputStyle} placeholder="Senha" type="password" value={senha}
            onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && fazerLogin()} />
          {erroLogin && <p style={{ color: '#ff4444', fontSize: 13, textAlign: 'center' }}>{erroLogin}</p>}
          <button style={btnLogin} onClick={fazerLogin}>Entrar</button>
          <button style={btnVoltar} onClick={() => navigate('/')}>← Voltar ao catálogo</button>
        </div>
      </div>
    )
  }

  // ─── TELA DE EDIÇÃO ──────────────────────────
  if (editando) {
    return (
      <div style={adminPage}>
        <div style={adminHeader}>
          <div><span style={logoMarcas}>Marcos</span><span style={{ ...logoMag, display: 'inline', marginLeft: 4 }}> Magazine</span></div>
          <button style={btnSecundario} onClick={() => { setEditando(null); setFotosEdicao([]) }}>← Voltar</button>
        </div>
        <div style={formContainer}>
          <h2 style={formTitle}>✏️ Editar produto</h2>
          <label style={labelStyle}>Categoria</label>
          <select style={inputStyle} value={editando.categoria} onChange={e => setEditando({ ...editando, categoria: e.target.value })}>
            <option>Celulares</option><option>Tablet</option><option>Carregadores</option>
            <option>Fones</option><option>Smartwatch</option><option>Caixa de som</option>
          </select>
          <label style={labelStyle}>Marca</label>
          <input style={inputStyle} value={editando.marca || ''} onChange={e => setEditando({ ...editando, marca: e.target.value })} />
          <label style={labelStyle}>Modelo</label>
          <input style={inputStyle} value={editando.modelo || ''} onChange={e => setEditando({ ...editando, modelo: e.target.value })} />
          <label style={labelStyle}>Memória</label>
          <input style={inputStyle} value={editando.memoria || ''} onChange={e => setEditando({ ...editando, memoria: e.target.value })} />
          <label style={labelStyle}>Cor</label>
          <input style={inputStyle} value={editando.cor || ''} onChange={e => setEditando({ ...editando, cor: e.target.value })} />
          <label style={labelStyle}>Condição</label>
          <select style={inputStyle} value={editando.condicao || ''} onChange={e => setEditando({ ...editando, condicao: e.target.value })}>
            <option value="">Selecione...</option>
            <option>Novo</option><option>Seminovo</option><option>Usado</option>
          </select>
          <label style={labelStyle}>Saúde da bateria</label>
          <input style={inputStyle} value={editando.bateria_saude || ''} onChange={e => setEditando({ ...editando, bateria_saude: e.target.value })} />
          <label style={labelStyle}>Preço</label>
          <input style={inputStyle} type="number" value={editando.preco || ''} onChange={e => setEditando({ ...editando, preco: Number(e.target.value) })} />
          <label style={labelStyle}>Foto principal</label>
          <label style={uploadBox}>
            {uploadando ? '⏳ Enviando...' : '📷 Trocar foto principal'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoPrincipalEdicao(f) }} />
          </label>
          {editando.foto_url && (
            <img src={editando.foto_url} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10, marginBottom: 12 }} />
          )}
          <label style={labelStyle}>Fotos extras</label>
          <label style={uploadBox}>
            {uploadandoFotos ? '⏳ Enviando...' : '📸 Adicionar foto extra'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoExtra(f, editando.id) }} />
          </label>
          {fotosEdicao.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {fotosEdicao.map(foto => (
                <div key={foto.id} style={{ position: 'relative' }}>
                  <img src={foto.url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  <button onClick={() => excluirFotoExtra(foto.id, editando.id)}
                    style={{ position: 'absolute', top: 2, right: 2, background: '#7a1111', border: 'none', color: 'white', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, height: 80 }} value={editando.descricao || ''} onChange={e => setEditando({ ...editando, descricao: e.target.value })} />
          <div style={tagsBox}>
            <p style={tagsTitle}>Tags do produto</p>
            <label style={checkLabel}><input type="checkbox" checked={editando.disponivel || false} onChange={e => setEditando({ ...editando, disponivel: e.target.checked })} />✅ Disponível no catálogo</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.destaque || false} onChange={e => setEditando({ ...editando, destaque: e.target.checked })} />☆ Destaque</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.lancamento || false} onChange={e => setEditando({ ...editando, lancamento: e.target.checked })} />🚀 Lançamento</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.promocao || false} onChange={e => setEditando({ ...editando, promocao: e.target.checked })} />🏷 Promoção</label>
            <label style={checkLabel}><input type="checkbox" checked={editando.mais_procurado || false} onChange={e => setEditando({ ...editando, mais_procurado: e.target.checked })} />🔥 Mais Procurado</label>
          </div>
          <button style={btnSalvar} onClick={salvarEdicao}>✅ Salvar alterações</button>
        </div>
      </div>
    )
  }

  // ─── PAINEL PRINCIPAL ─────────────────────────
  return (
    <div style={adminPage}>
      <div style={adminHeader}>
        <div><span style={logoMarcas}>Marcos</span><span style={{ ...logoMag, display: 'inline', marginLeft: 4 }}> Magazine</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnSecundario} onClick={() => navigate('/')}>Ver catálogo</button>
          <button style={btnSecundario} onClick={() => setLogado(false)}>Sair</button>
        </div>
      </div>

      <div style={abasContainer}>
        <button style={aba === 'cadastrar' ? abaAtiva : abaInativa} onClick={() => setAba('cadastrar')}>+ Cadastrar</button>
        <button style={aba === 'lista' ? abaAtiva : abaInativa} onClick={() => setAba('lista')}>📦 ({produtos.length})</button>
        <button style={aba === 'hero' ? abaAtiva : abaInativa} onClick={() => setAba('hero')}>🖼 Hero</button>
      </div>

      {aba === 'cadastrar' && (
        <div style={formContainer}>
          <h2 style={formTitle}>Novo produto</h2>
          <label style={labelStyle}>Categoria</label>
          <select style={inputStyle} value={novoProduto.categoria} onChange={e => setNovoProduto({ ...novoProduto, categoria: e.target.value })}>
            <option>Celulares</option><option>Tablet</option><option>Carregadores</option>
            <option>Fones</option><option>Smartwatch</option><option>Caixa de som</option>
          </select>
          <label style={labelStyle}>Marca</label>
          <input style={inputStyle} placeholder="Ex: Apple" value={novoProduto.marca} onChange={e => setNovoProduto({ ...novoProduto, marca: e.target.value })} />
          <label style={labelStyle}>Modelo</label>
          <input style={inputStyle} placeholder="Ex: iPhone 15 Pro Max" value={novoProduto.modelo} onChange={e => setNovoProduto({ ...novoProduto, modelo: e.target.value })} />
          <label style={labelStyle}>Memória</label>
          <input style={inputStyle} placeholder="Ex: 256GB" value={novoProduto.memoria} onChange={e => setNovoProduto({ ...novoProduto, memoria: e.target.value })} />
          <label style={labelStyle}>Cor</label>
          <input style={inputStyle} placeholder="Ex: Preto Titânio" value={novoProduto.cor} onChange={e => setNovoProduto({ ...novoProduto, cor: e.target.value })} />
          <label style={labelStyle}>Condição</label>
          <select style={inputStyle} value={novoProduto.condicao} onChange={e => setNovoProduto({ ...novoProduto, condicao: e.target.value })}>
            <option value="">Selecione...</option>
            <option>Novo</option><option>Seminovo</option><option>Usado</option>
          </select>
          <label style={labelStyle}>Saúde da bateria</label>
          <input style={inputStyle} placeholder="Ex: 89%" value={novoProduto.bateria_saude} onChange={e => setNovoProduto({ ...novoProduto, bateria_saude: e.target.value })} />
          <label style={labelStyle}>Preço (interno)</label>
          <input style={inputStyle} placeholder="Ex: 2999" value={novoProduto.preco} onChange={e => setNovoProduto({ ...novoProduto, preco: e.target.value })} />
          <label style={labelStyle}>Foto principal</label>
          <label style={uploadBox}>
            {uploadando ? '⏳ Enviando foto...' : '📷 Foto principal'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoPrincipal(f) }} />
          </label>
          {novoProduto.foto_url && (
            <img src={novoProduto.foto_url} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10, marginBottom: 12 }} />
          )}
          <label style={labelStyle}>Fotos extras (opcional)</label>
          <label style={uploadBox}>
            {uploadandoFotos ? '⏳ Enviando...' : '📸 Adicionar foto extra'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoExtra(f) }} />
          </label>
          {fotosNovas.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {fotosNovas.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  <button onClick={() => excluirFotoNova(url)}
                    style={{ position: 'absolute', top: 2, right: 2, background: '#7a1111', border: 'none', color: 'white', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, height: 80 }} placeholder="Descrição..." value={novoProduto.descricao} onChange={e => setNovoProduto({ ...novoProduto, descricao: e.target.value })} />
          <div style={tagsBox}>
            <p style={tagsTitle}>Tags do produto</p>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.disponivel} onChange={e => setNovoProduto({ ...novoProduto, disponivel: e.target.checked })} />✅ Disponível no catálogo</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.destaque} onChange={e => setNovoProduto({ ...novoProduto, destaque: e.target.checked })} />☆ Destaque</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.lancamento} onChange={e => setNovoProduto({ ...novoProduto, lancamento: e.target.checked })} />🚀 Lançamento</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.promocao} onChange={e => setNovoProduto({ ...novoProduto, promocao: e.target.checked })} />🏷 Promoção</label>
            <label style={checkLabel}><input type="checkbox" checked={novoProduto.mais_procurado} onChange={e => setNovoProduto({ ...novoProduto, mais_procurado: e.target.checked })} />🔥 Mais Procurado</label>
          </div>
          <button style={btnSalvar} onClick={salvarProduto}>✅ Salvar produto</button>
        </div>
      )}

      {aba === 'lista' && (
        <div style={formContainer}>
          <h2 style={formTitle}>Produtos cadastrados</h2>
          {produtos.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>Nenhum produto ainda.</p>
          ) : (
            produtos.map(p => (
              <div key={p.id} style={produtoCard}>
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.modelo} style={{ width: 65, height: 65, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={semFoto}>📱</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.marca} {p.modelo}</p>
                  <p style={{ color: '#aaa', fontSize: 12 }}>{p.categoria} {p.memoria ? '· ' + p.memoria : ''}</p>
                  <p style={{ fontSize: 11, color: p.disponivel ? '#25D366' : '#ff4444' }}>{p.disponivel ? '● Disponível' : '● Indisponível'}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {p.destaque && <span style={tagStyle}>☆ Destaque</span>}
                    {p.lancamento && <span style={tagStyle}>🚀 Lançamento</span>}
                    {p.promocao && <span style={tagStyle}>🏷 Promoção</span>}
                    {p.mais_procurado && <span style={tagStyle}>🔥 Mais Procurado</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button style={btnEditar} onClick={() => { setEditando(p); carregarFotosEdicao(p.id) }}>✏️</button>
                  <button style={btnExcluir} onClick={() => excluirProduto(p.id)}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {aba === 'hero' && (
        <div style={formContainer}>
          <h2 style={formTitle}>🖼 Fotos do Hero</h2>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#ff6600', color: 'white', padding: '14px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 16, marginBottom: 24, width: '100%', boxSizing: 'border-box' as const }}>
            {uploadandoHero ? '⏳ Enviando...' : '📸 Adicionar foto ao Hero'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) uploadHeroImagem(e.target.files[0]) }} />
          </label>
          {heroImagens.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>Nenhuma foto cadastrada ainda.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {heroImagens.map((img) => (
                <div key={img.id} style={{ background: '#0a0a0a', border: `2px solid ${img.ativo ? '#ff6600' : '#222'}`, borderRadius: 14, overflow: 'hidden' }}>
                  <img src={img.url} alt="hero" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px 8px', display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleHeroImagem(img.id, img.ativo)}
                      style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: img.ativo ? '#1a4a1a' : '#2a2a2a', color: img.ativo ? '#25D366' : '#888' }}>
                      {img.ativo ? '● Ativo' : '○ Inativo'}
                    </button>
                    <button onClick={() => excluirHeroImagem(img.id, img.url)}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ff3333', background: '#7a1111', color: '#fff', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const loginPage: React.CSSProperties = { minHeight: '100vh', background: '#050505', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, overflowX: 'hidden' }
const loginBox: React.CSSProperties = { background: '#0f0f0f', border: '1px solid #222', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }
const logoMarcas: React.CSSProperties = { color: '#ff6600', fontSize: 32, fontWeight: 900, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'center' }
const logoMag: React.CSSProperties = { color: '#ff6600', fontSize: 16, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'block', textAlign: 'center', marginTop: -6, opacity: 0.85 }
const loginSub: React.CSSProperties = { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }
const btnLogin: React.CSSProperties = { background: '#ff6600', color: 'white', border: 'none', borderRadius: 10, padding: '14px', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4 }
const btnVoltar: React.CSSProperties = { background: 'none', color: '#666', border: '1px solid #222', borderRadius: 10, padding: '12px', fontSize: 14, cursor: 'pointer' }
const adminPage: React.CSSProperties = { minHeight: '100vh', background: '#050505', color: 'white', paddingBottom: 40, overflowX: 'hidden', maxWidth: '100vw' }
const adminHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#080808', borderBottom: '1px solid #1a1a1a', position: 'sticky', top: 0, zIndex: 100 }
const abasContainer: React.CSSProperties = { display: 'flex', gap: 0, borderBottom: '1px solid #1a1a1a' }
const abaAtiva: React.CSSProperties = { flex: 1, padding: '14px', background: 'none', color: '#ff6600', border: 'none', borderBottom: '3px solid #ff6600', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const abaInativa: React.CSSProperties = { flex: 1, padding: '14px', background: 'none', color: '#666', border: 'none', borderBottom: '3px solid transparent', fontSize: 14, cursor: 'pointer' }
const formContainer: React.CSSProperties = { padding: '20px 16px', maxWidth: '100%', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }
const formTitle: React.CSSProperties = { color: '#ff6600', fontSize: 20, fontWeight: 800, marginBottom: 20 }
const labelStyle: React.CSSProperties = { color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', maxWidth: '100%', padding: '12px 14px', marginBottom: 14, borderRadius: 10, border: '1px solid #2a2a2a', background: '#0f0f0f', color: 'white', fontSize: 16, outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none' }
const uploadBox: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px', border: '2px dashed #2a2a2a', borderRadius: 12, marginBottom: 14, cursor: 'pointer', background: '#0f0f0f', color: '#aaa', fontSize: 14, width: '100%', boxSizing: 'border-box' }
const btnSalvar: React.CSSProperties = { width: '100%', padding: 16, borderRadius: 12, border: 'none', background: '#ff6600', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 8 }
const btnSecundario: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#ccc', fontSize: 13, cursor: 'pointer' }
const produtoCard: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 12, padding: 12, marginBottom: 12 }
const semFoto: React.CSSProperties = { width: 65, height: 65, background: '#1a1a1a', borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 24, flexShrink: 0 }
const btnEditar: React.CSSProperties = { background: '#0a1a2a', border: '1px solid #1a6aff', color: '#4a9aff', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 16 }
const btnExcluir: React.CSSProperties = { background: '#1a0000', border: '1px solid #ff3333', color: '#ff4444', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 16 }
const tagsBox: React.CSSProperties = { background: '#0a0a0a', border: '1px solid #222', borderRadius: 12, padding: 16, marginBottom: 16 }
const tagsTitle: React.CSSProperties = { color: '#ff6600', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }
const checkLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 15, color: '#ccc', cursor: 'pointer' }
const tagStyle: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#aaa' }