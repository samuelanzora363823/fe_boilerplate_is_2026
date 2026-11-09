"use client";

import { useCallback, useEffect, useState } from "react";

type Comanda = {
  id: string;
  tableNumber: string | null;
  orderNumber: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

type RespuestaComandas = {
  items: Comanda[];
};

async function leerRespuesta(response: Response): Promise<unknown> {
  const texto = await response.text();

  if (!texto) return null;

  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return { message: texto };
  }
}

function obtenerError(datos: unknown, status: number): string {
  if (
    typeof datos === "object" &&
    datos !== null &&
    "message" in datos
  ) {
    const mensaje = (datos as { message?: unknown }).message;

    if (Array.isArray(mensaje)) {
      return mensaje.map(String).join(", ");
    }

    if (typeof mensaje === "string") {
      return mensaje;
    }
  }

  return `No se pudo completar la operación (HTTP ${status}).`;
}

export default function KitchenOrders() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const cargarComandas = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);

    try {
      const response = await fetch("/api/kitchen/orders", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const datos = await leerRespuesta(response);

      if (!response.ok) {
        throw new Error(obtenerError(datos, response.status));
      }

      if (
        typeof datos !== "object" ||
        datos === null ||
        !("items" in datos) ||
        !Array.isArray((datos as RespuestaComandas).items)
      ) {
        throw new Error("La respuesta de comandas no es válida.");
      }

      const items = (datos as RespuestaComandas).items;

      setComandas(
        [...items].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        )
      );

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las comandas."
      );
    } finally {
      if (inicial) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const iniciar = window.setTimeout(() => {
      void cargarComandas(true);
    }, 0);

    const intervalo = window.setInterval(() => {
      void cargarComandas();
    }, 5000);

    return () => {
      window.clearTimeout(iniciar);
      window.clearInterval(intervalo);
    };
  }, [cargarComandas]);

  const tomarComanda = async (id: string) => {
    if (procesandoId) return;

    setProcesandoId(id);
    setError("");
    setMensaje("");

    try {
      const response = await fetch(
        `/api/kitchen/orders/${encodeURIComponent(id)}/take`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      const datos = await leerRespuesta(response);

      if (response.status === 409) {
        throw new Error(
          obtenerError(datos, 409) ||
            "Otra persona ya tomó esta comanda."
        );
      }

      if (!response.ok) {
        throw new Error(obtenerError(datos, response.status));
      }

      setMensaje("Comanda tomada correctamente. ¡A preparar!");
      await cargarComandas();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo tomar la comanda."
      );

      await cargarComandas();
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Panel de cocina</h1>

          <p className="mt-2 text-zinc-400">
            Comandas pendientes de preparación
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Actualización automática cada 5 segundos
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-800 bg-red-950 p-4 text-red-200"
          >
            {error}
          </div>
        )}

        {mensaje && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-green-800 bg-green-950 p-4 text-green-200"
          >
            {mensaje}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Comandas recibidas ({comandas.length})
          </h2>

          <button
            type="button"
            onClick={() => void cargarComandas(true)}
            disabled={cargando}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {cargando ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            Cargando comandas...
          </div>
        ) : comandas.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <h3 className="text-xl font-semibold">
              No hay comandas pendientes
            </h3>

            <p className="mt-2 text-zinc-400">
              Las nuevas comandas aparecerán automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {comandas.map((comanda) => (
              <article
                key={comanda.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-400">
                      Mesa {comanda.tableNumber ?? "Sin mesa"}
                    </p>

                    <h3 className="mt-1 text-xl font-bold">
                      Comanda #
                      {comanda.orderNumber ?? comanda.id.slice(0, 8)}
                    </h3>
                  </div>

                  <span className="rounded-full bg-yellow-950 px-3 py-1 text-xs font-medium text-yellow-300">
                    Recibido
                  </span>
                </div>

                <div className="mb-5 rounded-lg bg-zinc-800 p-4">
                  <p className="mb-1 text-sm font-medium text-zinc-300">
                    Notas especiales
                  </p>

                  <p className="text-sm text-zinc-400">
                    {comanda.notes || "Sin notas especiales."}
                  </p>
                </div>

                <p className="mb-4 text-xs text-zinc-500">
                  Recibida:{" "}
                  {new Date(comanda.createdAt).toLocaleString("es-SV")}
                </p>

                <button
                  type="button"
                  onClick={() => void tomarComanda(comanda.id)}
                  disabled={procesandoId !== null}
                  className="w-full rounded-lg bg-purple-600 px-5 py-3 font-semibold transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesandoId === comanda.id
                    ? "Tomando comanda..."
                    : "Tomar comanda"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
