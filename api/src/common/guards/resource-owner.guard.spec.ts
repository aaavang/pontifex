import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ResourceOwnerGuard } from './resource-owner.guard';

describe('ResourceOwnerGuard', () => {
  let guard: ResourceOwnerGuard;
  let reflector: Reflector;
  let moduleRef: jest.Mocked<Pick<ModuleRef, 'get'>>;

  const mockIsOwnedBy = jest.fn();

  beforeEach(() => {
    reflector = new Reflector();
    moduleRef = {
      get: jest.fn().mockReturnValue({ isOwnedBy: mockIsOwnedBy }),
    };
    guard = new ResourceOwnerGuard(reflector, moduleRef as unknown as ModuleRef);
    mockIsOwnedBy.mockReset();
  });

  function createMockContext(
    params: Record<string, string> = {},
    user: any = { id: 'user-1', type: 'user', name: 'Test', email: '', roles: [] },
  ): ExecutionContext {
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

  it('returns true when no decorator metadata is present', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const context = createMockContext();

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('grants access when user owns the application', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'APPLICATION',
      queryParameterKey: 'id',
    });
    mockIsOwnedBy.mockResolvedValue(true);
    const context = createMockContext({ id: 'app-1' });

    expect(await guard.canActivate(context)).toBe(true);
    expect(mockIsOwnedBy).toHaveBeenCalledWith('app-1', 'user-1');
  });

  it('denies access when user does not own the application', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'APPLICATION',
      queryParameterKey: 'id',
    });
    mockIsOwnedBy.mockResolvedValue(false);
    const context = createMockContext({ id: 'app-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('grants access when user owns parent application of environment', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'ENVIRONMENT',
      queryParameterKey: 'id',
    });
    mockIsOwnedBy.mockResolvedValue(true);
    const context = createMockContext({ id: 'env-1' });

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('denies access when user does not own environment parent application', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'ENVIRONMENT',
      queryParameterKey: 'id',
    });
    mockIsOwnedBy.mockResolvedValue(false);
    const context = createMockContext({ id: 'env-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('grants access when user owns source environment of permission request', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'PERMISSION_REQUEST',
      queryParameterKey: 'id',
    });
    mockIsOwnedBy.mockResolvedValue(true);
    const context = createMockContext({ id: 'pr-1' });

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('denies access when user does not own permission request', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      resourceType: 'PERMISSION_REQUEST',
      queryParameterKey: 'id',
    });
    mockIsOwnedBy.mockResolvedValue(false);
    const context = createMockContext({ id: 'pr-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
