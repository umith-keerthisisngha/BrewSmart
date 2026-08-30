<?php
declare(strict_types=1);

final class AIClient
{
    public function __construct(private string $baseUrl = '')
    {
        $this->baseUrl = rtrim($baseUrl ?: (getenv('BREWSMART_AI_URL') ?: 'http://127.0.0.1:5001'), '/');
    }

    public function rank(array $candidates, int $topK = 50): ?array
    {
        if (!$candidates) return [];
        $payload = json_encode(['candidates'=>$candidates,'top_k'=>$topK], JSON_UNESCAPED_UNICODE);
        $context = stream_context_create([
            'http'=>[
                'method'=>'POST',
                'header'=>"Content-Type: application/json\r\nAccept: application/json\r\n",
                'content'=>$payload,
                'timeout'=>1.25,
                'ignore_errors'=>true,
            ]
        ]);
        try {
            $raw = @file_get_contents($this->baseUrl.'/recommend', false, $context);
            if ($raw === false) return null;
            $json = json_decode($raw, true);
            if (!is_array($json) || empty($json['success']) || !isset($json['data']['ranked']) || !is_array($json['data']['ranked'])) return null;
            return $json['data'];
        } catch (Throwable $e) {
            return null;
        }
    }
}
