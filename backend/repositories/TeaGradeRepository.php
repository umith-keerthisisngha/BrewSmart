<?php
declare(strict_types=1);
final class TeaGradeRepository {
    public function __construct(private PDO $pdo) {}
    public function findByCode(string $code): ?array {
        $st=$this->pdo->prepare('SELECT grade_id,grade_code,grade_name,packing_density,min_bag_weight,max_bag_weight FROM tea_grades WHERE grade_code=? LIMIT 1');
        $st->execute([trim($code)]); $row=$st->fetch(); return $row ?: null;
    }
}
