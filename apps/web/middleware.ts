import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/menu', '/qa-manual'];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Customer menu route (public)
  const isCustomerMenu = /^\/[a-f0-9-]+\/\d+$/.test(request.nextUrl.pathname);

  if (!user && !isPublicRoute && !isCustomerMenu) {
    // No user, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // Get user profile to determine role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, restaurant_id')
      .eq('id', user.id)
      .single();

    if (profile) {
      const pathname = request.nextUrl.pathname;

      // Role-based routing
      const roleRoutes: Record<string, string> = {
        super_admin: '/super-admin',
        restaurant_owner: '/owner',
        manager: '/manager',
        kitchen_staff: '/kitchen',
        waiter: '/staff',
        cashier: '/cashier',
        customer: '/',
      };

      // Redirect to appropriate dashboard if on root or login
      if (pathname === '/' || pathname === '/login') {
        const redirectPath = roleRoutes[profile.role] || '/';
        const url = request.nextUrl.clone();
        url.pathname = redirectPath;
        return NextResponse.redirect(url);
      }

      // Check role-based access
      const allowedRoutes: Record<string, string[]> = {
        super_admin: ['/super-admin', '/api/admin'],
        restaurant_owner: ['/owner', '/api/restaurants'],
        manager: ['/manager', '/api/restaurants'],
        kitchen_staff: ['/kitchen', '/api/orders'],
        waiter: ['/staff', '/api/tables'],
        cashier: ['/cashier', '/api/payments'],
        customer: ['/'],
      };

      const allowed = allowedRoutes[profile.role] || [];
      const hasAccess = allowed.some((route) => pathname.startsWith(route));

      if (!hasAccess && !pathname.startsWith('/api/')) {
        // Redirect to appropriate dashboard
        const redirectPath = roleRoutes[profile.role] || '/';
        const url = request.nextUrl.clone();
        url.pathname = redirectPath;
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
