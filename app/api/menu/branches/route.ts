import { NextResponse } from "next/server";
export async function GET() {
  const api = process.env.API_URL?.replace(/\/$/, "");
  if (!api) return NextResponse.json({ message: "API_URL no configurada" }, { status: 500 });
  try {
    const response = await fetch(`${api}/menu/branches`, { cache: "no-store" });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar al servidor" }, { status: 502 });
  }
}
