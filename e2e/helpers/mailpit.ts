import { APIRequestContext } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export interface MailpitMessage {
  ID: string;
  MessageID: string;
  From: { Name: string; Address: string };
  To: { Name: string; Address: string }[];
  Cc: { Name: string; Address: string }[] | null;
  Subject: string;
  Created: string;
  Tags: string[];
  Size: number;
  Attachments: number;
  Snippet: string;
  Read: boolean;
}

export interface MailpitMessageDetail extends MailpitMessage {
  HTML: string;
  Text: string;
}

export interface MailpitListResponse {
  total: number;
  unread: number;
  count: number;
  messages: MailpitMessage[];
}

export class MailpitClient {
  constructor(private readonly request: APIRequestContext) {}

  async getMessages(): Promise<MailpitListResponse> {
    const response = await this.request.get(`${MAILPIT_URL}/api/v1/messages`);
    return response.json();
  }

  async search(query: string): Promise<MailpitListResponse> {
    const response = await this.request.get(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`,
    );
    return response.json();
  }

  async getMessage(id: string): Promise<MailpitMessageDetail> {
    const response = await this.request.get(`${MAILPIT_URL}/api/v1/message/${id}`);
    return response.json();
  }

  async deleteAll(): Promise<void> {
    const { messages } = await this.getMessages();
    if (messages.length === 0) return;
    await this.request.delete(`${MAILPIT_URL}/api/v1/messages`, {
      data: { IDs: messages.map((m) => m.ID) },
    });
  }

  async sendMessage(params: {
    from: string;
    to: string[];
    subject: string;
    html?: string;
    text?: string;
  }): Promise<string> {
    const response = await this.request.post(`${MAILPIT_URL}/api/v1/send`, {
      data: {
        From: { Email: params.from },
        To: params.to.map((email) => ({ Email: email })),
        Subject: params.subject,
        HTML: params.html,
        Text: params.text,
      },
    });
    const body = await response.json();
    return body.ID;
  }

  /**
   * Wait for a message matching the query to appear in Mailpit.
   * Polls every 500ms up to the timeout.
   */
  async waitForMessage(
    query: string,
    timeoutMs = 10_000,
  ): Promise<MailpitMessage> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = await this.search(query);
      if (result.messages.length > 0) {
        return result.messages[0];
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`No message matching "${query}" found within ${timeoutMs}ms`);
  }
}
