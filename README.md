# Máximus Produtora — Sistema de Captações

Sistema web colaborativo para a organização semanal das captações e gravações da **Máximus Produtora**.
Substitui a lousa física: a equipe planeja a semana de forma remota, compartilhada e atualizada em tempo real.

- **Agenda semanal** de segunda a sexta, com um ou vários clientes por dia;
- **Tela do dia** com rota, municípios e totais de vídeos;
- **Planejamento de cada captação** com contêineres de vídeo (roteiro, links de referência e imagens de apoio);
- **Sugestões de deslocamento** por município (aproveitar a viagem);
- **Monitoramento semanal** com percentual de conclusão;
- **Dois níveis de acesso** (administrador e membro da equipe), com registro de quem criou e quem alterou cada item.

---

## Sumário

1. [Tecnologias](#tecnologias)
2. [Identidade visual](#identidade-visual)
3. [Publicar para a equipe](#publicar-para-a-equipe)
4. [Estrutura de pastas](#estrutura-de-pastas)
3. [Requisitos](#requisitos)
4. [Instalação e execução](#instalação-e-execução)
5. [Acessos criados automaticamente](#acessos-criados-automaticamente)
6. [Variáveis de ambiente](#variáveis-de-ambiente)
7. [Banco de dados e migrations](#banco-de-dados-e-migrations)
8. [Armazenamento de imagens](#armazenamento-de-imagens)
9. [Tempo real](#tempo-real)
10. [Páginas e permissões](#páginas-e-permissões)
11. [API](#api)
12. [Testes, lint e build](#testes-lint-e-build)
13. [Publicação em produção](#publicação-em-produção)
14. [Migrar para Supabase/PostgreSQL no futuro](#migrar-para-supabasepostgresql-no-futuro)
15. [Fora do escopo desta fase](#fora-do-escopo-desta-fase)

---

## Tecnologias

O repositório já tinha uma stack definida (projeto da barbearia) e ela foi **preservada e reaproveitada**:

| Camada | Tecnologia |
|---|---|
| API | Node.js + Express 5 (CommonJS) |
| Banco | SQLite via `node:sqlite` (módulo nativo do Node — nenhum servidor de banco para instalar) |
| Autenticação | E-mail + senha, hash com bcrypt e sessão por JWT |
| Uploads | multer, com bucket local em `backend/uploads` |
| Tempo real | Server-Sent Events (SSE), sem dependência extra |
| Frontend | React 19 + Vite + React Router 7 |
| Datas | date-fns com locale pt-BR, fuso `America/Fortaleza` |
| HTTP | axios |
| Ícones | lucide-react (traço 1.75–2) |
| Fontes | Barlow Condensed (títulos) e Montserrat (interface), via Fontsource |
| Estilo | CSS próprio com design tokens da identidade Máximus (tema escuro) |
| Lint | oxlint |
| Testes | `node:test` (runner nativo) |

> **Sobre Supabase/Next.js:** o briefing indicava essa stack *caso o repositório estivesse vazio*. Como já havia
> estrutura (Express + SQLite + React/Vite), ela foi mantida conforme a instrução de preservar a tecnologia existente.
> O modelo de dados usa exatamente os nomes de tabela pedidos, o que deixa uma migração futura para PostgreSQL/Supabase
> direta — veja [a seção específica](#migrar-para-supabasepostgresql-no-futuro).

## Identidade visual

O sistema usa a identidade da Máximus Produtora: gradiente roxo → magenta → coral, tipografia
condensada nos títulos e os elementos oficiais da marca (logo, símbolo e o raio). O **tema escuro**
é o padrão e há um **tema claro** em *Configurações → Aparência*, salvo por dispositivo.
Tokens, componentes, regras de uso e verificação de contraste estão documentados em
**[docs/brand-system.md](docs/brand-system.md)**; as capturas das telas ficam em `docs/screenshots/`.

Os arquivos da marca ficam em `frontend/public/brand/` — a versão clara da logo é a usada no
sistema (fundo escuro) e a versão preta fica reservada para fundos claros e exportações.

## Publicar para a equipe

Guia completo em **[DEPLOY.md](DEPLOY.md)** — rede local (2 minutos), link temporário por túnel
e servidor 24h com disco persistente. Os arquivos `Dockerfile` e `render.yaml` já estão prontos,
e `npm run backup` gera a cópia do banco e das imagens para levar os dados atuais para o servidor.

## Estrutura de pastas

```
maximus/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.js            # conexão SQLite
│   │   │   ├── migrate.js          # runner de migrations
│   │   │   └── migrations/         # 001_init.sql, ...
│   │   ├── lib/                    # datas, cores, conflitos, validação, eventos, log de atividade
│   │   ├── middleware/             # autenticação (JWT) e upload (multer)
│   │   ├── routes/                 # auth, users, clients, team, captures, videos, uploads, workspace, events
│   │   ├── scripts/                # migrate, bootstrap, seed, seed-demo
│   │   └── server.js
│   ├── tests/                      # node:test (unitários + integração da API)
│   └── uploads/                    # bucket local (logos, avatars, videos)
└── frontend/
    └── src/
        ├── components/             # ui, layout, agenda, capture, clients
        ├── context/                # autenticação, tempo real e avisos (toasts)
        ├── lib/                    # datas (pt-BR), cores e contraste
        ├── pages/                  # Login, Agenda, DayView, CaptureDetail, Clients, Team, Settings
        └── styles/                 # base, layout, agenda, capture
```

## Requisitos

- **Node.js 22.5 ou superior** (o backend usa o módulo nativo `node:sqlite`). Verifique com `node -v`.
- Nenhum banco de dados externo, nenhuma conta em serviço de nuvem.

## Instalação e execução

### 1. Backend

```bash
cd maximus/backend
npm install
cp .env.example .env
npm run seed:demo
npm run dev
```

A API sobe em `http://localhost:4100`. Na primeira execução o sistema:

1. cria o banco em `backend/data/maximus.sqlite`;
2. aplica as migrations;
3. cria o workspace **Máximus Produtora** e o primeiro administrador;
4. com `npm run seed:demo`, cadastra os 9 clientes iniciais, a equipe e captações de exemplo na semana atual.

> Para começar sem dados de exemplo, rode `npm run seed` (só clientes e equipe) ou apenas `npm run migrate`.

### 2. Frontend

Em outro terminal:

```bash
cd maximus/frontend
npm install
cp .env.example .env
npm run dev
```

Acesse **http://localhost:5273**. O Vite encaminha `/api` e `/uploads` para a porta 4100, então não é preciso
configurar CORS no desenvolvimento.

## Acessos criados automaticamente

| Perfil | E-mail | Senha | O que pode fazer |
|---|---|---|---|
| Administrador | `admin@maximusprodutora.com.br` | `maximus123` | Tudo: clientes, equipe, acessos, configurações e todas as captações |
| Membro da equipe | `equipe@maximusprodutora.com.br` | `equipe123` | Ver, criar, editar e concluir captações, vídeos e roteiros |

> **Troque as senhas no primeiro acesso**, em *Configurações → Meu perfil → Alterar senha*.
> Os valores padrão podem ser mudados no `.env` **antes** da primeira execução (`ADMIN_EMAIL`, `ADMIN_PASSWORD`,
> `MEMBER_EMAIL`, `MEMBER_PASSWORD`).

## Variáveis de ambiente

**backend/.env** (veja `backend/.env.example`)

| Variável | Padrão | Para que serve |
|---|---|---|
| `PORT` | `4100` | Porta da API (a barbearia deste repositório usa a 4000) |
| `JWT_SECRET` | *(trocar)* | Assinatura dos tokens de sessão — **obrigatório trocar em produção** |
| `TOKEN_TTL` | `12h` | Validade da sessão |
| `TIMEZONE` | `America/Fortaleza` | Fuso usado para "hoje" e para a semana |
| `WORKSPACE_NAME` / `WORKSPACE_SLUG` | Máximus Produtora | Workspace criado na primeira execução |
| `HOME_CITY` / `HOME_REGION` | Senador Pompeu / Sertão Central | Sede usada nas rotas e sugestões |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Primeiro administrador |
| `MEMBER_EMAIL` / `MEMBER_PASSWORD` | — | Acesso de equipe criado pelo `npm run seed` |
| `UPLOADS_DIR` | `backend/uploads` | Pasta do bucket de imagens |
| `MAX_UPLOAD_MB` | `8` | Tamanho máximo por imagem |
| `CORS_ORIGIN` | vazio | Domínios liberados em produção (separados por vírgula) |
| `SERVE_FRONTEND` | `0` | Se `1`, a API também serve o build do frontend |

**frontend/.env**

| Variável | Padrão | Para que serve |
|---|---|---|
| `VITE_API_URL` | vazio | Endereço da API. Vazio = usa o proxy do Vite (desenvolvimento) |

## Banco de dados e migrations

As migrations ficam em `backend/src/db/migrations` e rodam automaticamente ao iniciar o servidor
(ou manualmente com `npm run migrate`). Cada arquivo roda uma única vez, dentro de uma transação, e fica
registrado na tabela `schema_migrations`.

Tabelas:

| Tabela | Conteúdo |
|---|---|
| `workspaces` | O ambiente da Máximus (nome, fuso, cidade sede) |
| `profiles` | Usuários que fazem login (papel `admin` ou `member`) |
| `team_members` | Quem pode ser escalado para gravar (com ou sem login) |
| `clients` | Clientes: nome, nome curto, logo, cor, município, região, tipo de captação, status |
| `capture_schedules` | Captações agendadas: data, horários, município, local, objetivo, observações, conclusão |
| `capture_assignees` | Responsáveis de cada captação (uma captação pode ter vários) |
| `video_ideas` | Contêineres de vídeo, com posição, título, roteiro, observações e conclusão |
| `video_references` | Links de referência (Instagram, TikTok, YouTube, qualquer página) |
| `video_attachments` | Imagens de apoio |
| `activity_logs` | Quem alterou o quê e quando |

Tudo é vinculado ao `workspace_id`. Toda rota autenticada só enxerga dados do workspace do próprio usuário, e as
operações administrativas (clientes, equipe, acessos, configurações) exigem papel `admin` — é a camada de segurança
equivalente às políticas RLS do Supabase.

### Scripts

```bash
npm run migrate      # aplica migrations pendentes e garante workspace + admin
npm run seed         # + 9 clientes iniciais, equipe e acesso de membro
npm run seed:demo    # + captações de exemplo na semana atual
npm run seed:demo -- --reset   # apaga as captações e recria as de exemplo
```

## Armazenamento de imagens

O bucket local fica em `backend/uploads`, separado por finalidade:

- `uploads/logos` — logotipos dos clientes;
- `uploads/avatars` — fotos da equipe;
- `uploads/videos` — imagens de apoio dos vídeos.

Formatos aceitos: PNG, JPG, WEBP, GIF e SVG, até `MAX_UPLOAD_MB` (8 MB por padrão). Os arquivos são servidos em
`/uploads/...` e removidos do disco quando a imagem é excluída (respeitando vídeos duplicados que apontam para o
mesmo arquivo).

## Tempo real

A API mantém um canal SSE em `GET /api/events`. Cada aba aberta se inscreve e recebe um aviso quando alguém altera
clientes, equipe, captações ou vídeos — a tela recarrega sozinha os dados afetados. O indicador **"Em tempo real"**
no topo mostra o estado da conexão; se ela cair, o sistema continua funcionando e atualiza ao recarregar a página.

## Páginas e permissões

| Rota | Tela | Acesso |
|---|---|---|
| `/login` | Entrada com e-mail e senha | Público |
| `/agenda` | Agenda semanal (página inicial após o login) | Todos |
| `/agenda/:data` | Tela específica do dia (ex.: `/agenda/2026-08-18`) | Todos |
| `/captacoes/:id` | Planejamento da captação: vídeos, roteiros, links e imagens | Todos |
| `/clientes` | Lista de clientes | Todos veem · **admin** cadastra/edita/exclui |
| `/equipe` | Membros que gravam | Todos veem · **admin** cadastra/edita/remove |
| `/configuracoes` | Perfil, senha, dados da produtora, acessos e histórico | Perfil/senha: todos · Produtora e acessos: **admin** |

Regras adicionais:

- captações e vídeos podem ser criados, editados e concluídos por qualquer membro;
- excluir uma captação: apenas quem a agendou ou um administrador;
- o sistema nunca fica sem administrador ativo;
- cliente ou membro com histórico não é apagado por engano — o sistema sugere desativar.

## API

Todas as rotas ficam sob `/api` e exigem o cabeçalho `Authorization: Bearer <token>`, exceto o login.

<details>
<summary><strong>Ver endpoints</strong></summary>

**Autenticação e usuários**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | Entrar (e-mail + senha) |
| GET | `/auth/me` | Sessão atual, workspace e cartão da equipe |
| PUT | `/auth/me` | Atualizar nome e foto |
| POST | `/auth/change-password` | Trocar a própria senha |
| GET | `/users` | Listar acessos |
| POST | `/users` | Criar acesso *(admin)* |
| PUT | `/users/:id` | Nome, papel e status *(admin)* |
| POST | `/users/:id/reset-password` | Redefinir senha *(admin)* |

**Clientes e equipe**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/clients` · `/clients/cities` · `/clients/:id` | Listagens e detalhe |
| POST · PUT · DELETE | `/clients` · `/clients/:id` | CRUD *(admin)* |
| GET | `/team` | Listar membros (`?active=1` só ativos) |
| POST · PUT · DELETE | `/team` · `/team/:id` | CRUD *(admin)* |

**Captações**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/captures/week?date=&client_id=&member_id=&city=&status=` | Semana com dias, resumo e filtros |
| GET | `/captures/day/:date` | Dia com rota, totais e sugestões |
| GET | `/captures/suggestions?date=&city=` | Sugestões de deslocamento |
| POST | `/captures/check-conflicts` | Conflitos de escala antes de salvar |
| GET · POST · PUT · DELETE | `/captures/:id` · `/captures` | CRUD |
| PATCH | `/captures/:id/done` | Concluir / reabrir |

**Vídeos**

| Método | Rota | Descrição |
|---|---|---|
| POST · PUT · DELETE | `/videos` · `/videos/:id` | Criar, editar (salvamento automático) e excluir |
| PATCH | `/videos/:id/done` | Concluir / reabrir (sugere concluir a captação) |
| POST | `/videos/:id/duplicate` | Duplicar |
| PUT | `/videos/reorder/:captureId` | Reordenar |
| POST · DELETE | `/videos/:id/references` · `/videos/references/:id` | Links de referência |
| POST · DELETE | `/videos/:id/attachments` · `/videos/attachments/:id` | Imagens de apoio |

**Outros**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/uploads/:bucket` | Enviar imagem (`logos`, `avatars`, `videos`) |
| GET · PUT | `/workspace` | Dados da produtora *(PUT: admin)* |
| GET | `/workspace/activity` | Histórico de alterações |
| GET | `/events` | Canal de tempo real (SSE) |
| GET | `/health` | Verificação de saúde |

</details>

## Testes, lint e build

```bash
# backend
cd maximus/backend
npm test            # 32 testes: datas, conflitos, validação e integração da API

# frontend
cd maximus/frontend
npm run lint        # oxlint
npm run build       # build de produção (Vite)
```

Os testes de integração sobem a API com um banco temporário próprio — não tocam nos dados de trabalho.

## Publicação em produção

1. **Backend** — qualquer serviço com Node 22+ e **disco persistente** (Render, Railway, VPS…), porque o banco
   (`data/maximus.sqlite`) e as imagens (`uploads/`) ficam em arquivo. Ambientes serverless puros não servem.
   Defina `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `CORS_ORIGIN`, e rode `npm start`.
2. **Frontend** — `npm run build` gera `frontend/dist`, publicável em qualquer hospedagem estática
   (Vercel, Netlify, Cloudflare Pages), com `VITE_API_URL` apontando para a API.
3. **Deploy único (opcional)** — com `SERVE_FRONTEND=1`, a própria API serve o `dist` do frontend.
4. Faça backup periódico de `backend/data/` e `backend/uploads/`.

## Migrar para Supabase/PostgreSQL no futuro

O modelo já usa os nomes de tabela e os relacionamentos previstos para o Supabase. Para migrar:

1. traduzir `001_init.sql` para PostgreSQL (`SERIAL`/`IDENTITY` no lugar de `AUTOINCREMENT`, `TIMESTAMPTZ` no lugar
   de `TEXT` nas datas de auditoria);
2. trocar `profiles.password_hash` pelo `auth.users` do Supabase, mantendo `profiles.id` como referência;
3. transformar as verificações de `workspace_id` e de papel (hoje no middleware) em políticas RLS equivalentes;
4. trocar o bucket local pelo Storage, mantendo o mesmo formato de URL salvo no banco;
5. trocar o canal SSE pelo Realtime.

Nada disso muda a interface: o frontend conversa apenas com os endpoints listados acima.
A chave `service_role` **nunca** deve ser usada no navegador — apenas no servidor.

## Fora do escopo desta fase

Calendário de postagens, gestão financeira, aprovação de posts pelos clientes, publicação automática em redes
sociais, identidade visual definitiva, aplicativo móvel nativo, upload dos vídeos originais, integração com
WhatsApp, otimização de rotas por mapas e notificações avançadas. A arquitetura foi organizada em módulos
(rotas, libs e páginas independentes) para que esses módulos possam ser adicionados depois sem reescrever o que já existe.
