// Shim for uuid v13+ (ESM-only) to work with Jest
import * as crypto from 'crypto';

export function v4(): string {
  return crypto.randomUUID();
}

export function validate(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}
