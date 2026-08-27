# Publicar o Corporate Signage no Railway

Este guia prepara uma demonstração pública com quatro serviços separados:

- `Postgres`: banco de dados;
- `signage-api`: NestJS, Prisma, Socket.io e streaming;
- `signage-dashboard`: painel administrativo;
- `signage-player`: Player das TVs.

O Railway não executa o `docker-compose.yml` diretamente. Todos os três serviços da aplicação usam o mesmo repositório GitHub, mantêm a raiz do projeto em `/` e escolhem seu Dockerfile pela variável `RAILWAY_DOCKERFILE_PATH`.

## 1. Enviar o projeto ao GitHub

Extraia o ZIP. Envie o conteúdo da pasta, e não o ZIP. Não envie `.env`, `node_modules`, `uploads`, `media-inbox`, banco de dados ou mídias corporativas. O `.gitignore` do projeto já bloqueia esses itens.

Crie no GitHub um repositório privado vazio chamado, por exemplo, `corporate-signage-demo`. Não marque as opções de criar README, licença ou `.gitignore` no site.

No PowerShell, dentro da pasta extraída:

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Corporate Signage - demonstracao Railway"
git remote add origin https://github.com/SEU-USUARIO/corporate-signage-demo.git
git push -u origin main
```

Antes do commit, o `git status` não deve mostrar `.env`, `node_modules`, ZIPs, vídeos ou a pasta `uploads`.

## 2. Criar o projeto e o PostgreSQL

1. Entre em `https://railway.com/new` usando o GitHub.
2. Crie um projeto vazio, por exemplo `Somai Signage Demo`.
3. No quadro do projeto, clique em **New → Database → PostgreSQL**.
4. Aguarde o banco ficar disponível. Não gere domínio público para o PostgreSQL.

## 3. Criar a API

1. Clique em **New → GitHub Repo** e selecione `corporate-signage-demo`.
2. Renomeie o serviço para `signage-api`.
3. Em **Variables**, adicione:

```env
RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=GERE-UMA-CHAVE-ALEATORIA-COM-MAIS-DE-32-CARACTERES
JWT_EXPIRES_IN=8h
ENROLLMENT_KEY=GERE-OUTRA-CHAVE-PARA-ATIVAR-AS-TVS
ADMIN_EMAIL=admin@demo.local
ADMIN_PASSWORD=COLOQUE-UMA-SENHA-FORTE
UPLOAD_DIR=/app/uploads
MEDIA_INBOX_DIR=/app/inbox
TZ=America/Sao_Paulo
PUBLIC_API_URL=https://ENDERECO-DA-API
CORS_ORIGINS=https://ENDERECO-DO-DASHBOARD,https://ENDERECO-DO-PLAYER
POWERBI_TENANT_ID=
POWERBI_CLIENT_ID=
POWERBI_CLIENT_SECRET=
```

O nome do banco no projeto pode não ser exatamente `Postgres`. Ao inserir `DATABASE_URL`, use a referência sugerida pela interface do Railway para o serviço PostgreSQL criado.

4. Em **Settings → Networking**, gere um domínio público com porta de destino `3000`.
5. Copie o endereço, por exemplo `https://signage-api-production.up.railway.app`.
6. Volte a **Variables** e corrija `PUBLIC_API_URL` com esse endereço, sem `/api` no final.
7. Deixe `CORS_ORIGINS` temporariamente vazio até gerar os outros dois domínios ou volte para preenchê-lo depois.
8. Em **Settings**, configure o Healthcheck Path como `/api/health`.
9. Anexe um volume ao serviço da API com o caminho de montagem:

```text
/app/uploads
```

Não monte o volume em `/app`, porque isso esconderia os arquivos da aplicação.

## 4. Criar o Dashboard

1. Adicione novamente o mesmo repositório como um novo serviço.
2. Renomeie para `signage-dashboard`.
3. Mantenha **Root Directory** vazio ou `/`.
4. Adicione as variáveis:

```env
RAILWAY_DOCKERFILE_PATH=apps/dashboard/Dockerfile
VITE_API_URL=https://SEU-DOMINIO-DA-API/api
VITE_SOCKET_URL=https://SEU-DOMINIO-DA-API
```

5. Gere um domínio público com porta de destino `80`.

As variáveis `VITE_*` entram durante a compilação. Depois de alterá-las, use **Redeploy** para gerar novamente o Dashboard.

## 5. Criar o Player

1. Adicione o mesmo repositório mais uma vez.
2. Renomeie para `signage-player`.
3. Mantenha **Root Directory** vazio ou `/`.
4. Adicione:

```env
RAILWAY_DOCKERFILE_PATH=apps/player/Dockerfile
VITE_API_URL=https://SEU-DOMINIO-DA-API/api
VITE_SOCKET_URL=https://SEU-DOMINIO-DA-API
VITE_PLAYER_CACHE_MAX_MB=2048
```

5. Gere um domínio público com porta de destino `80`.

## 6. Finalizar CORS e testar

Na API, substitua `CORS_ORIGINS` pelos endereços HTTPS reais, separados por vírgula e sem barra final:

```env
CORS_ORIGINS=https://signage-dashboard-production.up.railway.app,https://signage-player-production.up.railway.app
```

Faça **Redeploy** da API. Teste nesta ordem:

1. `https://SEU-DOMINIO-DA-API/api/health` deve responder com sucesso;
2. abra o Dashboard e entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`;
3. crie um usuário em **Acessos do Player**;
4. abra o domínio do Player e faça a ativação;
5. envie inicialmente uma imagem ou vídeo curto e pequeno;
6. crie uma playlist e use **Tocar agora**.

## 7. Atualizações futuras

Depois de alterar arquivos no computador:

```powershell
git add .
git status
git commit -m "Atualizacao do Corporate Signage"
git push
```

O Railway detectará o novo commit. Se apenas a URL ou outra variável `VITE_*` mudar, faça Redeploy do respectivo frontend.

## Limitações da demonstração gratuita

- Use vídeos pequenos: a conversão com FFmpeg consome CPU, memória e espaço temporário.
- O volume gratuito é limitado; não use o ambiente como acervo definitivo.
- Não envie conteúdo confidencial da empresa para uma demonstração pública.
- Use senhas diferentes das usadas no servidor interno.
- Para produção 24 horas com várias TVs e muitos vídeos, migre para um plano pago ou para o servidor próprio da empresa.
