import { isUpdateApplicationRequest } from './application-update-request.dto';

describe('isUpdateApplicationRequest', () => {
  it('returns true for valid request with environments array', () => {
    expect(isUpdateApplicationRequest({ environments: ['dev', 'prod'] })).toBe(true);
  });

  it('returns false when environments is missing', () => {
    expect(isUpdateApplicationRequest({})).toBe(false);
  });

  it('returns false when environments is not an array', () => {
    expect(isUpdateApplicationRequest({ environments: 'dev' })).toBe(false);
  });

  it('returns false when environments contains non-strings', () => {
    expect(isUpdateApplicationRequest({ environments: [1, 2] })).toBe(false);
  });

  it('returns true for empty environments array', () => {
    expect(isUpdateApplicationRequest({ environments: [] })).toBe(true);
  });
});
