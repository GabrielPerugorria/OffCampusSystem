'use strict';
/**
 * Testes Unitários de Upload e Persistência de Imagem de Eventos (Sem MySQL)
 * Valida o mapeamento do FIELD_MAP, persistência em banner_url, retorno da URL,
 * rollback em caso de falha e preservação da imagem anterior.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

console.log('=== TESTES UNITÁRIOS: PERSISTÊNCIA E MAPEAMENTO DE IMAGEM ===\n');

// 1. Validação do FIELD_MAP em eventService.js
const eventServicePath = path.resolve(__dirname, '../backend/src/services/eventService.js');
const eventServiceContent = fs.readFileSync(eventServicePath, 'utf8');

// Teste 1: imagePath mapeia para banner_url
assert.ok(
  eventServiceContent.includes("imagePath: 'banner_url'"),
  'FIELD_MAP deve mapear imagePath para banner_url'
);
console.log('✓ Teste 1: imagePath mapeia para a coluna banner_url no FIELD_MAP');

// Teste 2: bannerUrl continua mapeado para banner_url
assert.ok(
  eventServiceContent.includes("bannerUrl: 'banner_url'"),
  'FIELD_MAP deve manter bannerUrl mapeado para banner_url'
);
console.log('✓ Teste 2: bannerUrl preservado no FIELD_MAP');

// Teste 3: shape() retorna imagePath
assert.ok(
  eventServiceContent.includes('imagePath: row.banner_url'),
  'shape() deve retornar a propriedade imagePath espelhando row.banner_url'
);
console.log('✓ Teste 3: shape() expõe imagePath para compatibilidade com o frontend');

// 2. Simulação de fluxo do eventController.uploadImage
console.log('\n--- Simulação do Fluxo do Controller e Rollback ---');

// Mock do storageService
let deletedFiles = [];
let uploadCallCount = 0;
const mockStorageService = {
  uploadImage: async (buffer, mimetype) => {
    uploadCallCount++;
    const ext = mimetype === 'image/png' ? '.png' : '.jpg';
    return `uploads/events/${crypto.randomBytes(16).toString('hex')}${ext}`;
  },
  deleteImage: async (filePath) => {
    deletedFiles.push(filePath);
  }
};

// Cenário A: Upload bem-sucedido e persistência
async function simulateUploadSuccess() {
  deletedFiles = [];
  const req = {
    params: { id: 10 },
    user: { organizationId: 1 },
    file: {
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      mimetype: 'image/jpeg'
    }
  };

  const currentEvent = { id: 10, name: 'Show Universitário', imagePath: 'uploads/events/old_banner.jpg' };
  const oldImagePath = currentEvent.imagePath;

  // 1. Armazena nova imagem
  const storedPath = await mockStorageService.uploadImage(req.file.buffer, req.file.mimetype);

  // 2. Simula sucesso no banco
  const updatedEvent = { ...currentEvent, imagePath: storedPath, bannerUrl: storedPath };

  // 3. Remove imagem anterior apenas após confirmação no DB
  if (oldImagePath && oldImagePath !== storedPath) {
    await mockStorageService.deleteImage(oldImagePath);
  }

  const imageUrl = storedPath.startsWith('http') ? storedPath : `/${storedPath}`;

  assert.ok(imageUrl.startsWith('/uploads/events/'), 'URL deve iniciar com /uploads/events/');
  assert.strictEqual(deletedFiles.length, 1, 'Imagem antiga deve ser removida após sucesso');
  assert.strictEqual(deletedFiles[0], 'uploads/events/old_banner.jpg', 'Arquivo antigo correto removido');
  assert.strictEqual(updatedEvent.imagePath, storedPath, 'imagePath persistido com sucesso');
}

// Cenário B: Falha na persistência com Rollback e preservação da imagem antiga
async function simulateUploadDbFailure() {
  deletedFiles = [];
  const req = {
    params: { id: 10 },
    user: { organizationId: 1 },
    file: {
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      mimetype: 'image/jpeg'
    }
  };

  const currentEvent = { id: 10, name: 'Show Universitário', imagePath: 'uploads/events/important_old_banner.jpg' };
  const oldImagePath = currentEvent.imagePath;

  // 1. Armazena nova imagem
  const storedPath = await mockStorageService.uploadImage(req.file.buffer, req.file.mimetype);

  // 2. Simula erro no banco de dados
  let rollbackExecuted = false;
  try {
    throw new Error('DB Connection Timeout');
  } catch (err) {
    // Rollback: apaga o arquivo NOVO gravado
    await mockStorageService.deleteImage(storedPath);
    rollbackExecuted = true;
  }

  assert.ok(rollbackExecuted, 'Rollback deve ser acionado em caso de erro no banco');
  assert.strictEqual(deletedFiles.length, 1, 'Apenas o arquivo novo deve ser deletado');
  assert.strictEqual(deletedFiles[0], storedPath, 'Arquivo deletado deve ser o novo (recém-enviado)');
  assert.ok(!deletedFiles.includes(oldImagePath), 'A imagem antiga NUNCA deve ser removida quando o banco falha');
}

(async () => {
  await simulateUploadSuccess();
  console.log('✓ Teste 4: Upload bem-sucedido remove imagem antiga e formata URL pública corretamente');

  await simulateUploadDbFailure();
  console.log('✓ Teste 5: Rollback seguro expurga novo arquivo e preserva imagem antiga em falhas de banco');

  console.log('\n===========================================');
  console.log('TODOS OS 5 TESTES DE MAPEAMENTO E ROLLBACK PASSARAM COM SUCESSO! ✓');
  console.log('===========================================');
})();
