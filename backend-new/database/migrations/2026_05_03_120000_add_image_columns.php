<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('avatar_url')->nullable()->after('avatar_initials');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->text('logo_url')->nullable()->after('logo_initials');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->text('image_url')->nullable()->change();
            $table->text('video_url')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_url');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('logo_url');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('image_url')->nullable()->change();
            $table->string('video_url')->nullable()->change();
        });
    }
};
