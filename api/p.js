// Link do produto com prévia (foto + nome) para WhatsApp, Instagram etc.
// Ex: https://seu-site/api/p?id=ID_DO_PRODUTO&cor=Preto
// O WhatsApp lê as informações desta página e monta a prévia com a foto.
// Quem toca no link é levado direto para o produto no catálogo.

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export default async function handler(req, res) {
  const id = String(req.query.id || '').replace(/[^a-zA-Z0-9-]/g, '')
  const cor = String(req.query.cor || '').slice(0, 40)
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const base = `https://${host}`
  const destino = `${base}/?produto=${encodeURIComponent(id)}${cor ? `&cor=${encodeURIComponent(cor)}` : ''}`

  let p = null
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const chave = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    if (url && chave && id) {
      const r = await fetch(`${url}/rest/v1/produtos_catalogo?id=eq.${id}&select=marca,modelo,memoria,condicao,descricao,foto_url`, {
        headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      })
      const lista = await r.json()
      p = Array.isArray(lista) ? lista[0] : null
    }
  } catch { /* segue sem dados */ }

  const nome = p ? [p.marca === 'Apple' ? '' : p.marca, p.modelo, p.memoria].filter(Boolean).join(' ') : 'Marcos Magazine'
  const titulo = p ? `${nome}${cor ? ` · ${cor}` : ''} | Marcos Magazine` : 'Marcos Magazine · Catálogo'
  const descricao = p
    ? (p.descricao || `${[p.condicao, p.memoria].filter(Boolean).join(' · ')} · Parcele em até 18x e use seu usado como entrada.`).slice(0, 180)
    : 'Celulares e acessórios em Bom Jesus de Goiás. Parcele em até 18x.'
  const imagem = p?.foto_url || `${base}/icone-512.png`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
  res.status(200).send(`<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="Marcos Magazine" />
<meta property="og:title" content="${esc(titulo)}" />
<meta property="og:description" content="${esc(descricao)}" />
<meta property="og:image" content="${esc(imagem)}" />
<meta property="og:image:alt" content="${esc(nome)}" />
<meta property="og:url" content="${esc(base + req.url)}" />
<meta property="og:locale" content="pt_BR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(titulo)}" />
<meta name="twitter:image" content="${esc(imagem)}" />
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#555}</style>
</head><body>
<p>Abrindo ${esc(nome)}… <a href="${esc(destino)}">toque aqui</a></p>
<script>location.replace(${JSON.stringify(destino)})</script>
</body></html>`)
}
