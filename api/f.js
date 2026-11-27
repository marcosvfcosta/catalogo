// Link curto da foto da proposta (Negociação). Ex: https://seu-site/api/f?i=abc123
// O WhatsApp lê a página e mostra a foto na conversa; quem toca abre a foto.
export default function handler(req, res) {
  const i = String(req.query.i || '').replace(/[^a-z0-9]/gi, '').slice(0, 20)
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://bahcoajavayvdfavdhpg.supabase.co'
  const foto = `${base}/storage/v1/object/public/fotos/propostas/${i}.jpg`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8">
<title>Marcos Magazine</title>
<meta property="og:title" content="Marcos Magazine">
<meta property="og:description" content="Proposta">
<meta property="og:image" content="${foto}">
<meta property="og:image:width" content="1080"><meta property="og:image:height" content="1080">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${foto}">
</head><body><img src="${foto}" style="max-width:100%"></body></html>`)
}
