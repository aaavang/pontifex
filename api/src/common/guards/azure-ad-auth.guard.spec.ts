import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AzureAdAuthGuard } from './azure-ad-auth.guard';

describe('AzureAdAuthGuard', () => {
  let guard: AzureAdAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AzureAdAuthGuard(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('returns true when route is marked @Public()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('delegates to passport when route is not public', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const superActivate = jest
      .spyOn(Object.getPrototypeOf(AzureAdAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const context = createMockContext();
    guard.canActivate(context);

    expect(superActivate).toHaveBeenCalledWith(context);
    superActivate.mockRestore();
  });
});
