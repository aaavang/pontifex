import { delay } from './delay';

describe('delay', () => {
  it('resolves after the specified time', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('returns a promise', () => {
    const result = delay(1);
    expect(result).toBeInstanceOf(Promise);
  });
});
