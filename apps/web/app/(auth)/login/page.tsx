'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--gradient-primary)' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-glow)' }} />

      {/* Decorative elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-brand-orange/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-blue/30 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 relative">
            {/* Soft circular glow */}
            <div className="absolute w-48 h-48 bg-gradient-to-br from-brand-orange/30 via-brand-orange/10 to-transparent blur-2xl rounded-full" />
            <Image
              src="/QR_DINE_LOGO_NO_BG.png"
              alt="QR Dine Logo"
              width={150}
              height={150}
              className="relative z-10 drop-shadow-[0_0_40px_rgba(254,116,15,0.4)]"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Restaurant QR Order</h1>
          <p className="text-white/50 mt-2">Sign in to your dashboard</p>
        </div>

        {/* Login card */}
        <div className="bg-[#091A30] backdrop-blur-sm border border-white/[0.12] rounded-2xl p-8 shadow-lg shadow-black/30">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-white/60 text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus:border-brand-orange focus:ring-brand-orange/30 h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-white/60 text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus:border-brand-orange focus:ring-brand-orange/30 h-12"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold h-12 rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(254,116,15,0.4)] group"
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
        <p className="text-center text-white/30 text-xs mt-6">
          QR-based ordering system for restaurants
        </p>
      </div>
    </div>
  );
}
