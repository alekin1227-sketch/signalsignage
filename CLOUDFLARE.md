# Signal Signage no Mini PC com Cloudflare Tunnel

Esta configuração mantém banco, mídias, API, Dashboard e Player no Mini PC. A Cloudflare somente cria a passagem HTTPS; nenhuma porta de entrada precisa ser aberta no roteador.

## 1. Domínios recomendados

Use um Tunnel nomeado e três aplicações publicadas:

| Endereço público | Serviço de origem no Docker |
|---|---|
| `painel.signage.empresa.com.br` | `http://dashboard:80` |
| `player.signage.empresa.com.br` | `http://player:80` |
| `api.signage.empresa.com.br` | `http://api:3000` |

Como o `cloudflared` roda na mesma rede do Docker Compose, os nomes `dashboard`, `player` e `api` funcionam como DNS interno. Não use `localhost` nas rotas do Tunnel em contêiner.

## 2. Criar o Tunnel

1. Adicione o domínio à sua conta Cloudflare.
2. Abra **Networking > Tunnels**.
3. Crie um Tunnel chamado `signal-signage-somai`.
4. Selecione instalação por Docker e copie somente o token mostrado depois de `--token`.
5. Grave o token em `CLOUDFLARE_TUNNEL_TOKEN` no arquivo `.env`.
6. Em **Routes**, crie as três aplicações publicadas da tabela acima.

Nunca envie o token ao GitHub, ao Dashboard ou ao Player.

## 3. URLs da aplicação

No `.env`, use os domínios definitivos:

```env
PUBLIC_API_URL=https://api.signage.empresa.com.br
VITE_API_URL=https://api.signage.empresa.com.br/api
VITE_SOCKET_URL=https://api.signage.empresa.com.br
CORS_ORIGINS=https://painel.signage.empresa.com.br,https://player.signage.empresa.com.br
VITE_PLAYER_CACHE_MAX_MB=2048
```

Faça o primeiro build e inicie todos os componentes:

```bash
docker compose --profile tunnel up -d --build
docker compose exec api npm run prisma:seed
docker compose ps
```

Depois do primeiro `up`, todos os contêineres usam `restart: unless-stopped` e voltam quando o Docker iniciar.

## 4. Segurança

- Proteja `painel.signage.empresa.com.br` com Cloudflare Access.
- Não coloque Access na API inteira nem no Player, pois as TVs precisam renovar fila e WebSocket sem login interativo.
- A API mantém JWT para administradores e token individual para cada dispositivo.
- Nunca crie rota pública para PostgreSQL.
- Desative ou restrinja `/docs` em uma política corporativa se a documentação não precisar ficar pública.
- Use senhas diferentes para PostgreSQL, administrador e acessos dos Players.

## 5. Vídeos acima de 100 MB

O Dashboard divide automaticamente arquivos acima de 80 MB em partes de 50 MB. Cada requisição permanece abaixo do limite do Cloudflare Free; a API reúne as partes no volume local, verifica o tamanho e só então processa o arquivo com FFmpeg.

Uploads interrompidos são tentados novamente até três vezes. Se o envio for cancelado, a sessão temporária é removida.

## 6. Fire TV Stick de 8 GB

O limite padrão do Player é 2 GB. Ao receber uma nova playlist ele:

1. mantém a mídia atual visível;
2. baixa e valida os arquivos da nova fila;
3. reaproveita arquivos com o mesmo checksum;
4. troca para a nova programação;
5. remove mídias que não pertencem mais à playlist;
6. libera arquivos antigos antecipadamente se o sistema detectar pouco espaço.

Altere `VITE_PLAYER_CACHE_MAX_MB` somente depois de conferir o espaço realmente disponível no Fire TV.

## 7. Verificações

```text
https://api.signage.empresa.com.br/api/health
https://painel.signage.empresa.com.br
https://player.signage.empresa.com.br
```

No painel da Cloudflare, o Tunnel deve aparecer como **Healthy**. Esse estado confirma a conexão do `cloudflared`, mas o teste de `/api/health` confirma que a aplicação também está respondendo.
