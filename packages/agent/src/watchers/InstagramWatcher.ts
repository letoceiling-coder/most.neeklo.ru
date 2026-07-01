import type { MessengerSource } from '@most/shared';
import { BaseWatcher } from './BaseWatcher.js';
import type { DomSelectors } from './domObserver.js';

/**
 * Instagram DMs ride an MQTT-over-WebSocket (binary), so DOM observation is the
 * practical path. Instagram ships obfuscated classes; these selectors are
 * best-effort and likely need tuning. Own-message detection is limited, so the
 * server-side dedup + direction inference should be relied on as a backstop.
 */
export class InstagramWatcher extends BaseWatcher {
  readonly source: MessengerSource = 'instagram';

  protected domSelectors(): DomSelectors {
    return {
      message: 'div[role="row"]',
      // Instagram does not expose a stable "own" class; left empty by design.
      own: '',
      text: 'div[dir="auto"], span[dir="auto"]',
      title: 'header div[dir="auto"], header h1, h1',
      installFlag: '__mostIgInstalled',
    };
  }

  protected async detectStatus(): Promise<void> {
    try {
      const loggedOut = await this.page.evaluate(() =>
        Boolean(document.querySelector('input[name="username"], #loginForm')),
      );
      await this.reportStatus(loggedOut ? 'logged_out' : 'online');
    } catch {
      await this.reportStatus('error');
    }
  }

  async sendReply(_chatId: string, text: string): Promise<void> {
    const input = this.page
      .locator('textarea[placeholder], div[contenteditable="true"][role="textbox"]')
      .first();
    await input.click();
    await input.type(text, { delay: 15 });
    await this.page.keyboard.press('Enter');
  }
}
