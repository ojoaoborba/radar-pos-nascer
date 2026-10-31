// GET /api/onde — estado aproximado de quem acessa, pela conexão (cabeçalho da Vercel). Não guarda nada.
export default function handler(req, res) {
  const pais = req.headers['x-vercel-ip-country'];
  const uf = req.headers['x-vercel-ip-country-region'];
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ uf: pais === 'BR' && uf ? String(uf).toUpperCase() : null });
}
