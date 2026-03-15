/**
 * LIFO cleanup registry — ensures resources created during tests
 * are cleaned up even when tests fail mid-execution.
 */
export class CleanupRegistry {
  private readonly actions: Array<{ name: string; fn: () => Promise<void> }> = [];

  /** Register a cleanup action. Runs in reverse order (LIFO). */
  register(name: string, fn: () => Promise<void>) {
    this.actions.push({ name, fn });
  }

  /** Execute all registered cleanup actions in reverse order. */
  async runAll() {
    const reversed = [...this.actions].reverse();
    const errors: Array<{ name: string; error: unknown }> = [];

    for (const action of reversed) {
      try {
        console.log(`[cleanup] Running: ${action.name}`);
        await action.fn();
      } catch (error) {
        console.error(`[cleanup] Failed: ${action.name}`, error);
        errors.push({ name: action.name, error });
      }
    }

    this.actions.length = 0;

    if (errors.length > 0) {
      console.error(`[cleanup] ${errors.length} cleanup action(s) failed:`, errors.map(e => e.name));
    }
  }
}
