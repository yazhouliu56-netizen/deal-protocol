import { getServiceClient } from "@/lib/supabase-client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, email, password, phone, role } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // role 白名单（users 表 CHECK 合法）：CUSTOMER/user/client 一律拒绝。
    const selectedRole = role === "provider" ? "provider" : role === "demander" ? "demander" : null;
    if (!selectedRole) {
      return NextResponse.json(
        { error: "INVALID_ROLE", message: "role 仅支持 demander / provider" },
        { status: 400 },
      );
    }

    // Try standard Supabase Auth signUp first
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, role: selectedRole },
      },
    });

    if (authError && /already registered|already exists/i.test(authError.message ?? "")) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    let userId: string | undefined = authData?.user?.id;

    // If rate-limited, try admin API with service_role key
    if ((authError && authError.message?.includes?.("rate limit")) || !userId) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const adminRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/users`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              name,
              phone: phone || null,
              role: selectedRole,
            },
          }),
          }
        )

        if (!adminRes.ok) {
          const adminErr = await adminRes.text().catch(() => "")
          return NextResponse.json(
            { error: `Admin create failed: ${adminErr.slice(0, 200)}` },
            { status: 500 }
          )
        }

        const adminData = await adminRes.json()
        userId = adminData.id

        return NextResponse.json(
          {
            message: "Registration successful",
            user: {
              id: userId,
              name,
              email,
              role: selectedRole,
              phone: phone || null,
            },
          },
          { status: 201 }
        )
      }

      return NextResponse.json(
        { error: authError?.message || "Registration failed (rate limited)" },
        { status: 429 }
      )
    }

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Registration failed" },
        { status: 500 }
      );
    }

    // profiles 线上实测列：无 email/roles，role 取白名单值。
    const { data: user, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        name,
        phone: phone || null,
        role: selectedRole,
      })
      .select('id, name, phone, role, created_at')
      .single();

    if (profileError) throw profileError;

    // users 外键底座：有手机号才补行（phone NOT NULL），无号待绑手机时由 sms 回填。
    if (phone) {
      const { error: userRowError } = await supabase
        .from('users')
        .upsert({ id: userId, phone, role: selectedRole }, { onConflict: 'id', ignoreDuplicates: true });
      if (userRowError) throw userRowError;
    }

    return NextResponse.json(
      { message: "Registration successful", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
