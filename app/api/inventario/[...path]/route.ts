import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
// Rutas del backend de inventario que el gerente puede usar.
const allowed = new Map([["inventory", ["GET"]], ["inventory/movements", ["POST"]], ["inventory/alerts", ["GET"]]]);
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  if (!(allowed.get(endpoint)?.includes(request.method) || (request.method === "PATCH" && /^inventory\/alerts\/[^/]+\/status$/.test(endpoint)))) return NextResponse.json({ message: "Ruta no permitida" }, { status: 404 });
  const token = await getSession();
  if (!token) return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  const api = process.env.API_URL?.replace(/\/$/, "");
  if (!api) return NextResponse.json({ message: "API_URL no configurada" }, { status: 500 });
  const search = new URL(request.url).search;
  try {
    const response = await fetch(`${api}/${endpoint}${search}`, { method: request.method, headers: { Authorization: `Bearer ${token}`, ...(["POST", "PATCH"].includes(request.method) ? { "Content-Type": "application/json" } : {}) }, ...(["POST", "PATCH"].includes(request.method) ? { body: await request.text() } : {}), cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch { return NextResponse.json({ message: "No se pudo conectar al servidor" }, { status: 502 }); }
}
export { handle as GET, handle as POST, handle as PATCH };
