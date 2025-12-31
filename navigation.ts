import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from '@/i18n-config';

export const localePrefix = 'always';

export const {
  Link,
  redirect,
  usePathname,
  useRouter
} = createNavigation({
  locales,
  defaultLocale,
  localePrefix
});
