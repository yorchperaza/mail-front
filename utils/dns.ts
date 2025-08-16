// utils/dns.ts
import type { MxRecord } from '@/types/domain';

export function normalizeMx(input: unknown): MxRecord[] {
    const tryParse = (s: string) => {
        try {
            const x = JSON.parse(s);
            return Array.isArray(x) ? (x as MxRecord[]) : [];
        } catch {
            return [];
        }
    };

    if (!input) return [];

    // Already good
    if (Array.isArray(input) && input.length && typeof input[0] === 'object') {
        return input as MxRecord[];
    }

    // Case: array of string fragments split at commas
    if (Array.isArray(input) && input.length && typeof input[0] === 'string') {
        const parts = (input as string[]).map(s => s.trim());
        // 1) naive join
        let parsed = tryParse(parts.join(''));
        if (parsed.length) return parsed;
        // 2) join with commas (rebuild the JSON that was split by ',')
        parsed = tryParse(parts.join(','));
        if (parsed.length) return parsed;
        return [];
    }

    // Case: a single JSON string
    if (typeof input === 'string') {
        return tryParse(input);
    }

    return [];
}