# Radar Pós-Nascer

Site que reúne editais e programas de inovação para quem participou do **Programa Nascer** (pré-incubação de ideias inovadoras da FAPESC, SCTI e Sebrae/SC) e quer continuar com a ideia em outras oportunidades.

A pessoa abre o link e vê:

- os editais com **inscrição aberta hoje**, com contagem de dias até o prazo;
- os editais **previstos** (programas que costumam abrir todo ano);
- filtros por **estado** (os 27 mais "nacionais") e por **"aceita sem CNPJ"**.

O site **se atualiza sozinho** e **sem custo**: usa uma busca na web gratuita (Tavily) e uma inteligência artificial open source (gpt-oss-120b, no plano grátis do Groq). Ninguém precisa editar a lista.

> Página informativa, criada por um facilitador do Programa Nascer. Não é um canal oficial da FAPESC nem do Sebrae/SC.

---

## Sumário

1. [Como funciona](#como-funciona)
2. [Estrutura dos arquivos](#estrutura-dos-arquivos)
3. [Como publicar (passo a passo)](#como-publicar-passo-a-passo)
4. [Variáveis de ambiente](#variáveis-de-ambiente)
5. [Testar e acompanhar](#testar-e-acompanhar)
6. [Custos](#custos)
7. [Ajustes comuns](#ajustes-comuns)
8. [Problemas e soluções](#problemas-e-soluções)
9. [Limitações](#limitações)

---

## Como funciona

```
Visitante abre o site
        │
        ▼
index.html pede a lista em /api/editais
        │
        ▼
api/editais.js lê a lista guardada (Vercel Blob)
        │
        ├── Última busca há menos de 15 dias ──► devolve a lista (custo zero)
        │
        └── Última busca há 15 dias ou mais
                │
                ├── devolve a lista atual na hora (o visitante não espera)
                └── em segundo plano:
                        1. faz 12 buscas na web (Tavily)
                        2. a IA open source lê os resultados e extrai os editais
                        3. o código junta com a lista atual e tira vencidos/repetidos
                        │
                        ▼
                lista nova validada e guardada no Blob
                (próximos visitantes já veem a lista nova)
```

O que se ajusta sozinho:

- **Contagem de dias e editais vencidos:** calculados no navegador de quem abre, pela data do dia. Um edital que venceu ontem some hoje, mesmo sem nova busca.
- **Novos editais:** buscados na internet no máximo a cada 15 dias, e só quando alguém visita o site.
- **Estado de quem acessa:** na primeira visita, o site identifica o estado aproximado pela conexão (cabeçalho da Vercel) e já abre filtrado. A pessoa pode trocar, e a escolha fica salva no navegador dela. Nenhum dado de visitante é guardado.

Proteções incluídas:

- **Trava contra buscas duplicadas:** se muita gente abrir o link ao mesmo tempo, só a primeira visita dispara a busca. A trava expira em 20 minutos.
- **Espera após falha:** se uma busca falhar, o site espera 6 horas antes de tentar de novo.
- **Validação:** a IA só pode marcar um edital como aberto se o trecho encontrado mostrar o prazo final. Itens sem link, com prazo vencido ou com dados inválidos são descartados. Se a busca não trouxer nada, a lista anterior continua no ar.
- **Previstos com validade:** cada edital previsto tem uma data limite estimada (`ate`). Passada essa data, ele sai da lista sozinho.
- **Selo de data:** o topo mostra "Última busca: dd/mm/aaaa". Se passar de 30 dias, o selo fica amarelo, sinal de que as buscas pararam.

---

## Estrutura dos arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | A página: visual, filtros, cards e linha do tempo. |
| `api/editais.js` | Devolve a lista e dispara a busca quando ela está vencida. |
| `api/onde.js` | Informa o estado aproximado de quem acessa. |
| `lib/coletar.js` | Buscas no Tavily, chamada à IA, validação e junção com a lista atual. |
| `lib/armazem.js` | Lê e grava a lista no Vercel Blob. |
| `lib/seed.js` | Lista inicial, montada à mão em 31/10/2026. Usada até a primeira busca automática. |
| `package.json` | Dependências: `@vercel/blob` e `@vercel/functions`. |
| `vercel.json` | Dá até 5 minutos para a busca terminar. |

Os dados ficam em dois arquivos no Blob:

- `radar/dados.json`: a lista de editais e a data da última busca.
- `radar/estado.json`: controle interno (busca em andamento, falhas, consumo da última busca).

---

## Como publicar (passo a passo)

Tempo estimado: 15 minutos. Você vai precisar de contas gratuitas no **GitHub**, na **Vercel**, no **Tavily** e no **Groq**. Nenhuma pede cartão de crédito.

### 1. Subir o código no GitHub

1. Em [github.com](https://github.com), clique em **+** e depois em **New repository**.
2. Nome: `radar-pos-nascer`. Pode ser **Private**. Não marque a opção de README.
3. Clique em **Create repository**.
4. Na página do repositório, clique em **uploading an existing file**.
5. Arraste **o conteúdo** da pasta do projeto (os arquivos e as pastas `api` e `lib`), não a pasta de fora.
6. Confira se `api` e `lib` aparecem como pastas e clique em **Commit changes**.

### 2. Importar na Vercel

1. Em [vercel.com](https://vercel.com), clique em **Add New… → Project**.
2. Conecte o GitHub, se ele pedir, e clique em **Import** em `radar-pos-nascer`.
3. Em **Framework Preset**, deixe **Other**.
4. Clique em **Deploy**.

O site já abre, mostrando a lista inicial. Ele ainda não se atualiza sozinho.

### 3. Criar o armazenamento (Blob)

1. No projeto, abra a aba **Storage → Create Database → Blob**.
2. Nome: `radar-dados`. Se perguntar o tipo de acesso, escolha **Public**.
3. Conecte o armazenamento ao projeto `radar-pos-nascer`.

A Vercel cria sozinha a variável `BLOB_READ_WRITE_TOKEN`.

### 4. Criar as duas chaves gratuitas

**Busca na web (Tavily):**
1. Crie uma conta em [tavily.com](https://tavily.com) (plano Researcher, gratuito, sem cartão).
2. No painel, copie a **API Key** (`tvly-...`).

**IA open source (Groq):**
1. Crie uma conta em [console.groq.com](https://console.groq.com) (plano Free, sem cartão).
2. Em **API Keys**, clique em **Create API Key** e copie a chave (`gsk_...`). Ela só aparece uma vez.

> Nunca coloque as chaves no código nem as envie para ninguém. Elas ficam apenas nas configurações da Vercel.

### 5. Configurar as variáveis

No projeto da Vercel, abra **Settings → Environment Variables** e adicione as variáveis da [tabela abaixo](#variáveis-de-ambiente). As obrigatórias são `TAVILY_API_KEY`, `LLM_API_KEY` e `ADMIN_TOKEN`. Marque **Production** e **Preview** e salve.

### 6. Republicar

Na aba **Deployments**, clique nos três pontinhos do deploy mais recente e em **Redeploy**. As variáveis só passam a valer depois disso.

---

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Para que serve |
|---|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | sim | — | Criada automaticamente ao conectar o Blob (passo 3). |
| `TAVILY_API_KEY` | sim | — | Chave do Tavily, para as buscas na web. |
| `LLM_API_KEY` | sim | — | Chave do Groq (ou de outro provedor, veja abaixo). |
| `ADMIN_TOKEN` | recomendada | — | Uma senha inventada por você, para forçar uma busca de teste. |
| `LLM_BASE_URL` | não | `https://api.groq.com/openai/v1` | Endereço da IA. Qualquer API compatível com OpenAI funciona. |
| `LLM_MODEL` | não | `openai/gpt-oss-120b` | Modelo usado para ler os resultados. |
| `INTERVALO_DIAS` | não | `15` | Quantos dias esperar entre uma busca e outra. |
| `LOTE` | não | `15` | Quantos resultados a IA lê por vez. Diminua se der erro de limite. |
| `PAUSA_MS` | não | `25000` | Pausa entre chamadas à IA, para respeitar o limite por minuto do plano grátis. |

Sem `TAVILY_API_KEY` e `LLM_API_KEY`, o site funciona, mas mostra sempre a lista inicial.

Depois de mudar qualquer variável, faça **Redeploy**.

**Trocar o provedor da IA (todos com plano grátis no momento em que este README foi escrito):**

| Provedor | `LLM_BASE_URL` | `LLM_MODEL` (exemplo) |
|---|---|---|
| Groq (padrão) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` |
| OpenRouter | `https://openrouter.ai/api/v1` | um modelo com sufixo `:free` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.5-flash-lite` (não é open source) |

Os planos grátis e os nomes de modelos mudam com o tempo. Se um modelo for desativado, troque `LLM_MODEL` por outro da lista do provedor.

---

## Testar e acompanhar

**Forçar uma busca agora** (ignora o intervalo de 15 dias):

```
https://SEU-SITE.vercel.app/api/editais?forcar=SUA_SENHA_ADMIN
```

A coleta faz pausas para respeitar os limites gratuitos. Espere de 3 a 5 minutos e recarregue o site. "Última busca" deve mostrar a data de hoje.

**Ver o status da última busca:** abra `https://SEU-SITE.vercel.app/api/editais`. No fim da resposta, o bloco `status` mostra:

- `ultimaColeta`: quando a última busca deu certo;
- `uso`: número de buscas, chamadas à IA, tokens usados e modelo da última coleta;
- `ultimaFalha` e `erro`: o motivo, se a última tentativa falhou;
- `semChave: true`: a chave da API não está configurada.

**Logs detalhados:** no projeto da Vercel, na aba **Logs**.

---

## Custos

**Custo: zero**, dentro dos planos gratuitos:

| Serviço | Plano grátis | Uso deste site |
|---|---|---|
| Tavily (busca) | 1.000 créditos/mês, sem cartão | 12 créditos por coleta, cerca de 24 por mês |
| Groq (IA) | 1.000 chamadas/dia, sem cartão | cerca de 5 chamadas por coleta |
| Vercel + Blob | plano Hobby | bem abaixo dos limites |

- **Visitas não consomem nada.** Quem abre o site só lê a lista guardada.
- **No máximo uma coleta a cada 15 dias**, e só se alguém visitar o site.
- Se algum limite gratuito for atingido, a coleta falha, o site continua no ar com a última lista e tenta de novo depois.
- Os planos grátis podem mudar no futuro. Se um provedor passar a cobrar, troque-o pelas variáveis, sem mexer no código.

---

## Ajustes comuns

| Quero… | Como |
|---|---|
| Buscar com mais ou menos frequência | Mude `INTERVALO_DIAS` e faça Redeploy. |
| Mudar os termos pesquisados | Edite a função `consultas` em `lib/coletar.js`. |
| Mudar o que a IA considera edital | Edite a função `instrucao` em `lib/coletar.js`. |
| Trocar a IA | Mude `LLM_BASE_URL`, `LLM_MODEL` e `LLM_API_KEY`. |
| Mudar textos ou visual | Edite `index.html`. As cores ficam no bloco `:root`, no topo do `<style>`. |

Para alterar um arquivo pelo GitHub: abra o arquivo, clique no **lápis** (Edit), salve com **Commit changes**. A Vercel republica sozinha em cerca de 1 minuto.

---

## Problemas e soluções

| Sintoma | Causa provável | Solução |
|---|---|---|
| Deploy falha na Vercel | Arquivos subiram fora das pastas `api`/`lib` | Confira no GitHub se `api/editais.js` e `lib/coletar.js` estão nas pastas certas. |
| "Não foi possível carregar os editais" | Blob não conectado | Refaça o passo 3 e depois Redeploy. |
| "Última busca" nunca muda | Chaves ausentes ou inválidas | Veja `status.semChave` e `status.erro` em `/api/editais`. |
| `erro` começa com `Tavily 401` ou `432` | Chave do Tavily errada ou créditos do mês esgotados | Confira a chave no painel do Tavily. |
| `erro` começa com `IA 401` | Chave da IA errada | Gere outra chave no Groq. |
| `erro` começa com `IA 404` ou menciona `model` | Modelo desativado pelo provedor | Troque `LLM_MODEL` por um modelo atual. |
| `erro`: limite de uso atingido | Limite por minuto do plano grátis | Diminua `LOTE` (ex.: 10) ou aumente `PAUSA_MS` (ex.: 40000). |
| Poucos editais novos | Os trechos da busca não trazem o prazo | Normal: a IA só inclui o que tem prazo confirmado. Ajuste os termos em `consultas`. |
| Selo "Última busca" amarelo | Mais de 30 dias sem coleta bem-sucedida | Veja `status.erro` e os Logs da Vercel. |

---

## Limitações

- **A lista é montada por inteligência artificial** a partir de trechos de busca. Ela pode errar uma data ou um critério, e ninguém revisa antes de publicar. O rodapé do site avisa os visitantes para sempre conferirem o edital oficial.
- **A IA só lê os trechos que a busca devolve**, não o edital inteiro. Editais cujo prazo não aparece no trecho ficam de fora. Isso deixa a lista mais curta, porém mais confiável.
- **A cobertura depende do que a busca encontra** naquela rodada. Editais de estados com pouca divulgação on-line podem não aparecer.
- **A primeira visita depois de muito tempo** mostra a lista antiga por alguns minutos, enquanto a nova é buscada. Os editais vencidos já ficam escondidos.
- **Funcionamento por anos sem manutenção** depende de as contas continuarem ativas e de os planos gratuitos e os modelos continuarem disponíveis. O selo amarelo e o `status` em `/api/editais` existem para você perceber quando algo parou.
