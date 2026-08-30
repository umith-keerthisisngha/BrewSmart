<?php
declare(strict_types=1);
final class Inventory { public function __construct(public int $id, public string $lotNumber, public int $totalBags, public int $availableBags, public string $status) {} }
