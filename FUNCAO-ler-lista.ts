import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODELO = 'claude-sonnet-5-5'

const SISTEMA = `Você recebe listas de preços de fornecedores de celulares copiadas do WhatsApp (com emojis, asteriscos, avisos e separadores).
Extraia SOMENTE os aparelhos à venda e devolva APENAS um JSON válido, sem texto antes ou depois:

{ "itens": [
  { "marca": "Xiaomi", "modelo": "Redmi 15C", "memoria": "256GB", "ram": "8GB", "rede": "4G", "cores": ["Preto", "Azul"], "custo": 965.00 }
] }

REGRAS:
- "marca": fabricante. Redmi, Poco e "Note" (sem marca) são da marca "Xiaomi". Realme é "Realme". iPhone é "Apple". Galaxy é "Samsung". Moto é "Motorola".
- "modelo": nome comercial SEM memória, SEM RAM e SEM 4G/5G. Corrija a escrita: "Pró" -> "Pro", "Pro +" -> "Pro+". Se for Xiaomi e vier só "Note 15 Pro", escreva "Redmi Note 15 Pro". Mantenha o prefixo da linha (Redmi, Poco, Realme, iPhone, Galaxy...).
- "memoria": armazenamento no formato "64GB", "128GB", "256GB", "512GB", "1TB" ou "2TB".
- "ram": só o número com GB, ex: "4GB", "8GB". Se não tiver, use null.
- "rede": "4G" ou "5G" se estiver escrito na linha do aparelho. Se não tiver, use null.
- "cores": lista das cores do aparelho, sem repetir, com a primeira letra maiúscula, em português ("Silver" -> "Prata", "Lilas" -> "Lilás", "Gold" -> "Dourado", "Black" -> "Preto", "Blue" -> "Azul", "Green" -> "Verde", "White" -> "Branco").
- "custo": número em reais. Atenção ao formato brasileiro: "R$:1.150.00" = 1150, "R$:745.00" = 745, "R$ 1.234,56" = 1234.56.
- Cada combinação diferente de modelo + memória + RAM + rede é um item separado.
- Se o MESMO aparelho tiver preços diferentes por cor (ex: "Laranja R$ 8.000 / Branco R$ 8.200"), crie um item para cada preço, cada um só com as cores daquele preço.
- Ignore títulos, avisos ("atacado", "garantia"), separadores e linhas sem preço.
- NUNCA invente aparelhos ou preços que não estão na lista.`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extrairJson(texto: string) {
  const limpo = texto.replace(/```json|```/g, '')
  const inicio = limpo.indexOf('{')
  const fim = limpo.lastIndexOf('}')
  if (inicio === -1 || fim <= inicio) throw new Error('A IA não devolveu uma lista válida')
  return JSON.parse(limpo.slice(inicio, fim + 1))
}

// Só quem está logado como admin pode usar (evita gastarem seu crédito da IA)
const EMAILS_ADMIN = ['admin@marcosmagazine.com.br']

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!(await usuarioEhAdmin(req))) return json({ error: 'Faça login no Admin para usar a lista' }, 401)

    const { lista } = await req.json()
    if (!lista || String(lista).trim().length < 10) return json({ error: 'Cole a lista do fornecedor' }, 400)

    const CLAUDE_KEY = Deno.env.get('CLAUDE_API_KEY')
    if (!CLAUDE_KEY) return json({ error: 'CLAUDE_API_KEY não configurada no Supabase' }, 500)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 16000,
        system: SISTEMA,
        messages: [{ role: 'user', content: String(lista).slice(0, 60000) }],
      }),
    })

    const data = await response.json()
    if (!response.ok) return json({ error: data?.error?.message || 'Erro na API do Claude' }, 502)

    const texto = ((data.content || []) as { type: string; text?: string }[])
      .filter(b => b.type === 'text').map(b => b.text || '').join('')

    const resultado = extrairJson(texto)
    if (!Array.isArray(resultado.itens)) return json({ error: 'Lista não reconhecida' }, 500)
    return json(resultado)
  } catch (e) {
    console.error('Erro ao ler lista:', e)
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
