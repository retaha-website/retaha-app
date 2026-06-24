import type { APIRoute } from 'astro';
import { createServerClient } from '@retaha/db';
import { createSupabaseServerInstance } from '@retaha/auth';
import { SUPPORTED_ADMIN_LOCALES } from '../../../i18n/constants';
import type { AdminLocale } from '../../../i18n/types';

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  // Hard guard: only allow in dev mode
  if (!import.meta.env.DEV) {
    return new Response('Not available in production', { status: 403 });
  }

  const form = await request.formData();
  const email = form.get('email')?.toString().trim();

  if (!email) {
    return redirect('/admin/login?error=no_email');
  }

  // Use service role to generate a session for an existing user (no email sent)
  const admin = createServerClient();

  // Find user by email
  const { data: { users }, error: lookupErr } = await admin.auth.admin.listUsers();
  if (lookupErr) {
    return redirect(`/admin/login?error=${encodeURIComponent(lookupErr.message)}`);
  }

  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    return redirect(`/admin/login?error=${encodeURIComponent('User not found: ' + email)}`);
  }

  // Generate a magic link, then immediately consume it
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email!,
  });

  if (linkErr || !linkData.properties?.hashed_token) {
    return redirect(`/admin/login?error=${encodeURIComponent(linkErr?.message || 'no_token')}`);
  }

  // Use the hashed token to create a session via verifyOtp
  const client = createSupabaseServerInstance(cookies, request);
  const { error: verifyErr } = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyErr) {
    return redirect(`/admin/login?error=${encodeURIComponent(verifyErr.message)}`);
  }

  // Onboarding-Cookie → user_metadata.locale übernehmen (falls Cookie da und Metadata noch leer)
  const onboardingLocale = cookies.get('onboarding_locale')?.value;
  if (onboardingLocale && SUPPORTED_ADMIN_LOCALES.includes(onboardingLocale as AdminLocale)) {
    const { data: { user: sessionUser } } = await client.auth.getUser();
    const currentLocale = (sessionUser?.user_metadata as { locale?: string } | undefined)?.locale;
    if (sessionUser && !currentLocale) {
      await client.auth.updateUser({ data: { locale: onboardingLocale } });
      await client.auth.refreshSession();
    }
    cookies.delete('onboarding_locale', { path: '/' });
  }

  return redirect('/overview');
};
