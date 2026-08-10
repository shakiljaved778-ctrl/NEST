import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { site, seo } from "@/data/content";
import { LanguageProvider } from "@/components/LanguageProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppFab from "@/components/WhatsAppFab";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: seo.home.title,
    template: "%s",
  },
  description: seo.home.description,
  keywords: [
    "website design Qatar",
    "web design Doha",
    "موقع الكتروني قطر",
    "web design agency Qatar",
    "bilingual website Qatar",
  ],
  openGraph: {
    type: "website",
    locale: "en_QA",
    siteName: site.name,
    url: site.url,
    title: seo.home.title,
    description: seo.home.description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.home.title,
    description: seo.home.description,
  },
  alternates: { canonical: site.url },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1B33",
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: site.name,
  description: seo.home.description,
  url: site.url,
  telephone: site.phoneDisplay,
  email: site.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "West Bay", // TODO: real address
    addressLocality: "Doha",
    addressCountry: "QA",
  },
  areaServed: "Qatar",
  priceRange: "QAR 3,500+",
  openingHours: "Su-Th 09:00-18:00",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <LanguageProvider>
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
          <WhatsAppFab />
        </LanguageProvider>
      </body>
    </html>
  );
}
