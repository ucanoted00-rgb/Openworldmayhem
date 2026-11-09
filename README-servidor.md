# Contas e amigos — Open World Mayhem

## Como rodar
Os arquivos `server.js` e `test.js` ficam na **raiz do projeto**, junto do `index.html`. Rode lá:

    node server.js

Abra `http://localhost:3000`. O servidor também serve o jogo, então não há CORS nem endereço para configurar.
Para jogar pelo celular na mesma rede Wi‑Fi, abra `http://IP-DO-PC:3000`.

Se abrir o `index.html` direto (file://) ou hospedar o jogo em outro lugar, toque em **Conta → Servidor** e digite o endereço da API (o servidor libera CORS por padrão; restrinja com `OWM_CORS=https://seu-site`).

Variáveis: `PORT` (3000), `HOST` (0.0.0.0), `OWM_DATA` (caminho do JSON de dados), `OWM_CORS`.
Teste: `node test.js`.

## API (JSON; autenticação com `Authorization: Bearer <token>`)
| Rota | Corpo | Função |
|---|---|---|
| POST /api/register | username, password | cria conta e já loga |
| POST /api/login | username, password | entra |
| POST /api/logout | — | encerra a sessão |
| GET /api/me | — | valida a sessão |
| GET /api/friends | — | amigos (com online), pedidos recebidos e enviados |
| POST /api/friends/request | username | envia pedido (se a pessoa já tinha pedido, vira amizade) |
| POST /api/friends/accept · decline · cancel · remove | username | aceitar, recusar, cancelar envio, desfazer amizade |

## Regras e segurança
- Usuário: 3–16 caracteres (`A-Z a-z 0-9 _`), único sem diferenciar maiúsculas. Senha: 8–72.
- Senhas com scrypt + sal; tokens aleatórios guardados só como hash; sessão de 30 dias; até 8 sessões por conta.
- Limite de 12 tentativas de login/cadastro por IP a cada 5 min. Limites: 100 amigos, 50 pedidos pendentes.
- "Online" = qualquer requisição autenticada no último minuto (o jogo atualiza a cada 15 s).
- `server.js`, `test.js`, `data.json` (e o `.tmp` dele), este README e arquivos com ponto nunca são servidos. Os dados ficam em `data.json` na raiz (coloque no `.gitignore`, não versione).
- **Em produção use HTTPS** (proxy reverso tipo Caddy/Nginx): sem isso a senha trafega em texto puro.
- Para o resto do jogo: `OWM.account` expõe `loggedIn`, `username`, `friends`, `incoming`, `outgoing`, `refresh()`, `onChange(fn)`.
