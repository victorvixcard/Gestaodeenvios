<?php

use Illuminate\Support\Facades\Schedule;

// Verifica OS em atraso e notifica via WhatsApp toda manhã às 08:00
Schedule::command('orders:notify-overdue')->dailyAt('08:00');
