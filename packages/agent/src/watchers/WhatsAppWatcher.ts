import type { MessengerSource } from '@most/shared';
import { BaseWatcher } from './BaseWatcher.js';
import type { DomSelectors } from './domObserver.js';

/**
 * WhatsApp Web marks incoming bubbles with `.message-in` and outgoing with
 * `.message-out`; text lives in `.selectable-text`. Selectors are best-effort
 * and may need tuning if WhatsApp ships markup changes.
 */
export class WhatsAppWatcher extends BaseWatcher {
  readonly source: MessengerSource = 'whatsapp';

  protected domSelectors(): DomSelectors {
    return {
      message: '.message-in',
      own: '.message-out',
      text: '.selectable-text span, .copyable-text .selectable-text, .selectable-text',
      title:
        'header span[title], [data-testid="conversation-info-header-chat-title"], header [dir="auto"]',
      idAttr: 'data-id',
      installFlag: '__mostWaInstalled',
    };
  }

  protected async detectStatus(): Promise<void> {
    try {
      const needsQr = await this.page.evaluate(() =>
        Boolean(
          document.querySelector(
            '[data-testid="qrcode"], canvas[aria-label*="Scan"], [data-ref]',
          ),
        ),
      );
      await this.reportStatus(needsQr ? 'needs_qr' : 'online');
    } catch {
      await this.reportStatus('error');
    }
  }

  async sendReply(_chatId: string, text: string): Promise<void> {
    const input = this.page
      .locator(
        '[data-testid="conversation-compose-box-input"], div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]',
      )
      .first();
    await input.click();
    await input.type(text, { delay: 15 });
    await this.page.keyboard.press('Enter');
  }
}
