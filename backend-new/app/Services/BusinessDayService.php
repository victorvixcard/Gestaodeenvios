<?php

namespace App\Services;

use Carbon\Carbon;

class BusinessDayService
{
    // Feriados fixos: [mês, dia, nome]
    private array $fixedNational = [
        [1,  1,  'Confraternização Universal'],
        [4,  21, 'Tiradentes'],
        [5,  1,  'Dia do Trabalho'],
        [9,  7,  'Independência do Brasil'],
        [10, 12, 'Nossa Senhora Aparecida'],
        [11, 2,  'Finados'],
        [11, 15, 'Proclamação da República'],
        [11, 20, 'Consciência Negra'],
        [12, 25, 'Natal'],
    ];

    private array $fixedStateES = [
        [5, 23, 'Colonização do Espírito Santo'],
    ];

    private array $fixedMunicipalSerra = [
        [6, 29, 'São Pedro e São Paulo'],
    ];

    // Feriados variáveis: ano => ['YYYY-MM-DD' => 'Nome']
    private array $variable = [
        2024 => [
            '2024-02-12' => 'Carnaval',
            '2024-02-13' => 'Carnaval',
            '2024-03-29' => 'Sexta-feira Santa',
            '2024-05-30' => 'Corpus Christi',
        ],
        2025 => [
            '2025-03-03' => 'Carnaval',
            '2025-03-04' => 'Carnaval',
            '2025-04-18' => 'Sexta-feira Santa',
            '2025-06-19' => 'Corpus Christi',
        ],
        2026 => [
            '2026-02-16' => 'Carnaval',
            '2026-02-17' => 'Carnaval',
            '2026-04-03' => 'Sexta-feira Santa',
            '2026-06-04' => 'Corpus Christi',
        ],
        2027 => [
            '2027-02-08' => 'Carnaval',
            '2027-02-09' => 'Carnaval',
            '2027-03-26' => 'Sexta-feira Santa',
            '2027-05-27' => 'Corpus Christi',
        ],
    ];

    public function isHoliday(Carbon $date): bool
    {
        $month = (int) $date->format('m');
        $day   = (int) $date->format('d');
        $iso   = $date->format('Y-m-d');
        $year  = (int) $date->format('Y');

        $allFixed = array_merge(
            $this->fixedNational,
            $this->fixedStateES,
            $this->fixedMunicipalSerra
        );

        foreach ($allFixed as [$m, $d]) {
            if ($m === $month && $d === $day) return true;
        }

        return isset($this->variable[$year][$iso]);
    }

    public function getHolidayName(Carbon $date): ?string
    {
        $month = (int) $date->format('m');
        $day   = (int) $date->format('d');
        $iso   = $date->format('Y-m-d');
        $year  = (int) $date->format('Y');

        $allFixed = array_merge(
            $this->fixedNational,
            $this->fixedStateES,
            $this->fixedMunicipalSerra
        );

        foreach ($allFixed as [$m, $d, $name]) {
            if ($m === $month && $d === $day) return $name;
        }

        return $this->variable[$year][$iso] ?? null;
    }

    public function isBusinessDay(Carbon $date): bool
    {
        return !$date->isWeekend() && !$this->isHoliday($date);
    }

    public function addBusinessDays(Carbon $from, int $days): Carbon
    {
        $date  = $from->copy()->startOfDay();
        $added = 0;

        while ($added < $days) {
            $date->addDay();
            if ($this->isBusinessDay($date)) {
                $added++;
            }
        }

        return $date;
    }

    public function businessDaysBetween(Carbon $from, Carbon $to): int
    {
        $cursor = $from->copy()->startOfDay();
        $end    = $to->copy()->startOfDay();
        $count  = 0;

        while ($cursor->lt($end)) {
            $cursor->addDay();
            if ($this->isBusinessDay($cursor)) $count++;
        }

        return $count;
    }

    public function getHolidaysInMonth(int $year, int $month): array
    {
        $holidays = [];

        foreach (array_merge($this->fixedNational, $this->fixedStateES, $this->fixedMunicipalSerra) as [$m, $d, $name]) {
            if ($m === $month) {
                $holidays[] = [
                    'date' => Carbon::create($year, $month, $d)->format('Y-m-d'),
                    'name' => $name,
                    'type' => $m === 6 && $d === 29 ? 'municipal' : ($m === 5 && $d === 23 ? 'estadual' : 'nacional'),
                ];
            }
        }

        foreach (($this->variable[$year] ?? []) as $iso => $name) {
            if ((int) substr($iso, 5, 2) === $month) {
                $holidays[] = ['date' => $iso, 'name' => $name, 'type' => 'nacional'];
            }
        }

        usort($holidays, fn($a, $b) => strcmp($a['date'], $b['date']));

        return $holidays;
    }
}
