
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Accessibility Contrast Checks', () => {
    const cssPath = path.resolve(__dirname, 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    it('should not use opacity on navigation items', () => {
        const navItemBlock = cssContent.match(/\.nav-item-v2\s*\{[^}]*\}/s)?.[0] || '';
        expect(navItemBlock).not.toContain('opacity:');
    });

    it('should not use opacity on transaction metadata', () => {
        const metaBlock = cssContent.match(/\.transaction-meta\s*\{[^}]*\}/s)?.[0] || '';
        expect(metaBlock).not.toContain('opacity:');
    });

    it('should enforce a very dark muted color for light theme', () => {
        const lightThemeBlock = cssContent.match(/\[data-theme="light"\]\s*\{[^}]*\}/s)?.[0] || '';
        // We want --text-muted to be darker than #424242. Let's aim for #2c2c2c or similar.
        // This test ensures we don't revert to lighter grays.
        expect(lightThemeBlock).toContain('--text-muted: #2c2c2c');
    });

    it('should verify success color is darker for better contrast', () => {
        const lightThemeBlock = cssContent.match(/\[data-theme="light"\]\s*\{[^}]*\}/s)?.[0] || '';
        // #008f39 is okay, but maybe #00682a is better?
        // Let's just check it's not the old bright green or standard.
        // Actually, let's enforce a specific safe hex.
        expect(lightThemeBlock).toContain('--success: #00600f');
    });

    it('should not have opacity on version tag', () => {
         const versionTagBlock = cssContent.match(/\.version-tag\s*\{[^}]*\}/s)?.[0] || '';
         expect(versionTagBlock).not.toContain('opacity:');
    });
});
