import { defineMiddleware } from 'astro:middleware';
import { getUser } from './lib/auth';
import { resolveAdminLocale } from './i18n/loaders';

export const onRequest = defineMiddleware(async (context, next) => {
  const user = await getUser(context.cookies, context.request);

  const locale = resolveAdminLocale({
    url: new URL(context.request.url),
    userMetadataLocale: (user?.user_metadata as { locale?: string } | undefined)?.locale ?? null,
    cookieLocale: context.cookies.get('onboarding_locale')?.value ?? null,
    acceptLanguage: context.request.headers.get('accept-language'),
  });

  context.locals.user = user
    ? { id: user.id, email: user.email ?? '', locale }
    : null;
  context.locals.locale = locale;

  return next();
});
