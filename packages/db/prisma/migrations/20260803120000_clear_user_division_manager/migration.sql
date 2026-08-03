-- Division and division manager are set on projects/reports, not user accounts.
UPDATE "User"
SET
  division = NULL,
  "managerId" = NULL
WHERE division IS NOT NULL OR "managerId" IS NOT NULL;
