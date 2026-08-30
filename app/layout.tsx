import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PayLog | PayPay CSV Viewer',
  description: 'PayPayの取引履歴CSVをブラウザだけで安全に整理・集計できるビューアー。',
  openGraph: {
    title: 'PayLog | PayPay CSV Viewer',
    description: 'PayPayの取引を、ひと目でわかりやすく。CSVはブラウザ内だけで安全に処理します。',
    images: [{ url: '/og.png', width: 1734, height: 907, alt: 'PayLog — PayPayの取引を、ひと目でわかりやすく。' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PayLog | PayPay CSV Viewer',
    description: 'PayPayの取引を、ひと目でわかりやすく。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
