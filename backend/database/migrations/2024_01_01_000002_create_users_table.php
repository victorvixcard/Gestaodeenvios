<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('role', ['super_admin', 'tenant_admin', 'operator'])->default('operator');
            $table->string('tenant_slug');
            $table->string('avatar_initials', 2);
            $table->boolean('active')->default(true);
            $table->json('permissions')->nullable();
            $table->string('whatsapp', 20)->nullable();
            $table->rememberToken();
            $table->timestamps();

            $table->foreign('tenant_slug')->references('slug')->on('companies')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
