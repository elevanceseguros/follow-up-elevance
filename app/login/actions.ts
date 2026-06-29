'use server';

import { redirect } from 'next/navigation';
import { loginAdmin, logoutAdmin } from '@/lib/adminAuth';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  await loginAdmin(email, password);
  redirect('/');
}

export async function logoutAction() {
  await logoutAdmin();
  redirect('/login');
}
