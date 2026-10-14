/**
 * Shared by the quiz and assignment forms (Figma 1982:41913 / 1983:44040,
 * D-066). Figma draws two question types differently from the API's shape:
 *
 *  - Yes/No: one "Correct answer / grading key" dropdown. The learner sees
 *    options, so the form writes the Yes / No pair in both languages and
 *    the key in both languages (the grader accepts either).
 *  - Reorder: the items are typed in their correct order, so the order IS
 *    the key. It is stored as a JSON array (the grader decodes that), and
 *    the learner API shuffles the items (QuestionAnswerGrader).
 */

export type YesNo = 'yes' | 'no';

const YES_NO_TEXT: Record<'en' | 'ar', Record<YesNo, string>> = {
  en: { yes: 'Yes', no: 'No' },
  ar: { yes: 'نعم', no: 'لا' },
};

/** Reads a stored yes/no key ('Yes', 'no', 'True', 'نعم', ...) back into the dropdown value. */
export function yesNoFromKey(key: string | null | undefined): YesNo | null {
  const k = (key ?? '').trim().toLowerCase();
  if (['yes', 'true', 'نعم', 'صح'].includes(k)) return 'yes';
  if (['no', 'false', 'لا', 'خطأ'].includes(k)) return 'no';
  return null;
}

export function yesNoOptions(lang: 'en' | 'ar'): string[] {
  return [YES_NO_TEXT[lang].yes, YES_NO_TEXT[lang].no];
}

export function yesNoText(value: YesNo, lang: 'en' | 'ar'): string {
  return YES_NO_TEXT[lang][value];
}

/** The reorder items in their correct order: the stored key when it is a JSON list, else the options. */
export function reorderItems(options: string[] | null | undefined, key: string | null | undefined): string[] {
  if (key) {
    try {
      const parsed: unknown = JSON.parse(key);
      if (Array.isArray(parsed) && parsed.length && parsed.every(v => typeof v === 'string')) {
        return parsed as string[];
      }
    } catch {
      // Not JSON: fall back to the options as authored.
    }
  }
  return options ?? [];
}

/**
 * MCQ and reorder options are pairs: option N in English is option N in
 * Arabic (NEW2B-6288). Both lists grow and shrink together, and a row is
 * filled in both languages or in neither.
 */
export function optionsPaired(en: readonly string[], ar: readonly string[]): boolean {
  return en.length === ar.length && en.every((e, i) => !!e.trim() === !!(ar[i] ?? '').trim());
}

/** Where a stored MCQ key sits among the options (English first, then Arabic), or null. */
export function mcqKeyIndex(
  en: readonly string[], ar: readonly string[],
  keyEn: string | null | undefined, keyAr: string | null | undefined,
): number | null {
  const find = (items: readonly string[], key: string | null | undefined): number => {
    const k = (key ?? '').trim();
    return k ? items.findIndex(o => (o ?? '').trim() === k) : -1;
  };
  const byEn = find(en, keyEn);
  if (byEn >= 0) return byEn;
  const byAr = find(ar, keyAr);
  return byAr >= 0 ? byAr : null;
}

export interface McqChoice { value: number; label: string; }

/** The MCQ key dropdown (NEW2B-6289): one choice per filled option, in the reader's language. */
export function mcqChoices(en: readonly string[], ar: readonly string[], lang: string): McqChoice[] {
  return en.flatMap((e, i) => {
    const first = ((lang === 'ar' ? ar[i] : e) ?? '').trim();
    const text = first || ((lang === 'ar' ? e : ar[i]) ?? '').trim();
    return text ? [{ value: i, label: `${i + 1}. ${text}` }] : [];
  });
}

/** 'YYYY-MM-DD' (or a datetime) from the API into a local date for the picker. */
export function dateFromApi(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** A picked local date back to 'YYYY-MM-DD', without a UTC shift. */
export function dateToApi(value: Date | null | undefined): string | null {
  if (!value) return null;
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${mm}-${dd}`;
}
