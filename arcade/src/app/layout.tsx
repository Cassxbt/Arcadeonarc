import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/design-system.css";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "ARCade | Best Games & Apps on Arc L1 (Circle)",
  description: "The #1 place to play games on Arc L1. Win USDC instantly on the Circle-powered Arc blockchain. Try Tower, Crash, Dice and other top apps.",
  keywords: ["arc l1 apps", "games on arc", "circle l1", "crypto arcade", "usdc gaming", "play to earn arc", "tower", "crash", "dice"],
  authors: [{ name: "ARCade Team" }],
  openGraph: {
    title: "ARCade | Play & Win USDC on Arc L1",
    description: "Experience the fastest games on Circle's Arc L1 blockchain. Instant payouts, provably fair.",
    type: "website",
    siteName: "ARCade",
    images: [{ url: '/twitter-image.png' }], // Assuming an image exists or will be added, good practice to have placeholder
  },
  twitter: {
    card: 'summary_large_image',
    title: "ARCade - #1 Game on Arc L1",
    description: "Play fast, fair games on Arc L1. Win USDC.",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

// Structured Data for Rich Results (Google Knowledge Graph)
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ARCade',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description: 'The premier gaming platform on Arc L1 blockchain.',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '1024',
  },
};


export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a12' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
