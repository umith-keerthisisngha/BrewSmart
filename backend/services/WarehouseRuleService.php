<?php
declare(strict_types=1);

final class WarehouseRuleService
{
    public const MAX_BAGS_PER_LOCATION = 10;
    public const LEVELS = ['A','B','C','D','E','F'];

    public static function effectiveBagCapacity(array $location): int
    {
        $dbCapacity = isset($location['capacity_bags']) ? (int)$location['capacity_bags'] : self::MAX_BAGS_PER_LOCATION;
        return max(0, min(self::MAX_BAGS_PER_LOCATION, $dbCapacity));
    }

    public static function fallbackAllowedLevels(float $bagWeight): array
    {
        return ($bagWeight >= 50.0 && $bagWeight <= 65.0) ? ['A','B','C'] : self::LEVELS;
    }

    public static function validatesLevel(float $bagWeight, string $level): bool
    {
        return in_array(strtoupper($level), self::fallbackAllowedLevels($bagWeight), true);
    }
}
