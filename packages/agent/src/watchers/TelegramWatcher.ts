import type { MessengerSource } from '@most/shared';
import { BaseWatcher } from './BaseWatcher.js';
import type { DomSelectors } from './domObserver.js';

/**
 * Reference watcher. Telegram Web (both "A"/telegram-tt and "K" builds) renders
 * incoming messages as bubbles; the MTProto socket is encrypted/binary so DOM
 * observation is the reliable path. Selectors cover both web builds.
 */
export class TelegramWatcher extends BaseWatcher {
  readonly source: MessengerSource = 'telegram';

  protected domSelectors(): DomSelectors {
    return {
      message: '.Message, .message, .bubble',
      own: '.own, .is-out',
      text: '.text-content, .message-content .text, .translatable-message, .text',
      title: '.ChatInfo .title, .chat-info .title, .topbar .info .title, .peer-title',
      sender: '.message-title, .peer-title, .sender-title',
      idAttr: 'data-message-id',
      installFlag: '__mostTgInstalled',
    };
  }

  protected async detectStatus(): Promise<void> {
    try {
      const loggedOut = await this.page.evaluate(() =>
        Boolean(document.querySelector('.qr-container, #auth-qr-form, .auth-form')),
      );
      await this.reportStatus(loggedOut ? 'needs_qr' : 'online');
    } catch {
      await this.reportStatus('error', 'status check failed');
    }
  }

  async sendReply(chatId: string, text: string): Promise<void> {
    if (chatId) {
      await this.page.evaluate((id) => {
        location.hash = `#${id}`;
      }, chatId);
      await this.page.waitForTimeout(800);
    }
    const input = this.page.locator('.input-message-input, [contenteditable="true"]').first();
    await input.click();
    await input.type(text, { delay: 15 });
    await this.page.keyboard.press('Enter');
  }
}
