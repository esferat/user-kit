import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Suspense } from "react";
import { Providers } from "./providers";
import {AppShell} from "@/widgets/app-shell";

import "antd/dist/reset.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "User Kit",
  description: "Next.js application of the user-kit monorepo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/*
          antd создаёт кэш css-in-js через Math.random() при первом рендере.
          При cacheComponents такое значение нельзя вычислять на этапе
          пререндера, поэтому дерево отдаётся потоком на запрос.
        */}
        <Suspense fallback={null}>
          <AntdRegistry>
            <Providers>
              <AppShell>{children}</AppShell>
            </Providers>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
