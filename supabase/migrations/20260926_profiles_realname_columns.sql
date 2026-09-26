-- 20260926: profiles 实名三件套列（P2-b 只做实名 · 用户裁决 2026-09-26）
--
-- 背景：实名全自动、无人工审核。手机（SMS 成功打戳）＋身份证（vendor 三要素；
-- 确定性 SHA-256 哈希供 R2 撞库，随机 IV 密文不可比）＋人脸（照片采集先行，
-- 活体厂商 E 组另案）。纯 ADD COLUMN（F2 只增不改），幂等可重放。
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_number_hash TEXT,
  ADD COLUMN IF NOT EXISTS face_image_url TEXT,
  ADD COLUMN IF NOT EXISTS face_verified_at TIMESTAMPTZ;
COMMENT ON COLUMN public.profiles.phone_verified_at IS '手机验证通过时刻（SMS 成功打戳）';
COMMENT ON COLUMN public.profiles.id_number_hash IS '身份证归一化 SHA-256（R2 同证多号撞库用；密文随机 IV 不可比）';
COMMENT ON COLUMN public.profiles.face_image_url IS '人脸采集照（活体厂商接入前人工位空置，审核走自动）';
COMMENT ON COLUMN public.profiles.face_verified_at IS '人脸通过时刻（vendor/人工位，自动流由系统直写）';
