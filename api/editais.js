// GET /api/editais — devolve a lista e, se a última busca tiver 15 dias ou mais, dispara uma nova em segundo plano.
// Se algo estiver mal configurado, responde com o motivo em "status.erro" em vez de quebrar.
import { waitUntil } from '@vercel/functions';
import { ler, gravar } from '../lib/armazem.js';
import { coletar } from '../lib/coletar.js';
import seed from '../lib/seed.js';

const DIA = 864e5;
const pronto = () => !!(process.env.TAVILY_API_KEY && process.env.LLM_API_KEY);
const INTERVALO = Number(process.env.INTERVALO_DIAS || 15) * DIA;
const TRAVA = 20 * 60e3;         // uma coleta "em andamento" expira depois de 20 min
const ESPERA_FALHA = 6 * 3600e3; // depois de uma falha, espera 6 h antes de tentar de novo

function faltando() {
  const f = [];
  if (!process.env.BLOB_READ_WRITE_TOKEN) f.push('BLOB_READ_WRITE_TOKEN (crie o Blob em Storage e conecte ao projeto)');
  if (!process.env.TAVILY_API_KEY) f.push('TAVILY_API_KEY');
  if (!process.env.LLM_API_KEY) f.push('LLM_API_KEY');
  return f;
}

async function rodar(dados, estado) {
  try {
    const { uso, ...lista } = await coletar(dados);
    await gravar('dados.json', { ...lista, coletadoEm: new Date().toISOString(), fonte: 'automatica' });
    await gravar('estado.json', { ultimaColeta: new Date().toISOString(), uso, falhas: 0 });
  } catch (e) {
    console.error('coleta falhou', e);
    try {
      await gravar('estado.json', { ...estado, coletandoDesde: null, ultimaFalha: Date.now(), erro: String(e.message || e).slice(0, 500), falhas: (estado.falhas || 0) + 1 });
    } catch (e2) { console.error('não consegui gravar o estado', e2); }
  }
}

export default async function handler(req, res) {
  const falta = faltando();
  let dados = seed, estado = {}, coletando = false, erro = null;

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const salvo = await ler('dados.json');
      if (salvo) dados = salvo; else await gravar('dados.json', seed);
      estado = (await ler('estado.json')) || {};
    }
    const agora = Date.now();
    const forcar = !!process.env.ADMIN_TOKEN && req.query?.forcar === process.env.ADMIN_TOKEN;
    const vencida = agora - Date.parse(dados.coletadoEm) >= INTERVALO;
    const emAndamento = estado.coletandoDesde && agora - estado.coletandoDesde < TRAVA;
    const falhouHaPouco = estado.ultimaFalha && agora - estado.ultimaFalha < ESPERA_FALHA;
    coletando = !!emAndamento;

    if ((vencida || forcar) && !emAndamento && (!falhouHaPouco || forcar) && falta.length === 0) {
      const novoEstado = { ...estado, coletandoDesde: agora };
      await gravar('estado.json', novoEstado);
      waitUntil(rodar(dados, novoEstado));
      coletando = true;
    }
    if (req.query?.forcar && !forcar) erro = 'Senha de teste (ADMIN_TOKEN) não confere.';
  } catch (e) {
    console.error('api/editais', e);
    erro = String(e.message || e).slice(0, 300);
  }

  res.setHeader('Cache-Control', req.query?.forcar ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({
    dados,
    coletando,
    status: {
      configuracaoFaltando: falta,
      semChave: !pronto(),
      ultimaColeta: estado.ultimaColeta || null,
      ultimaFalha: estado.ultimaFalha || null,
      erro: erro || estado.erro || null,
      uso: estado.uso || null,
    },
  });
}
