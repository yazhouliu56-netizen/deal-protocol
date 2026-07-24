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

    const { error: profileError } = await svc.from("profiles").insert({
      id: userId,
      name,
      phone,
      role: "demander",
      roles: JSON.stringify(["demander"]),
    });

    if (profileError) {
      return NextResponse.json({ error: "创建用户资料失败" }, { status: 500 });
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
      body: JSON.stringify({ password: tempPassword }),
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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });

  const { error: signInError } = await supabase.auth.signInWithPassword({
    phone,
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
