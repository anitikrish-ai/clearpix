import DOMPurify from 'dompurify';

export interface HtmlCleanOptions {
  stripStyleAttributes?: boolean;
  stripClassAttributes?: boolean;
  stripComments?: boolean;
  stripScripts?: boolean;
}

/** Sanitizes and optionally strips presentational cruft from HTML, using DOMPurify. */
export function cleanHtml(html: string, opts: HtmlCleanOptions = {}): string {
  const config: Record<string, unknown> = {
    FORBID_TAGS: opts.stripScripts === false ? [] : ['script', 'style'],
    FORBID_ATTR: [
      ...(opts.stripStyleAttributes !== false ? ['style'] : []),
      ...(opts.stripClassAttributes ? ['class'] : []),
    ],
  };
  let sanitized = DOMPurify.sanitize(html, config as any) as unknown as string;
  if (opts.stripComments !== false) {
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
  }
  return sanitized;
}

export function extractPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}
