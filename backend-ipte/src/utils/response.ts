
/**
 * Convert a snake_case string to camelCase.
 */
const snakeToCamel = (key: string) =>
    key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

/**
 * Check if a value is a plain object (not Date/Array/Map/etc.).
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    value !== null &&
    typeof value === "object" &&
    value.constructor === Object &&
    !Array.isArray(value);

/**
 * Recursively convert all object keys from snake_case to camelCase.
 * Leaves non-plain objects (Date, Buffer, Prisma Decimal, etc.) untouched.
 */
export function camelCaseKeysDeep<T>(input: T): T {
    if (Array.isArray(input)) {
        return input.map((item) => camelCaseKeysDeep(item)) as unknown as T;
    }

    if (!isPlainObject(input)) {
        return input;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        const camelKey = snakeToCamel(key);
        result[camelKey] = camelCaseKeysDeep(value as unknown);
    }

    return result as T;
}
