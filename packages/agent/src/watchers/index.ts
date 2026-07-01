import type { Page } from 'playwright';
import type { MessengerSource } from '@most/shared';
import type { BaseWatcher, WatcherCallbacks } from './BaseWatcher.js';
import { TelegramWatcher } from './TelegramWatcher.js';
import { WhatsAppWatcher } from './WhatsAppWatcher.js';
import { VkWatcher } from './VkWatcher.js';
import { MaxWatcher } from './MaxWatcher.js';
import { InstagramWatcher } from './InstagramWatcher.js';
import { AvitoWatcher } from './AvitoWatcher.js';

export function createWatcher(
  source: MessengerSource,
  page: Page,
  pcId: string,
  cb: WatcherCallbacks,
): BaseWatcher {
  switch (source) {
    case 'telegram':
      return new TelegramWatcher(page, pcId, cb);
    case 'whatsapp':
      return new WhatsAppWatcher(page, pcId, cb);
    case 'vk':
      return new VkWatcher(page, pcId, cb);
    case 'max':
      return new MaxWatcher(page, pcId, cb);
    case 'instagram':
      return new InstagramWatcher(page, pcId, cb);
    case 'avito':
      return new AvitoWatcher(page, pcId, cb);
    default:
      throw new Error(`unknown source ${source}`);
  }
}
