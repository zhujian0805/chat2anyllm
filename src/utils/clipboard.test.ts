import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard, isModernClipboardAPIPossible } from './clipboard';

describe('clipboard utility', () => {
  const originalNavigator = (globalThis as any).navigator;
  const originalWindow: any = (globalThis as any).window;

  beforeEach(() => {
  (globalThis as any).window = {
      location: { hostname: '10.1.2.3' },
      isSecureContext: false,
    } as any;
  (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'textarea') {
          return {
            value: '',
            setAttribute: () => {},
            style: {},
            focus: () => {},
            select: () => {},
          } as any;
        }
        if (tag === 'span') {
          return {
            style: {},
            contentEditable: '',
            textContent: '',
          } as any;
        }
        return { style: {} } as any;
      },
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
      getSelection: () => ({
        rangeCount: 0,
        removeAllRanges: () => {},
        addRange: () => {},
      }),
      createRange: () => ({ selectNodeContents: () => {} }),
      execCommand: () => false,
    } as any;
  (globalThis as any).navigator = {} as any; // clipboard intentionally absent
  });

  afterEach(() => {
  (globalThis as any).navigator = originalNavigator as any;
  (globalThis as any).window = originalWindow;
  delete (globalThis as any).document;
  });

  it('does not report modern clipboard possible on insecure private IP', () => {
    expect(isModernClipboardAPIPossible()).toBe(false);
  });

  it('returns false gracefully when copying with no clipboard available', async () => {
    const ok = await copyTextToClipboard('hello');
    expect(ok).toBe(false);
  });

  it('uses execCommand fallback (returns true) when execCommand succeeds on private IP insecure context', async () => {
    // Reconfigure document.execCommand to succeed and add minimal selection handling
    (globalThis as any).document.execCommand = (cmd: string) => cmd === 'copy';
    (globalThis as any).document.createElement = (tag: string) => {
      if (tag === 'textarea') {
        return {
          value: '',
          setAttribute: () => {},
          style: {},
          focus: () => {},
          select: () => {},
        } as any;
      }
      return { style: {} } as any;
    };
    const ok = await copyTextToClipboard('via-fallback');
    expect(ok).toBe(true);
  });

  it('succeeds when navigator.clipboard.writeText exists', async () => {
  (globalThis as any).navigator = {
      clipboard: { writeText: async () => {} },
    };
  (globalThis as any).window.isSecureContext = true;
    const ok = await copyTextToClipboard('hello');
    expect(ok).toBe(true);
  });
});
