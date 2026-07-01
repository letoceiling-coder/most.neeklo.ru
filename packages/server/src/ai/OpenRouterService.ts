import type { MessageEvent } from '@most/shared';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { getOpenRouterSettings } from '../repositories/settings.js';

const logger = createLogger('openrouter');

export interface MessageAnalysis {
  category: string;
  tags: string[];
  summary: string;
  draftReply: string;
  language?: string;
}

const SYSTEM_PROMPT = `Ты помощник колл-центра. На вход приходит входящее сообщение из мессенджера.
Верни СТРОГО JSON без markdown с полями:
{
  "category": "одно из: lead, question, complaint, spam, other",
  "tags": ["короткие теги на русском, до 5"],
  "summary": "одно предложение сути",
  "draftReply": "вежливый черновик ответа на языке сообщения",
  "language": "ru|en|..."
}`;

export class OpenRouterService {
  async analyze(event: MessageEvent, userId: string): Promise<MessageAnalysis | null> {
    const settings = await getOpenRouterSettings(userId);
    if (!settings.enabled || !settings.apiKey) return null;
    if (!event.text?.trim()) return null;

    try {
      const res = await fetch(`${config.openRouter.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
          'HTTP-Referer': config.publicUrl,
          'X-Title': 'Most Bridge',
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Источник: ${event.source}\nОт: ${event.sender.name ?? event.sender.username ?? 'неизвестно'}\nТекст: ${event.text}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        logger.warn('OpenRouter non-OK', { status: res.status });
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as MessageAnalysis;
      return {
        category: parsed.category ?? 'other',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
        summary: parsed.summary ?? '',
        draftReply: parsed.draftReply ?? '',
        language: parsed.language,
      };
    } catch (err) {
      logger.warn('OpenRouter analyze failed', { error: (err as Error).message });
      return null;
    }
  }
}

export const openRouter = new OpenRouterService();
