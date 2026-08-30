<?php
declare(strict_types=1);
final class StockMovement { public function __construct(public int $id, public string $type, public int $bags, public ?string $referenceNo, public string $createdAt) {} }
