-- Query di verifica per controllare tracce residue dopo eliminazione istruttori
-- Esegui queste query nel SQL Editor di Supabase per verificare la pulizia del database

-- 1. Verifica profili eliminati (dovrebbe essere vuoto se gli istruttori sono stati eliminati)
-- Questa query mostra tutti i profili che hanno il ruolo 'instructor'
SELECT p.id, p.full_name, p.email, p.created_at
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = p.user_id
  AND ur.role = 'instructor'
)
ORDER BY p.full_name;

-- 2. Verifica collegamenti orfani in athlete_instructors
-- Questa query cerca collegamenti a profile_id che non esistono più
SELECT ai.id, ai.athlete_id, ai.profile_id, ai.created_at
FROM athlete_instructors ai
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.id = ai.profile_id
);

-- 3. Verifica atleti con instructor_id orfano
-- Questa query cerca atleti che puntano a un instructor_id che non esiste più
SELECT a.id, a.first_name, a.last_name, a.instructor_id
FROM athletes a
WHERE a.instructor_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.id = a.instructor_id
);

-- 4. Verifica coppie con instructor_id orfano
-- Questa query cerca coppie che puntano a un instructor_id che non esiste più
SELECT c.id, c.male_athlete_id, c.female_athlete_id, c.instructor_id
FROM couples c
WHERE c.instructor_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.id = c.instructor_id
);

-- 5. Verifica ruoli orfani in user_roles
-- Questa query cerca ruoli di utenti i cui profili non esistono più
SELECT ur.id, ur.user_id, ur.role, ur.created_at
FROM user_roles ur
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.user_id = ur.user_id
);

-- 6. Conta totale istruttori rimasti
SELECT COUNT(*) as total_instructors
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = p.user_id
  AND ur.role = 'instructor'
);

-- INTERPRETAZIONE DEI RISULTATI:
-- - Query 1: Mostra gli istruttori ancora presenti (dovrebbe mostrare solo quelli che NON hai eliminato)
-- - Query 2-5: Dovrebbero restituire 0 righe (nessun dato orfano)
-- - Query 6: Mostra il numero totale di istruttori rimasti nel sistema
