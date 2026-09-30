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

/**
 * Start a browser download of a signed, short-lived URL (no token needed).
 *
 * Preferred over `saveBlob` for files a download manager may take over (IDM
 * grabs PDFs and aborts the page's own request, D-071): the browser, or the
 * download manager, fetches the link itself. The response's
 * `Content-Disposition: attachment` keeps the page where it is.
 */
export function openDownload(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
