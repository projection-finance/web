"use client";

import "../../../src/app/globals.css";
import Header from "../header";
import Footer from "../Footer";
import BugReportWidget from "../BugReportWidget";
import AlchemyStatusBanner from "../AlchemyStatusBanner";
import { usePathname } from "next/navigation";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const excludedPath = ["/sign-in", "/link-sent"];

  if (excludedPath.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <AlchemyStatusBanner />
      <div className="flex-grow overflow-y-auto px-4 py-4 sm:px-6 md:px-8 md:py-5 bg-[#ECECF5]">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </div>
      <Footer />
      <BugReportWidget />
    </div>
  );
};

export default MainLayout;
