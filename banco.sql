CREATE DATABASE IF NOT EXISTS evotechevents;
USE evotechevents;
SELECT DATABASE();
USE evotech_events;

desc users;

SELECT
    id,
    name,
    email,
    role,
    status,
    created_at
FROM users
ORDER BY created_at DESC;

SELECT COUNT(*) AS total_usuarios
FROM users;

SELECT id, name, slug, owner_user_id
FROM organizations;



SELECT DATABASE();

INSERT INTO organizations (name, slug, owner_user_id)
SELECT
    'OffCampus',
    'OffCampus',
    id
FROM users
WHERE email = 'gabrielperugorria681@gmail.com';

INSERT INTO organization_members
    (organization_id, user_id, role, status)
SELECT
    o.id,
    u.id,
    'owner',
    'active'
FROM users u
JOIN organizations o ON o.owner_user_id = u.id
WHERE u.email = 'gabrielperugorria681@gmail.com'
ON DUPLICATE KEY UPDATE
    role = 'owner',
    status = 'active';

SELECT
    o.id,
    o.name,
    o.slug,
    u.email
FROM organizations o
JOIN users u ON u.id = o.owner_user_id
WHERE u.email = 'gabrielperugorria681@gmail.com';

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

show tables;
