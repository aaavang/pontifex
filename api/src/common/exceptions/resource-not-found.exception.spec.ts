import { HttpStatus } from '@nestjs/common';
import { ResourceNotFoundException } from './resource-not-found.exception';

describe('ResourceNotFoundException', () => {
  it('has NOT_FOUND status code', () => {
    const exception = new ResourceNotFoundException('Application');
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('includes the resource type in the message', () => {
    const exception = new ResourceNotFoundException('Application');
    expect(exception.message).toBe('Application not found');
  });

  it('has the correct name', () => {
    const exception = new ResourceNotFoundException('User');
    expect(exception.name).toBe('ResourceNotFoundException');
  });
});
