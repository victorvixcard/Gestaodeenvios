<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category');
            $table->string('image_url')->nullable();
            $table->string('video_url')->nullable();
            $table->integer('stock')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Produtos permitidos por empresa (pivot)
        Schema::create('company_products', function (Blueprint $table) {
            $table->string('company_slug');
            $table->foreignId('product_id');

            $table->primary(['company_slug', 'product_id']);
            $table->foreign('company_slug')->references('slug')->on('companies')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_products');
        Schema::dropIfExists('products');
    }
};
