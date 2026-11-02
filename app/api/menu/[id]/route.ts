
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_URL = (
  process.env.API_URL ||
  "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function procesarSolicitud(
  request: NextRequest,
  context: RouteContext,
  metodo: "PUT" | "PATCH"
) {
  const token = await getSession();

  if (!token) {
    return NextResponse.json(
      {
        message: "No autorizado. Inicia sesión nuevamente.",
      },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      {
        message: "El ID del platillo es obligatorio.",
      },
      { status: 400 }
    );
  }

  try {
    let endpoint = `${API_URL}/menu/${encodeURIComponent(id)}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let body: string | undefined;

    if (metodo === "PUT") {
      headers["Content-Type"] = "application/json";

      const datos = await request.json();

      // El backend espera price como string.
      if (datos.price !== undefined) {
        datos.price = String(datos.price);
      }

      body = JSON.stringify(datos);
    }

    if (metodo === "PATCH") {
      const accion = request.nextUrl.searchParams.get("accion");

      if (accion === "disable") {
        endpoint += "/disable";
      } else if (accion === "reactivate") {
        endpoint += "/reactivate";
      } else {
        return NextResponse.json(
          {
            message:
              "Acción no válida. Utiliza disable o reactivate.",
          },
          { status: 400 }
        );
      }
    }

    const respuesta = await fetch(endpoint, {
      method: metodo,
      headers,
      body,
      cache: "no-store",
    });

    const contenido = await respuesta.text();

    return new NextResponse(contenido || null, {
      status: respuesta.status,
      headers: contenido
        ? {
            "Content-Type":
              respuesta.headers.get("content-type") ||
              "application/json",
          }
        : {},
    });
  } catch (error) {
    console.error("Error al actualizar el platillo:", error);

    return NextResponse.json(
      {
        message: "Error al comunicarse con el servidor.",
      },
      { status: 502 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  return procesarSolicitud(request, context, "PUT");
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  return procesarSolicitud(request, context, "PATCH");
}
