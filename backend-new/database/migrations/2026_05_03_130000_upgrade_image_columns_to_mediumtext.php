<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // TEXT = 65 KB max — insuficiente para base64 de imagens reais.
        // MEDIUMTEXT = 16 MB — adequado para imagens recortadas via canvas.
        DB::statement('ALTER TABLE products  MODIFY image_url  MEDIUMTEXT NULL');
        DB::statement('ALTER TABLE products  MODIFY video_url  MEDIUMTEXT NULL');
        DB::statement('ALTER TABLE users     MODIFY avatar_url MEDIUMTEXT NULL');
        DB::statement('ALTER TABLE companies MODIFY logo_url   MEDIUMTEXT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE products  MODIFY image_url  TEXT NULL');
        DB::statement('ALTER TABLE products  MODIFY video_url  TEXT NULL');
        DB::statement('ALTER TABLE users     MODIFY avatar_url TEXT NULL');
        DB::statement('ALTER TABLE companies MODIFY logo_url   TEXT NULL');
    }
};
