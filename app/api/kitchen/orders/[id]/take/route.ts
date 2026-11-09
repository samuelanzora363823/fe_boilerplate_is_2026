import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_URL = process.env.API_URL;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  _request: Request,
  context: RouteContext
) {
  const token = await getSession();

  if (!token) {
    return NextResponse.json(
      { message: "No autenticado" },
      { status: 401 }
    );
  }

  if (!API_URL) {
    return NextResponse.json(
      { message: "API_URL no está configurada" },
      { status: 500 }
    );
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { message: "El ID de la comanda es obligatorio." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${API_URL.replace(/\/+$/, "")}/kitchen/orders/${encodeURIComponent(id)}/take`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const contenido = await response.text();

    return new NextResponse(contenido || null, {
      status: response.status,
      headers: contenido
        ? {
            "Content-Type":
              response.headers.get("content-type") ||
              "application/json",
          }
        : {},
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con NestJS" },
      { status: 502 }
    );
  }
}
