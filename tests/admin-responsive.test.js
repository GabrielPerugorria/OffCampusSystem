const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('admin.html', 'utf8');
const css = fs.readFileSync('css/admin.css', 'utf8');
const js = fs.readFileSync('js/admin.js', 'utf8');

test('Mobile navigation is an accessible drawer and preserves desktop sidebar', () => {
  assert.match(html, /class="hamburger-btn"[^>]*aria-controls="admin-sidebar"[^>]*aria-expanded="false"/);
  assert.match(html, /<aside class="sidebar" id="admin-sidebar"/);
  assert.doesNotMatch(html, /nav-toggle-checkbox|type="checkbox" id="nav-toggle"/);
  assert.match(css, /--sidebar-w:\s*240px/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.sidebar\s*\{[\s\S]*?width:\s*min\(var\(--sidebar-w-mobile\), calc\(100vw - 56px\)\)/);
  assert.match(css, /\.nav-item\.active::before\s*\{[\s\S]*?background:\s*var\(--accent\)/);
  assert.match(css, /body\.nav-open\s*\{\s*overflow:\s*hidden/);
  assert.match(css, /\.hamburger-btn\s*\{[^}]*width:\s*44px;\s*height:\s*44px/);
  assert.match(js, /function toggleAdminNav\(\)/);
  assert.match(js, /toggle\.setAttribute\('aria-expanded', String\(shouldOpen\)\)/);
  assert.match(js, /function closeAdminNav\(restoreFocus = false\)/);
  assert.match(js, /function goPanel\(id\)\s*\{\s*const navWasOpen/);
});

test('Only table containers scroll horizontally; the page does not hide overflow', () => {
  assert.match(css, /\.table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.table-wrap table\s*\{\s*min-width:\s*480px/);
  assert.doesNotMatch(css, /(?:html|body)\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.main,\s*\.panel,\s*\.card,[^}]*min-width:\s*0/);
});

test('Cards, progress, funnel, and KPIs reflow at small widths', () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.grid-2,\s*\.grid-3\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*?\.kpi-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*1fr\)/);
  assert.match(css, /\.countdown-units\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.progress-row\s*\{\s*display:\s*grid/);
  assert.match(css, /\.funnel-step\s*\{\s*display:\s*grid/);
  assert.match(css, /\.contact-email,\s*\.contact-tel\s*\{\s*overflow-wrap:\s*anywhere/);
});

test('Mobile modals stay within the available viewport width', () => {
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*?\.modal-box\s*\{[^}]*max-width:\s*100%;[^}]*width:\s*100%;/);
  assert.doesNotMatch(css, /\.modal-box\s*\{[^}]*width:\s*100vw/);
  assert.match(css, /\.modal-close\s*\{\s*width:\s*40px;\s*height:\s*40px/);
});
