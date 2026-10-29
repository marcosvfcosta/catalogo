import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Gemini (Nano Banana). Só o admin logado pode usar.
//  - banner do carrossel (padrão)
//  - acao: 'tirar_fundo' → tira o fundo de uma foto de produto/capinha e deixa em fundo branco
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAILS_ADMIN = ['admin@marcosmagazine.com.br']
const MODELO = 'gemini-nano-banana-2.1'          // modelo atual de imagem do Google
const MODELO_RESERVA = 'gemini-2.5-flash-image'  // usado se o principal falhar

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function usuarioEhAdmin(req: Request) {
  const token = req.headers.get('Authorization') || ''
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!token || !url || !anon) return false
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: token, apikey: anon } })
  if (!r.ok) return false
  const user = await r.json()
  return EMAILS_ADMIN.includes(String(user?.email || '').toLowerCase())
}

function paraBase64(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// Procura a imagem em qualquer lugar da resposta (o formato do Google muda entre versões)
function acharImagem(o: unknown): { data: string; mime: string } | null {
  if (!o || typeof o !== 'object') return null
  const x = o as Record<string, unknown>
  const inline = (x.inlineData || x.inline_data) as Record<string, unknown> | undefined
  if (inline && typeof inline.data === 'string') return { data: inline.data, mime: String(inline.mimeType || inline.mime_type || 'image/png') }
  if (x.type === 'image' && typeof x.data === 'string' && x.data.length > 1000) return { data: x.data, mime: String(x.mime_type || x.mimeType || 'image/png') }
  for (const v of Object.values(x)) {
    const achou = Array.isArray(v) ? v.map(acharImagem).find(Boolean) : acharImagem(v)
    if (achou) return achou
  }
  return null
}

const PROPORCOES = ['4:5', '1:1', '16:9', '9:16', '3:4']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (!(await usuarioEhAdmin(req))) return json({ error: 'Faça login no Admin para usar a IA' }, 401)
    const CHAVE = Deno.env.get('GEMINI_API_KEY')
    if (!CHAVE) return json({ error: 'Falta a GEMINI_API_KEY nos Secrets do Supabase' }, 500)

    const { ideia, produto, proporcao, acao, foto_url } = await req.json()
    const tirarFundo = acao === 'tirar_fundo'
    if (tirarFundo && !foto_url) return json({ error: 'Falta a foto' }, 400)
    if (!tirarFundo && (!ideia || String(ideia).trim().length < 3)) return json({ error: 'Escreva a ideia do banner' }, 400)
    const formato = PROPORCOES.includes(proporcao) ? proporcao : (tirarFundo ? '1:1' : '4:5')

    // Foto: no banner é opcional (aparelho de verdade); no "tirar fundo" é a própria foto a editar
    let foto: { data: string; mime: string } | null = null
    const urlFoto = tirarFundo ? foto_url : produto?.foto_url
    if (urlFoto) {
      try {
        const r = await fetch(urlFoto)
        if (r.ok) foto = { data: paraBase64(new Uint8Array(await r.arrayBuffer())), mime: r.headers.get('content-type') || 'image/png' }
      } catch { /* segue sem foto */ }
    }
    if (tirarFundo && !foto) return json({ error: 'Não consegui abrir a foto' }, 400)

    const prompt = tirarFundo
      ? `Edite esta foto de produto para o catálogo de uma loja online (proporção ${formato}).
Remova TODO o fundo (mesa, tecido, parede, mãos, sombras e qualquer objeto) e deixe SOMENTE o produto principal.
O produto deve ficar IDÊNTICO ao da foto: mesmo formato, cor, textura, estampa, furos da câmera, botões, anel/suporte, logos e detalhes. Não redesenhe, não "melhore", não acrescente e não remova nada do produto.
Deixe o produto de frente, reto e centralizado, ocupando cerca de 85% da altura da imagem, sobre fundo BRANCO PURO (#FFFFFF) liso, com luz de estúdio suave e uniforme.
Sem textos, sem marca d'água, sem reflexo no chão e sem sombra forte.`
      : `Crie um banner publicitário (proporção ${formato}) para o carrossel do catálogo online da loja de celulares "Marcos Magazine", de Bom Jesus de Goiás.
Estilo: moderno, premium e limpo, como lojas Apple/iPlace. Fundo claro (branco ou cinza bem claro) com detalhes na cor laranja #FF6600. Boa iluminação, sombra suave, muito espaço livre.
IDEIA DO DONO DA LOJA: ${String(ideia).trim()}
${produto?.nome ? `PRODUTO EM DESTAQUE: ${produto.nome}.` : ''}
${foto ? 'Use EXATAMENTE o aparelho da foto enviada como destaque, sem mudar o design, as câmeras nem a cor dele.' : ''}
Textos: em português do Brasil, POUCAS palavras (no máximo um título curto e uma frase), letras grandes, legíveis e SEM erros de ortografia.
Não coloque preços nem valores. Pode incluir discretamente o nome "Marcos Magazine" em laranja. Não invente logotipos de outras marcas.`

    // 1ª tentativa: API nova (Interactions)
    let imagem: { data: string; mime: string } | null = null
    let erroTexto = ''
    try {
      const input: unknown[] = [{ type: 'text', text: prompt }]
      if (foto) input.push({ type: 'image', mime_type: foto.mime, data: foto.data })
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CHAVE },
        body: JSON.stringify({
          model: MODELO, input,
          response_format: { type: 'image', mime_type: tirarFundo ? 'image/png' : 'image/jpeg', aspect_ratio: formato, image_size: tirarFundo ? '1K' : '2K' },
        }),
      })
      const data = await r.json()
      if (r.ok) imagem = acharImagem(data)
      else erroTexto = data?.error?.message || `Erro ${r.status}`
    } catch (e) { erroTexto = String(e) }

    // 2ª tentativa: API clássica (generateContent)
    if (!imagem) {
      console.log('Interactions falhou, tentando generateContent:', erroTexto)
      const parts: unknown[] = [{ text: prompt }]
      if (foto) parts.push({ inline_data: { mime_type: foto.mime, data: foto.data } })
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_RESERVA}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CHAVE },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: formato } } }),
      })
      const data = await r.json()
      if (r.ok) imagem = acharImagem(data)
      else erroTexto = data?.error?.message || `Erro ${r.status}`
    }

    if (!imagem) return json({ error: `O Gemini não devolveu imagem. ${erroTexto}`.trim() }, 502)
    return json({ imagem: imagem.data, mime: imagem.mime })
  } catch (e) {
    console.error('Erro no Gemini:', e)
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
