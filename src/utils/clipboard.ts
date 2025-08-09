/**
 * Copy text to the clipboard with fallbacks for browsers/environments where
 * the async Clipboard API is unavailable (non-secure context, older browsers, etc.).
 * Returns a promise that resolves to true on success, false otherwise.
 */
/**
 * Detect whether the modern async clipboard API is realistically usable.
 * We additionally require a secure context (or localhost/127.0.0.1) because
 * some browsers expose navigator.clipboard but reject all calls with SecurityError
 * when not secure; detecting early avoids throwing and noisy console output.
 */
export function isModernClipboardAPIPossible(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) {
    // Allow localhost / 127.0.0.1 during local dev even if served over http (dev servers sometimes)
    try {
      const host = window.location.hostname;
      const isPrivate172 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host); // RFC1918 172.16.0.0 - 172.31.255.255
      const localLike = host === 'localhost'
        || host === '127.0.0.1'
        || host.startsWith('192.168.')
        || host.startsWith('10.')
        || isPrivate172
        || host.endsWith('.local');
      if (!localLike) return false; // treat truly insecure remote contexts as unsupported
    } catch {
      return false;
    }
  }
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
    return !!(nav && nav.clipboard && typeof nav.clipboard.writeText === 'function');
  } catch {
    return false;
  }
}

/** Public helper so components can adapt UI (e.g., disable a button). */
export function isClipboardSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  return true; // We always have at least one fallback path in a browser-like environment.
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('[clipboard] Not in a browser environment');
    return false;
  }
  if (!text) {
    console.warn('[clipboard] Empty text provided to copy');
    return false;
  }

  const value = text.replace(/\r\n?/g, '\n');

  // 1. Modern API (only if clearly available & likely to succeed)
  if (isModernClipboardAPIPossible()) {
    try {
      // Optional chaining prevents "cannot access property writeText" even if race condition nulls it.
      const ok = await navigator.clipboard?.writeText?.(value).then(() => true, () => false);
      if (ok) return true;
    } catch (err) {
      console.warn('[clipboard] navigator.clipboard.writeText failed, will fallback', err);
    }
  }

  // 2. ClipboardItem advanced path
  try {
    // @ts-ignore ClipboardItem may be undefined
    if (typeof ClipboardItem !== 'undefined' && (navigator as any)?.clipboard?.write) {
      // @ts-ignore
      const item = new ClipboardItem({ 'text/plain': new Blob([value], { type: 'text/plain' }) });
      // @ts-ignore
      await (navigator as any).clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn('[clipboard] clipboard.write (ClipboardItem) path failed, continuing', err);
  }

  // 3. execCommand fallback
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    const selection = document.getSelection();
    let previousRange: Range | null = null;
    if (selection && selection.rangeCount > 0) previousRange = selection.getRangeAt(0);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
    if (ok) return true;
  } catch (err) {
    console.warn('[clipboard] execCommand fallback failed, attempting contentEditable', err);
  }

  // 4. contentEditable fallback
  try {
    const span = document.createElement('span');
    span.textContent = value;
    span.style.whiteSpace = 'pre';
    span.contentEditable = 'true';
    span.style.position = 'fixed';
    span.style.top = '0';
    span.style.left = '-9999px';
    document.body.appendChild(span);
    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const ok = document.execCommand('copy');
    selection?.removeAllRanges();
    document.body.removeChild(span);
    if (ok) return true;
  } catch (err) {
    console.error('[clipboard] contentEditable fallback failed', err);
  }

  return false;
}
