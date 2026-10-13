import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TransitProvider } from "../components/providers/TransitProvider";
import { AppExperience } from "../components/navigation/AppExperience";
import { PwaSupport } from "../components/pwa/PwaSupport";
import { ThemeOnboarding } from "../components/common/ThemePicker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  applicationName: "Smart Safar",
  title: "Smart Safar Faisalabad",
  description: "Smart Public Transit for Faisalabad",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Smart Safar" },
};

export const viewport = { themeColor: "#0F5797", colorScheme: "light", viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="blue"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: '(function(){try{if(localStorage.getItem("smart-safar-theme-v1")==="orange")document.documentElement.dataset.theme="orange";var m=localStorage.getItem("smart-safar-data-saver")||"automatic",c=navigator.connection;document.documentElement.dataset.dataSaver=(m==="on"||(m!=="off"&&c&&(c.saveData||["slow-2g","2g","3g"].includes(c.effectiveType))))?"on":"off"}catch(e){}})()' }} /></head>
      <body className="min-h-full flex flex-col"><TransitProvider><AppExperience>{children}</AppExperience><PwaSupport /><ThemeOnboarding /></TransitProvider></body>
    </html>
  );
}
