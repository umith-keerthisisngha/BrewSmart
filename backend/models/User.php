<?php
declare(strict_types=1);
final class User {
    public function __construct(public int $id, public string $username, public string $displayName, public string $role) {}
    public function isAdmin(): bool { return $this->role === 'ADMIN'; }
}
