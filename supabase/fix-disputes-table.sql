ALTER TABLE disputes ALTER COLUMN protocol_id TYPE TEXT;
NOTIFY pgrst, 'reload schema';
