// GET /api/editais — devolve a lista e, se a última busca tiver 15 dias ou mais, dispara uma nova em segundo plano.
import { waitUntil } from '@vercel/functions';
import { ler, gravar } from '../lib/armazem.js';
import { coletar } from '../lib/coletar.js';
import seed from '../lib/seed.js';

const DIA = 864e5;
const INTERVALO = Number(process.env.INTERVALO_DIAS || 15) * DIA;
const TRAVA = 20 * 60e3;      // uma coleta "em andamento" expira depois de 20 min
const ESPERA_FALHA = 6 * 3600e3; // depois de uma falha, espera 6 h antes de tentar de novo

async function rodar(dados, estado) {
  try {
    const novo = await coletar(dados);
    const { uso, ...lista } = novo;
    await gravar('dados.json', { ...lista, coletadoEm: new Date().toISOString(), fonte: 'automatica' });
    await gravar('estado.json', { ultimaColeta: new Date().toISOString(), uso, falhas: 0 });
  } catch (e) {
    console.error('coleta falhou', e);
    await gravar('estado.json', { ...estado, coletandoDesde: null, ultimaFalha: Date.now(), erro: String(e.message || e).slice(0, 500), falhas: (estado.falhas || 0) + 1 });
  }
}

export default async function handler(req, res) {
  let dados = await ler('dados.json');
  if (!dados) { dados = seed; await gravar('dados.json', seed).catch(() => {}); }
  const estado = (await ler('estado.json')) || {};
  const agora = Date.now();
  const forcar = process.env.ADMIN_TOKEN && req.query?.forcar === process.env.ADMIN_TOKEN;
  const vencida = agora - Date.parse(dados.coletadoEm) >= INTERVALO;
  const emAndamento = estado.coletandoDesde && agora - estado.coletandoDesde < TRAVA;
  const falhouHaPouco = estado.ultimaFalha && agora - estado.ultimaFalha < ESPERA_FALHA;
  let coletando = !!emAndamento;

  if ((vencida || forcar) && !emAndamento && (!falhouHaPouco || forcar) && process.env.ANTHROPIC_API_KEY) {
    const novoEstado = { ...estado, coletandoDesde: agora };
    await gravar('estado.json', novoEstado);
    waitUntil(rodar(dados, novoEstado));
    coletando = true;
  }

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({
    dados,
    coletando,
    status: { semChave: !process.env.ANTHROPIC_API_KEY, ultimaColeta: estado.ultimaColeta || null, ultimaFalha: estado.ultimaFalha || null, erro: estado.erro || null, uso: estado.uso || null },
  });
}
