import { diffChars, diffWords } from 'diff';

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export function diffTextWords(original: string, cleaned: string): DiffPart[] {
  return diffWords(original, cleaned);
}

export function diffTextChars(original: string, cleaned: string): DiffPart[] {
  return diffChars(original, cleaned);
}
