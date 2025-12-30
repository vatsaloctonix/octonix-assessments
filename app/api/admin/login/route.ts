import { NextResponse } from "next/server";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  const adminPassword = requireEnv("ADMIN_PASSWORD");

  if (!password || password !== adminPassword) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("oct_admin", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
