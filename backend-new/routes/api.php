<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SectorController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FileController;
use Illuminate\Support\Facades\Route;

// ── Autenticação ───────────────────────────────────────────────────────────
// Máximo de 10 tentativas por minuto por IP — proteção contra brute-force
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

// ── Branding público do tenant ─────────────────────────────────────────────
// Necessário ANTES do login, para a tela /{tenant}/login exibir nome e logo.
// Devolve apenas a identidade visual — nunca usuários, produtos ou pedidos.
// Antes disso os tenants eram hardcoded no bundle do frontend, o que fazia
// empresa criada pela UI cair em 404 até alguém editar o código e publicar.
Route::get('/tenants/{slug}', [CompanyController::class, 'publicShow']);

// ── Rotas protegidas ───────────────────────────────────────────────────────
Route::middleware(['auth:sanctum'])->group(function () {

    Route::get('/me', [AuthController::class, 'me']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // ── Ordens de Serviço ──────────────────────────────────────────────────
    Route::prefix('orders')->group(function () {
        Route::get('/',              [OrderController::class, 'index']);
        Route::post('/',             [OrderController::class, 'store']);
        Route::get('/{id}',          [OrderController::class, 'show']);
        Route::patch('/{id}/status', [OrderController::class, 'updateStatus']);
        Route::put('/{id}/items',    [OrderController::class, 'updateItems'])
            ->middleware('role:super_admin');
        Route::post('/{id}/notes',   [OrderController::class, 'addNote']);
        Route::post('/{id}/cancel',  [OrderController::class, 'cancel']);
        Route::post('/{id}/files',   [OrderController::class, 'uploadFile']);
        Route::delete('/{id}/files/{fileIndex}', [OrderController::class, 'deleteFile']);

        // Exclusão definitiva — somente super admin
        Route::delete('/{id}', [OrderController::class, 'destroy'])
            ->middleware('role:super_admin');
    });

    // ── Produtos ───────────────────────────────────────────────────────────
    // O catálogo é da VIXCard. Empresas apenas LISTAM para montar pedidos —
    // criar/editar/excluir é exclusivo do super admin. Antes isso liberava
    // tenant_admin, o que permitia a uma empresa apagar produto de outra.
    // ── Categorias ─────────────────────────────────────────────────────────
    // Listar é liberado porque o formulário de produto precisa das opções.
    // Criar/editar/excluir é do super admin, mesma regra do catálogo.
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::prefix('categories')->middleware('role:super_admin')->group(function () {
        Route::post('/',             [CategoryController::class, 'store']);
        Route::put('/{id}',          [CategoryController::class, 'update']);
        Route::delete('/{id}',       [CategoryController::class, 'destroy']);
        Route::patch('/{id}/toggle', [CategoryController::class, 'toggleActive']);
    });

    // ── Papéis ─────────────────────────────────────────────────────────────
    // Papéis dinâmicos por cima dos níveis de acesso. Listar é liberado
    // porque o cadastro de usuário precisa das opções (tenant_admin recebe
    // a lista já filtrada, sem papéis de nível super_admin).
    Route::get('/roles', [RoleController::class, 'index']);
    Route::prefix('roles')->middleware('role:super_admin')->group(function () {
        Route::post('/',             [RoleController::class, 'store']);
        Route::put('/{id}',          [RoleController::class, 'update']);
        Route::delete('/{id}',       [RoleController::class, 'destroy']);
        Route::patch('/{id}/toggle', [RoleController::class, 'toggleActive']);
    });

    // ── Setores ────────────────────────────────────────────────────────────
    // Organizam a equipe interna da VIXCard. Listar é liberado porque o
    // cadastro de usuário precisa das opções; escrita é do super admin.
    Route::get('/sectors', [SectorController::class, 'index']);
    Route::prefix('sectors')->middleware('role:super_admin')->group(function () {
        Route::post('/',             [SectorController::class, 'store']);
        Route::put('/{id}',          [SectorController::class, 'update']);
        Route::delete('/{id}',       [SectorController::class, 'destroy']);
        Route::patch('/{id}/toggle', [SectorController::class, 'toggleActive']);
    });

    Route::get('/products', [ProductController::class, 'index']); // todos podem listar
    Route::prefix('products')->middleware('role:super_admin')->group(function () {
        Route::post('/',        [ProductController::class, 'store']);
        Route::put('/{id}',     [ProductController::class, 'update']);
        Route::delete('/{id}',  [ProductController::class, 'destroy']);
        Route::patch('/{id}/toggle', [ProductController::class, 'toggleActive']);

        // Aba "Prazo de alerta" dentro do cadastro do produto
        Route::get('/{id}/deadlines', [ProductController::class, 'deadlines']);
        Route::put('/{id}/deadlines', [ProductController::class, 'syncDeadlines']);
    });

    // ── Empresas (super admin only) ────────────────────────────────────────
    Route::prefix('companies')->middleware('role:super_admin')->group(function () {
        Route::get('/',             [CompanyController::class, 'index']);
        Route::post('/',            [CompanyController::class, 'store']);
        Route::get('/{slug}',       [CompanyController::class, 'show']);
        Route::put('/{slug}',       [CompanyController::class, 'update']);
        Route::patch('/{slug}/toggle', [CompanyController::class, 'toggleActive']);
        Route::get('/{slug}/products', [CompanyController::class, 'products']);
        Route::put('/{slug}/products', [CompanyController::class, 'syncProducts']);

        // Colaboradores que atendem a empresa (OS nova cai para eles)
        Route::put('/{slug}/attendants', [CompanyController::class, 'syncAttendants']);

        // Linha do tempo (fluxo de etapas) da empresa — null volta ao padrão
        Route::put('/{slug}/timeline', [CompanyController::class, 'syncTimeline']);

        // Catálogo da empresa: prazo e preço de cada produto liberado
        Route::get('/{slug}/catalog', [CompanyController::class, 'catalog']);
        Route::put('/{slug}/catalog', [CompanyController::class, 'syncCatalog']);
    });

    // ── Usuários ───────────────────────────────────────────────────────────
    Route::prefix('users')->middleware('role:super_admin,tenant_admin')->group(function () {
        Route::get('/',             [UserController::class, 'index']);
        Route::post('/',            [UserController::class, 'store']);
        Route::put('/{id}',         [UserController::class, 'update']);
        Route::patch('/{id}/toggle', [UserController::class, 'toggleActive']);
        Route::patch('/{id}/password', [UserController::class, 'changePassword']);
        Route::post('/{id}/send-credentials', [UserController::class, 'sendCredentials']);
    });

    // ── Logs de auditoria (super admin only) ───────────────────────────────
    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('role:super_admin');
});
