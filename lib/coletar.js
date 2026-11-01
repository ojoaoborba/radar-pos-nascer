// Coleta gratuita de editais:
// 1) busca na web pela API do Tavily (plano grátis: 1.000 créditos/mês, cada busca usa 1);
// 2) uma IA open source (padrão: gpt-oss-120b no Groq, plano grátis) lê os resultados e extrai os editais;
// 3) o código junta com a lista atual, tira os vencidos e os repetidos.
// A IA é chamada por qualquer API compatível com OpenAI (Groq, OpenRouter, Gemini etc.), configurável por variáveis.

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','BR'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function consultas(hoje) {
  const [ano, mes] = hoje.split('-').map(Number);
  const m = MESES[mes - 1];
  return [
    `edital pré-incubação ideias inovadoras inscrições abertas ${ano}`,
    `programa Centelha edital inscrições abertas ${ano}`,
    `edital startups inscrições abertas ${m} ${ano}`,
    `Sebrae edital startups inscrições abertas ${ano}`,
    `FAPESC chamada pública startups inovação inscrições abertas`,
    `fundação de amparo à pesquisa edital startups subvenção inscrições abertas ${ano}`,
    `programa de aceleração gratuito startups inscrições abertas ${m} ${ano}`,
    `hackathon inovação inscrições abertas ${m} ${ano}`,
    `incubadora edital seleção startups ideias ${ano}`,
    `prêmio inovação startups inscrições abertas ${ano}`,
    `BNDES Garagem InovAtiva Catalisa inscrições abertas ${ano}`,
    `Programa Nascer pré-incubação Santa Catarina ${ano}`,
  ];
}

async function buscar(q) {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.TAVILY_API_KEY },
    body: JSON.stringify({ query: q, search_depth: 'basic', max_results: 6, time_range: 'month', country: 'brazil' }),
  });
  if (!r.ok) throw new Error('Tavily ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return (j.results || []).map((x) => ({ titulo: String(x.title || '').slice(0, 160), url: x.url, trecho: String(x.content || '').replace(/\s+/g, ' ').slice(0, 450) }));
}

async function ia(mensagem) {
  const base = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'openai/gpt-oss-120b';
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.LLM_API_KEY },
      body: JSON.stringify({ model, temperature: 0.1, max_tokens: 2500, messages: [{ role: 'user', content: mensagem }] }),
    });
    if (r.status === 429) { await espera(25000); continue; } // limite por minuto do plano grátis
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('IA ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
    return { texto: j.choices?.[0]?.message?.content || '', tokens: j.usage?.total_tokens || 0, model };
  }
  throw new Error('IA: limite de uso atingido repetidamente');
}

function instrucao(hoje, resultados) {
  return `Hoje é ${hoje}. Abaixo estão resultados de busca na web (título, link e trecho). Extraia SOMENTE editais, chamadas ou programas brasileiros para ideias inovadoras ou startups em estágio inicial: pré-incubação, incubação, pré-aceleração, aceleração, subvenção, bolsas para empreendedores, prêmios e hackathons de inovação.
Ignore: bolsas de pós-graduação, editais só para pesquisadores, eventos científicos, licitações, cultura, notícias de resultado.

Regras:
- "aberto": só se o trecho mostrar que as inscrições estão abertas e trouxer o prazo final. Prazo final em formato AAAA-MM-DD, igual ou depois de hoje.
- "previsto": só se o trecho disser que as inscrições vão abrir numa data futura. "ate" = data aproximada de fim das inscrições, AAAA-MM-DD.
- Não invente datas nem dados. Se o trecho não traz a informação, deixe o campo vazio ou não inclua o item.
- "uf": sigla do estado onde vale, ou "BR" se for nacional.
- "cnpj": true se exige empresa aberta para se inscrever.
- "fit": "alta" se parece com pré-incubação de ideias (como o Programa Nascer), senão "media".
- Use o link do resultado em "url". Textos em português, curtos.

Responda só com JSON, sem comentários:
{"itens":[{"tipo":"aberto|previsto","nome":"","org":"","prazo":"AAAA-MM-DD ou vazio","ate":"AAAA-MM-DD ou vazio","quando":"ex.: Mar a mai/2027 (estimado)","prazoTexto":"","desc":"1 frase","quem":"","oferece":"","cnpj":false,"uf":"SC","fit":"alta","url":"https://..."}]}

Resultados:
${resultados.map((x, i) => `[${i + 1}] ${x.titulo}\n${x.url}\n${x.trecho}`).join('\n\n')}`;
}

function lerJson(texto) {
  const ini = texto.indexOf('{'), fim = texto.lastIndexOf('}');
  if (ini < 0 || fim < ini) return { itens: [] };
  try { return JSON.parse(texto.slice(ini, fim + 1)); } catch { return { itens: [] }; }
}

const txt = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const okUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const data = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
const chave = (i) => (i.url || '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase() + '|' + txt(i.nome).toLowerCase().slice(0, 40);

export function normalizarAberto(i) {
  return { nome: txt(i.nome, 160), org: txt(i.org, 160), prazo: data(i.prazo), prazoTexto: txt(i.prazoTexto, 120) || ('Até ' + data(i.prazo).split('-').reverse().join('/')),
    desc: txt(i.desc, 500), quem: txt(i.quem, 240) || 'Consulte o edital', oferece: txt(i.oferece, 240) || 'Consulte o edital',
    cnpj: !!i.cnpj, uf: UFS.includes(i.uf) ? i.uf : 'BR', fit: i.fit === 'alta' ? 'alta' : 'media', url: i.url };
}
export function normalizarPrevisto(i) {
  return { quando: txt(i.quando, 60) || 'Data a confirmar', ate: data(i.ate), nome: txt(i.nome, 160), desc: txt(i.desc, 500), cnpj: !!i.cnpj, uf: UFS.includes(i.uf) ? i.uf : 'BR', url: i.url };
}

// Junta a lista atual com os itens novos, tira vencidos e repetidos.
export function juntar(atual, novos, hoje) {
  const abertos = new Map(), previstos = new Map();
  for (const i of atual.abertos || []) if (data(i.prazo) >= hoje) abertos.set(chave(i), i);
  for (const i of novos) {
    if (!okUrl(i.url) || !txt(i.nome)) continue;
    if (i.tipo === 'aberto' && data(i.prazo) && i.prazo >= hoje) {
      const nome = txt(i.nome).toLowerCase().slice(0, 25);
      for (const [k, a] of abertos) if (txt(a.nome).toLowerCase().slice(0, 25) === nome) abertos.delete(k); // versão mais nova substitui
      abertos.set(chave(i), normalizarAberto(i));
    }
    if (i.tipo === 'previsto' && data(i.ate) && i.ate >= hoje) previstos.set(chave(i), normalizarPrevisto(i));
  }
  const nomesAbertos = [...abertos.values()].map((i) => txt(i.nome).toLowerCase().slice(0, 25));
  for (const i of atual.previstos || []) {
    if (i.ate && i.ate < hoje) continue; // estimativa já passou
    if (nomesAbertos.some((n) => n && txt(i.nome).toLowerCase().includes(n))) continue; // já abriu
    const nome = txt(i.nome).toLowerCase().slice(0, 25);
    if (![...previstos.values()].some((p) => txt(p.nome).toLowerCase().slice(0, 25) === nome)) previstos.set(chave(i), i);
  }
  const lista = {
    abertos: [...abertos.values()].sort((a, b) => (a.prazo < b.prazo ? -1 : 1)).slice(0, 60),
    previstos: [...previstos.values()].slice(0, 25),
  };
  if (lista.abertos.length + lista.previstos.length === 0) throw new Error('Coleta voltou vazia');
  return lista;
}

export async function coletar(atual) {
  if (!process.env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY não configurada');
  if (!process.env.LLM_API_KEY) throw new Error('LLM_API_KEY não configurada');
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const uso = { buscas: 0, chamadasIA: 0, tokensIA: 0, modelo: '' };

  // 1) buscas
  const conhecidos = new Set((atual.abertos || []).map((i) => i.url));
  const vistos = new Set();
  const resultados = [];
  for (const q of consultas(hoje)) {
    try {
      const rs = await buscar(q);
      uso.buscas++;
      for (const x of rs) if (okUrl(x.url) && !vistos.has(x.url) && !conhecidos.has(x.url)) { vistos.add(x.url); resultados.push(x); }
    } catch (e) { console.error('busca falhou', q, e.message); }
  }
  if (uso.buscas === 0) throw new Error('Nenhuma busca funcionou (verifique TAVILY_API_KEY)');

  // 2) extração em lotes pequenos, para caber no limite por minuto do plano grátis
  const novos = [];
  const LOTE = Number(process.env.LOTE || 15);
  const inicio = Date.now();
  for (let i = 0; i < resultados.length; i += LOTE) {
    if (Date.now() - inicio > 200000) break; // não passar do tempo máximo da função
    if (i > 0) await espera(Number(process.env.PAUSA_MS || 25000));
    const r = await ia(instrucao(hoje, resultados.slice(i, i + LOTE)));
    uso.chamadasIA++; uso.tokensIA += r.tokens; uso.modelo = r.model;
    novos.push(...(lerJson(r.texto).itens || []));
  }

  // 3) junta com a lista atual
  return { ...juntar(atual, novos, hoje), uso };
}
