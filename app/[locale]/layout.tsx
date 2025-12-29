import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';
import { GoogleAnalytics } from '@next/third-parties/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n-config';
import { Footer } from '@/components/footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Call a Star - Connectez-vous avec vos créateurs préférés',
  description:
    'Plateforme SaaS permettant aux influenceurs de monétiser leur audience en offrant des appels vidéo payants à leurs fans',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg'
  },
  openGraph: {
    images: ['/og-image.png']
  }
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;

  if (!locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages({ locale });
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <div className="flex flex-col min-h-screen">
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
