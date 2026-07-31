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
| Banco local | SQLite |
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

- **Raiz do repo:** `C:\Users\Maquina_Estágiario\Documents\Gestaodeenvios\`
- **PHP:** `C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe`
- **Composer:** `C:\laragon\bin\composer\composer.phar` (rode com `php composer.phar ...`)
- **Node:** v20.x

### 4.2 Como rodar local

**Backend (porta 8001):**
```powershell
cd C:\Users\Maquina_Estágiario\Documents\Gestaodeenvios\backend-new
C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe artisan serve --host=127.0.0.1 --port=8001
```

**Frontend (porta 5173):**
```powershell
cd C:\Users\Maquina_Estágiario\Documents\Gestaodeenvios\vixcard-platform
node node_modules\vite\bin\vite.js
```

Acesse http://localhost:5173. O frontend chama o backend em `/api` (proxy do Vite cuida disso em dev).

### 4.3 Usuários locais (banco SQLite resetado)

| E-mail | Senha | Papel |
|---|---|---|
| admin@vixcard.com.br | password | super_admin (tenant `vixcard`) |
| ana@medsenior.com | password | tenant_admin (tenant `medsenior`) |

Se precisar resetar senhas locais de novo, use um script PHP no estilo:
```php
foreach (App\Models\User::all() as $u) {
    $u->password = Hash::make('password');
    $u->save();
}
```

---

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

### Erros silenciosos — padrão a seguir

Antes, várias chamadas em `DataContext` eram `.then()` sem `.catch()`. Erros viravam toasts de sucesso enganosos. **Regra:** toda chamada de API que pode falhar deve usar `async/await` no caller com `try/catch`, exibindo o `ApiError.message` no toast. Veja `Users.tsx::handleSave` como referência.

---

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
- Nunca foi feito um teste de restauração real do backup — vale testar num banco descartável antes de precisar de verdade

---

## 17. Backup do banco de produção

Script: `backend-new/scripts/backup-db.sh` (versionado no repo, instalado no servidor no mesmo caminho).

- **Agendamento:** cron diário às `06:00 UTC` = **03:00 horário de Brasília**
- **Destino local:** `/var/backups/gestaodeenvios/gestaodeenvios_AAAA-MM-DD_HH-MM-SS.sql.gz`
- **Destino off-site:** Google Drive, pasta `backups-gestaodeenvios` (via rclone, remote `gdrive`)
- **Retenção:** 14 dias nos dois lados (rotação automática)
- **Log:** `/var/log/gestaodeenvios-backup.log`
- **Tamanho atual:** ~292 KB por dump comprimido

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

### Verificar se um backup está íntegro
```bash
zcat /var/backups/gestaodeenvios/ARQUIVO.sql.gz | grep "CREATE TABLE"
```
Deve listar 14 tabelas: `audit_logs`, `cache`, `cache_locks`, `companies`, `company_products`,
`migrations`, `order_events`, `order_items`, `order_notes`, `orders`, `personal_access_tokens`,
`products`, `sessions`, `users`.

### Restaurar (CUIDADO — sobrescreve o banco)
```bash
zcat /var/backups/gestaodeenvios/ARQUIVO.sql.gz | mysql -u vixcard -p gestaodeenvios
```
Nunca rode isso em produção sem confirmar com o Victor antes.

---

**Última atualização:** 2026-07-31 — correção de isolamento de produtos entre tenants + backup off-site.
