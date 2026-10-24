import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

// ─── Quem pode entrar ───────────────────────────────
// Usuário digitado na tela  →  e-mail cadastrado no Supabase (Authentication > Users)
const USUARIOS: Record<string, string> = {
  admin: 'admin@marcosmagazine.com.br',
  negociacao: 'negociacao@marcosmagazine.com.br',
}
// Quem entra no Admin (o resto só entra na Negociação)
const EMAILS_ADMIN = ['admin@marcosmagazine.com.br']

function usuarioParaEmail(digitado: string) {
  const limpo = digitado.trim().toLowerCase()
  if (limpo.includes('@') && limpo.includes('.')) return limpo // digitou o e-mail completo
  const chave = limpo.replace(/^@/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')
  return USUARIOS[chave] || ''
}

type Props = { papel: 'admin' | 'negociacao'; children: ReactNode }

export default function Protegido({ papel, children }: Props) {
  const navigate = useNavigate()
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  // Na Negociação, o "Adicionar à Tela de Início" cria um ícone próprio que abre direto aqui
  useEffect(() => {
    if (papel !== 'negociacao') return
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const titulo = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null
    const antes = { href: link?.getAttribute('href'), titulo: titulo?.getAttribute('content') }
    link?.setAttribute('href', '/manifest-negociacao.webmanifest')
    titulo?.setAttribute('content', 'Negociação')
    return () => {
      if (link && antes.href) link.setAttribute('href', antes.href)
      if (titulo && antes.titulo) titulo.setAttribute('content', antes.titulo)
    }
  }, [papel])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSessao(data.session); setCarregando(false) })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  async function entrar() {
    setErro('')
    const email = usuarioParaEmail(usuario)
    if (!email) { setErro('Usuário não encontrado'); return }
    if (!senha) { setErro('Digite a senha'); return }
    setEntrando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEntrando(false)
    if (error) { setErro('Usuário ou senha incorretos!'); return }
    setSenha('')
  }

  async function sair() {
    await supabase.auth.signOut()
    setUsuario(''); setSenha('')
  }

  if (carregando) {
    return <div style={pagina}><p style={{ color: '#666' }}>Carregando...</p></div>
  }

  const email = sessao?.user?.email?.toLowerCase() || ''
  const ehAdmin = EMAILS_ADMIN.includes(email)
  const temAcesso = !!sessao && (papel === 'negociacao' || ehAdmin)

  if (sessao && !temAcesso) {
    return (
      <div style={pagina}>
        <div style={caixa}>
          <Logo />
          <p style={{ color: '#ff4444', textAlign: 'center', fontSize: 15 }}>🔒 Esse usuário não tem acesso ao Admin.</p>
          <button style={btnPrincipal} onClick={() => navigate('/negociacao')}>Ir para a Negociação</button>
          <button style={btnSecundario} onClick={sair}>Entrar com outro usuário</button>
        </div>
      </div>
    )
  }

  if (!sessao) {
    return (
      <div style={pagina}>
        <div style={caixa}>
          <Logo />
          <p style={subtitulo}>{papel === 'admin' ? 'Painel Administrativo' : 'Negociação'}</p>
          <input style={campo} placeholder="Usuário" autoCapitalize="none" autoCorrect="off" value={usuario}
            onChange={e => setUsuario(e.target.value)} />
          <input style={campo} placeholder="Senha" type="password" value={senha}
            onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} />
          {erro && <p style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', margin: 0 }}>{erro}</p>}
          <button style={{ ...btnPrincipal, opacity: entrando ? 0.6 : 1 }} disabled={entrando} onClick={entrar}>
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
          <button style={btnSecundario} onClick={() => navigate('/')}>← Voltar ao catálogo</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      {papel === 'negociacao' && <button onClick={sair} style={btnSair} title="Sair">🔒 Sair</button>}
    </>
  )
}

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 4 }}>
      <span style={{ color: '#ff6600', fontSize: 32, fontWeight: 900, fontFamily: 'Nunito, sans-serif', display: 'block' }}>Marcos</span>
      <span style={{ color: '#ff6600', fontSize: 16, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'block', marginTop: -6, opacity: 0.85 }}>Magazine</span>
    </div>
  )
}

const pagina: React.CSSProperties = { minHeight: '100vh', background: '#050505', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, boxSizing: 'border-box' }
const caixa: React.CSSProperties = { background: '#0f0f0f', border: '1px solid #222', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }
const subtitulo: React.CSSProperties = { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }
const campo: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0f0f0f', color: 'white', fontSize: 16, outline: 'none', boxSizing: 'border-box' }
const btnPrincipal: React.CSSProperties = { background: '#ff6600', color: 'white', border: 'none', borderRadius: 10, padding: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4 }
const btnSecundario: React.CSSProperties = { background: 'none', color: '#666', border: '1px solid #222', borderRadius: 10, padding: 12, fontSize: 14, cursor: 'pointer' }
const btnSair: React.CSSProperties = { position: 'fixed', left: 10, bottom: 10, zIndex: 9999, background: 'rgba(20,20,20,0.85)', color: '#888', border: '1px solid #2a2a2a', borderRadius: 20, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }
