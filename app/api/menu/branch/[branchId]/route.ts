import { NextResponse } from "next/server";
export async function GET(_request: Request, context: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
    return NextResponse.json({ message: "ID de sucursal inválido" }, { status: 400 });
  }
  const api = process.env.API_URL?.replace(/\/$/, "");
  if (!api) return NextResponse.json({ message: "API_URL no configurada" }, { status: 500 });
  try {
    const response = await fetch(`${api}/menu/${branchId}`, { cache: "no-store" });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar al servidor" }, { status: 502 });
  }
}
