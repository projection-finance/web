"use client";

import { useEffect, useRef, useState } from "react";
import { IoIosSearch } from "react-icons/io";

const SearchInput = () => {
  const [showInputSearch, setShowInputSearch] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState<string>("");

  useEffect(() => {
    if (showInputSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInputSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowInputSearch(false);
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowInputSearch(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, []);

  return (
    <div className="w-5/12" ref={containerRef}>
      {!showInputSearch && (
        <div
          className="flex items-center text-sm w-fit self-end justify-self-end py-1 hover:cursor-pointer"
          onClick={() => setShowInputSearch(true)}
        >
          <IoIosSearch className="size-5 2xl:size-7 3xl:size-8 text-black" />
          <p>Search</p>
        </div>
      )}

      {showInputSearch && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent focus:outline focus:outline-slate-200 ps-8 py-1 text-sm"
            placeholder="Search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-bluePrimary 2xl:left-4 3xl:left-5">
            <IoIosSearch className="size-5 2xl:size-7 3xl:size-8 text-black" />
          </span>
        </div>
      )}
    </div>
  );
};

export default SearchInput;
