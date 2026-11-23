import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (values) => { values.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === '/login';
  if (!user && !isLogin) {
    console.warn('[auth middleware] Tidak ada sesi Supabase valid untuk rute terlindungi.', { path: request.nextUrl.pathname });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // An authenticated user may still need to see the login diagnostics if their
  // application profile is missing or its database migration is incomplete.
  if (user && isLogin && !request.nextUrl.searchParams.has('error')) return NextResponse.redirect(new URL('/proker', request.url));
  return response;
}

// Public static assets (logo, icons, and any future files with extensions) do
// not require an Auth session; redirecting them to /login makes images fail.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'] };
