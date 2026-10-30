import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Suspense } from "react";
import { Providers } from "./providers";

import "antd/dist/reset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "User Kit — Игры",
  description: "Игры монорепозитория user-kit: «Цветные линии» и «Три в ряд»",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>
        {/*
          antd создаёт кэш css-in-js через Math.random() при первом рендере.
          При cacheComponents такое значение нельзя вычислять на этапе
          пререндера, поэтому дерево отдаётся потоком на запрос.
        */}
        <Suspense fallback={null}>
          <AntdRegistry>
            <Providers>{children}</Providers>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
