import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const allowedGet = new Set([
  "orders/in-preparation",
]);

const allowedPatch = [
  /^orders\/[0-9a-f-]{36}\/status$/i,
  /^orders\/[0-9a-f-]{36}\/items\/[0-9a-f-]{36}\/status$/i,
];

const allowedPost = [
  /^out-of-stock\/[0-9a-f-]{36}$/i,
];

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const endpoint = `kitchen/${path.join("/")}`;
  const method = request.method;
  const requestedPath = path.join("/");

  const isAllowed =
    (method === "GET" && allowedGet.has(requestedPath)) ||
    (method === "PATCH" &&
      allowedPatch.some((pattern) => pattern.test(requestedPath))) ||
    (method === "POST" &&
      allowedPost.some((pattern) => pattern.test(requestedPath)));

  if (!isAllowed) {
    return NextResponse.json(
      { message: "Ruta no permitida" },
      { status: 404 },
    );
  }

  const token = await getSession();

  if (!token) {
    return NextResponse.json(
      { message: "No autenticado" },
      { status: 401 },
    );
  }

  const api = process.env.API_URL?.replace(/\/$/, "");

  if (!api) {
    return NextResponse.json(
      { message: "API_URL no configurada" },
      { status: 500 },
    );
  }

  let response: Response;

  try {
    response = await fetch(`${api}/${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === "PATCH" || method === "POST"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(method === "PATCH" || method === "POST"
        ? { body: await request.text() }
        : {}),
      cache: "no-store",
    });
  } catch {
    // Solo los fallos de red se reportan como 502.
    return NextResponse.json(
      { message: "No se pudo conectar con NestJS" },
      { status: 502 },
    );
  }

  return reenviarRespuesta(response);
}

// Reenvía la respuesta del backend conservando su código HTTP real,
// aunque el cuerpo esté vacío o no sea JSON.
async function reenviarRespuesta(response: Response) {
  const status = response.status;

  // Estas respuestas no pueden llevar cuerpo.
  if (status === 204 || status === 205 || status === 304) {
    return new NextResponse(null, { status });
  }

  let texto = "";

  try {
    texto = await response.text();
  } catch {
    texto = "";
  }

  if (!texto) {
    return new NextResponse(null, { status });
  }

  try {
    return NextResponse.json(JSON.parse(texto) as unknown, { status });
  } catch {
    return NextResponse.json(
      {
        message: response.ok
          ? texto
          : `Respuesta no válida del servidor (HTTP ${status}).`,
      },
      { status },
    );
  }
}

export {
  handle as GET,
  handle as PATCH,
  handle as POST,
};
