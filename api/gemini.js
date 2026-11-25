const DEFAULT_GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-4-hydrogen',
  'gemini-flash-latest'
];

/**
 * Vercel serverless proxy for Gemini generateContent so the API key stays
 * exclusively in Vercel Environment Variables (GEMINI_API_KEY).
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel Environment Variables.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Body JSON tidak valid.' });
    }
  }

  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) {
    return res.status(400).json({ error: 'Prompt wajib diisi.' });
  }

  const requestedModels = Array.isArray(body.models) && body.models.length > 0
    ? body.models.filter(m => typeof m === 'string' && /^[a-z0-9._-]+$/i.test(m))
    : DEFAULT_GEMINI_MODELS;

  const modelsToTry = requestedModels.length > 0 ? requestedModels : DEFAULT_GEMINI_MODELS;
  const generationConfig = body.generationConfig && typeof body.generationConfig === 'object'
    ? body.generationConfig
    : { temperature: 0.6, maxOutputTokens: 600 };

  let lastStatus = 502;
  let lastError = 'Semua model Gemini gagal merespons.';

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig
        })
      });

      if (upstream.status === 200) {
        const json = await upstream.json();
        const parts = json?.candidates?.[0]?.content?.parts || [];
        const text = parts.filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
        if (text) {
          return res.status(200).json({ text, model });
        }
      }

      lastStatus = upstream.status;
      lastError = await upstream.text();
    } catch (err) {
      lastError = err.message || 'Network error';
    }
  }

  return res.status(lastStatus >= 400 ? lastStatus : 502).json({
    error: 'Seluruh model Gemini sedang sibuk atau gagal diakses.',
    detail: lastError.slice(0, 300)
  });
};
