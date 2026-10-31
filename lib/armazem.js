// Guarda e lê arquivos JSON no Vercel Blob.
import { put, list } from '@vercel/blob';

const PASTA = 'radar/';

export async function ler(nome) {
  try {
    const { blobs } = await list({ prefix: PASTA + nome, limit: 5 });
    const blob = blobs.find((b) => b.pathname === PASTA + nome);
    if (!blob) return null;
    const r = await fetch(blob.url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.error('ler', nome, e);
    return null;
  }
}

export async function gravar(nome, obj) {
  await put(PASTA + nome, JSON.stringify(obj), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}
