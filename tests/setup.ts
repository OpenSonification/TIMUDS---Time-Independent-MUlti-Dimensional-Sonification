import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:test');
if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) =>
    window.setTimeout(() => callback(performance.now()), 16);
  globalThis.cancelAnimationFrame = (identifier) =>
    window.clearTimeout(identifier);
}
