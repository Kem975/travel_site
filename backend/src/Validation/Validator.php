<?php

declare(strict_types=1);

namespace App\Validation;

use DateTimeImmutable;

/**
 * Small fluent validator. The frontend uses Zod, but the server never trusts the
 * client — every write is validated here too.
 */
final class Validator
{
    /** @var array<string,string> */
    private array $errors = [];

    /** @param array<string,mixed> $data */
    public function __construct(private array $data)
    {
    }

    public function required(string $field): self
    {
        $value = $this->data[$field] ?? null;
        if ($value === null || (is_string($value) && trim($value) === '')) {
            $this->add($field, 'is required');
        }
        return $this;
    }

    public function stringMax(string $field, int $max): self
    {
        $value = $this->data[$field] ?? null;
        if (is_string($value) && mb_strlen($value) > $max) {
            $this->add($field, "must be at most {$max} characters");
        }
        return $this;
    }

    /** @param list<string> $allowed */
    public function in(string $field, array $allowed): self
    {
        $value = $this->data[$field] ?? null;
        if ($value !== null && $value !== '' && !in_array($value, $allowed, true)) {
            $this->add($field, 'is invalid');
        }
        return $this;
    }

    public function dateOrNull(string $field): self
    {
        $value = $this->data[$field] ?? null;
        if ($value !== null && $value !== '' && !$this->isDate((string) $value)) {
            $this->add($field, 'must be a valid date (YYYY-MM-DD)');
        }
        return $this;
    }

    public function floatRange(string $field, float $min, float $max): self
    {
        $value = $this->data[$field] ?? null;
        if ($value === null || $value === '') {
            return $this;
        }
        if (!is_numeric($value)) {
            $this->add($field, 'must be a number');
        } elseif ((float) $value < $min || (float) $value > $max) {
            $this->add($field, "must be between {$min} and {$max}");
        }
        return $this;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    /** @return array<string,string> */
    public function errors(): array
    {
        return $this->errors;
    }

    private function add(string $field, string $message): void
    {
        $label = ucfirst(str_replace('_', ' ', $field));
        $this->errors[$field] ??= "{$label} {$message}.";
    }

    private function isDate(string $value): bool
    {
        $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    }
}
