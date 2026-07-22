import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(c => ({
            name: c.name,
            value: c.value,
          }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session and apply to response
  await supabase.auth.getSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/auth', '/api/menu', '/qa-manual', '/order', '/api/public', '/api/orders'];
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
      // /auth is included for all roles so staff can reach /auth/accept-invite
      const allowedRoutes: Record<string, string[]> = {
        super_admin: ['/super-admin', '/api/admin', '/auth'],
        restaurant_owner: ['/owner', '/api/restaurants', '/auth'],
        manager: ['/manager', '/api/restaurants', '/auth'],
        kitchen_staff: ['/kitchen', '/api/orders', '/auth'],
        waiter: ['/staff', '/api/tables', '/auth'],
        cashier: ['/cashier', '/api/payments', '/auth'],
        customer: ['/', '/auth', '/order', '/api/orders'],
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
