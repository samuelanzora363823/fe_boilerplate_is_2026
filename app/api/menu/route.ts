import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_URL = process.env.API_URL;

export async function GET() {
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

  try {
    const response = await fetch(
      `${API_URL.replace(/\/$/, "")}/menu`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar con NestJS" },
      { status: 502 }
    );
  }
}


export async function POST(request: Request) {
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

  try {
    const body = await request.json();

    const response = await fetch(
      `${API_URL.replace(/\/$/, "")}/menu`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo procesar la solicitud" },
      { status: 502 }
    );
  }
}