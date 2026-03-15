import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ResourceOwnerGuard } from './resource-owner.guard';

describe('ResourceOwnerGuard', () => {
  let guard: ResourceOwnerGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ResourceOwnerGuard(reflector);
  });

  function createMockContext(params: Record<string, string> = {}, user: any = { id: 'user-1' }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ params, user }),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
    } as unknown as ExecutionContext;
  }

  it('returns true when no decorator metadata is present', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true for APPLICATION resource type', () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'APPLICATION',
      queryParameterKey: 'id',
    });
    const context = createMockContext({ id: 'app-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true for ENVIRONMENT resource type', () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'ENVIRONMENT',
      queryParameterKey: 'id',
    });
    const context = createMockContext({ id: 'env-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true for PERMISSION_REQUEST resource type', () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'PERMISSION_REQUEST',
      queryParameterKey: 'id',
    });
    const context = createMockContext({ id: 'pr-1' });

    expect(guard.canActivate(context)).toBe(true);
  });
});
