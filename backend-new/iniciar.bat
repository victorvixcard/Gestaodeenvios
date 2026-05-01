@echo off
SET PHP=C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe
SET MYSQL=C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe

echo =========================================
echo   VIXCard Backend - Iniciando...
echo =========================================

echo.
echo [1/3] Criando banco de dados...
%MYSQL% -u root -e "CREATE DATABASE IF NOT EXISTS vixcard_gestaodeenvios CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: MySQL nao esta rodando. Abra o Laragon e clique em Start All.
    pause
    exit /b 1
)
echo OK - Banco criado.

echo.
echo [2/3] Rodando migrations...
%PHP% artisan migrate --force
if %ERRORLEVEL% NEQ 0 (
    echo ERRO nas migrations.
    pause
    exit /b 1
)
echo OK - Migrations concluidas.

echo.
echo [3/3] Rodando seeders...
%PHP% artisan db:seed --force
echo OK - Dados iniciais inseridos.

echo.
echo =========================================
echo   Backend pronto! Iniciando servidor...
echo   URL: http://localhost:8000
echo =========================================
echo.
%PHP% artisan serve --port=8001
