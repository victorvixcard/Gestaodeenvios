<?php

/**
 * Mensagens de validação em português.
 *
 * Sem este arquivo o Laravel responde em inglês, e o erro chega ao cliente
 * como "The email field must be a valid email address." num sistema que é
 * todo em português.
 *
 * Só estão aqui as regras que os controllers deste projeto realmente usam.
 * O que faltar cai no fallback em inglês, definido em config/app.php.
 */
return [

    // As frases evitam artigo antes de :attribute ("O empresa selecionado"
    // sairia errado). Onde há artigo, ele concorda com "campo" ou "valor",
    // que são fixos — assim funciona para qualquer nome de campo.
    'required'  => 'O campo :attribute é obrigatório.',
    'email'     => 'Informe um e-mail válido.',
    'unique'    => 'O valor informado em :attribute já está em uso.',
    'confirmed' => 'A confirmação de :attribute não confere.',
    'exists'    => 'Não encontramos o valor informado em :attribute.',
    'in'        => 'Valor inválido para :attribute.',
    'boolean'   => 'O campo :attribute deve ser verdadeiro ou falso.',
    'integer'   => 'O campo :attribute deve ser um número inteiro.',
    'numeric'   => 'O campo :attribute deve ser um número.',
    'string'    => 'O campo :attribute deve ser um texto.',
    'array'     => 'O campo :attribute deve ser uma lista.',
    'date'      => 'O campo :attribute não é uma data válida.',
    'regex'     => 'O formato do campo :attribute é inválido.',
    'file'      => 'O campo :attribute deve ser um arquivo.',
    'image'     => 'O campo :attribute deve ser uma imagem.',
    'extensions' => 'O arquivo deve ser do tipo: :values.',
    'mimes'      => 'O arquivo deve ser do tipo: :values.',

    'min' => [
        'numeric' => 'O campo :attribute deve ser no mínimo :min.',
        'file'    => 'O arquivo deve ter no mínimo :min kilobytes.',
        'string'  => 'O campo :attribute deve ter no mínimo :min caracteres.',
        'array'   => 'O campo :attribute deve ter no mínimo :min itens.',
    ],

    'max' => [
        'numeric' => 'O campo :attribute não pode ser maior que :max.',
        'file'    => 'O arquivo não pode ser maior que :max kilobytes.',
        'string'  => 'O campo :attribute não pode ter mais que :max caracteres.',
        'array'   => 'O campo :attribute não pode ter mais que :max itens.',
    ],

    /*
    |--------------------------------------------------------------------------
    | Nomes dos campos
    |--------------------------------------------------------------------------
    |
    | Sem isso a mensagem sairia "O campo tenant_slug é obrigatório", com o
    | nome técnico da coluna. Aqui cada campo ganha o nome que o usuário vê
    | na tela.
    |
    */
    'attributes' => [
        'name'           => 'nome',
        'email'          => 'e-mail',
        'password'       => 'senha',
        'role'           => 'perfil',
        'tenant_slug'    => 'empresa',
        'whatsapp'       => 'WhatsApp',
        'avatar_url'     => 'foto',
        'permissions'    => 'permissões',
        'slug'           => 'identificador',
        'logo_color'     => 'cor do logo',
        'logo_initials'  => 'iniciais do logo',
        'logo_url'       => 'logo',
        'title'          => 'título',
        'category'       => 'categoria',
        'description'    => 'descrição',
        'price'          => 'preço',
        'stock'          => 'estoque',
        'image_url'      => 'imagem',
        'video_url'      => 'vídeo',
        'variations'     => 'variações',
        'deadline_days'  => 'prazo em dias úteis',
        'status'         => 'status',
        'reason'         => 'motivo',
        'content'        => 'conteúdo',
        'file'           => 'arquivo',
        'items'          => 'itens',
        'quantity'       => 'quantidade',
        'product_id'     => 'produto',
        'product_ids'    => 'produtos',
        'active'         => 'ativo',
    ],

];
