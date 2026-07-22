import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";

export const GET = withAuth(async (req, user) => {
  const svc = await getRouteClient()

  const { data: profile, error } = await svc
    .from('profiles')
    .select('id, name, email, phone, role, roles, credit_score, balance, created_at, bio, skills, service_areas, avatar_url, verification_status, verification_real_name, verification_id_number, verification_certificates, verification_rejected_reason, verification_submitted_at, verification_reviewed_at, verification_reviewed_by')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const newProfile = {
      id: user.id, name: user.name, email: user.email,
      phone: null, role: user.role, roles: user.roles,
      verification_status: 'unverified',
    }
    const { data: newUser, error: insertError } = await svc
      .from('profiles')
      .insert(newProfile)
      .select('id, name, email, phone, role, roles, credit_score, balance, created_at, bio, skills, service_areas, avatar_url, verification_status, verification_real_name, verification_id_number, verification_certificates, verification_rejected_reason, verification_submitted_at, verification_reviewed_at, verification_reviewed_by')
      .single()
    if (insertError || !newUser) {
      return NextResponse.json({ error: insertError?.message || 'Failed to create profile' }, { status: 500 })
    }
    return NextResponse.json({ user: newUser })
  }

  return NextResponse.json({ user: profile });
});

export const PATCH = withAuth(async (req, user) => {
  const svc = await getRouteClient()
  const body = await req.json();
  const { name, phone, currentPassword, newPassword, bio, skills, service_areas } = body;

  const updateData: Record<string, string | number | null | string[]> = {};

  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (bio !== undefined) updateData.bio = bio;
  if (skills !== undefined) updateData.skills = skills;
  if (service_areas !== undefined) updateData.service_areas = service_areas;

  if (currentPassword && newPassword) {
    const { data: profile } = await svc
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (!profile?.email) {
      return NextResponse.json({ error: "无法验证当前密码" }, { status: 400 });
    }

    const { error: signInError } = await svc.auth.signInWithPassword({
      email: profile.email,
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
    .select('id, name, email, phone, role, credit_score, balance, verification_status, verification_real_name, verification_id_number, verification_certificates, verification_rejected_reason, verification_submitted_at, verification_reviewed_at, verification_reviewed_by')
    .single();

  if (updateError) throw updateError;

  return NextResponse.json({ user: updated });
});
