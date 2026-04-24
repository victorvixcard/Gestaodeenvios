<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->string('id')->primary();  // ex: ORD-001
            $table->string('tenant_slug');
            $table->string('title');
            $table->enum('status', ['pending', 'started', 'production', 'finishing', 'done', 'cancelled'])
                  ->default('pending');
            $table->string('requested_by');
            $table->string('assigned_to')->nullable();
            $table->text('cancel_reason')->nullable();
            $table->date('deadline');          // prazo em dias úteis calculado
            $table->json('files')->nullable();
            $table->timestamps();

            $table->foreign('tenant_slug')->references('slug')->on('companies')->onDelete('cascade');
            $table->index(['tenant_slug', 'status']);
            $table->index('deadline');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->string('order_id');
            $table->foreignId('product_id')->nullable();
            $table->string('product_name');
            $table->integer('quantity');
            $table->text('specifications')->nullable();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });

        Schema::create('order_notes', function (Blueprint $table) {
            $table->id();
            $table->string('order_id');
            $table->string('author_name');
            $table->enum('author_role', ['super_admin', 'tenant_admin', 'operator']);
            $table->text('content');
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });

        Schema::create('order_events', function (Blueprint $table) {
            $table->id();
            $table->string('order_id');
            $table->enum('type', ['created', 'status_change', 'note', 'file_upload', 'cancel']);
            $table->string('description');
            $table->string('author_name');
            $table->string('status')->nullable();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');
        Schema::dropIfExists('order_notes');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
