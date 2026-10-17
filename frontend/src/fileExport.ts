/** Quote CSV fields and keep spreadsheet formula-like values as literal text. */
export function csvCell(value: string): string {
  const safe = /^[\s\u0000-\u001f\uFEFF]*[=+\-@]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

/** Initiate a browser download; callers must report failures and allow retry. */
export function downloadTextFile(content: string, filename: string, type: string): void {
  let url: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  try {
    url = URL.createObjectURL(new Blob([content], { type }));
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    // WebKit needs the object URL to remain alive after the click dispatch.
    const downloadUrl = url;
    if (downloadUrl) setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }
}
