<?php

return [
    'paths'                    => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods'          => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins'          => [
        env('FRONTEND_URL', 'http://localhost:5173'),
        'https://gestaodeenvios-two.vercel.app',
        'https://gestaodenvios.com.br',
        'https://www.gestaodenvios.com.br',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers'          => ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    'exposed_headers'          => [],
    'max_age'                  => 0,
    'supports_credentials'     => true,
];
