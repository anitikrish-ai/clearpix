export interface CharFinding {
  index: number;
  codePoint: number;
  hex: string;
  category: 'zero-width' | 'bidi-control' | 'variation-selector' | 'unicode-tag' | 'unusual-whitespace';
  name: string;
}

export interface TextInspectionReport {
  findings: CharFinding[];
  counts: Record<CharFinding['category'], number>;
  aiWatermarkIndicator: boolean;
}

const NAMES: Record<number, string> = {
  0x200b: 'Zero Width Space',
  0x200c: 'Zero Width Non-Joiner',
  0x200d: 'Zero Width Joiner',
  0x2060: 'Word Joiner',
  0xfeff: 'Zero Width No-Break Space (BOM)',
  0x200e: 'Left-to-Right Mark',
  0x200f: 'Right-to-Left Mark',
  0x00a0: 'No-Break Space',
  0x202f: 'Narrow No-Break Space',
  0x205f: 'Medium Mathematical Space',
  0x3000: 'Ideographic Space',
};

function categoryFor(cp: number): CharFinding['category'] | null {
  if ([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff].includes(cp)) return 'zero-width';
  if ((cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x200e || cp === 0x200f) return 'bidi-control';
  if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)) return 'variation-selector';
  if (cp === 0xe0001 || (cp >= 0xe0020 && cp <= 0xe007f)) return 'unicode-tag';
  if (cp === 0x00a0 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x202f || cp === 0x205f || cp === 0x3000) return 'unusual-whitespace';
  return null;
}

function nameFor(cp: number, category: CharFinding['category']): string {
  if (NAMES[cp]) return NAMES[cp];
  switch (category) {
    case 'bidi-control':
      return 'Bidirectional control character';
    case 'variation-selector':
      return 'Variation selector';
    case 'unicode-tag':
      return 'Unicode tag character';
    case 'unusual-whitespace':
      return 'Unusual whitespace';
    default:
      return 'Zero-width character';
  }
}

/**
 * Scans text for invisible/zero-width characters, bidi control characters, variation
 * selectors, Unicode tag characters and unusual whitespace. Variation selectors and tag
 * characters are flagged as a documented indicator sometimes used to carry hidden
 * (including AI-generated-content) markers in plain text, per published research on
 * Unicode steganography — this is a documented-signal report, not a certainty claim.
 */
export function inspectText(text: string): TextInspectionReport {
  const findings: CharFinding[] = [];
  const counts: Record<CharFinding['category'], number> = {
    'zero-width': 0,
    'bidi-control': 0,
    'variation-selector': 0,
    'unicode-tag': 0,
    'unusual-whitespace': 0,
  };

  const chars = Array.from(text);
  let index = 0;
  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;
    const category = categoryFor(cp);
    if (category) {
      findings.push({ index, codePoint: cp, hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'), category, name: nameFor(cp, category) });
      counts[category]++;
    }
    index += ch.length;
  }

  return {
    findings,
    counts,
    aiWatermarkIndicator: counts['variation-selector'] > 0 || counts['unicode-tag'] > 0,
  };
}

export interface CleanTextOptions {
  removeZeroWidth?: boolean;
  removeBidiControl?: boolean;
  removeVariationSelectors?: boolean;
  removeUnicodeTags?: boolean;
  normalizeWhitespace?: boolean;
  unicodeNormalForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | 'none';
}

export function cleanText(text: string, opts: CleanTextOptions): string {
  let result = text;

  if (opts.unicodeNormalForm && opts.unicodeNormalForm !== 'none') {
    result = result.normalize(opts.unicodeNormalForm);
  }

  const chars = Array.from(result);
  const kept: string[] = [];
  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;
    const category = categoryFor(cp);
    if (category === 'zero-width' && opts.removeZeroWidth) continue;
    if (category === 'bidi-control' && opts.removeBidiControl) continue;
    if (category === 'variation-selector' && opts.removeVariationSelectors) continue;
    if (category === 'unicode-tag' && opts.removeUnicodeTags) continue;
    if (category === 'unusual-whitespace' && opts.normalizeWhitespace) {
      kept.push(' ');
      continue;
    }
    kept.push(ch);
  }
  result = kept.join('');

  if (opts.normalizeWhitespace) {
    result = result.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  return result;
}
