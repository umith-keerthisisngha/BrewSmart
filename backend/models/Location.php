<?php
declare(strict_types=1);
final class Location {
    public function __construct(public int $id, public string $code, public string $level, public int $capacityBags, public int $occupiedBags, public float $maxWeight, public float $currentWeight, public string $status) {}
    public function remainingBags(): int { return max(0, min(10,$this->capacityBags)-$this->occupiedBags); }
    public function remainingWeight(): float { return max(0.0,$this->maxWeight-$this->currentWeight); }
}
