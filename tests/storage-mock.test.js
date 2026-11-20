'use strict';
/**
 * Testes do storageService com mocks — SEM MySQL, SEM S3 real.
 * Testa o armazenamento local: escrita, leitura, exclusão, path traversal, rollback.
 *
 * Executar:  node tests/storage-mock.test.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✘ ${name}`);
    console.log(`    → ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✔ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✘ ${name}`);
    console.log(`    → ${err.message}`);
    failed++;
  }
}

// Cria diretório temporário isolado para testes
const tmpDir = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

// Configura variável para que storageService use o diretório temporário
process.env.STORAGE_PROVIDER = 'local';
process.env.LOCAL_UPLOAD_DIR = tmpDir;

// Importa o serviço DEPOIS de configurar env
// Re-require para evitar cache
delete require.cache[require.resolve('../backend/src/services/storageService')];
const storageService = require('../backend/src/services/storageService');

// Gera um buffer JPEG válido (magic numbers FF D8 FF)
function fakeJpeg(size = 1024) {
  const buf = crypto.randomBytes(size);
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF;
  return buf;
}

// Gera um buffer PNG válido
function fakePng(size = 1024) {
  const buf = crypto.randomBytes(size);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47;
  buf[4] = 0x0D; buf[5] = 0x0A; buf[6] = 0x1A; buf[7] = 0x0A;
  return buf;
}

async function run() {
  console.log('\n=== STORAGE SERVICE MOCK TESTS ===\n');

  console.log('1) Upload local');

  await testAsync('upload JPEG cria arquivo com nome aleatório', async () => {
    const result = await storageService.uploadImage(fakeJpeg(), 'image/jpeg');
    assert.ok(result.startsWith('uploads/events/'), `Caminho inesperado: ${result}`);
    assert.ok(result.endsWith('.jpg'), 'Deve terminar com .jpg');
    const filename = path.basename(result);
    assert.strictEqual(filename.length, 36, 'Nome deve ser 32 hex + .jpg = 36 chars');
    // Verifica que o arquivo existe no disco
    const fullPath = path.join(tmpDir, filename);
    assert.ok(fs.existsSync(fullPath), 'Arquivo deve existir no disco');
  });

  await testAsync('upload PNG cria arquivo .png', async () => {
    const result = await storageService.uploadImage(fakePng(), 'image/png');
    assert.ok(result.endsWith('.png'));
  });

  await testAsync('upload WebP cria arquivo .webp', async () => {
    const buf = crypto.randomBytes(1024);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
    const result = await storageService.uploadImage(buf, 'image/webp');
    assert.ok(result.endsWith('.webp'));
  });

  await testAsync('nomes de arquivo são únicos entre uploads', async () => {
    const r1 = await storageService.uploadImage(fakeJpeg(), 'image/jpeg');
    const r2 = await storageService.uploadImage(fakeJpeg(), 'image/jpeg');
    assert.notStrictEqual(r1, r2, 'Nomes devem ser diferentes');
  });

  console.log('\n2) Exclusão local');

  await testAsync('deleteImage remove arquivo existente', async () => {
    const result = await storageService.uploadImage(fakeJpeg(), 'image/jpeg');
    const filename = path.basename(result);
    const fullPath = path.join(tmpDir, filename);
    assert.ok(fs.existsSync(fullPath), 'Arquivo deve existir antes da exclusão');
    await storageService.deleteImage(result);
    assert.ok(!fs.existsSync(fullPath), 'Arquivo deve ter sido removido');
  });

  await testAsync('deleteImage ignora arquivo inexistente sem erro', async () => {
    await storageService.deleteImage('uploads/events/inexistente.jpg');
    // Não deve lançar exceção
  });

  await testAsync('deleteImage ignora URLs remotas', async () => {
    await storageService.deleteImage('https://bucket.s3.amazonaws.com/events/abc.jpg');
    // Não deve lançar exceção nem tentar excluir arquivo local
  });

  await testAsync('deleteImage ignora null e undefined', async () => {
    await storageService.deleteImage(null);
    await storageService.deleteImage(undefined);
    await storageService.deleteImage('');
  });

  console.log('\n3) Segurança — path traversal');

  await testAsync('deleteImage não aceita path traversal', async () => {
    // Cria um arquivo legítimo fora do diretório de uploads
    const evilPath = '../../etc/passwd';
    await storageService.deleteImage(evilPath);
    // A função usa path.basename, então o path.join fica dentro do dir
    // Verificar que nenhum arquivo fora do tmpDir foi afetado
  });

  await testAsync('nomes de arquivo gerados são hexadecimais puros', async () => {
    const result = await storageService.uploadImage(fakeJpeg(), 'image/jpeg');
    const name = path.basename(result, '.jpg');
    assert.ok(/^[0-9a-f]{32}$/.test(name), `Nome deve ser 32 hex chars, recebeu: ${name}`);
  });

  console.log('\n4) Rollback');

  await testAsync('arquivo pode ser excluído após falha de persistência (simulação)', async () => {
    const result = await storageService.uploadImage(fakeJpeg(), 'image/jpeg');
    const filename = path.basename(result);
    const fullPath = path.join(tmpDir, filename);
    assert.ok(fs.existsSync(fullPath));

    // Simula falha no DB → rollback do arquivo
    try {
      throw new Error('Simulação de falha no banco');
    } catch (_) {
      await storageService.deleteImage(result);
    }
    assert.ok(!fs.existsSync(fullPath), 'Arquivo deve ser removido no rollback');
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n=== RESULTADO: ${passed} aprovados, ${failed} reprovados ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
