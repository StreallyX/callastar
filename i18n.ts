import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './i18n-config';

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = locales.includes(locale as any)
    ? locale
    : defaultLocale;

  if (!safeLocale) notFound();

  return {
    locale: safeLocale,
    messages: (await import(`./messages/${safeLocale}.json`)).default
  };
});
