import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400","500","600","700","800"] });
const plex = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400","500","600"] });

export const metadata: Metadata = {
  title: "RateGuard",
  description: "FM/SC rate card management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${plex.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
