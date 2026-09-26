/**
 * Save a downloaded file (an xlsx / csv export) under `name`.
 *
 * The export routes need the bearer token, so a plain link cannot fetch
 * them; the file is fetched as a Blob and handed to the browser here.
 */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
