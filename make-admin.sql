UPDATE profiles SET role = 'ADMIN' WHERE id = '97a6b155-017a-4776-8342-c1676ce01fd3';
UPDATE profiles SET roles = '["ADMIN","CUSTOMER","PROVIDER"]' WHERE id = '97a6b155-017a-4776-8342-c1676ce01fd3';

NOTIFY pgrst, 'reload schema';
