UPDATE "Property"
SET "status" = 'draft'
WHERE "status" = 'paid';

UPDATE "Property"
SET "status" = 'rejected'
WHERE "status" = 'needs_fix';

UPDATE "Property"
SET "pendingEditStatus" = 'draft'
WHERE "pendingEditStatus" = 'paid';

UPDATE "Property"
SET "pendingEditStatus" = 'rejected'
WHERE "pendingEditStatus" = 'needs_fix';
