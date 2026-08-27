# Widget Power BI

O Signal Signage oferece dois modos no menu **Power BI**.

## Link público

Use somente para relatórios sem informação confidencial:

1. No Power BI Service, gere o endereço **Publicar na Web**.
2. No Signal Signage, abra **Power BI > Novo relatório**.
3. Selecione **Link público** e cole o endereço `https://app.powerbi.com/view?...`.
4. Teste a conexão, salve e adicione o novo widget a uma playlist.

Não existe segredo nem token nesse modo. Qualquer pessoa que obtenha o link pode visualizar o conteúdo.

## Embedded seguro

Esse modo usa o padrão **App owns data**. As TVs não armazenam senha Microsoft: a API gera um token temporário e entrega somente esse token ao Player.

### Preparação na Microsoft

1. Registre um aplicativo no Microsoft Entra ID.
2. Crie um Client Secret e guarde o valor em local seguro.
3. No portal administrativo do Power BI, permita que service principals usem as APIs do Power BI para o grupo de segurança escolhido.
4. Adicione o service principal ao Workspace do relatório com a permissão necessária.
5. Confirme que o Workspace está atribuído a uma capacidade compatível de Power BI Embedded/Fabric para produção.
6. Copie Tenant ID, Client ID, Workspace ID e Report ID.

### Variáveis da API

Configure somente no `.env` do Mini PC:

```env
POWERBI_TENANT_ID=00000000-0000-0000-0000-000000000000
POWERBI_CLIENT_ID=00000000-0000-0000-0000-000000000000
POWERBI_CLIENT_SECRET=valor-secreto
```

Reconstrua somente a API:

```bash
docker compose up -d --build api
```

No Dashboard, informe Workspace ID e Report ID. O Client Secret não aparece no formulário, não é salvo no PostgreSQL e nunca é enviado ao Player.

## Renovação e segurança

- O Player consulta novamente a configuração conforme o intervalo do widget.
- Tokens Embedded não são gravados no cache offline nem no `localStorage`.
- Quando estiver offline, um relatório privado não funciona; o Power BI depende dos servidores Microsoft.
- O widget oculta barra de ações e status. Navegação de páginas e filtros são opcionais.
- O modo Embedded exige saída HTTPS do Mini PC para `login.microsoftonline.com`, `api.powerbi.com` e domínios de incorporação do Power BI.

## Fluxo técnico

```text
Player → API Signal Signage
API → Microsoft Entra ID (client credentials)
API → Power BI REST API (informações do relatório + GenerateToken)
API → Player (embedUrl + token temporário)
Player → Power BI (renderização pelo SDK oficial)
```

As chamadas do relatório vão diretamente da TV para a Microsoft. O Cloudflare Tunnel transporta somente o Player, a fila e a pequena resposta de configuração.
