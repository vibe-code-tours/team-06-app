"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

interface UserProfile {
  full_name: string;
  role: string;
}

export default function Header() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    };

    fetchProfile();
  }, [supabase]);

  // Scroll shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const formatRole = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header
      className={`
        sticky top-0 z-50 h-16
        bg-white border-b border-gray-200
        transition-shadow duration-200
        ${scrolled ? "shadow-lg shadow-black/10" : ""}
      `}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="QR Dine"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </div>

        {/* Center: Empty */}
        <div className="hidden flex-1 md:block" />

        {/* Right: User Area */}
        <div className="flex items-center gap-3">
          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-3 py-2 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {/* Avatar */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange text-sm font-bold text-white shadow-md shadow-brand-orange/30">
                {profile ? getInitials(profile.full_name) : "U"}
              </div>

              {/* Name & Role */}
              <div className="hidden flex-col items-start text-left sm:flex">
                <span className="text-sm font-semibold text-gray-900 leading-tight">
                  {profile?.full_name || "User"}
                </span>
                <span className="text-xs text-gray-500 leading-tight">
                  {profile ? formatRole(profile.role) : "Loading..."}
                </span>
              </div>

              <ChevronDown
                className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-60 origin-top-right rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/10 py-2 animate-in fade-in-0 zoom-in-95 duration-200">
                {/* User Info Header */}
                <div className="border-b border-gray-100 px-5 py-3.5">
                  <p className="text-sm font-semibold text-gray-900">
                    {profile?.full_name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {profile ? formatRole(profile.role) : ""}
                  </p>
                </div>

                {/* Menu Items */}
                <div className="py-1.5 px-1.5">
                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-4 w-4 text-red-500" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
       <hr/>
    </header>
   
  );
}