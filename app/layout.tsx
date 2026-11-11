import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Devanagari } from "next/font/google";
import { InteractionSounds } from "./components/feedback/InteractionSounds";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Replies can come back in Hindi, so Devanagari gets a matching face. Loaded only when used.
const plexDeva = IBM_Plex_Sans_Devanagari({
  variable: "--font-plex-deva",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "BolPay",
  description: "Voice-first payroll for daily-wage teams, paid out through PayPal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexDeva.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <InteractionSounds />
      </body>
    </html>
  );
}
