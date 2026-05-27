import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

// ---------------------------------------------------------------------------
// Helpers — save/restore process.env around each test
// ---------------------------------------------------------------------------

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  // Clear all Splunk-related env vars so each test starts from a clean slate
  delete process.env.SPLUNK_HOST;
  delete process.env.SPLUNK_PORT;
  delete process.env.SPLUNK_TOKEN;
  delete process.env.SPLUNK_INDEX;
  delete process.env.ALLOW_LIVE_SPL;
  delete process.env.MAX_TIME_WINDOW_HOURS;
});

afterEach(() => {
  process.env = savedEnv;
});

// ---------------------------------------------------------------------------
// Default values — no env vars set
// ---------------------------------------------------------------------------

describe('getSplunkConfig — default values', () => {
  test('host defaults to localhost', () => {
    expect(getSplunkConfig().host).toBe('localhost');
  });

  test('port defaults to 8089', () => {
    expect(getSplunkConfig().port).toBe(8089);
  });

  test('token defaults to empty string', () => {
    expect(getSplunkConfig().token).toBe('');
  });

  test('index defaults to main', () => {
    expect(getSplunkConfig().index).toBe('main');
  });

  test('allowLiveSpl defaults to false', () => {
    expect(getSplunkConfig().allowLiveSpl).toBe(false);
  });

  test('maxTimeWindowHours defaults to 24', () => {
    expect(getSplunkConfig().maxTimeWindowHours).toBe(24);
  });

  test('returns all defaults in a single call', () => {
    expect(getSplunkConfig()).toEqual({
      host: 'localhost',
      port: 8089,
      token: '',
      index: 'main',
      allowLiveSpl: false,
      maxTimeWindowHours: 24,
    });
  });
});

// ---------------------------------------------------------------------------
// Env var overrides
// ---------------------------------------------------------------------------

describe('getSplunkConfig — env var overrides', () => {
  test('SPLUNK_HOST overrides host', () => {
    process.env.SPLUNK_HOST = 'splunk.example.com';
    expect(getSplunkConfig().host).toBe('splunk.example.com');
  });

  test('SPLUNK_PORT overrides port', () => {
    process.env.SPLUNK_PORT = '9089';
    expect(getSplunkConfig().port).toBe(9089);
  });

  test('SPLUNK_TOKEN overrides token', () => {
    process.env.SPLUNK_TOKEN = 'my-secret-token';
    expect(getSplunkConfig().token).toBe('my-secret-token');
  });

  test('SPLUNK_INDEX overrides index', () => {
    process.env.SPLUNK_INDEX = 'prod-logs';
    expect(getSplunkConfig().index).toBe('prod-logs');
  });

  test('ALLOW_LIVE_SPL=true sets allowLiveSpl to true', () => {
    process.env.ALLOW_LIVE_SPL = 'true';
    expect(getSplunkConfig().allowLiveSpl).toBe(true);
  });

  test('MAX_TIME_WINDOW_HOURS overrides maxTimeWindowHours', () => {
    process.env.MAX_TIME_WINDOW_HOURS = '48';
    expect(getSplunkConfig().maxTimeWindowHours).toBe(48);
  });

  test('all env vars overridden together', () => {
    process.env.SPLUNK_HOST = 'splunk.prod.internal';
    process.env.SPLUNK_PORT = '9089';
    process.env.SPLUNK_TOKEN = 'tok-abc123';
    process.env.SPLUNK_INDEX = 'security';
    process.env.ALLOW_LIVE_SPL = 'true';
    process.env.MAX_TIME_WINDOW_HOURS = '12';

    expect(getSplunkConfig()).toEqual({
      host: 'splunk.prod.internal',
      port: 9089,
      token: 'tok-abc123',
      index: 'security',
      allowLiveSpl: true,
      maxTimeWindowHours: 12,
    });
  });
});

// ---------------------------------------------------------------------------
// ALLOW_LIVE_SPL — only exact string 'true' enables live SPL
// ---------------------------------------------------------------------------

describe('getSplunkConfig — ALLOW_LIVE_SPL strict matching', () => {
  test.each([
    ['True'],
    ['TRUE'],
    ['1'],
    ['yes'],
    ['on'],
    ['false'],
    ['0'],
    [' true'],
    ['true '],
  ])('"%s" does NOT set allowLiveSpl to true', (value) => {
    process.env.ALLOW_LIVE_SPL = value;
    expect(getSplunkConfig().allowLiveSpl).toBe(false);
  });

  test('"true" (exact) sets allowLiveSpl to true', () => {
    process.env.ALLOW_LIVE_SPL = 'true';
    expect(getSplunkConfig().allowLiveSpl).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SPLUNK_PORT parsing
// ---------------------------------------------------------------------------

describe('getSplunkConfig — SPLUNK_PORT parsing', () => {
  test('valid integer string is parsed as a number', () => {
    process.env.SPLUNK_PORT = '9089';
    expect(getSplunkConfig().port).toBe(9089);
  });

  test('port 0 is treated as a valid finite number', () => {
    process.env.SPLUNK_PORT = '0';
    expect(getSplunkConfig().port).toBe(0);
  });

  test('non-numeric string falls back to 8089', () => {
    process.env.SPLUNK_PORT = 'abc';
    expect(getSplunkConfig().port).toBe(8089);
  });

  test('empty string falls back to 8089', () => {
    process.env.SPLUNK_PORT = '';
    expect(getSplunkConfig().port).toBe(8089);
  });

  test('float string is truncated (parseInt behaviour)', () => {
    process.env.SPLUNK_PORT = '9089.9';
    expect(getSplunkConfig().port).toBe(9089);
  });

  test('string with leading digits is truncated (parseInt behaviour)', () => {
    process.env.SPLUNK_PORT = '9089abc';
    expect(getSplunkConfig().port).toBe(9089);
  });
});

// ---------------------------------------------------------------------------
// MAX_TIME_WINDOW_HOURS parsing
// ---------------------------------------------------------------------------

describe('getSplunkConfig — MAX_TIME_WINDOW_HOURS parsing', () => {
  test('valid integer string is parsed as a number', () => {
    process.env.MAX_TIME_WINDOW_HOURS = '48';
    expect(getSplunkConfig().maxTimeWindowHours).toBe(48);
  });

  test('non-numeric string falls back to 24', () => {
    process.env.MAX_TIME_WINDOW_HOURS = 'unlimited';
    expect(getSplunkConfig().maxTimeWindowHours).toBe(24);
  });

  test('empty string falls back to 24', () => {
    process.env.MAX_TIME_WINDOW_HOURS = '';
    expect(getSplunkConfig().maxTimeWindowHours).toBe(24);
  });

  test('float string is truncated (parseInt behaviour)', () => {
    process.env.MAX_TIME_WINDOW_HOURS = '12.5';
    expect(getSplunkConfig().maxTimeWindowHours).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// isConfigured
// ---------------------------------------------------------------------------

describe('isConfigured', () => {
  test('returns false when token is empty and allowLiveSpl is false', () => {
    expect(isConfigured({ host: 'localhost', port: 8089, token: '', index: 'main', allowLiveSpl: false, maxTimeWindowHours: 24 })).toBe(false);
  });

  test('returns false when token is non-empty but allowLiveSpl is false', () => {
    expect(isConfigured({ host: 'localhost', port: 8089, token: 'my-token', index: 'main', allowLiveSpl: false, maxTimeWindowHours: 24 })).toBe(false);
  });

  test('returns false when allowLiveSpl is true but token is empty', () => {
    expect(isConfigured({ host: 'localhost', port: 8089, token: '', index: 'main', allowLiveSpl: true, maxTimeWindowHours: 24 })).toBe(false);
  });

  test('returns false when allowLiveSpl is true but token is whitespace only', () => {
    expect(isConfigured({ host: 'localhost', port: 8089, token: '   ', index: 'main', allowLiveSpl: true, maxTimeWindowHours: 24 })).toBe(false);
  });

  test('returns true when token is non-empty AND allowLiveSpl is true', () => {
    expect(isConfigured({ host: 'localhost', port: 8089, token: 'tok-abc123', index: 'main', allowLiveSpl: true, maxTimeWindowHours: 24 })).toBe(true);
  });

  test('returns true regardless of other config fields when token and allowLiveSpl are set', () => {
    expect(isConfigured({ host: 'splunk.prod', port: 9089, token: 'tok-xyz', index: 'security', allowLiveSpl: true, maxTimeWindowHours: 12 })).toBe(true);
  });
});
