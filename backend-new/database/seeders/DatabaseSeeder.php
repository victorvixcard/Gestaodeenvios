<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Company::create([
            'slug'          => 'vixcard',
            'name'          => 'VIXCard',
            'logo_color'    => '#6366f1',
            'logo_initials' => 'VX',
            'active'        => true,
        ]);

        User::create([
            'name'            => 'Victor Admin',
            'email'           => 'admin@vixcard.com.br',
            'password'        => Hash::make('password'),
            'role'            => 'super_admin',
            'tenant_slug'     => 'vixcard',
            'avatar_initials' => 'VA',
            'active'          => true,
        ]);
    }
}
