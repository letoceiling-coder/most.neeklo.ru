import type { MessengerSource } from '@most/shared';
import { BaseWatcher } from './BaseWatcher.js';
import type { DomSelectors } from './domObserver.js';

/**
 * Avito messenger (avito.ru/profile/messenger). Avito uses hashed CSS classes,
 * so selectors match on substrings/data-markers and are best-effort.
 */
export class AvitoWatcher extends BaseWatcher {
  readonly source: MessengerSource = 'avito';

  protected domSelectors(): DomSelectors {
    return {
      message: '[data-marker*="message"], [class*="bubble"], [class*="message-"]',
      own: '[class*="outgoing"], [class*="own"], [class*="-out-"], [data-marker*="out"]',
      text: '[class*="text"], [class*="content"], [data-marker*="text"]',
      title: '[class*="interlocutor"], [class*="title"], h1',
      installFlag: '__mostAvitoInstalled',
    };
  }

  async sendReply(_chatId: string, text: string): Promise<void> {
    const input = this.page
      .locator('[data-marker="messenger/input"] textarea, [class*="messenger"] textarea, textarea')
      .first();
    await input.click();
    await input.fill(text);
    await this.page.keyboard.press('Enter');
  }
}
