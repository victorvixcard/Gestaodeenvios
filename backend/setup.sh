#!/usr/bin/env bash
# Script de setup do backend VIXCard
# Rode este script na raiz do projeto backend após clonar

set -e

echo "==> Instalando dependências..."
composer install

echo "==> Copiando .env..."
cp .env.example .env

echo "==> Gerando chave da aplicação..."
php artisan key:generate

echo ""
echo "⚠️  Edite o arquivo .env com os dados do banco MySQL antes de continuar."
echo "    DB_DATABASE, DB_USERNAME, DB_PASSWORD"
echo ""
read -p "Pressione ENTER após configurar o .env..."

echo "==> Rodando migrations..."
php artisan migrate

echo "==> Rodando seeders..."
php artisan db:seed

echo ""
echo "✅ Backend configurado com sucesso!"
echo ""
echo "Credenciais de acesso inicial:"
echo "  Super Admin : admin@vixcard.com.br / password"
echo "  MedSênior   : gerente@medsenior.com.br / password"
echo "  Unimed      : gerente@unimed.com.br / password"
echo ""
echo "Para iniciar o servidor de desenvolvimento:"
echo "  php artisan serve"
echo ""
echo "Para agendar notificações automáticas (cron), adicione ao crontab:"
echo "  * * * * * cd /caminho/do/backend && php artisan schedule:run >> /dev/null 2>&1"
