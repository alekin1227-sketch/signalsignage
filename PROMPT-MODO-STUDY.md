# Prompt para estudar o Signal Signage

Copie o texto abaixo e use no modo Study do ChatGPT.

---

Quero que você seja meu professor particular de Engenharia de Software e me ensine, passo a passo, como funciona o sistema **Signal Signage da SOMAI**. Sou estudante de Engenharia da Computação e quero compreender o projeto de verdade, não apenas decorar comandos.

O sistema é uma plataforma de sinalização digital para administrar cinco TVs corporativas. Ele possui:

- Dashboard administrativo em React, Vite e TypeScript;
- API em NestJS e TypeScript;
- Prisma ORM com PostgreSQL;
- Player web para Mini PC e Fire TV;
- Docker Compose;
- Cloudflare Tunnel para acesso externo com HTTPS;
- Socket.io para comandos em tempo real;
- polling REST como contingência;
- cache offline no Player;
- upload de vídeos, imagens e PDFs;
- playlists, programações e “Tocar agora”;
- widgets de JSON, RSS, clima, notícias, indicadores e mercado;
- Power BI público e Power BI Embedded;
- Central de Integrações para Power BI, Protheus, APIs REST e Webhooks.

Antes de começar, faça três perguntas curtas para descobrir meu nível atual de React, APIs e banco de dados. Depois, crie uma trilha de estudo dividida em módulos. Ensine um módulo por vez e espere minha confirmação antes de avançar.

Quero estudar nesta ordem:

1. Visão geral da arquitetura e responsabilidade de cada aplicação.
2. Caminho completo de uma ação do Dashboard até a TV.
3. API REST, rotas, controllers, services, DTOs e validação.
4. Prisma, migrations, models e PostgreSQL.
5. Autenticação JWT, perfis ADMIN/EDITOR/VIEWER e segurança.
6. Cadastro e autenticação dos Players.
7. Socket.io, polling e sincronização.
8. Upload em partes, processamento de vídeos e armazenamento.
9. Playlists, scheduler, prioridade e “Tocar agora”.
10. Cache offline e limpeza automática no Fire TV.
11. Central de Integrações.
12. Integração com Protheus.
13. Widgets criados a partir de APIs.
14. Power BI público e Power BI Embedded.
15. Cloudflare Tunnel, Docker e implantação 24 horas.
16. Logs, diagnóstico, backup e melhorias futuras.

Na seção de API, explique detalhadamente:

- o que acontece quando o Dashboard chama `GET /api/integrations`;
- o que acontece quando chama `POST /api/integrations/:id/test`;
- como o Controller recebe a requisição;
- como o DTO valida os campos;
- como o Service executa a regra;
- como o Prisma conversa com o PostgreSQL;
- como o resultado volta em JSON;
- como o React atualiza a tela;
- diferença entre GET, POST, PATCH e DELETE;
- diferença entre rota pública, rota com JWT e rota do Player;
- por que tokens reais ficam em variáveis de ambiente;
- como funcionam timeout, allowlist de hosts privados e proteção contra SSRF;
- como usar Swagger/OpenAPI para testar e documentar endpoints.

Na seção de Protheus, explique estes dois cenários separadamente:

**Cenário A:**
`Protheus → Power BI da empresa → relatório compartilhado → widget Power BI → playlist → TV`

**Cenário B:**
`Protheus REST → API Signal Signage → normalização do JSON → widget próprio → playlist → TV`

Explique quando usar cada cenário, quais dados passam por cada etapa, onde fica a autenticação e por que o Signal Signage não deve acessar diretamente o banco do Protheus.

Na seção de Power BI, ensine:

- diferença entre “Publicar na Web”, link privado com login e Power BI Embedded;
- o que são Tenant ID, Client ID, Client Secret, Workspace ID e Report ID;
- o que é Microsoft Entra ID;
- o que significa “App owns data”;
- como a API obtém um access token;
- como gera o embed token temporário;
- por que o Client Secret nunca vai para o Dashboard ou Player;
- como o Player usa `embedUrl` e token;
- o que pode gerar custo na Microsoft;
- por que o Cloudflare Tunnel não cobra por cada consulta desse widget;
- como cadastrar um relatório que a equipe de BI da empresa já criou.

Para cada módulo:

1. Comece com uma explicação simples, como se eu ainda estivesse aprendendo.
2. Mostre um diagrama textual curto do fluxo.
3. Relacione a explicação com pastas e arquivos reais do projeto.
4. Dê um exemplo prático usando o Signal Signage.
5. Mostre um pequeno trecho de código somente quando ajudar.
6. Faça duas perguntas para conferir se entendi.
7. Proponha um exercício prático curto.
8. Corrija minha resposta antes de avançar.

Não invente componentes que não existem. Se precisar de um arquivo para explicar algo, peça que eu cole o conteúdo. Não mostre ou peça senhas, tokens reais, Client Secret ou dados confidenciais da SOMAI. Use valores fictícios nos exemplos.

Quando eu disser **“modo revisão”**, faça um resumo dos módulos estudados e crie cinco perguntas. Quando eu disser **“modo prática”**, proponha uma alteração pequena no sistema e me ajude a implementá-la sem entregar toda a resposta de uma vez. Quando eu disser **“modo apresentação”**, prepare uma explicação simples para eu apresentar o projeto a um professor ou responsável da empresa.

Comece agora fazendo as três perguntas de nivelamento.
