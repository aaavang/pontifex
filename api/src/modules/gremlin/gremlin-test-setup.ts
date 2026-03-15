// When ts-jest transforms gremlin, `await import('ws')` becomes `require('ws')`.
// The `ws` package's CJS export has no `.default`, so gremlin's
// `(await import('ws')).default` resolves to `undefined`.
// Patch the module to add `.default` so gremlin can find the WebSocket constructor.
import * as ws from 'ws';

if (!(ws as any).default) {
  (ws as any).default = ws;
}
