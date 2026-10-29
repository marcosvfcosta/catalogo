import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

// Notificações push da Negociação (aparecem com a tela apagada)
// Ações:
//  - chave  → devolve a chave pública (o aparelho usa para se inscrever)
//  - avisar → chamada pela tela "Avaliar meu usado" logo depois de enviar
//  - teste  → manda uma notificação de teste (só equipe logada)
//  - retornos → chamada de hora em hora pelo agendador (pg_cron). Avisa enquanto tiver cliente para chamar hoje

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const EQUIPE = ['admin@marcosmagazine.com.br', 'negociacao@marcosmagazine.com.br']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function ehEquipe(req: Request) {
  const token = req.headers.get('Authorization') || ''
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: token, apikey: anon } })
  if (!r.ok) return false
  const u = await r.json()
  return EQUIPE.includes(String(u?.email || '').toLowerCase())
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const PUB = Deno.env.get('VAPID_PUBLIC_KEY')
    const PRIV = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!PUB || !PRIV) return json({ error: 'Faltam as chaves VAPID nos Secrets do Supabase' }, 500)

    const { acao, id } = await req.json().catch(() => ({}))
    if (acao === 'chave') return json({ chave: PUB })

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    webpush.setVapidDetails('mailto:admin@marcosmagazine.com.br', PUB, PRIV)

    let mensagem: { titulo: string; corpo: string; url: string; tag: string }

    if (acao === 'teste') {
      if (!(await ehEquipe(req))) return json({ error: 'Faça login na Negociação' }, 401)
      mensagem = { titulo: '🔔 Teste da Marcos Magazine', corpo: 'Pronto! Os avisos estão funcionando neste aparelho.', url: '/negociacao?aba=entradas', tag: 'teste' }
    } else if (acao === 'avisar' && id) {
      // Só avisa uma vez e só para avaliação recém-criada (evita abuso)
      const { data: e } = await db.from('entradas').select('*').eq('id', id).maybeSingle()
      if (!e) return json({ ok: false, motivo: 'não encontrada' })
      if (e.notificado) return json({ ok: true, motivo: 'já avisada' })
      if (Date.now() - new Date(e.created_at).getTime() > 10 * 60 * 1000) return json({ ok: false, motivo: 'antiga' })
      await db.from('entradas').update({ notificado: true }).eq('id', id)
      const fotos = Array.isArray(e.fotos) && e.fotos.length ? ` · 📷 ${e.fotos.length} fotos` : ''
      mensagem = {
        titulo: '📲 Nova avaliação de usado',
        corpo: `${e.nome}: ${e.modelo} ${e.armazenamento}${e.interesse ? ` → quer ${e.interesse}` : ''}${fotos}`,
        url: '/negociacao?aba=entradas',
        tag: `entrada-${id}`,
      }
    } else if (acao === 'retornos') {
      // Só no horário da loja (Brasília): seg a sex 9h–18h, sábado 9h–12h
      const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      const dia = agora.getDay(), hora = agora.getHours()
      const aberto = (dia >= 1 && dia <= 5 && hora >= 9 && hora <= 18) || (dia === 6 && hora >= 9 && hora <= 12)
      if (!aberto) return json({ ok: true, motivo: 'fora do horário' })
      const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      // 1) Retornos (capinhas/acessórios) e 2) clientes da negociação que pediram para ser chamados
      const { data: r1 } = await db.from('catalogo_retornos').select('nome, modelo')
        .eq('ativo', true).eq('aceita', true).lte('proximo_contato', hoje).order('proximo_contato')
      const { data: r2, error: e2 } = await db.from('negociacoes').select('nome, modelo')
        .not('retorno_em', 'is', null).lte('retorno_em', hoje).order('retorno_em')
      const retornos = r1 || []
      const clientes = e2 ? [] : (r2 || [])
      const lista = [...clientes, ...retornos]
      if (lista.length === 0) return json({ ok: true, motivo: 'ninguém hoje' })
      const nomes = lista.slice(0, 3).map(r => `${String(r.nome).split(' ')[0]} (${r.modelo})`).join(', ')
      mensagem = {
        titulo: `🔔 ${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'} para chamar hoje`,
        corpo: `${nomes}${lista.length > 3 ? ` e mais ${lista.length - 3}` : ''}. ${clientes.length ? 'Toque em "Concluí o contato" depois de falar.' : 'Toque em "Mandei" depois de enviar.'}`,
        url: clientes.length ? '/negociacao?aba=clientes' : '/negociacao?aba=retornos',
        tag: 'retornos',
      }
    } else {
      return json({ error: 'Ação inválida' }, 400)
    }

    const { data: inscricoes } = await db.from('push_inscricoes').select('*')
    let enviados = 0
    for (const s of inscricoes || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(mensagem),
          { TTL: 3600, urgency: 'high' },
        )
        enviados++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await db.from('push_inscricoes').delete().eq('id', s.id) // aparelho desativou
        else console.error('Falha ao enviar push:', err)
      }
    }
    return json({ ok: true, enviados })
  } catch (e) {
    console.error('Erro no push:', e)
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
