# Como deixar o sistema disponível para a equipe

Três caminhos, do mais rápido ao definitivo. Todos usam o **modo servidor único**: a API serve
também a interface, então é **um endereço só**, sem configurar CORS.

| Caminho | Quando usar | Custo | Funciona fora do escritório? |
|---|---|---|---|
| **A. Rede local** | Mostrar hoje para quem está no mesmo Wi-Fi | zero | não |
| **B. Link temporário** | A equipe testar de casa por alguns dias | zero | sim, enquanto o PC estiver ligado |
| **C. Servidor 24h** | Uso de verdade, todo dia | ~R$ 30–60/mês | sim, sempre |

> Em qualquer caminho: **o banco e as imagens são arquivos** (`backend/data/maximus.sqlite` e
> `backend/uploads/`). Onde o sistema rodar, precisa ter disco que não se apaga a cada atualização.

---

## A. Rede local (funciona agora, em 2 minutos)

Serve para a equipe abrir no celular ou no notebook **dentro do escritório**, no mesmo Wi-Fi.

```bash
cd maximus/frontend && npm run build
```

```bash
cd maximus/backend && SERVE_FRONTEND=1 npm start
```

No Windows (PowerShell), a segunda linha fica:

```bash
cd maximus/backend; $env:SERVE_FRONTEND="1"; npm start
```

Pronto: a equipe acessa **http://192.168.0.3:4100** (esse é o IP atual deste computador no Wi-Fi —
confira com `ipconfig` se mudar).

Se ninguém conseguir abrir, libere a porta no Firewall do Windows uma única vez:

```bash
netsh advfirewall firewall add rule name="Maximus 4100" dir=in action=allow protocol=TCP localport=4100
```

Limitações: só funciona no mesmo Wi-Fi, o computador precisa ficar ligado e o IP pode mudar quando
o roteador reiniciar.

---

## B. Link temporário pela internet (Cloudflare Tunnel)

Cria um endereço `https://algo-aleatorio.trycloudflare.com` apontando para o sistema rodando neste
computador. Bom para a equipe testar de casa antes de contratar servidor.

1. Baixe o `cloudflared` (Windows 64 bits): https://github.com/cloudflare/cloudflared/releases
2. Deixe o sistema rodando como no caminho A.
3. Em outro terminal:

```bash
cloudflared tunnel --url http://localhost:4100
```

O programa mostra o link `https://...trycloudflare.com` — é só enviar para a equipe.

Limitações: o link muda toda vez que o comando é reiniciado e só funciona com o computador ligado.
Não use como solução definitiva.

---

## C. Servidor 24h (recomendado para o dia a dia)

### C1. Render — o mais simples (sem Docker, sem terminal)

O arquivo `maximus/render.yaml` já está pronto no projeto.

1. Suba o projeto para um repositório no GitHub (privado).
2. Em https://render.com → **New → Blueprint** → conecte o repositório.
3. O Render lê o `render.yaml` e pede só duas variáveis: `ADMIN_EMAIL` e `ADMIN_PASSWORD`
   (o primeiro administrador). O `JWT_SECRET` ele gera sozinho.
4. Confirme o **disco de 1 GB** montado em `/var/data` — é onde ficam banco e imagens.
   Isso exige o plano pago (a partir de US$ 7/mês); o plano gratuito **não tem disco** e apaga tudo.
5. Ao final, o endereço fica `https://maximus-produtora.onrender.com`. Dá para apontar um domínio
   próprio (ex.: `agenda.maximusprodutora.com.br`) em *Settings → Custom Domain*.

### C2. Railway / Fly.io / Coolify / VPS com Docker

O `maximus/Dockerfile` já está pronto e monta tudo sozinho (compila a interface e sobe a API).

```bash
docker build -t maximus maximus
docker run -d --name maximus -p 80:4100 \
  -v maximus-dados:/data \
  -e JWT_SECRET="uma-chave-longa-e-aleatoria" \
  -e ADMIN_EMAIL="voce@maximusprodutora.com.br" \
  -e ADMIN_PASSWORD="uma-senha-forte" \
  --restart unless-stopped maximus
```

O volume `maximus-dados` guarda `/data/db` (banco) e `/data/uploads` (imagens).
Em VPS (Hostinger, Contabo, DigitalOcean — a partir de ~R$ 30/mês), coloque um **Caddy** ou
**Nginx** na frente para ter HTTPS automático no seu domínio.

### C3. VPS sem Docker

```bash
git clone <seu-repositorio> && cd <repo>/maximus
npm run build
JWT_SECRET="..." SERVE_FRONTEND=1 PORT=4100 npm start
```

Use `pm2` (ou um serviço `systemd`) para o sistema voltar sozinho depois de reiniciar a máquina.

---

## Levar os dados que já existem

O que a equipe já cadastrou está **neste computador**. Para não recomeçar do zero:

```bash
cd maximus/backend && npm run backup
```

Isso cria `maximus/backend/backups/AAAA-MM-DD_HHMM/` com o banco e a pasta de imagens.
No servidor novo, copie o conteúdo para dentro do disco persistente:

- `maximus.sqlite` → `DATA_DIR` (ex.: `/var/data/db/`)
- `uploads/` → `UPLOADS_DIR` (ex.: `/var/data/uploads/`)

Reinicie o serviço. As migrations rodam sozinhas e nada se perde.

> Faça isso com o sistema **parado** nos dois lados, para o arquivo não ser copiado no meio de uma escrita.

---

## Antes de liberar para a equipe

1. **Troque o `JWT_SECRET`** por um valor longo e aleatório (o Render gera automaticamente).
2. **Troque as senhas padrão** (`maximus123` / `equipe123`) em *Configurações → Meu perfil*.
3. **Crie um acesso para cada pessoa** em *Configurações → Acessos*, com o nível certo:
   - *Administrador*: gerencia clientes, equipe, acessos e configurações;
   - *Equipe*: cria, edita e conclui captações, vídeos e roteiros.
4. **Desative o acesso genérico** `equipe@maximusprodutora.com.br` depois que todos tiverem o seu.
5. **Confirme o HTTPS** (Render e Cloudflare já entregam; em VPS use Caddy ou Nginx + Let's Encrypt).
6. **Defina `CORS_ORIGIN`** apenas se a interface ficar em um endereço diferente da API.
   No modo servidor único isso não é necessário.

## Rotina de backup

```bash
cd maximus/backend && npm run backup
```

Guarde a pasta gerada fora do servidor (Google Drive, HD externo). Uma vez por semana já resolve;
em servidor Linux dá para agendar no `cron`:

```bash
0 3 * * 1 cd /caminho/maximus/backend && npm run backup >> /var/log/maximus-backup.log 2>&1
```

## Perguntas rápidas

**Precisa instalar algo no celular da equipe?** Não. É um site — abre no navegador. No Android e no
iPhone dá para usar "Adicionar à tela de início" e ele abre como um aplicativo.

**Quantas pessoas aguenta?** A equipe inteira da Máximus com folga. O banco SQLite roda em arquivo e
o gargalo real seria dezenas de acessos simultâneos escrevendo ao mesmo tempo — bem acima do uso da
produtora.

**E se um dia precisar crescer?** O modelo de dados usa os mesmos nomes de tabela do Supabase;
a migração para PostgreSQL está descrita no [README](README.md#migrar-para-supabasepostgresql-no-futuro).

**Vou perder os dados ao atualizar o sistema?** Não, desde que o disco persistente esteja
configurado (caminho C) — o código é substituído, os arquivos de dados ficam.
