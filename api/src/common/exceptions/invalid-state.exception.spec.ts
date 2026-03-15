import { HttpStatus } from '@nestjs/common';
import { InvalidStateException } from './invalid-state.exception';

describe('InvalidStateException', () => {
  it('has CONFLICT status code', () => {
    const exception = new InvalidStateException('test message');
    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
  });

  it('includes the provided message', () => {
    const exception = new InvalidStateException('cannot delete');
    expect(exception.message).toBe('cannot delete');
  });

  it('has the correct name', () => {
    const exception = new InvalidStateException('test');
    expect(exception.name).toBe('InvalidStateException');
  });
});
