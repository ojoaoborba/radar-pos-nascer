// Guarda e lê arquivos JSON no Vercel Blob.
// Funciona com os dois jeitos de conectar o Blob: o novo (BLOB_STORE_ID, autenticação automática da Vercel)
// e o antigo (BLOB_READ_WRITE_TOKEN). Funciona com Blob público ou privado.
import { put, get } from '@vercel/blob';

const PASTA = 'radar/';
let acesso = process.env.BLOB_ACCESS === 'private' ? 'private' : 'public';
const outro = (a) => (a === 'public' ? 'private' : 'public');
const erroDeAcesso = (e) => /access|private|public/i.test(String(e && (e.name + ' ' + e.message)));

export const blobConfigurado = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

export async function ler(nome) {
  for (const a of [acesso, outro(acesso)]) {
    try {
      const r = await get(PASTA + nome, { access: a, useCache: false });
      if (!r) return null;
      acesso = a;
      return JSON.parse(await new Response(r.stream).text());
    } catch (e) {
      if (erroDeAcesso(e)) continue;
      console.error('ler', nome, e);
      return null;
    }
  }
  return null;
}

export async function gravar(nome, obj) {
  const opcoes = (a) => ({ access: a, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
  try {
    await put(PASTA + nome, JSON.stringify(obj), opcoes(acesso));
  } catch (e) {
    if (!erroDeAcesso(e)) throw e;
    acesso = outro(acesso);
    await put(PASTA + nome, JSON.stringify(obj), opcoes(acesso));
  }
}
