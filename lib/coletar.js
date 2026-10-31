// Coleta de editais: pede ao Claude (API da Anthropic, com busca na web) a lista atualizada.
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','BR'];

function prompt(hoje, atual) {
  return `Hoje é ${hoje}. Você mantém o "Radar Pós-Nascer", uma lista de editais e programas para quem participou do Programa Nascer (pré-incubação de ideias inovadoras da FAPESC/Sebrae SC) e quer submeter a ideia em outras oportunidades.

Perfil que interessa: ideias inovadoras ou startups em estágio inicial (ideação, validação, protótipo, primeiras vendas). Pré-incubação, incubação, pré-aceleração, aceleração, subvenção econômica, bolsas para empreendedores, prêmios e hackathons de inovação com premiação ou continuidade. Fontes típicas: FAPs estaduais (FAPESC, FACEPE, Fapespa, FAPERJ etc.), Programa Centelha, Sebrae (nacional e estaduais), Finep, BNDES Garagem, InovAtiva, Catalisa ICT, incubadoras, parques e centros de inovação, prefeituras.
Fora do perfil: bolsas de pós-graduação, editais só para pesquisadores de ICT, apoio a eventos científicos, compras públicas, editais culturais.

Lista atual (JSON):
${JSON.stringify(atual)}

Tarefa:
1. Para cada item de "abertos", remova se o prazo já passou ou se foi encerrado.
2. Pesquise na web editais com inscrições ABERTAS hoje, no Brasil inteiro (nacionais e de todos os estados), dentro do perfil. Priorize os que aceitam ideia sem CNPJ e os de Santa Catarina, mas cubra o país.
3. Para "previstos": remova os que já abriram (se abriram e continuam abertos, mova para "abertos") ou que não fazem mais sentido; acrescente programas recorrentes que devem abrir nos próximos meses, com a estimativa baseada na edição anterior.
4. Confirme prazo e link em página oficial ou notícia confiável. Na dúvida, não inclua. Não invente datas.
5. Máximo de 40 itens em "abertos" e 20 em "previstos".

Responda SOMENTE com o JSON final completo entre <json> e </json>, neste formato:
{"abertos":[{"nome":"","org":"","prazo":"AAAA-MM-DD (último dia de inscrição)","prazoTexto":"","desc":"1 a 2 frases em português","quem":"","oferece":"","cnpj":true|false (true se exige CNPJ para se inscrever),"uf":"sigla do estado ou BR se nacional","fit":"alta (muito parecido com o Nascer) ou media (próximo passo)","url":"https://..."}],
 "previstos":[{"quando":"ex.: Mar a mai/2027 (estimado)","nome":"","desc":"","cnpj":true|false,"uf":"","url":"https://..."}]}`;
}

function txt(v, max = 400) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function okUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }

export function validar(obj, hoje) {
  if (!obj || !Array.isArray(obj.abertos) || !Array.isArray(obj.previstos)) throw new Error('JSON sem abertos/previstos');
  const abertos = obj.abertos
    .filter((i) => i && /^\d{4}-\d{2}-\d{2}$/.test(i.prazo) && i.prazo >= hoje && okUrl(i.url) && UFS.includes(i.uf) && txt(i.nome))
    .slice(0, 40)
    .map((i) => ({ nome: txt(i.nome, 160), org: txt(i.org, 160), prazo: i.prazo, prazoTexto: txt(i.prazoTexto, 120), desc: txt(i.desc, 500),
      quem: txt(i.quem, 240), oferece: txt(i.oferece, 240), cnpj: !!i.cnpj, uf: i.uf, fit: i.fit === 'alta' ? 'alta' : 'media', url: i.url }));
  const previstos = obj.previstos
    .filter((i) => i && okUrl(i.url) && UFS.includes(i.uf) && txt(i.nome))
    .slice(0, 20)
    .map((i) => ({ quando: txt(i.quando, 60), nome: txt(i.nome, 160), desc: txt(i.desc, 500), cnpj: !!i.cnpj, uf: i.uf, url: i.url }));
  if (abertos.length + previstos.length === 0) throw new Error('Coleta voltou vazia');
  return { abertos, previstos };
}

export async function coletar(atual) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
  const model = process.env.MODELO || 'claude-haiku-5-5';
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const base = { abertos: atual.abertos || [], previstos: atual.previstos || [] };
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: Number(process.env.MAX_BUSCAS || 20) }];
  const messages = [{ role: 'user', content: prompt(hoje, base) }];
  const uso = { modelo: model, entrada: 0, saida: 0, buscas: 0 };
  let resp;
  for (let i = 0; i < 6; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 16000, messages, tools }),
    });
    resp = await r.json();
    if (!r.ok) throw new Error('API ' + r.status + ': ' + JSON.stringify(resp).slice(0, 300));
    uso.entrada += resp.usage?.input_tokens || 0;
    uso.saida += resp.usage?.output_tokens || 0;
    uso.buscas += resp.usage?.server_tool_use?.web_search_requests || 0;
    if (resp.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: resp.content });
  }
  const texto = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const m = texto.match(/<json>([\s\S]*?)<\/json>/);
  if (!m) throw new Error('Resposta sem <json>: ' + texto.slice(0, 200));
  return { ...validar(JSON.parse(m[1]), hoje), uso };
}
