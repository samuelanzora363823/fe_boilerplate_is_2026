import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// H22: proxy de las rutas de administración de lealtad del Gerente.
// Solo se reenvían estas rutas y métodos a /loyalty/admin/... del backend;
// el backend vuelve a validar sesión y rol en cada solicitud.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const permitidas: Array<{ metodo: string; ruta: RegExp }> = [
  { metodo: "GET", ruta: /^rules$/ },
  { metodo: "PUT", ruta: /^rules$/ },
  { metodo: "GET", ruta: /^rules\/history$/ },
  { metodo: "GET", ruta: /^benefits$/ },
  { metodo: "POST", ruta: /^benefits$/ },
  { metodo: "PUT", ruta: new RegExp(`^benefits/${UUID}$`, "i") },
  { metodo: "PATCH", ruta: new RegExp(`^benefits/${UUID}/status$`, "i") },
];

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const ruta = path.join("/");
  const metodo = request.method;

  if (!permitidas.some((p) => p.metodo === metodo && p.ruta.test(ruta))) {
    return NextResponse.json({ message: "Ruta no permitida" }, { status: 404 });
  }

  const token = await getSession();
  if (!token) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const api = process.env.API_URL?.replace(/\/+$/, "");
  if (!api) {
    return NextResponse.json(
      { message: "API_URL no está configurada" },
      { status: 500 },
    );
  }

  const conCuerpo = metodo !== "GET";

  try {
    const response = await fetch(`${api}/loyalty/admin/${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(conCuerpo ? { "Content-Type": "application/json" } : {}),
      },
      ...(conCuerpo ? { body: await request.text() } : {}),
      cache: "no-store",
    });
    const body = await response.text();

    if (!body) return new NextResponse(null, { status: response.status });

    try {
      return NextResponse.json(JSON.parse(body), { status: response.status });
    } catch {
      return NextResponse.json(
        { message: "Respuesta inválida del servidor" },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { message: "No se pudo conectar al servidor" },
      { status: 502 },
    );
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH };
