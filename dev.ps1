# Sobe o ambiente local do Gestao de Envios.
#
#   .\dev.ps1          sobe backend (8001) e frontend (5175)
#   .\dev.ps1 -Stop    derruba os dois
#   .\dev.ps1 -Reset   recria o banco de demonstracao e sobe
#
# As janelas ficam minimizadas na barra de tarefas. Fechar a janela derruba
# aquele servidor.

param([switch]$Stop, [switch]$Reset)

$raiz = $PSScriptRoot
$php  = "C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe"

function Porta-Ativa($p) {
    [bool](Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)
}

function Derruba($p, $nome) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    if (-not $c) { Write-Host "  $nome ja estava parado" -ForegroundColor DarkGray; return }
    foreach ($x in $c) {
        try { Stop-Process -Id $x.OwningProcess -Force -ErrorAction Stop; Write-Host "  $nome parado (PID $($x.OwningProcess))" -ForegroundColor Yellow }
        catch { Write-Host "  nao consegui parar o PID $($x.OwningProcess)" -ForegroundColor Red }
    }
}

if ($Stop) {
    Write-Host "Parando..." -ForegroundColor Cyan
    Derruba 5175 "frontend"
    Derruba 8001 "backend"
    return
}

if ($Reset) {
    Write-Host "Recriando o banco de demonstracao..." -ForegroundColor Cyan
    Push-Location "$raiz\backend-new"
    & $php artisan migrate --force
    & $php artisan db:seed --class=DemoSeeder --force
    Pop-Location
    Write-Host ""
}

Write-Host "Subindo o ambiente local..." -ForegroundColor Cyan

if (Porta-Ativa 8001) {
    Write-Host "  backend  ja esta de pe (8001)" -ForegroundColor DarkGray
} else {
    $b = Start-Process -FilePath $php `
        -ArgumentList "artisan","serve","--host=127.0.0.1","--port=8001" `
        -WorkingDirectory "$raiz\backend-new" -WindowStyle Minimized -PassThru
    Write-Host "  backend  iniciado  PID $($b.Id)" -ForegroundColor Green
}

if (Porta-Ativa 5175) {
    Write-Host "  frontend ja esta de pe (5175)" -ForegroundColor DarkGray
} else {
    $f = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c","npm run dev -- --port 5175" `
        -WorkingDirectory "$raiz\vixcard-platform" -WindowStyle Minimized -PassThru
    Write-Host "  frontend iniciado  PID $($f.Id)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Aguardando responder..." -NoNewline
$ok = $false
foreach ($i in 1..30) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5175/" -TimeoutSec 5 -UseBasicParsing
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { Write-Host "." -NoNewline }
}
Write-Host ""

if ($ok) {
    Write-Host ""
    Write-Host "  Pronto: http://localhost:5175" -ForegroundColor Green
    Write-Host "  Senha de todos os usuarios: senha123" -ForegroundColor DarkGray
} else {
    Write-Host "  Nao respondeu a tempo. Veja as janelas minimizadas na barra." -ForegroundColor Red
}
