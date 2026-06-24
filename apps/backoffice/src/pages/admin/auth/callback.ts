import type { APIRoute } from 'astro';
import { createSupabaseServerInstance } from '@retaha/auth';
import { SUPPORTED_ADMIN_LOCALES } from '../../../i18n/constants';
import type { AdminLocale } from '../../../i18n/types';

export const GET: APIRoute = async ({ cookies, request, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/overview';

  if (!code) {
    return redirect('/admin/login?error=no_code');
  }

  const client = createSupabaseServerInstance(cookies, request);
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error.message);
    return redirect(`/admin/login?error=${encodeURIComponent(error.message)}`);
  }

  // Onboarding-Cookie → user_metadata.locale übernehmen (falls Cookie da und Metadata noch leer)
  await adoptOnboardingLocale(client, cookies);

  return redirect(next);
};

async function adoptOnboardingLocale(
  client: ReturnType<typeof createSupabaseServerInstance>,
  cookies: Parameters<APIRoute>[0]['cookies'],
) {
  const onboardingLocale = cookies.get('onboarding_locale')?.value;
  if (!onboardingLocale || !SUPPORTED_ADMIN_LOCALES.includes(onboardingLocale as AdminLocale)) {
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  // Nur übernehmen wenn user_metadata.locale noch nicht gesetzt — sonst hätte ein Re-Login die User-Pref überschreiben können
  const currentLocale = (user.user_metadata as { locale?: string } | undefined)?.locale;
  if (!currentLocale) {
    await client.auth.updateUser({ data: { locale: onboardingLocale } });
    await client.auth.refreshSession();
  }

  // Cookie aufräumen — user_metadata ist jetzt Source-of-Truth
  cookies.delete('onboarding_locale', { path: '/' });
}
