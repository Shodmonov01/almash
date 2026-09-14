import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { OnboardingGate } from "@/components/OnboardingGate";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

const sans = Nunito({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const metadata: Metadata = {
  title: "SwapToy — безопасный обмен игрушками",
  description:
    "Платформа обмена игрушками и детскими аксессуарами без денег, продаж и доплат.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <AuthProvider>
          <OnboardingGate>
            <AppShell>{children}</AppShell>
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}
