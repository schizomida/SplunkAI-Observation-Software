/**
 * Safe SPL query builder.
 *
 * Provides an allowlist-based parameter validation and interpolation mechanism
 * to prevent SPL/shell injection attacks when constructing Splunk queries.
 *
 * Rejected characters include: | ; ` ' " [ ] ( ) $ \n \r and other
 * shell/SPL metacharacters. Only alphanumeric characters, hyphens,
 * underscores, dots, forward slashes, and colons are permitted.
 */

/**
 * Allowlist regex — permits only safe characters for SPL parameter values:
 *   - Alphanumeric: a-z, A-Z, 0-9
 *   - Hyphen: -
 *   - Underscore: _
 *   - Dot: .
 *   - Forward slash: /
 *   - Colon: :
 *
 * Explicitly rejects: | ; ` ' " [ ] ( ) $ \n \r and all other metacharacters.
 */
export const SAFE_PARAM_PATTERN = /^[a-zA-Z0-9\-_./:]+$/;

/**
 * Validates a single parameter value against the allowlist.
 *
 * @param value - The parameter value to validate.
 * @returns `true` if the value contains only allowed characters, `false` otherwise.
 */
export function validateParam(value: string): boolean {
  return SAFE_PARAM_PATTERN.test(value);
}

/**
 * Builds a safe SPL query by validating all parameter values against the
 * allowlist and interpolating them into the template.
 *
 * Template placeholders use the `{{key}}` syntax. Each key in `params` must
 * have a corresponding `{{key}}` in the template (extra keys are silently
 * ignored; missing keys leave the placeholder unreplaced).
 *
 * @param template - The SPL query template with `{{key}}` placeholders.
 * @param params   - A map of placeholder keys to their string values.
 * @returns The interpolated query string with all placeholders replaced.
 * @throws {Error} If any parameter value contains disallowed characters.
 *
 * @example
 * ```ts
 * const query = buildSafeQuery(
 *   'index={{index}} sourcetype={{sourcetype}} | stats count',
 *   { index: 'main', sourcetype: 'access_combined' }
 * );
 * // → 'index=main sourcetype=access_combined | stats count'
 * ```
 */
export function buildSafeQuery(
  template: string,
  params: Record<string, string>
): string {
  let query = template;

  for (const [key, value] of Object.entries(params)) {
    if (!validateParam(value)) {
      throw new Error(
        `Invalid parameter value for key '${key}': contains disallowed characters`
      );
    }

    // Replace all occurrences of {{key}} with the validated value.
    const placeholder = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'g');
    query = query.replace(placeholder, value);
  }

  return query;
}

/**
 * Escapes special regex characters in a string so it can be used safely
 * inside a `RegExp` constructor.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
