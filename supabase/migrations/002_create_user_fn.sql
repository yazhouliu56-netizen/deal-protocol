-- Function to create user bypassing rate limits (SECURITY DEFINER)
-- Run this in Supabase SQL Editor once.
-- Grant execute to anon so the register API can call it.
CREATE OR REPLACE FUNCTION create_user_direct(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_roles JSONB DEFAULT '["CUSTOMER"]'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_encrypted_pw TEXT;
  v_result JSON;
BEGIN
  -- Check existing
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object('error', 'Email already registered');
  END IF;

  -- Encrypt password using Supabase's built-in cryp function
  v_encrypted_pw := crypt(p_password, gen_salt('bf', 10));

  -- Create user in auth schema
  v_user_id := gen_random_uuid();
  v_role := p_roles->>0;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    confirmation_sent_at, confirmation_token,
    recovery_token, raw_app_meta_data,
    created_at, updated_at, last_sign_in_at,
    is_sso_user, deleted_at
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', p_email,
    v_encrypted_pw, now(), now(),
    encode(gen_random_bytes(32), 'hex'),
    encode(gen_random_bytes(32), 'hex'),
    jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'name', p_name,
      'phone', p_phone,
      'role', v_role,
      'roles', p_roles::text,
      'email_verified', true
    ),
    now(), now(), now(),
    false, null
  );

  -- Create identity record for the user
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object(
      'sub', v_user_id,
      'email', p_email,
      'name', p_name
    ),
    'email', p_email,
    now(), now(), now()
  );

  -- Insert profile
  INSERT INTO public.profiles (
    id, name, email, phone, role, roles, balance, credit_score, created_at
  ) VALUES (
    v_user_id, p_name, p_email, p_phone, v_role,
    p_roles::text, 0, 100, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    roles = EXCLUDED.roles;

  v_result := json_build_object(
    'id', v_user_id,
    'name', p_name,
    'email', p_email,
    'role', v_role,
    'roles', p_roles
  );

  RETURN v_result;
END;
$$;

-- Grant execute to anon role so the register API can use it
GRANT EXECUTE ON FUNCTION create_user_direct TO anon;
GRANT EXECUTE ON FUNCTION create_user_direct TO authenticated;

-- Rate-limit bypass: register API can call this RPC when signUp() is rate-limited
