import { test, expect } from '../fixtures';

test.describe('Mailpit Integration', () => {
  test('can send an email and verify it via Mailpit API', async ({ mailpit }) => {
    // Clear any existing messages
    await mailpit.deleteAll();

    // Send a test email via Mailpit's send API
    await mailpit.sendMessage({
      from: 'pontifex@pontifex.localhost',
      to: ['testuser@example.com'],
      subject: '[Pontifex] E2E test email',
      html: '<h2>Test</h2><p>This email was sent by an e2e test.</p>',
    });

    // Verify the email was captured
    const message = await mailpit.waitForMessage('to:testuser@example.com');

    expect(message.Subject).toBe('[Pontifex] E2E test email');
    expect(message.From.Address).toBe('pontifex@pontifex.localhost');
    expect(message.To[0].Address).toBe('testuser@example.com');

    // Verify the full HTML body
    const detail = await mailpit.getMessage(message.ID);
    expect(detail.HTML).toContain('This email was sent by an e2e test');

    // Clean up
    await mailpit.deleteAll();
  });
});
