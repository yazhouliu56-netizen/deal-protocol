ALTER TABLE protocols DROP CONSTRAINT IF EXISTS protocols_status_check;
ALTER TABLE protocols ADD CONSTRAINT protocols_status_check
  CHECK (status IN (
    'draft','pending_confirm','pending_held','matching','matched',
    'completed','disputed','cancelled','satisfaction_held','settled','rejected'
  ));
