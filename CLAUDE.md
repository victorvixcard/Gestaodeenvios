# Gestão de Envios — Documentação do Projeto

> Este arquivo é o **manual de bordo** do projeto. Qualquer desenvolvedor ou IA que entrar aqui deve ler isto primeiro. Mantenha atualizado conforme o sistema evolui.

---

## 1. O que é o projeto

Sistema multi-tenant de **gestão de pedidos gráficos** (cartões, carnês, etiquetas, impressos). Cada cliente é um **tenant** com seu próprio ambiente (URL, branding, usuários, produtos liberados).

- **Dono:** Victor (victorvixcard no GitHub) — empresa VIXCard
- **Domínio em produção:** https://gestaodenvios.com.br
- **Repositório:** https://github.com/victorvixcard/Gestaodeenvios
- **Branch principal:** `main`

Exemplos de tenants atuais: `vixcard` (super admin), `medsenior`, `unimed`, `sebrae`.

---

## 2. Stack técnico

| Camada | Tecnologia |
|---|---|
| Backend | **Laravel 11** (PHP 8.3) + Sanctum (Bearer tokens) |
| Frontend | **React + TypeScript + Vite** + Tailwind + shadcn/ui |
| Banco local | **MySQL** dentro do WSL (era SQLite ate 2026-08) |
| Banco produção | MySQL |
| Webserver produção | nginx + php8.3-fpm |
| Hospedagem | Digital Ocean Droplet (Ubuntu 24.04) |

---

## 3. Estrutura de pastas — é um MONOREPO

```
Gestaodeenvios/                          ← raiz do repo (uma só)
├── backend-new/                         ← API Laravel
│   ├── app/Http/Controllers/Api/        ← endpoints
│   ├── app/Models/                      ← User, Order, Product, Company, AuditLog
│   ├── database/migrations/
│   ├── routes/api.php                   ← rotas da API
│   ├── .env                             ← config (NÃO comitado)
│   └── ...
├── vixcard-platform/                    ← SPA React
│   ├── src/
│   │   ├── pages/                       ← Login, LoginUniversal, Users, Empresas, etc.
│   │   ├── contexts/                    ← Auth, Data, Tenant, Orders, Logs
│   │   ├── lib/api.ts                   ← cliente HTTP com timeout
│   │   ├── lib/mappers.ts               ← converte snake_case → camelCase
│   │   └── types/                       ← TypeScript types
│   ├── .env                             ← VITE_API_URL (NÃO comitado)
│   └── dist/                            ← build de produção (gerado por `npm run build`)
└── CLAUDE.md                            ← este arquivo
```

**Atenção:** o repositório contém os DOIS projetos. Um `git pull` na raiz traz código de backend e frontend juntos.

---

## 4. Ambiente LOCAL (Windows do Victor)

### 4.1 Caminhos

- **Raiz do repo:** `C:\Users\Administrador\Documents\GitHub\Gestaodeenvios\`
- **PHP:** `C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe`
- **Composer:** `C:\laragon\bin\composer\composer.phar` (rode com `php composer.phar ...`)
- **Node:** v20.x

### 4.2 Como rodar local

O jeito certo é o script na raiz do repo:

```powershell
.\dev.ps1          # sobe backend (8001) e frontend (5175)
.\dev.ps1 -Stop    # derruba os dois
.\dev.ps1 -Reset   # recria o banco de demonstracao e sobe
```

Ele usa `Start-Process` destacado de propósito. Servidor iniciado dentro de uma
sessão de terminal ou de ferramenta morre junto com ela — foi o motivo de "o
backend e o front ficam caindo". As janelas ficam minimizadas na barra de
tarefas; fechar a janela derruba aquele servidor.

Acesse **http://localhost:5175**.

**Use `localhost`, nunca `127.0.0.1`.** O Vite escuta só em IPv6 (`::1`), então
`http://127.0.0.1:5175` é recusado. Isso afeta `curl` e teste automatizado — no
navegador `localhost` resolve certo. O backend é o oposto: escuta em
`127.0.0.1:8001`. O proxy `/api` do Vite faz a ponte em dev.

### 4.3 Banco local

**MySQL dentro do WSL** (Ubuntu-24.04), não SQLite. Chega no Windows pela
porta 3306 via `wslrelay`.

```
DB_CONNECTION=mysql
DB_DATABASE=vixcard_gestaodeenvios
DB_HOST=127.0.0.1   DB_PORT=3306
```

Se a porta 3306 aparecer livre, o WSL provavelmente está desligado. Qualquer
comando `wsl -d Ubuntu-24.04` o inicia, e o MySQL sobe junto (serviço enabled):

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "service mysql status"
```

### 4.4 Usuários locais

Criados pelo `DemoSeeder`. **A senha de todos é `senha123`.**

| E-mail | Papel | Tenant |
|---|---|---|
| admin@vixcard.com.br | super_admin | vixcard |
| ana@medsenior.com | tenant_admin | medsenior |
| bruno@medsenior.com | operator | medsenior |
| diego@technip.com | tenant_admin | technip |
| elena@technip.com | operator | technip |
| carla@unimed.com | tenant_admin | unimed |

Para recriar a base de demonstração do zero:

```powershell
.\dev.ps1 -Reset
```

O `DemoSeeder` se recusa a rodar com `APP_ENV=production`.


## 5. Ambiente de PRODUÇÃO (Digital Ocean)

### 5.1 Acesso ao servidor

- **Painel:** https://cloud.digitalocean.com/ (conta do Victor)
- **Droplet:** `ubuntu-s-1vcpu-2gb-nyc1`
- **IP:** `67.207.90.37`
- **OS:** Ubuntu 24.04 LTS
- **Acesso:** Web Console pelo painel do DO (não há chave SSH configurada nesta máquina). Caminho: Droplets → ubuntu-s-1vcpu-2gb-nyc1 → botão **Console** (canto superior direito).

### 5.2 Caminhos no servidor

```
/var/www/gestaodeenvios/
├── backend-new/        ← API
└── vixcard-platform/   ← SPA (dist/ é o que o nginx serve)
```

### 5.3 Configuração do nginx (resumida)

- `server_name: gestaodenvios.com.br www.gestaodenvios.com.br`
- `root /var/www/gestaodeenvios/vixcard-platform/dist`
- `try_files $uri $uri/ /index.html` (SPA fallback)
- PHP-FPM via `fastcgi_pass` apontando para `php8.3-fpm`
- `fastcgi_param SCRIPT_FILENAME /var/www/gestaodeenvios/backend-new/public/index.php`
- HTTPS via Let's Encrypt (TLS 1.3, válido até 2026-08-01)

Config completa: `/etc/nginx/sites-enabled/`

### 5.4 Serviços relevantes

```bash
systemctl status nginx
systemctl status php8.3-fpm
systemctl status mysql
```

Reload sem downtime: `systemctl reload nginx` / `systemctl reload php8.3-fpm`.

---

## 6. Fluxo de DEPLOY em produção

Sempre nesta ordem. **Não pule etapas.**

```bash
# 1. Backend
cd /var/www/gestaodeenvios/backend-new
git stash                                 # preserva alterações locais (gitignores que o Laravel toca)
git pull origin main
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --pretend             # SEMPRE rode pretend primeiro
php artisan migrate --force               # só rode se o pretend não tentar criar tabela existente
php artisan config:clear && php artisan route:clear && php artisan cache:clear
php artisan config:cache && php artisan route:cache
systemctl reload php8.3-fpm

# 2. Frontend (mesmo repo, já foi puxado acima)
cd /var/www/gestaodeenvios/vixcard-platform
npm install --no-audit --no-fund
npm run build                             # gera dist/ (substitui o antigo)

# nginx NÃO precisa reload — ele lê dist/ direto
```

**Cuidado com migrations:** o servidor já tem MySQL com tabelas `cache` e `sessions` (driver = database). Antes de aplicar qualquer migration nova que crie tabela, sempre rode `php artisan migrate --pretend` e confira se ela não vai colidir com algo que já existe.

---

## 7. Autenticação e multi-tenant

### 7.1 Login universal

Endpoint: `POST /api/login`

Aceita `email + password` **sem `tenant_slug`** (login universal — descobre o tenant pelo e-mail). Se o `tenant_slug` for enviado, força o filtro nele.

Resposta:
```json
{
  "token": "Bearer-token-aqui",
  "user": { ... },
  "tenant_slug": "medsenior"
}
```

O frontend usa o `tenant_slug` da resposta para redirecionar a `/{tenant_slug}/dashboard`.

### 7.2 Tenants

Tenants vêm do banco. Criar a empresa pela tela **Cadastros → Empresas → Nova Empresa**
(ou via `POST /companies`) já basta — **não precisa mexer em código nem publicar build**.

`TenantContext.tsx` resolve o tenant da URL consultando `GET /api/tenants/{slug}`, uma rota
pública que devolve só a identidade visual (slug, nome, cor e iniciais do logo). Ela é pública
porque a tela `/{tenant}/login` precisa da marca antes de existir usuário autenticado; por isso
mesmo, **nunca** devolva usuários, produtos ou contadores nesse endpoint — use `publicShow()`,
não `formatCompany()`. Empresa inativa responde 404.

Até 2026-07-31 os tenants eram hardcoded num objeto `TENANTS` dentro do
`TenantContext.tsx`. O efeito era que o botão "Nova Empresa" criava a empresa no banco mas ela
caía em `/404`, porque o frontend não sabia que ela existia. Se algo parecido reaparecer,
confira primeiro se a informação está sendo lida do banco e não de uma constante no bundle.

`TenantProvider` também redireciona quem não é `super_admin` para a própria empresa ao tentar
abrir a URL de outra. Isso é consistência de tela, **não** é a barreira de segurança — quem
isola os dados é a API, que filtra pelo tenant do token e ignora o slug da URL.

### 7.3 Papéis (roles)

| Role | O que pode fazer |
|---|---|
| `super_admin` | Tudo — gerencia empresas, usuários de todos os tenants, vê todos os pedidos |
| `tenant_admin` | Gerencia usuários e pedidos do PRÓPRIO tenant |
| `operator` | Cria/acompanha pedidos do tenant; sem cadastros |

Há um campo extra `permissions` (JSON array) na tabela `users` para permissões granulares dentro do papel. Veja `DEFAULT_PERMISSIONS` em `DataContext.tsx`.

### 7.4 Rotas com restrição

- `/companies/*` → super_admin only
- `/audit-logs` → super_admin only
- `/orders/{id}` (DELETE) → super_admin only
- `/products` (POST/PUT/DELETE/toggle) → **super_admin only** — o catálogo é da VIXCard
- `GET /products` → qualquer autenticado (filtrado pelos produtos vinculados à empresa)
- `/users/*` → super_admin OU tenant_admin (tenant_admin restrito ao próprio tenant)
- Demais → qualquer autenticado

### 7.5 Isolamento entre tenants — o que foi verificado

Auditado em 2026-07-31 com login real de um `tenant_admin` atacando outro tenant:

| Recurso | Isolamento | Onde é garantido |
|---|---|---|
| Pedidos | OK | `OrderController::authorizeOrder` em todos os métodos |
| Usuários | OK | `UserController::authorizeUserAccess` + filtro no `index` |
| Empresas | OK | rota `role:super_admin` |
| Logs de auditoria | OK | rota `role:super_admin` |
| Dashboard | OK | filtro `where('tenant_slug')` quando não é super admin |
| Produtos | Corrigido | era o furo — ver tabela da seção 10 |

**Regra ao criar endpoint novo:** listar filtrado por tenant não basta. IDs são sequenciais,
então qualquer rota que receba `{id}` precisa checar o tenant do registro, não só esconder
da listagem.

---

## 8. Banco de dados — tabelas principais

```
companies        slug (PK), name, logo_*, active, products linked via company_products
users            id, email, password, role, tenant_slug → companies.slug, permissions(JSON), active
products         id, code, name, category, price, stock, variations(JSON), active
orders           id, tenant_slug, title, status, items, notes, events, files
audit_logs       action, entity_*, user_*, tenant_slug, details, created_at
product_lots     creditos: cada entrada e um lote com validade (18 meses)
product_movements  livro-razao de creditos (saldo = saldo_posterior do ultimo)
product_movement_lots  alocacao de cada saida/estorno nos lotes
personal_access_tokens   Sanctum (Bearer tokens)
cache, cache_locks, sessions   Laravel framework tables
```

Migrations em `backend-new/database/migrations/`. As mais recentes (2026-05-04) criam `cache` e `sessions` — necessárias porque `.env` tem `CACHE_STORE=database` e `SESSION_DRIVER=database`.

---

## 9. Variáveis de ambiente

### 9.1 Backend `.env` (não comitado)

Em produção:
```
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:...
APP_URL=https://gestaodenvios.com.br

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=gestaodeenvios
DB_USERNAME=...
DB_PASSWORD=...

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

FRONTEND_URL=https://gestaodenvios.com.br
SANCTUM_STATEFUL_DOMAINS=gestaodenvios.com.br

# Opcional — WhatsApp (Z-API ou similar) para envio de credenciais
WHATSAPP_API_URL=...
WHATSAPP_API_TOKEN=...
```

Em local: `DB_CONNECTION=sqlite`, `APP_ENV=local`, `APP_DEBUG=true`.

### 9.2 Frontend `vixcard-platform/.env`

```
VITE_API_URL=https://gestaodenvios.com.br/api
```

O frontend usa `/api` relativo no `lib/api.ts`, mas mantenha a variável correta caso algum código futuro use ela direto. **Nunca coloque IP/HTTP** — mixed content quebra o site em HTTPS.

---

## 10. Bugs históricos já corrigidos (para contexto)

Estes foram resolvidos em sessões anteriores. Documentando para evitar regressão.

| Bug | Causa | Onde corrigido |
|---|---|---|
| Variação de produto não persistia ao excluir todas | Frontend mandava `undefined` em vez de `[]`; `JSON.stringify` omite undefined | `Products.tsx` |
| Permissões de usuário não salvavam | Frontend não enviava o campo + backend não validava/aceitava | `DataContext.tsx` + `UserController.php` |
| Alterar senha não funcionava | Função do frontend só mostrava toast, nunca chamava a API | `EmpresaDetalhe.tsx` |
| Usuário criado por tenant_admin não aparecia na lista | API `/companies` é super_admin-only; frontend agrupava por company → array vazio → sumia | `Users.tsx` (grupo sintético do tenant) |
| Senha auto-gerada ficava perdida | Backend gerava mas não exibia ao admin; sem campo de senha no form | `UserController.php` (aceita password opcional) + `Users.tsx` (campo + toast) |
| Race condition no ID de pedido | `max(id)+1` sem lock | `Order.php` (DB::transaction + lockForUpdate) |
| Sem rate limiting | API exposta a brute force | `AppServiceProvider.php` + `bootstrap/app.php` (`throttleApi`) |
| Login redirecionava para `/{tenant}/login` | Antes do login universal, URL exigia tenant | Endpoint `/api/login` agora aceita sem tenant_slug; rota `/login` no React |
| **Tenant_admin podia editar e EXCLUIR produto de outra empresa** | Rota liberava `tenant_admin` e `update/toggle/destroy` faziam `findOrFail($id)` sem checar tenant. A listagem escondia os produtos dos outros, mas os IDs são sequenciais — bastava chamar `/products/1`, `/products/2`. O frontend já escondia os botões, então só era explorável via API direta. | `routes/api.php` (rota → `role:super_admin`) + `ProductController` (`denyIfNotSuperAdmin` como defesa em profundidade) |

### Checagem de tipos — use o comando certo

`npx tsc --noEmit` na pasta do frontend **não checa nada**: o `tsconfig.json` raiz tem
`files: []` e só aponta para `tsconfig.app.json` via references. Esse comando sai com 0
mesmo com erro de sintaxe. Use sempre:

```powershell
npx tsc -p tsconfig.app.json --noEmit    # ou npm run build, que roda tsc -b
```

### Erros silenciosos — padrão a seguir

Antes, várias chamadas em `DataContext` eram `.then()` sem `.catch()`. Erros viravam toasts de sucesso enganosos. **Regra:** toda chamada de API que pode falhar deve usar `async/await` no caller com `try/catch`, exibindo o `ApiError.message` no toast. Veja `Users.tsx::handleSave` como referência.

---

## 10b. Creditos de produto (menu Movimentacoes)

Cada empresa tem saldo em unidades por produto. Regras (definidas em 2026-08-23):

- **Entrada** = lote com validade de 18 meses (`CREDIT_VALIDITY_MONTHS`), lancada
  pelo super admin em Empresas -> aba Movimentacoes ou no menu Movimentacoes.
- **Saida** automatica a cada OS criada (FIFO: lote que vence primeiro paga
  primeiro). Sem saldo a OS NAO e bloqueada — fica negativo ("descoberto") e
  `CREDIT_ALERT_EMAIL` (felipegat@vixcard.com.br) recebe aviso no cruzamento.
- **Estorno** ao cancelar/arquivar/reduzir OS; devolve ao lote de origem; se o
  lote ja venceu, a devolucao expira junto. Restaurar OS volta a descontar.
- **Expiracao** lancada de forma preguicosa (primeira leitura/lancamento apos o
  vencimento) — nao depende de cron.
- Movimento e imutavel; erro se corrige com outro lancamento.
- Toda a logica fica em `app/Services/CreditoService.php` (lock por
  empresa+produto + transacao). Invariante: saldo == soma(restante dos lotes
  validos) - descoberto. OS anteriores ao recurso nao consumiram e nao estornam.
- Testes: `tests/Feature/CreditosTest.php`.

## 11. Cliente HTTP (frontend)

`vixcard-platform/src/lib/api.ts`:

- Timeout padrão: **15 segundos** (60s em uploads), via `AbortController`
- Token armazenado em `localStorage` com chave `vixcard_token`
- Erros lançam `ApiError(status, message)`; timeouts lançam `ApiTimeoutError`
- Base path: `/api` (relativo — funciona em dev e prod)

**Não fetch direto.** Sempre via `api.get/post/put/patch/delete/upload`.

---

## 12. Segurança — pontos críticos

- Sanctum + Bearer tokens (não cookies de sessão para SPA)
- CORS restrito em `config/cors.php` aos domínios do projeto
- Rate limit: 60 req/min/usuário-ou-IP na API geral; 10 req/min/IP no `/login`
- Validação de role e tenant em todos os endpoints sensíveis (ver helpers `authorizeOrder`, `authorizeUserAccess`, `allowedRolesFor`)
- Upload de arquivos restringido por MIME types (pdf, jpg, png, etc.)
- Tokens invalidados quando o usuário muda de senha (`$user->tokens()->delete()`)
- HTTPS obrigatório (Let's Encrypt)

**Pendência conhecida:** envio de credenciais via WhatsApp ainda manda senha em texto plano. Não foi corrigido — decisão consciente do dono, marcado como item #7 da revisão de segurança.

---

## 13. Logs e debugging

### 13.1 Logs do Laravel
```bash
tail -f /var/www/gestaodeenvios/backend-new/storage/logs/laravel.log
```

### 13.2 Logs do nginx
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### 13.3 Audit log da aplicação

A tabela `audit_logs` registra ações importantes (login, criação/edição/exclusão de entidades, alteração de senha). Acessível pela UI em `/vixcard/logs` (super_admin only) ou via API `GET /audit-logs`.

### 13.4 Quando um endpoint retorna 500

Habilite temporariamente `APP_DEBUG=true` no `.env`, rode `php artisan config:clear`, refaça a requisição. **Volte para `false` depois** — debug ligado vaza stack traces.

---

## 14. Convenções de código

- **Backend:** segue padrões Laravel — controllers RESTful, validações via `$request->validate()`, eloquent models com `$fillable` + `$casts`
- **Frontend:** camelCase no TS, mappers fazem a ponte para snake_case da API. Não use snake_case fora do código que conversa com a API.
- **Commits:** mensagens em português, prefixo `feat:`, `fix:`, `security:`, `refactor:` etc. Sempre com `Co-Authored-By` de quem ajudou.
- **Branch:** sempre commitar direto em `main`. Não há branch protegida (projeto pequeno). Backup foi feito em `backup/pre-security-fixes` antes de mudanças grandes.

---

## 15. Como uma nova IA deve começar uma sessão aqui

1. **Leia este arquivo inteiro.**
2. Rode `git log --oneline -20` para ver o que andou mudando.
3. Rode `git status` na raiz para ver se tem trabalho em andamento.
4. **Antes de subir qualquer coisa em produção, ler a seção 6 (Deploy) e a seção 10 (Bugs históricos).**
5. Pergunte ao Victor antes de:
   - Rodar migrations destrutivas
   - Tocar no `.env` de produção
   - Fazer push em horário comercial
   - Mudar config de nginx/php-fpm

Victor (`victoruli@gmail.com`) é o dono e prefere:
- Respostas curtas em português
- Confirmação explícita antes de comandos destrutivos
- Deploy preferencialmente à noite, com tempo para reverter se algo der errado
- Sem emojis em arquivos de código/doc

---

## 16. TODOs e pendências conhecidas

- WhatsApp envia senha em texto plano (item #7 do audit) — substituir por link de "definir senha" com token de uso único
- O bundle do frontend está com 2.5 MB minificado — considerar `build.rolldownOptions.output.codeSplitting` ou `manualChunks` para split de vendor
- Não há testes automatizados — adicionar PHPUnit no backend e Vitest no frontend
- Workers/queue ainda em `database` driver — migrar para Redis quando o volume aumentar
- Servidor tem upgrade de kernel pendente aguardando reboot — agendar janela de manutenção

---

## 17. Backup do banco de produção

Script: `backend-new/scripts/backup-db.sh` (versionado no repo, instalado no servidor no mesmo caminho).

- **Agendamento:** cron diário às `06:00 UTC` = **03:00 horário de Brasília**
- **Destino local:** `/var/backups/gestaodeenvios/`
- **Destino off-site:** Google Drive, pasta `backups-gestaodeenvios` (via rclone, remote `gdrive`)
- **Retenção:** 14 dias nos dois lados (rotação automática)
- **Log:** `/var/log/gestaodeenvios-backup.log`

Gera **dois arquivos por dia**:

| Arquivo | Conteúdo | Tamanho (ago/2026) |
|---|---|---|
| `gestaodeenvios_AAAA-MM-DD_HH-MM-SS.sql.gz` | dump do banco | ~300 KB |
| `anexos_AAAA-MM-DD_HH-MM-SS.tar.gz` | `storage/app/public` | ~55 MB (de 544 MB) |

Os anexos precisam entrar porque o banco guarda apenas o **caminho** do arquivo, nunca o
conteúdo — restaurar só o dump listaria os anexos com nome e tamanho, mas todo download
daria erro.

O **`.env` fica de fora de propósito**: levaria `APP_KEY` e senha do banco para o Google
Drive. Perder o `APP_KEY` só obriga os usuários a entrar de novo (não há coluna
criptografada no banco), então o risco não compensa. Guarde uma cópia dele num
gerenciador de senhas.

**Quando revisar a estratégia:** o pacote de anexos é refeito inteiro todo dia. Isso é
irrelevante em 55 MB, mas se a pasta `storage/app/public` passar de **2 GB**, troque para
sincronização incremental (`rclone sync` da pasta, em vez de `tar` diário).

O rclone usa OAuth com escopo `drive.file` — alcança **apenas os arquivos que ele mesmo cria**,
não o resto do Drive. Config em `/root/.config/rclone/rclone.conf` (contém refresh token, `chmod 600`).
Se o token for comprometido, revogue em https://myaccount.google.com/permissions e refaça
o `rclone config`.

O script lê credenciais do `.env` (sem senha hardcoded), usa `--single-transaction` para não travar
tabelas em uso, e `--no-tablespaces` porque o usuário da aplicação não tem `PROCESS` privilege.
Falha com exit 1 se o dump sair menor que 1 KB (proteção contra falha silenciosa).

### Rodar backup manual
```bash
/var/www/gestaodeenvios/backend-new/scripts/backup-db.sh
```

### Restaurar os anexos
```bash
tar -xzf /var/backups/gestaodeenvios/anexos_ARQUIVO.tar.gz -C /var/www/gestaodeenvios/backend-new/storage/app/
chown -R www-data:www-data /var/www/gestaodeenvios/backend-new/storage/app/public
```

### Verificar se um backup está íntegro
```bash
zcat /var/backups/gestaodeenvios/ARQUIVO.sql.gz | grep "CREATE TABLE"
```
Deve listar 14 tabelas: `audit_logs`, `cache`, `cache_locks`, `companies`, `company_products`,
`migrations`, `order_events`, `order_items`, `order_notes`, `orders`, `personal_access_tokens`,
`products`, `sessions`, `users`.

### Teste de restauração

**Último teste: 2026-08-23**, com o dump `gestaodeenvios_2026-08-23_06-00-01.sql.gz`
(1,6 MB; 3,3 MB descomprimido) baixado do Google Drive e restaurado num banco
descartável no MySQL local. Resultado: 14 tabelas, 3 empresas, 15 usuários, 176 OS,
770 itens, 2.053 eventos, 3.173 logs; zero registros órfãos; a OS mais recente do dump
(ORD-195, 21/08) abriu com itens e eventos. Banco de teste apagado ao final.

Repetir a cada trimestre ou depois de mudar o script de backup. Roteiro: baixar o dump
mais recente do Drive, `gzip -t` para integridade, `CREATE DATABASE vixcard_restore_teste`,
`zcat ARQUIVO | mysql vixcard_restore_teste`, conferir contagens e órfãos, `DROP DATABASE`.

### Restaurar (CUIDADO — sobrescreve o banco)
```bash
zcat /var/backups/gestaodeenvios/ARQUIVO.sql.gz | mysql -u vixcard -p gestaodeenvios
```
Nunca rode isso em produção sem confirmar com o Victor antes.

---

**Última atualização:** 2026-08-22 — secao 4 (ambiente local) corrigida: senha `senha123`, porta 5175, MySQL no WSL, `dev.ps1`.
