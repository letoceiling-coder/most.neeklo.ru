/**
 * Selector-driven DOM observer. The function below is serialized and injected
 * into the messenger page by Playwright, so it must be self-contained and only
 * use its single argument (no closure over module scope).
 */
export interface DomSelectors {
  /** Selector matching a single message bubble. */
  message: string;
  /** Selector meaning the bubble is our own outgoing message (skip it). */
  own: string;
  /** Selector for the text node inside a bubble. */
  text: string;
  /** Chat title selector (in the conversation header). */
  title?: string;
  /** Sender name selector inside a bubble (groups). */
  sender?: string;
  /** Attribute on the bubble holding a stable message id. */
  idAttr?: string;
  /** Window flag used to avoid double installation. */
  installFlag: string;
}

export interface DomObserverArg {
  binding: string;
  selectors: DomSelectors;
}

export function domObserverFn(arg: DomObserverArg): void {
  const w = window as unknown as Record<string, unknown>;
  const { binding, selectors } = arg;
  if (w[selectors.installFlag]) return;
  w[selectors.installFlag] = true;

  const emit = (raw: unknown): void => {
    try {
      (w[binding] as (r: unknown) => void)(raw);
    } catch {
      /* binding not ready */
    }
  };

  const text = (el: Element | null): string => (el ? (el.textContent ?? '').trim() : '');
  const chatTitle = (): string =>
    selectors.title ? text(document.querySelector(selectors.title)) : '';
  const isOwn = (el: Element): boolean =>
    selectors.own ? el.matches(selectors.own) || Boolean(el.closest(selectors.own)) : false;

  const handle = (node: Node): void => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const msg = el.matches?.(selectors.message)
      ? el
      : (el.querySelector?.(selectors.message) ?? null);
    if (!msg || isOwn(msg)) return;

    const body = text(msg.querySelector(selectors.text)) || text(msg);
    if (!body) return;

    const sender = selectors.sender ? text(msg.querySelector(selectors.sender)) : '';
    const id = selectors.idAttr ? msg.getAttribute(selectors.idAttr) ?? '' : '';
    const title = chatTitle();

    emit({
      id: id || undefined,
      chatId: location.hash ? location.hash.replace(/^#/, '') : title || undefined,
      chatTitle: title || undefined,
      senderName: sender || title || undefined,
      text: body,
      ts: new Date().toISOString(),
      direction: 'in',
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        try {
          handle(n);
        } catch {
          /* ignore */
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
