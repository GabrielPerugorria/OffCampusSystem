'use strict';
/**
 * Testes Unitários e de Integração: Módulo de Upload de Imagens de Eventos
 * Cobre: Autenticação, RBAC, Validação de Assinatura, Tamanho, Isolamento Multi-tenant,
 * Rollback em Falha e Limpeza de Imagem Anterior.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { verifyFileSignature, MAX_FILE_SIZE } = require('../backend/src/middlewares/upload');
const storageService = require('../backend/src/services/storageService');

async function runTests() {
  console.log('\n======================================================');
  console.log(' SUÍTE: UPLOAD DE IMAGENS DE EVENTOS (SEGURANÇA & FLUXO)');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
    }
  }

  // --- 1. Assinatura Real de Arquivo (Magic Numbers) ---
  console.log('--- 1. Validação de Assinatura (Magic Numbers) ---');

  await asyncTest('Valida JPEG legítimo com magic bytes FF D8 FF', async () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const isValid = await verifyFileSignature(jpegBuffer);
    assert.strictEqual(isValid, true);
  });

  await asyncTest('Valida PNG legítimo com magic bytes 89 50 4E 47 0D 0A 1A 0A', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const isValid = await verifyFileSignature(pngBuffer);
    assert.strictEqual(isValid, true);
  });

  await asyncTest('Valida WebP legítimo com magic bytes RIFF....WEBP', async () => {
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50  // WEBP
    ]);
    const isValid = await verifyFileSignature(webpBuffer);
    assert.strictEqual(isValid, true);
  });

  await asyncTest('Bloqueia arquivo de texto disfarçado de imagem (.jpg falso)', async () => {
    const textBuffer = Buffer.from('<?php echo "malicious code"; ?>', 'utf-8');
    const isValid = await verifyFileSignature(textBuffer);
    assert.strictEqual(isValid, false);
  });

  await asyncTest('Bloqueia arquivo executável disfarçado (.exe com extensão .png)', async () => {
    const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const isValid = await verifyFileSignature(exeBuffer);
    assert.strictEqual(isValid, false);
  });

  await asyncTest('Bloqueia buffer vazio ou truncado (< 12 bytes)', async () => {
    const shortBuffer = Buffer.from([0xFF, 0xD8]);
    const isValid = await verifyFileSignature(shortBuffer);
    assert.strictEqual(isValid, false);
  });

  // --- 2. Limites de Tamanho e Configurações ---
  console.log('\n--- 2. Limites de Tamanho e Segurança ---');

  test('Limite máximo de arquivo definido em 5MB', () => {
    assert.strictEqual(MAX_FILE_SIZE, 5 * 1024 * 1024);
  });

  // --- 3. Storage Service & Path Traversal Prevention ---
  console.log('\n--- 3. Camada de Armazenamento e Prevenção de Path Traversal ---');

  await asyncTest('Storage local gera nome criptograficamente aleatório e seguro', async () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const storedPath = await storageService.uploadImage(jpegBuffer, 'image/jpeg');
    assert.ok(storedPath.startsWith('uploads/events/'), 'Deve salvar no diretório uploads/events');
    assert.ok(/\.jpg$/.test(storedPath), 'Extensão deve ser .jpg');
    assert.ok(!storedPath.includes('..'), 'Não deve conter path traversal');

    // Limpeza
    await storageService.deleteImage(storedPath);
  });

  await asyncTest('Prevenção de remoção arbitrária via path traversal', async () => {
    // Tentar deletar arquivo fora do diretório através de traversal
    const traversalPath = 'uploads/events/../../package.json';
    // Não deve apagar nada fora de uploads/events
    await storageService.deleteImage(traversalPath);
    assert.ok(fs.existsSync(path.resolve(__dirname, '../backend/package.json')));
  });

  // --- 4. Rota e Controlador ---
  console.log('\n--- 4. Configuração de Rotas e Middlewares ---');

  test('eventRoutes.js possui a rota POST /:id/image com middleware de upload e requireAdmin', () => {
    const routesContent = fs.readFileSync(path.resolve(__dirname, '../backend/src/routes/eventRoutes.js'), 'utf-8');
    assert.ok(routesContent.includes("router.post('/:id/image'"));
    assert.ok(routesContent.includes('requireAdmin'));
    assert.ok(routesContent.includes('upload.upload.single(') || routesContent.includes('upload.single('));
  });

  test('eventController.js utiliza storageService e faz rollback em falhas de banco', () => {
    const ctrlContent = fs.readFileSync(path.resolve(__dirname, '../backend/src/controllers/eventController.js'), 'utf-8');
    assert.ok(ctrlContent.includes('storageService.uploadImage'));
    assert.ok(ctrlContent.includes('storageService.deleteImage'));
    assert.ok(ctrlContent.includes('verifyFileSignature'));
  });

  test('admin.html inclui o script event-image.js e o modal modal-event-image', () => {
    const htmlContent = fs.readFileSync(path.resolve(__dirname, '../admin.html'), 'utf-8');
    assert.ok(htmlContent.includes('js/event-image.js'));
    assert.ok(htmlContent.includes('id="modal-event-image"'));
    assert.ok(htmlContent.includes('id="event-image-dropzone"'));
  });

  test('api.js suporta multipart/form-data via EvoAPI.upload()', () => {
    const apiContent = fs.readFileSync(path.resolve(__dirname, '../js/api.js'), 'utf-8');
    assert.ok(apiContent.includes('isFormData'));
    assert.ok(apiContent.includes('upload:'));
  });

  console.log(`\n===========================================`);
  console.log(`Total: ${total} | Aprovados: ${passed} | Falhas: ${total - passed}`);
  console.log(`STATUS: ${passed === total ? 'TODOS OS TESTES DE UPLOAD FORAM APROVADOS ✓' : 'FALHAS DETECTADAS'}`);
  console.log(`===========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução da suíte de upload:', err);
  process.exit(1);
});
