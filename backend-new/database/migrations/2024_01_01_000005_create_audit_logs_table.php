<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('action');
            $table->string('entity_type');
            $table->string('entity_id');
            $table->string('entity_name');
            $table->string('user_name');
            $table->string('user_email');
            $table->string('user_role');
            $table->string('tenant_slug');
            $table->text('details')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_slug', 'created_at']);
            $table->index('entity_type');
            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
