-- A custom voice may have no separate consent record.
--
-- OpenAI enrols a voice in two calls, a consent record and then the voice, and
-- keeps them as separate objects that must each be deleted on revocation.
-- Google takes the consent recording inside the single call that creates the
-- voice and verifies it there, so there is no consent identifier to store.
-- Forcing one would mean inventing a value that names nothing.
ALTER TABLE "custom_voices" ALTER COLUMN "provider_consent_id" DROP NOT NULL;
