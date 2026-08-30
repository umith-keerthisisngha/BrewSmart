<?php
declare(strict_types=1);
final class Allocation {
    public function __construct(public int $locationId, public string $locationCode, public int $bags, public float $weight, public float $score, public string $reason) {}
}
