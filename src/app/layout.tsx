import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "LimerX - Assistant expert des normes techniques",
  description:
    "Chatbot IA specialise sur la norme NF C15-100 et autres normes techniques, avec reponses sourcees.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
