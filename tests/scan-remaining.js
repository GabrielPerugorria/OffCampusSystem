// Quick scan for remaining vulnerable patterns in admin.js
const fs = require('fs');

const admin = fs.readFileSync('js/admin.js', 'utf-8');
const main = fs.readFileSync('js/main.js', 'utf-8');
const script = fs.readFileSync('script.js', 'utf-8');

console.log('=== Checking title attributes with user data ===');
[['admin.js', admin], ['main.js', main], ['script.js', script]].forEach(([name, content]) => {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // Look for title="..." with ${...} inside innerHTML contexts
    if (line.includes('title=') && line.includes('${') && !line.includes('setAttribute')) {
      const hasEscape = line.includes('escapeHTML(');
      if (!hasEscape && (line.includes('.nome') || line.includes('.local') || line.includes('.evento'))) {
        console.log('  VULN ' + name + ' L' + (i+1) + ': ' + line.trim().substring(0, 120));
      }
    }
  });
});

console.log('\n=== Checking err.message in innerHTML ===');
[['main.js', main]].forEach(([name, content]) => {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('err.message') && line.includes('innerHTML')) {
      const safe = line.includes('escapeHTML(');
      console.log('  ' + (safe ? 'OK' : 'VULN') + ' ' + name + ' L' + (i+1) + ': ' + line.trim().substring(0, 120));
    }
  });
});

console.log('\n=== Counting escapeHTML usage per file ===');
[['admin.js', admin], ['main.js', main], ['script.js', script]].forEach(([name, content]) => {
  const count = (content.match(/escapeHTML\(/g) || []).length;
  const sanitizeCount = (content.match(/sanitizeURL\(/g) || []).length;
  console.log('  ' + name + ': escapeHTML=' + count + ', sanitizeURL=' + sanitizeCount);
});

console.log('\n=== Checking confirm() calls (native dialogs - safe) ===');
[['admin.js', admin]].forEach(([name, content]) => {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('confirm(') && (line.includes('.nome') || line.includes('.email'))) {
      console.log('  INFO ' + name + ' L' + (i+1) + ': confirm() with user data (safe - native dialog)');
    }
  });
});

console.log('\n=== Checking toast() calls ===');
[['admin.js', admin], ['main.js', main]].forEach(([name, content]) => {
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('toast(') && line.includes('err.message')) {
      console.log('  INFO ' + name + ' L' + (i+1) + ': toast with err.message - check if toast uses innerHTML');
    }
  });
});

console.log('\nDone.');
