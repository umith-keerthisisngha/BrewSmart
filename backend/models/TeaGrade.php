<?php
declare(strict_types=1);
final class TeaGrade {
    public function __construct(public int $id, public string $code, public string $name, public float $packingDensity, public float $minBagWeight, public float $maxBagWeight) {}
    public function acceptsWeight(float $kg): bool { return $kg >= $this->minBagWeight && $kg <= $this->maxBagWeight; }
}
