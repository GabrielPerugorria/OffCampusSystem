-- ==============================================================================
-- EVO TECH EVENTS / OFFCAMPUS SYSTEM
-- Script Oficial de Configuração e Associação de Organização (Fase 5 - Homologado)
-- Banco de dados oficial: evotech_events (MySQL 8.0)
-- Totalmente idempotente e seguro contra ER_DUP_ENTRY
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS evotech_events
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE evotech_events;

SELECT DATABASE() AS banco_em_uso;

-- 1. Diagnóstico de Estrutura e Usuários
DESCRIBE users;

SELECT
    id,
    name,
    email,
    role,
    status,
    created_at
FROM users
ORDER BY created_at DESC;

SELECT COUNT(*) AS total_usuarios FROM users;

-- 2. Diagnóstico de Organizações Existentes
SELECT id, name, slug, owner_user_id FROM organizations;

-- 3. Inserção / Garantia Idempotente da Organização OffCampus
INSERT INTO organizations (name, slug, owner_user_id)
SELECT
    'OffCampus',
    'offcampus',
    u.id
FROM users u
WHERE u.email = 'gabrielperugorria681@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM organizations WHERE slug = 'offcampus'
  );

-- Atualiza owner se a organização já existia mas com outro proprietário
UPDATE organizations o
JOIN users u ON u.email = 'gabrielperugorria681@gmail.com'
SET o.owner_user_id = u.id
WHERE o.slug = 'offcampus' AND o.owner_user_id != u.id;

-- 4. Associação Idempotente do Usuário como Membro Owner Ativo
INSERT INTO organization_members
    (organization_id, user_id, role, status)
SELECT
    o.id,
    u.id,
    'owner',
    'active'
FROM users u
JOIN organizations o ON o.slug = 'offcampus'
WHERE u.email = 'gabrielperugorria681@gmail.com'
ON DUPLICATE KEY UPDATE
    role = 'owner',
    status = 'active';

-- 5. Conferência de Vínculo Proprietário
SELECT
    o.id,
    o.name,
    o.slug,
    u.email
FROM organizations o
JOIN users u ON u.id = o.owner_user_id
WHERE u.email = 'gabrielperugorria681@gmail.com';

-- 6. Conferência de Membros e Produtoras
SELECT
    u.name,
    u.email,
    o.name AS produtora,
    om.role,
    om.status
FROM users u
JOIN organization_members om ON om.user_id = u.id
JOIN organizations o ON o.id = om.organization_id
ORDER BY u.created_at DESC;

-- 7. Relação Completa de Tabelas Homologadas (25 tabelas)
SHOW TABLES;
