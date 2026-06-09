<?php

declare(strict_types=1);

namespace App\Support;

use DOMComment;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;

/**
 * Strict DOM allowlist sanitizer for richText block HTML (PLAN_REVIEW A3).
 * The allowed tags match exactly what the TipTap editor is configured to emit;
 * everything else is unwrapped or dropped, and attributes are stripped (links keep
 * a validated href + safe rel/target).
 */
final class HtmlSanitizer
{
    private const ALLOWED = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'code', 'pre'];

    public static function clean(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }

        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML(
            '<?xml encoding="UTF-8"?><body>' . $html . '</body>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();

        $body = $doc->getElementsByTagName('body')->item(0);
        if (!$body instanceof DOMElement) {
            return '';
        }
        self::cleanChildren($body);

        $out = '';
        foreach (iterator_to_array($body->childNodes) as $child) {
            $out .= $doc->saveHTML($child);
        }
        return trim($out);
    }

    private static function cleanChildren(DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMComment) {
                $node->removeChild($child);
                continue;
            }
            if ($child instanceof DOMText) {
                continue;
            }
            if (!$child instanceof DOMElement) {
                $node->removeChild($child);
                continue;
            }

            $tag = strtolower($child->tagName);
            if ($tag === 'script' || $tag === 'style') {
                $node->removeChild($child);
                continue;
            }

            self::cleanChildren($child);

            if (!in_array($tag, self::ALLOWED, true)) {
                // Unwrap: keep the (already-cleaned) children, drop the element.
                while ($child->firstChild !== null) {
                    $node->insertBefore($child->firstChild, $child);
                }
                $node->removeChild($child);
                continue;
            }

            self::stripAttributes($child, $tag);
        }
    }

    private static function stripAttributes(DOMElement $element, string $tag): void
    {
        foreach (iterator_to_array($element->attributes) as $attr) {
            $keep = $tag === 'a' && strtolower($attr->name) === 'href' && self::safeHref($attr->value);
            if (!$keep) {
                $element->removeAttribute($attr->name);
            }
        }
        // Only genuinely external (http/https) links open in a new tab; internal
        // links (/ and #) and mailto/tel stay in the current tab.
        if ($tag === 'a' && $element->hasAttribute('href')
            && preg_match('#^https?:#i', trim($element->getAttribute('href'))) === 1) {
            $element->setAttribute('rel', 'noopener noreferrer nofollow');
            $element->setAttribute('target', '_blank');
        }
    }

    private static function safeHref(string $href): bool
    {
        $href = trim($href);
        // Reject empty and protocol-relative (//evil.example resolves off-site).
        if ($href === '' || str_starts_with($href, '//')) {
            return false;
        }
        // In-page anchor or same-site absolute path.
        if (str_starts_with($href, '#') || str_starts_with($href, '/')) {
            return true;
        }
        // Explicit safe schemes only — blocks javascript:, data:, vbscript:, etc.
        return preg_match('#^(https?:|mailto:|tel:)#i', $href) === 1;
    }
}
