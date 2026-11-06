import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
export async function POST(request: Request) {
  const token = await getSession();
  if (!token) return NextResponse.json({ message: "Inicia sesión como cliente" }, { status: 401 });
  const api = process.env.API_URL?.replace(/\/$/, "");
  if (!api) return NextResponse.json({ message: "API_URL no configurada" }, { status: 500 });
  try {
    const response = await fetch(`${api}/orders/takeaway`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: await request.text(), cache: "no-store" });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch { return NextResponse.json({ message: "No se pudo conectar al backend" }, { status: 502 }); }
}
