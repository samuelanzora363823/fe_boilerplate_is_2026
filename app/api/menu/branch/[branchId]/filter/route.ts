import { NextResponse } from "next/server";
export async function GET(request: Request, context: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
    return NextResponse.json({ message: "ID de sucursal inválido" }, { status: 400 });
  }
  const api = process.env.API_URL?.replace(/\/$/, "");
  if (!api) return NextResponse.json({ message: "API_URL no configurada" }, { status: 500 });
  const query = new URL(request.url).searchParams;
  const params = new URLSearchParams();
  for (const key of ["category", "tags"]) for (const value of query.getAll(key)) params.append(key, value);
  try {
    const response = await fetch(`${api}/menu/${branchId}/filter${params.size ? `?${params}` : ""}`, { cache: "no-store" });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar al servidor" }, { status: 502 });
  }
}
