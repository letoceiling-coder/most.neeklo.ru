import type { MessengerSource } from '@most/shared';
import { BaseWatcher } from './BaseWatcher.js';
import type { DomSelectors } from './domObserver.js';

/**
 * VK messages (vk.com/im). Incoming rows carry an `_in` variant class; text is
 * in `.im-mess--text`. Selectors are best-effort across VK's markup variants.
 */
export class VkWatcher extends BaseWatcher {
  readonly source: MessengerSource = 'vk';

  protected domSelectors(): DomSelectors {
    return {
      message: '.im-mess, .im_msg, ._im_mess',
      own: '.im-mess_out, .im_msg_out, ._im_mess_out, .im-mess--isMine',
      text: '.im-mess--text, .im_msg--text, ._im_mess_text, .wall_module',
      title: '.im-page--title-main, .im_convo_title, .ConvoTitle',
      installFlag: '__mostVkInstalled',
    };
  }

  protected async detectStatus(): Promise<void> {
    try {
      const loggedIn = await this.page.evaluate(() =>
        Boolean(document.querySelector('.im-page, .im_page, [class*="im_"]')),
      );
      await this.reportStatus(loggedIn ? 'online' : 'logged_out');
    } catch {
      await this.reportStatus('error');
    }
  }

  async sendReply(_chatId: string, text: string): Promise<void> {
    const input = this.page
      .locator('.im-chat-input--text, [contenteditable="true"].im-chat-input--text, [contenteditable="true"]')
      .first();
    await input.click();
    await input.type(text, { delay: 15 });
    await this.page.keyboard.press('Enter');
  }
}
