<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Papeis dinamicos por cima dos tres niveis fixos de acesso.
 *
 * O isolamento entre empresas se apoia na coluna users.role (super_admin /
 * tenant_admin / operator) e nos middlewares que a leem. Os papeis NAO
 * substituem isso: cada papel herda de um dos tres niveis (base_role) e o
 * que ele personaliza e a visibilidade de menus. users.role continua sendo
 * a fonte da autorizacao — o papel apenas a define, nunca a contorna.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->enum('base_role', ['super_admin', 'tenant_admin', 'operator']);
            // Menus visiveis para quem tem o papel. NULL = todos os menus que
            // o nivel de acesso ja permite (comportamento de sempre).
            $table->json('menus')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('role')
                  ->constrained('roles')->nullOnDelete();
        });

        // Papeis equivalentes aos tres niveis atuais, ja vinculados aos
        // usuarios existentes para ninguem ficar sem papel.
        $agora = now();
        DB::table('roles')->insert([
            ['name' => 'Super Administrador',      'base_role' => 'super_admin',  'menus' => null, 'active' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['name' => 'Administrador da Empresa', 'base_role' => 'tenant_admin', 'menus' => null, 'active' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['name' => 'Operador',                 'base_role' => 'operator',     'menus' => null, 'active' => true, 'created_at' => $agora, 'updated_at' => $agora],
        ]);

        foreach (DB::table('roles')->get() as $papel) {
            DB::table('users')->where('role', $papel->base_role)
                ->update(['role_id' => $papel->id]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
        });
        Schema::dropIfExists('roles');
    }
};
