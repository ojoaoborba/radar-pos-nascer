# Radar Pós-Nascer

Site que reúne editais e programas de inovação para quem participou do **Programa Nascer** (pré-incubação de ideias inovadoras da FAPESC, SCTI e Sebrae/SC) e quer continuar com a ideia em outras oportunidades.

A pessoa abre o link e vê:

- os editais com **inscrição aberta hoje**, com contagem de dias até o prazo;
- os editais **previstos** (programas que costumam abrir todo ano);
- filtros por **estado** (os 27 mais "nacionais") e por **"aceita sem CNPJ"**.

O site **se atualiza sozinho**. Ninguém precisa editar a lista.

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
                └── em segundo plano, chama o Claude com busca na web
                        │
                        ▼
                lista nova validada e guardada no Blob
                (próximos visitantes já veem a lista nova)
```

O que se ajusta sozinho:

- **Contagem de dias e editais vencidos:** calculados no navegador de quem abre, pela data do dia. Um edital que venceu ontem some hoje, mesmo sem nova busca.
- **Novos editais:** buscados pelo Claude na internet no máximo a cada 15 dias, e só quando alguém visita o site. Sem visitas, não há gasto.
- **Estado de quem acessa:** na primeira visita, o site identifica o estado aproximado pela conexão (cabeçalho da Vercel) e já abre filtrado. A pessoa pode trocar, e a escolha fica salva no navegador dela. Nenhum dado de visitante é guardado.

Proteções incluídas:

- **Trava contra buscas duplicadas:** se muita gente abrir o link ao mesmo tempo, só a primeira visita dispara a busca. A trava expira em 20 minutos.
- **Espera após falha:** se uma busca falhar, o site espera 6 horas antes de tentar de novo.
- **Validação:** antes de entrar no ar, a resposta da IA é conferida. Itens sem link `https`, com prazo vencido ou com estado inválido são descartados. Uma resposta vazia é rejeitada e a lista anterior continua no ar.
- **Selo de data:** o topo mostra "Última busca: dd/mm/aaaa". Se passar de 30 dias, o selo fica amarelo, sinal de que as buscas pararam.

---

## Estrutura dos arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | A página: visual, filtros, cards e linha do tempo. |
| `api/editais.js` | Devolve a lista e dispara a busca quando ela está vencida. |
| `api/onde.js` | Informa o estado aproximado de quem acessa. |
| `lib/coletar.js` | Instrução enviada ao Claude, chamada à API e validação da resposta. |
| `lib/armazem.js` | Lê e grava a lista no Vercel Blob. |
| `lib/seed.js` | Lista inicial, montada à mão em 31/10/2026. Usada até a primeira busca automática. |
| `package.json` | Dependências: `@vercel/blob` e `@vercel/functions`. |
| `vercel.json` | Dá até 5 minutos para a busca terminar. |

Os dados ficam em dois arquivos no Blob:

- `radar/dados.json`: a lista de editais e a data da última busca.
- `radar/estado.json`: controle interno (busca em andamento, falhas, consumo da última busca).

---

## Como publicar (passo a passo)

Tempo estimado: 15 minutos. Você vai precisar de contas gratuitas no **GitHub** e na **Vercel**, e de uma conta com cartão no **console da Anthropic**.

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

### 4. Criar a chave da API do Claude

1. Acesse o [console da Anthropic](https://console.anthropic.com).
2. Em **Billing**, cadastre um cartão e **defina um limite mensal de gasto**. Para começar, US$ 5 é suficiente.
3. Em **API Keys**, clique em **Create Key** e copie a chave (`sk-ant-...`). Ela só aparece uma vez.

> Nunca coloque a chave no código nem a envie para ninguém. Ela fica apenas nas configurações da Vercel.

### 5. Configurar as variáveis

No projeto da Vercel, abra **Settings → Environment Variables** e adicione as variáveis da [tabela abaixo](#variáveis-de-ambiente). As obrigatórias são `ANTHROPIC_API_KEY` e `ADMIN_TOKEN`. Marque **Production** e **Preview** e salve.

### 6. Republicar

Na aba **Deployments**, clique nos três pontinhos do deploy mais recente e em **Redeploy**. As variáveis só passam a valer depois disso.

---

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Para que serve |
|---|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | sim | — | Criada automaticamente ao conectar o Blob (passo 3). |
| `ANTHROPIC_API_KEY` | sim | — | Chave da API do Claude. Sem ela, o site funciona, mas mostra sempre a lista inicial. |
| `ADMIN_TOKEN` | recomendada | — | Uma senha inventada por você, para forçar uma busca de teste. |
| `MODELO` | não | `claude-haiku-5-5` | Modelo do Claude usado na busca. O Haiku é o mais barato. |
| `INTERVALO_DIAS` | não | `15` | Quantos dias esperar entre uma busca e outra. |
| `MAX_BUSCAS` | não | `20` | Máximo de pesquisas na web por busca. Controla o custo. |

Depois de mudar qualquer variável, faça **Redeploy**.

---

## Testar e acompanhar

**Forçar uma busca agora** (ignora o intervalo de 15 dias):

```
https://SEU-SITE.vercel.app/api/editais?forcar=SUA_SENHA_ADMIN
```

Espere de 3 a 5 minutos e recarregue o site. "Última busca" deve mostrar a data de hoje.

**Ver o status da última busca:** abra `https://SEU-SITE.vercel.app/api/editais`. No fim da resposta, o bloco `status` mostra:

- `ultimaColeta`: quando a última busca deu certo;
- `uso`: modelo, tokens de entrada e saída e número de pesquisas da última busca (serve para estimar o custo);
- `ultimaFalha` e `erro`: o motivo, se a última tentativa falhou;
- `semChave: true`: a chave da API não está configurada.

**Logs detalhados:** no projeto da Vercel, na aba **Logs**.

---

## Custos

- **Visitas não custam nada.** Quem abre o site só lê a lista guardada.
- **Cada busca** é cobrada na sua conta da API da Anthropic. Ela usa tokens e pesquisas na web (cerca de US$ 0,01 por pesquisa, mais os tokens). Com o modelo Haiku e até 20 pesquisas, uma busca deve ficar em poucos centavos de dólar. Confira o valor real no console da Anthropic depois do primeiro teste.
- **No máximo uma busca a cada 15 dias**, ou seja, cerca de duas por mês, e só se alguém visitar o site.
- **Vercel e Blob:** o uso deste site cabe no plano gratuito (Hobby).
- **O teto de gasto** definido no console da Anthropic é a garantia final. Se o limite for atingido, as buscas param e o site continua no ar com a última lista.

O uso da API é separado da assinatura do Claude que você usa no chat.

---

## Ajustes comuns

| Quero… | Como |
|---|---|
| Buscar com mais ou menos frequência | Mude `INTERVALO_DIAS` e faça Redeploy. |
| Gastar menos por busca | Diminua `MAX_BUSCAS` (por exemplo, 10). |
| Resultados mais caprichados | Mude `MODELO` para `claude-sonnet-5-5`. É mais caro. |
| Mudar o perfil de editais buscados | Edite o texto da função `prompt` em `lib/coletar.js`. |
| Mudar textos ou visual | Edite `index.html`. As cores ficam no bloco `:root`, no topo do `<style>`. |

Para alterar um arquivo pelo GitHub: abra o arquivo, clique no **lápis** (Edit), salve com **Commit changes**. A Vercel republica sozinha em cerca de 1 minuto.

---

## Problemas e soluções

| Sintoma | Causa provável | Solução |
|---|---|---|
| Deploy falha na Vercel | Arquivos subiram fora das pastas `api`/`lib` | Confira no GitHub se `api/editais.js` e `lib/coletar.js` estão nas pastas certas. |
| "Não foi possível carregar os editais" | Blob não conectado | Refaça o passo 3 e depois Redeploy. |
| "Última busca" nunca muda | Chave ausente ou inválida | Veja `status.semChave` e `status.erro` em `/api/editais`. |
| `erro` menciona `credit` ou `billing` | Sem saldo ou limite atingido | Ajuste em Billing, no console da Anthropic. |
| `erro` menciona `model` | Nome do modelo mudou | Troque `MODELO` por um modelo atual (veja a documentação da Anthropic). |
| Busca demora e não termina | Muitas pesquisas para o tempo limite | Diminua `MAX_BUSCAS`. |
| Selo "Última busca" amarelo | Mais de 30 dias sem busca bem-sucedida | Veja `status.erro` e os Logs da Vercel. |

---

## Limitações

- **A lista é montada por inteligência artificial.** Ela pode errar uma data ou um critério, e ninguém revisa antes de publicar. O rodapé do site avisa os visitantes para sempre conferirem o edital oficial.
- **A cobertura depende do que a busca encontra** naquela rodada. Editais de estados com pouca divulgação on-line podem não aparecer.
- **A primeira visita depois de muito tempo** mostra a lista antiga por alguns minutos, enquanto a nova é buscada. Os editais vencidos já ficam escondidos.
- **Funcionamento por anos sem manutenção** depende de a conta da Vercel continuar ativa, do cartão da API continuar válido e de o modelo configurado continuar disponível. O selo amarelo e o `status` em `/api/editais` existem para você perceber quando algo parou.
