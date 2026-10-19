import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TransitProvider } from "../components/providers/TransitProvider";
import { AppExperience } from "../components/navigation/AppExperience";
import { PwaSupport } from "../components/pwa/PwaSupport";
import { VisualPreferences } from "../components/common/VisualPreferences";
import { AppearancePreference, ThemeOnboarding } from "../components/common/ThemePicker";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const metadata = {
  applicationName: "Smart Safar",
  title: "Smart Safar Faisalabad",
  description: "Smart Public Transit for Faisalabad",
  icons: {
    icon: [
      { url: "/icons/favicon-32-v2.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/app-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/app-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-180-v2.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Smart Safar" },
};

export const viewport = { themeColor: "#0F5797", colorScheme: "light dark", viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="blue"
      suppressHydrationWarning
      className={`${jakarta.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: '(function(){try{var d=document.documentElement,t=localStorage.getItem("smart-safar-theme-v1"),a=localStorage.getItem("smart-safar-appearance-v1")||"system",dark=a==="dark"||(a==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(t==="orange")d.dataset.theme="orange";d.dataset.appearancePreference=["light","dark","system"].includes(a)?a:"system";d.dataset.appearance=dark?"dark":"light";var m=localStorage.getItem("smart-safar-data-saver")||"automatic",c=navigator.connection;d.dataset.dataSaver=(m==="on"||(m!=="off"&&c&&(c.saveData||["slow-2g","2g","3g"].includes(c.effectiveType))))?"on":"off"}catch(e){}})()' }} /></head>
      <body className="min-h-full flex flex-col"><TransitProvider><AppearancePreference /><VisualPreferences /><AppExperience>{children}</AppExperience><PwaSupport /><ThemeOnboarding /></TransitProvider></body>
    </html>
  );
}
