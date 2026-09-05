import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase-client";
import { getSmsCode, deleteSmsCode } from "@/lib/sms-code-store";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(request: Request) {
  const { phone, code } = await request.json();

  if (!phone || !PHONE_REGEX.test(phone)) {
    return NextResponse.json(
      { success: false, error: "手机号格式不正确" },
      { status: 400 },
    );
  }

  if (!code || code.length !== 6) {
    return NextResponse.json(
      { success: false, error: "验证码格式不正确" },
      { status: 400 },
    );
  }

  const storedCode = getSmsCode(phone);
  if (!storedCode || storedCode !== code) {
    return NextResponse.json(
      { success: false, error: "验证码错误或已过期" },
      { status: 400 },
    );
  }

  deleteSmsCode(phone);

  const svc = getServiceClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const { data: existingProfile } = await svc
    .from("profiles")
    .select("id, name, phone, role, created_at")
    .eq("phone", phone)
    .maybeSingle();

  let userId: string;
  let isNewUser = false;
  let profileData: Record<string, unknown>;

  if (existingProfile) {
    userId = existingProfile.id;
    profileData = existingProfile;
    // 老号回填 users 行（短信建号早期版本未写 users 表，发单外键所需）。
    // 缺席才插：不覆盖既有 role（provider 等身份不受影响）。
    const { error: backfillError } = await svc.from("users").upsert(
      { id: userId, phone, role: "demander" },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (backfillError) {
      return NextResponse.json({ error: "补齐用户行失败" }, { status: 500 });
    }
  } else {
    const name = `用户_${phone.slice(-4)}`;

    const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        phone,
        password: crypto.randomUUID(),
        phone_confirm: true,
        email: `${phone}@sms.local`,
        email_confirm: true,
        user_metadata: { name, phone, role: "demander" },
      }),
    });

    if (!adminRes.ok) {
      const adminErr = await adminRes.text().catch(() => "");
      return NextResponse.json(
        { error: `创建用户失败: ${adminErr.slice(0, 200)}` },
        { status: 500 },
      );
    }

    const adminData = await adminRes.json();
    userId = adminData.id;

    // 线上 profiles 无 roles 列（COLS 实测）：只写真实列，否则整行被拒。
    const { error: profileError } = await svc.from("profiles").insert({
      id: userId,
      name,
      phone,
      role: "demander",
    });

    if (profileError) {
      return NextResponse.json({ error: "创建用户资料失败" }, { status: 500 });
    }

    // protocols.demander_id → users(id) 外键底座：短信号同步补 users 行，
    // 否则后续发单 insert 先过 RLS 再撞外键。role 取 users 表 CHECK 合法值。
    const { error: userRowError } = await svc.from("users").upsert(
      { id: userId, phone, role: "demander" },
      { onConflict: "id" },
    );

    if (userRowError) {
      return NextResponse.json({ error: "创建用户行失败" }, { status: 500 });
    }

    isNewUser = true;
    profileData = { id: userId, name, phone, role: "demander" };
  }

  const tempPassword = crypto.randomUUID();

  const updateRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${userId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      // 老号回填：密码轮换的同时补确认邮箱（短信建号的登录凭证）。
      body: JSON.stringify({ password: tempPassword, email_confirm: true }),
    },
  );

  if (!updateRes.ok) {
    const updateErr = await updateRes.text().catch(() => "");
    return NextResponse.json(
      { error: `更新用户密码失败: ${updateErr.slice(0, 200)}` },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });

  // 本实例未启用 Phone provider（Phone logins are disabled）：建号时已写入
  // `${phone}@sms.local` 邮箱，用 email 会话代替，同用户同临时密钥。
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: `${phone}@sms.local`,
    password: tempPassword,
  });

  if (signInError) {
    return NextResponse.json(
      { error: `登录失败: ${signInError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    user: profileData,
    isNewUser,
  });
}
