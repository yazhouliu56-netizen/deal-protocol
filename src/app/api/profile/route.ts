import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { maskPhone } from "@/lib/privacy-guard";

/**
 * profiles 线上实测列白名单（2026-09 实探）。
 * email/roles/bio/skills/service_areas/avatar_url 等列不存在，
 * 写入即整行被拒；扩展画像字段待 P8 迁移后再放行。
 */
const PROFILE_LIVE_COLUMNS =
  'id, name, phone, role, credit_score, balance, created_at, verification_status, verification_rejected_reason, verification_submitted_at, verification_reviewed_at, verification_reviewed_by';

export const GET = withAuth(async (req, user) => {
  const svc = await getRouteClient()

  const { data: profile } = await svc
    .from('profiles')
    .select(PROFILE_LIVE_COLUMNS)
    .eq('id', user.id)
    .single();

  if (!profile) {
    const meta = (user as unknown as { user_metadata?: Record<string, unknown> }).user_metadata ?? {};
    const metaRole = typeof meta.role === 'string' ? meta.role : null;
    const safeRole = metaRole === 'provider' || metaRole === 'both' ? metaRole : 'demander';
    const newProfile = {
      id: user.id,
      name: typeof meta.name === 'string' ? meta.name : (user.email?.split('@')[0] ?? '用户'),
      phone: typeof meta.phone === 'string' ? meta.phone : null,
      role: safeRole,
      verification_status: 'unverified',
    }
    const { data: newUser, error: insertError } = await svc
      .from('profiles')
      .insert(newProfile)
      .select(PROFILE_LIVE_COLUMNS)
      .single()
    if (insertError || !newUser) {
      console.warn('[API Profile] Failed to auto-create profile:', insertError?.message)
      return NextResponse.json({ user: null, error: 'Profile creation failed' }, { status: 200 })
    }
    if (newUser.phone) newUser.phone = maskPhone(newUser.phone)
    return NextResponse.json({ user: newUser })
  }

  if (profile.phone) profile.phone = maskPhone(profile.phone)
  return NextResponse.json({ user: profile });
});

export const PATCH = withAuth(async (req, user) => {
  const svc = await getRouteClient()
  const body = await req.json();
  const { name, phone, currentPassword, newPassword, bio, skills, service_areas } = body;

  const updateData: Record<string, string | number | null> = {};

  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (bio !== undefined || skills !== undefined || service_areas !== undefined) {
    // 扩展画像列线上不存在：明示拒绝，而非静默丢弃。
    return NextResponse.json(
      { error: "EXTENDED_PROFILE_UNSUPPORTED", message: "服务商简介字段待画像迁移后开放" },
      { status: 400 },
    );
  }

  if (currentPassword && newPassword) {
    // profiles 无 email 列：改密凭证取 auth 用户自身邮箱。
    if (!user.email) {
      return NextResponse.json({ error: "无法验证当前密码" }, { status: 400 });
    }

    const { error: signInError } = await svc.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
    }

    const { error: updateError } = await svc.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json({ error: "密码修改失败" }, { status: 400 });
    }
  }

  const { data: updated, error: updateError } = await svc
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)
    .select(PROFILE_LIVE_COLUMNS)
    .single();

  if (updateError) {
    console.warn('[API Profile] Update failed:', updateError.message)
    return NextResponse.json({ user: null, error: updateError.message }, { status: 200 })
  }

  return NextResponse.json({ user: updated });
});
