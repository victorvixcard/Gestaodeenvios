<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Solicitacoes de cancelamento de OS.
 *
 * Regra do Victor: a empresa cliente cancela a OS por conta propria so nos
 * primeiros 15 minutos. Depois disso ela SOLICITA o cancelamento, e a
 * VIXCard aprova ou rejeita com um motivo que fica no historico.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cancellation_requests', function (Blueprint $table) {
            $table->id();
            $table->string('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            $table->string('tenant_slug', 50)->index();
            $table->foreignId('requested_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('requested_by');          // nome, preservado mesmo se o usuario sumir
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $table->string('decided_by')->nullable();
            $table->text('decision_reason')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cancellation_requests');
    }
};
