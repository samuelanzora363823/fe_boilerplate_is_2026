
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

const publicRoutes = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = publicRoutes.includes(pathname);

  // La cookie puede existir aunque el token haya expirado.
  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  // Permitir siempre el acceso a login.
  // Esto evita ciclos cuando la sesión ha expirado.
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Proteger las rutas privadas.
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
