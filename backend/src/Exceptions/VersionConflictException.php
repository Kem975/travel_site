<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/** Thrown when an article save is based on a stale version (optimistic lock). */
final class VersionConflictException extends RuntimeException
{
}
