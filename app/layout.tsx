import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Call a Star',
  description: 'Call a Star platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
