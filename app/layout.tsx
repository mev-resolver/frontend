import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resolver - MEV Mitigation Framework',
  description: 'Real-time sandwich attack detection and mitigation on Ethereum Sepolia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, background: '#0A0F1A', color: '#F3F4F6' }}>
        {children}
      </body>
    </html>
  );
}