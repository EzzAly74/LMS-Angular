/**
 * Bilingual field sent to (and sometimes received from) Laravel
 * `spatie/laravel-translatable` endpoints.
 *
 * Both `en` and `ar` are optional — a freshly-created record may only have one
 * locale filled in, and we want to handle that gracefully on the client.
 */
export interface LocalizedText {
  en?: string;
  ar?: string;
}
