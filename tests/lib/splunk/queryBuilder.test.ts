import { buildSafeQuery, validateParam, SAFE_PARAM_PATTERN } from '@/lib/splunk/queryBuilder';

// ---------------------------------------------------------------------------
// validateParam — safe values
// ---------------------------------------------------------------------------

describe('validateParam — safe values', () => {
  test.each([
    ['alphanumeric lowercase', 'main'],
    ['alphanumeric uppercase', 'MAIN'],
    ['alphanumeric mixed', 'Main123'],
    ['hyphen', 'checkout-service'],
    ['underscore', 'access_combined'],
    ['dot', 'splunk.log'],
    ['forward slash', 'logs/app'],
    ['colon', 'host:8080'],
    ['combined safe chars', 'checkout-service_v1.2/prod:8080'],
    ['digits only', '12345'],
    ['single char', 'a'],
  ])('returns true for %s: %s', (_label, value) => {
    expect(validateParam(value)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateParam — injection patterns
// ---------------------------------------------------------------------------

describe('validateParam — injection patterns', () => {
  test.each([
    ['pipe character', 'main | delete'],
    ['semicolon', 'main; rm -rf'],
    ['backtick', 'main`whoami`'],
    ['single quote', "main' OR '1'='1"],
    ['double quote', 'main" OR "1"="1'],
    ['dollar sign', 'main$PATH'],
    ['newline', 'main\ndelete'],
    ['bracket', 'main[0]'],
    ['parenthesis', 'main()'],
    ['space', 'main service'],
  ])('returns false for %s: %p', (_label, value) => {
    expect(validateParam(value)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateParam — empty string
// ---------------------------------------------------------------------------

describe('validateParam — edge cases', () => {
  test('returns false for empty string', () => {
    // Empty string does not match /^[a-zA-Z0-9\-_./:]+$/ (requires at least one char)
    expect(validateParam('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildSafeQuery — valid interpolation
// ---------------------------------------------------------------------------

describe('buildSafeQuery — valid interpolation', () => {
  test('replaces a single {{key}} placeholder with a safe value', () => {
    const result = buildSafeQuery('index={{index}} | stats count', { index: 'main' });
    expect(result).toBe('index=main | stats count');
  });

  test('replaces multiple {{key}} placeholders correctly', () => {
    const result = buildSafeQuery(
      'index={{index}} sourcetype={{sourcetype}} | stats count',
      { index: 'main', sourcetype: 'access_combined' }
    );
    expect(result).toBe('index=main sourcetype=access_combined | stats count');
  });

  test('replaces all occurrences of the same placeholder', () => {
    const result = buildSafeQuery(
      'index={{index}} OR index={{index}}',
      { index: 'main' }
    );
    expect(result).toBe('index=main OR index=main');
  });

  test('handles values with hyphens, underscores, dots, slashes, and colons', () => {
    const result = buildSafeQuery(
      'index={{index}} host={{host}}',
      { index: 'prod-logs', host: 'app.server/node:8080' }
    );
    expect(result).toBe('index=prod-logs host=app.server/node:8080');
  });

  test('returns the template unchanged when params is empty', () => {
    const template = 'index=main | stats count';
    expect(buildSafeQuery(template, {})).toBe(template);
  });
});

// ---------------------------------------------------------------------------
// buildSafeQuery — missing placeholder (extra params silently ignored)
// ---------------------------------------------------------------------------

describe('buildSafeQuery — missing placeholder', () => {
  test('silently ignores params that have no matching {{key}} in the template', () => {
    const result = buildSafeQuery(
      'index=main | stats count',
      { extraParam: 'ignored' }
    );
    expect(result).toBe('index=main | stats count');
  });

  test('replaces known placeholders and ignores unknown params', () => {
    const result = buildSafeQuery(
      'index={{index}} | stats count',
      { index: 'main', unused: 'value' }
    );
    expect(result).toBe('index=main | stats count');
  });
});

// ---------------------------------------------------------------------------
// buildSafeQuery — unreplaced placeholder
// ---------------------------------------------------------------------------

describe('buildSafeQuery — unreplaced placeholder', () => {
  test('leaves {{key}} as-is when no matching param is provided', () => {
    const result = buildSafeQuery(
      'index={{index}} sourcetype={{sourcetype}}',
      { index: 'main' }
    );
    expect(result).toBe('index=main sourcetype={{sourcetype}}');
  });

  test('leaves all placeholders as-is when params is empty', () => {
    const template = 'index={{index}} sourcetype={{sourcetype}}';
    expect(buildSafeQuery(template, {})).toBe(template);
  });
});

// ---------------------------------------------------------------------------
// buildSafeQuery — injection rejection
// ---------------------------------------------------------------------------

describe('buildSafeQuery — injection rejection', () => {
  test.each([
    ['pipe character', 'index', 'main | delete'],
    ['semicolon', 'index', 'main; rm -rf'],
    ['backtick', 'index', 'main`whoami`'],
    ['single quote', 'index', "main' OR '1'='1"],
    ['double quote', 'index', 'main" OR "1"="1'],
    ['dollar sign', 'index', 'main$PATH'],
    ['newline', 'index', 'main\ndelete'],
    ['bracket', 'index', 'main[0]'],
    ['parenthesis', 'index', 'main()'],
    ['space', 'index', 'main service'],
  ])('throws for %s injection in param value', (_label, key, value) => {
    expect(() =>
      buildSafeQuery(`index={{${key}}}`, { [key]: value })
    ).toThrow(/disallowed characters/);
  });

  test('error message includes the offending key name', () => {
    expect(() =>
      buildSafeQuery('index={{myIndex}}', { myIndex: 'bad value' })
    ).toThrow("Invalid parameter value for key 'myIndex'");
  });

  test('throws on first invalid param even when other params are valid', () => {
    expect(() =>
      buildSafeQuery(
        'index={{index}} sourcetype={{sourcetype}}',
        { index: 'main | delete', sourcetype: 'access_combined' }
      )
    ).toThrow(/disallowed characters/);
  });
});
