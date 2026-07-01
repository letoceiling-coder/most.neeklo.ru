/** Messengers the PC agent can watch for incoming messages. */
export const MESSENGER_SOURCES = [
  'telegram',
  'max',
  'vk',
  'avito',
  'instagram',
  'whatsapp',
] as const;

export type MessengerSource = (typeof MESSENGER_SOURCES)[number];

export function isMessengerSource(value: string): value is MessengerSource {
  return (MESSENGER_SOURCES as readonly string[]).includes(value);
}

export const SOURCE_LABELS: Record<MessengerSource, string> = {
  telegram: 'Telegram',
  max: 'MAX',
  vk: 'VK',
  avito: 'Avito',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
};

/** Web URLs the agent opens per source (authorized profile). */
export const SOURCE_WEB_URLS: Record<MessengerSource, string> = {
  telegram: 'https://web.telegram.org/a/',
  max: 'https://web.max.ru/',
  vk: 'https://vk.com/im',
  avito: 'https://www.avito.ru/profile/messenger',
  instagram: 'https://www.instagram.com/direct/inbox/',
  whatsapp: 'https://web.whatsapp.com/',
};
