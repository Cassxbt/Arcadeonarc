import type { Metadata } from "next";
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
  title: "ARCade - Crypto Gaming on Arc L1",
  description: "Play Tower, Dice, and Cannon Crash games. Win USDC instantly on Arc L1 blockchain.",
  keywords: ["crypto", "gaming", "arcade", "usdc", "arc", "blockchain", "tower", "dice", "crash"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
