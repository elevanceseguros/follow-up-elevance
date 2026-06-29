import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'elevance_admin_session';

function expectedSessionValue() {
  const email = process.env.ADMIN_EMAIL;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!email || !secret) return null;
  return `${email}:${secret}`;
}

export async function isAdminLoggedIn() {
  const expected = expectedSessionValue();
  if (!expected) return false;
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === expected;
}

export async function requireAdmin() {
  const logged = await isAdminLoggedIn();
  if (!logged) redirect('/login');
}

export async function loginAdmin(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const expected = expectedSessionValue();

  if (!adminEmail || !adminPassword || !expected) {
    throw new Error('Login admin não configurado. Defina ADMIN_EMAIL, ADMIN_PASSWORD e ADMIN_SESSION_SECRET na Vercel.');
  }

  if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase() || password !== adminPassword) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
