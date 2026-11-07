
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const token = await getSession();

  if (!token) {
    return NextResponse.json(
      { message: "No autenticado" },
      { status: 401 }
    );
  }

  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { message: "API_URL no está configurada" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { message: "No se pudo obtener el usuario" },
        { status: response.status }
      );
    }

    const user = await response.json();

    return NextResponse.json(user);
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con NestJS" },
      { status: 502 }
    );
  }
}
