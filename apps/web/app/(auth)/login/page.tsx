"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image
              src="/logo.png"
              alt="QR Dine Logo"
              width={150}
              height={150}
              className="drop-shadow-[0_4px_24px_rgba(5,35,79,0.15)]"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Restaurant QR Order
          </h1>
          <p className="text-gray-500 mt-2">Sign in to your dashboard</p>
        </div>

        {/* Login card */}
        <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-lg shadow-black/5">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-gray-700 text-sm font-medium"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-brand-orange focus:ring-brand-orange/30 h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-gray-700 text-sm font-medium"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-brand-orange focus:ring-brand-orange/30 h-12"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold h-12 rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(254,116,15,0.3)] group"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-6">
          QR-based ordering system for restaurants
        </p>
      </div>
    </div>
  );
}
