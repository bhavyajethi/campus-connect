BEGIN;

ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE registrations
SET is_verified = TRUE
WHERE status::text = 'attended'
  AND is_verified = FALSE;

COMMIT;