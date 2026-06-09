"use client";

import "../../src/app/globals.css";
import Image from "next/image";
import logo from "@/public/logo.svg";
import { AiOutlinePieChart } from "react-icons/ai";
import { HiOutlinePresentationChartLine } from "react-icons/hi2";
import { useSidebar } from "../utils/context/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Sidebar = () => {
  const { isOpen } = useSidebar();
  const pathname = usePathname();

  return (
    <>
      <div
        className={`h-full border-r border-slate-400 transform transition-all duration-300 ${
          isOpen ? "translate-x-0 w-2/12" : "-translate-x-[20rem] w-0"
        }`}
      >
        {/* logo */}
        <div className="w-full p-4">
          <Image src={logo} alt="logo-img" />
        </div>

        {/* list menu */}
        <div className="w-full p-4 space-y-1 text-sm">
          {/* portofolio */}
          <Link href="/">
            <div
              className={`flex items-center gap-1 px-4 py-2 rounded-md transition-colors duration-300 ${
                pathname === "/"
                  ? "bg-slate-200"
                  : "hover:bg-slate-200 hover:cursor-pointer"
              }`}
            >
              <AiOutlinePieChart className="size-5" />
              <p>Portofolio</p>
            </div>
          </Link>

          {/* projections */}
          <div className="flex items-center gap-1 px-4 py-2 text-gray-500">
            <HiOutlinePresentationChartLine className="size-5" />
            <p>Projections</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
