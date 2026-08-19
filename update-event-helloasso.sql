-- Script pour configurer l'événement "Le RétroBus de Noël" en mode HelloAsso
-- À exécuter dans votre base de données PostgreSQL

-- 1. Trouver l'événement
SELECT id, title, extras, "helloAssoUrl" 
FROM "Event" 
WHERE title ILIKE '%RétroBus de Noël%' OR title ILIKE '%Retrobus de Noel%';

-- 2. Mettre à jour l'événement avec HelloAsso
UPDATE "Event"
SET 
  "helloAssoUrl" = 'https://www.helloasso.com/associations/association-retrobus-essonne/evenements/le-retrobus-de-noel/widget',
  extras = jsonb_set(
    COALESCE(extras::jsonb, '{}'::jsonb),
    '{registrationMethod}',
    '"helloasso"'::jsonb
  )
WHERE title ILIKE '%RétroBus de Noël%' OR title ILIKE '%Retrobus de Noel%';

-- 3. Vérifier la mise à jour
SELECT 
  id, 
  title, 
  "helloAssoUrl",
  extras->>'registrationMethod' as registration_method,
  extras
FROM "Event" 
WHERE title ILIKE '%RétroBus de Noël%' OR title ILIKE '%Retrobus de Noel%';
