import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppFrame } from "../components/AppFrame";

export const metadata: Metadata = {
  title: "Conversational Marketing SaaS",
  description: "WhatsApp CRM, campaigns, automation and AI approval workflow",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="pt-BR">
      <body>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
