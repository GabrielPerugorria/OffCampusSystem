'use strict';

function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || 'item';
}

// Garante unicidade consultando a tabela (events.slug / organizations.slug).
async function uniqueSlug(db, table, base, ignoreId = null) {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  /* eslint-disable no-await-in-loop */
  while (true) {
    const sql = ignoreId
      ? `SELECT id FROM ${table} WHERE slug = ? AND id <> ? LIMIT 1`
      : `SELECT id FROM ${table} WHERE slug = ? LIMIT 1`;
    const params = ignoreId ? [candidate, ignoreId] : [candidate];
    const found = await db.queryOne(sql, params);
    if (!found) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

module.exports = { slugify, uniqueSlug };
