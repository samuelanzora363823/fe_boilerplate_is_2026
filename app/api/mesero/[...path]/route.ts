import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
const allowed = new Map([["tables/my-branch", ["GET"]], ["orders/table/menu", ["GET"]], ["accounts", ["POST"]], ["orders/table", ["POST"]]]);
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  if (!allowed.get(endpoint)?.includes(request.method)) return NextResponse.json({ message: "Ruta no permitida" }, { status: 404 });
  const token = await getSession();
  if (!token) return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  const api = process.env.API_URL?.replace(/\/$/, "");
  if (!api) return NextResponse.json({ message: "API_URL no configurada" }, { status: 500 });
  try {
    const response = await fetch(`${api}/${endpoint}`, { method: request.method, headers: { Authorization: `Bearer ${token}`, ...(request.method === "POST" ? { "Content-Type": "application/json" } : {}) }, ...(request.method === "POST" ? { body: await request.text() } : {}), cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch { return NextResponse.json({ message: "No se pudo conectar al servidor" }, { status: 502 }); }
}
export { handle as GET, handle as POST };
