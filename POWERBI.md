# Widget Power BI

O Signal Signage oferece dois modos no menu **Power BI**.

Antes de cadastrar um relatório privado, abra **Integrações e API**, crie uma conexão do tipo **Power BI** e clique em **Testar**. Esse teste é executado pela API e confirma se `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID` e `POWERBI_CLIENT_SECRET` conseguem autenticar no Microsoft Entra ID. O painel mostra o último estado, a latência e a mensagem da Microsoft sem revelar o segredo.

## Relatórios criados pela equipe de BI

Se outra pessoa da empresa já desenvolve os painéis usando dados do Protheus, o Signal Signage não precisa recriar esses indicadores. A equipe de BI fornece uma destas opções:

- link **Publicar na Web**, apenas para conteúdo que pode ser público;
- `Workspace ID` e `Report ID`, para o modo Embedded seguro;
- link privado comum, que exigirá login Microsoft na TV e por isso não é o método recomendado para sinalização digital.

Depois do cadastro, o relatório vira uma mídia do tipo widget. Basta adicioná-lo a uma playlist, escolher o tempo de exibição e programar a TV.

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

## Relação entre Protheus, API e Power BI

Existem dois fluxos possíveis:

```text
Protheus → Power BI da empresa → Widget Power BI → Player da TV
```

Nesse caso, a equipe de BI já consulta e modela os dados do Protheus. O Signal Signage recebe apenas o relatório pronto.

```text
Protheus REST → API Signal Signage → Widget próprio → Player da TV
```

Nesse segundo caso, o Signal Signage consulta um endpoint REST do Protheus e transforma o JSON em cards, tabelas, listas ou indicadores. Cadastre primeiro o endpoint em **Integrações e API** para validar autenticação e disponibilidade; depois use a URL em **Widgets de dados**.
