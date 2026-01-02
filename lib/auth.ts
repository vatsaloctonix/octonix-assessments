import { createSupabaseServiceClient } from "./supabaseServer";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export type AdminRole = "super_admin" | "trainer";

export type Admin = {
  id: string;
  email: string;
  role: AdminRole;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type Session = {
  id: string;
  admin_id: string;
  token: string;
  expires_at: string;
};

const SESSION_COOKIE_NAME = "octonix_session";
const SESSION_DURATION_DAYS = 7;

// ==============================================================================
// PASSWORD HASHING (using Node.js crypto for simplicity, bcrypt would be better)
// ==============================================================================

export async function hashPassword(password: string): Promise<string> {
  // Using bcrypt-compatible hash format
  // In production, use bcryptjs library
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}

// ==============================================================================
// SESSION MANAGEMENT
// ==============================================================================

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(adminId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const token = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const { error } = await supabase
    .from("sessions")
    .insert({
      admin_id: adminId,
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return token;
}

export async function getSessionFromCookie(): Promise<{ session: Session; admin: Admin } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const supabase = createSupabaseServiceClient();

  // Get session with admin data
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, admins (*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (sessionError || !session) {
    return null;
  }

  const admin = session.admins as any;

  // Check if admin is active
  if (!admin.is_active) {
    await deleteSession(token);
    return null;
  }

  return {
    session: {
      id: session.id,
      admin_id: session.admin_id,
      token: session.token,
      expires_at: session.expires_at,
    },
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
      is_active: admin.is_active,
      created_at: admin.created_at,
    },
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function deleteSession(token: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  await supabase.from("sessions").delete().eq("token", token);
}

// ==============================================================================
// AUTHENTICATION
// ==============================================================================

export async function authenticate(email: string, password: string): Promise<Admin | null> {
  const supabase = createSupabaseServiceClient();

  const { data: admin, error } = await supabase
    .from("admins")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error || !admin) {
    return null;
  }

  // Check if active
  if (!admin.is_active) {
    return null;
  }

  // Verify password
  const isValid = await verifyPassword(password, admin.password_hash);
  if (!isValid) {
    return null;
  }

  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    name: admin.name,
    is_active: admin.is_active,
    created_at: admin.created_at,
  };
}

// ==============================================================================
// AUTHORIZATION
// ==============================================================================

export function requireSuperAdmin(admin: Admin | null): void {
  if (!admin || admin.role !== "super_admin") {
    throw new Error("Unauthorized: Super admin access required");
  }
}

export function requireAuth(admin: Admin | null): void {
  if (!admin) {
    throw new Error("Unauthorized: Authentication required");
  }
}
