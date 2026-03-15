import { FakeUserMiddleware, fakeUserMiddleware } from './fake-user.middleware';

describe('FakeUserMiddleware', () => {
  it('sets req.user to fake-user-id', () => {
    const middleware = new FakeUserMiddleware();
    const req: any = {};
    const res: any = {};
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.user).toEqual({ id: 'fake-user-id' });
    expect(next).toHaveBeenCalled();
  });
});

describe('fakeUserMiddleware (function)', () => {
  it('sets req.user to fake-user-id', () => {
    const req: any = {};
    const res: any = {};
    const next = jest.fn();

    fakeUserMiddleware(req, res, next);

    expect(req.user).toEqual({ id: 'fake-user-id' });
    expect(next).toHaveBeenCalled();
  });
});
