import { getSupabase, getServiceClient } from "@/lib/supabase-client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, email, password, phone, role, roles } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const selectedRoles = roles && Array.isArray(roles) && roles.length > 0
      ? roles
      : role
        ? [role]
        : ["CUSTOMER"];

    // Try standard Supabase Auth signUp first
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, role: selectedRoles[0], roles: JSON.stringify(selectedRoles) },
      },
    });

    let userId: string | undefined = authData?.user?.id;

    // If rate-limited, try admin API with service_role key
    if ((authError && authError.message?.includes?.("rate limit")) || !userId) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        const adminRes = await fetch(
          "https://eixqnwaxcnwtxiizmdfs.supabase.co/auth/v1/admin/users",
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
                role: selectedRoles[0],
                roles: JSON.stringify(selectedRoles),
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
              role: selectedRoles[0],
              roles: JSON.stringify(selectedRoles),
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

    const { data: user, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        name,
        email,
        phone: phone || null,
        role: selectedRoles[0],
        roles: JSON.stringify(selectedRoles),
      })
      .select('id, name, email, role, roles, phone, created_at')
      .single();

    if (profileError) throw profileError;

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
