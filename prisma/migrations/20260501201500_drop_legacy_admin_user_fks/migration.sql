-- Standalone admin sessions use identifiers like `admin:<login>`, not User rows.
-- These legacy foreign keys were left from the older user-backed admin model and
-- can make admin actions fail when they try to write audit/moderation metadata.
ALTER TABLE IF EXISTS "AdminActionLog"
DROP CONSTRAINT IF EXISTS "AdminActionLog_adminUserId_fkey";

ALTER TABLE IF EXISTS "CustomLocation"
DROP CONSTRAINT IF EXISTS "CustomLocation_approvedById_fkey";

ALTER TABLE IF EXISTS "PasswordResetRequest"
DROP CONSTRAINT IF EXISTS "PasswordResetRequest_processedById_fkey";
