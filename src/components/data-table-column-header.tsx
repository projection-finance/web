"use client";

import type React from "react";
import { ChevronsUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface DataTableColumnHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  isSortable?: boolean;
  isSorted?: boolean | "asc" | "desc";
  onSort?: () => void;
}

export function DataTableColumnHeader({
  title,
  isSortable = false,
  isSorted = false,
  onSort,
  className,
}: DataTableColumnHeaderProps) {
  if (!isSortable) {
    return (
      <div
        className={cn(
          "text-center text-xs font-medium text-[#62677B]",
          className
        )}
      >
        {title}
      </div>
    );
  }

  return (
    <div className={cn("items-center ", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 text-xs font-medium text-[#62677B] hover:bg-transparent"
          >
            <span>{title}</span>
            {isSorted === "desc" ? (
              <ArrowDown color="#EAEBEF" className="-ml-1" />
            ) : isSorted === "asc" ? (
              <ArrowUp color="#EAEBEF" className="-ml-1" />
            ) : (
              <ChevronsUpDown color="#EAEBEF" className="-ml-1" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onSort && onSort()}>
            <ArrowUp className="mr-0 text-muted-foreground/70" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSort && onSort()}>
            <ArrowDown className="mr-2 text-muted-foreground/70" />
            Desc
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
