import type { MessengerSource } from './sources.js';

export type MessageDirection = 'in' | 'out';

export type AttachmentType =
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'sticker'
  | 'link'
  | 'other';

export interface MessageAttachment {
  type: AttachmentType;
  url?: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface MessageSender {
  externalId?: string;
  name?: string;
  username?: string;
  phone?: string;
  avatar?: string;
}

export interface MessageChat {
  id: string;
  title?: string;
  kind?: 'private' | 'group' | 'channel';
}

/**
 * Unified inbound (or outbound) message captured by a watcher on the PC.
 * `id` must be stable per (pcId, source) so the server can dedup.
 */
export interface MessageEvent {
  id: string;
  source: MessengerSource;
  accountId: string;
  pcId: string;
  chat: MessageChat;
  sender: MessageSender;
  text: string;
  attachments: MessageAttachment[];
  direction: MessageDirection;
  /** ISO timestamp of the message itself. */
  ts: string;
  /** Raw provider payload, kept for debugging / reprocessing. */
  raw?: unknown;
}
