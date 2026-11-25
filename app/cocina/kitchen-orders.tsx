"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Mensaje cuando la sesión activa no es de Cocina (por ejemplo, otro rol
// inició sesión en el mismo navegador y reemplazó la cookie).
const SESION_NO_COCINA =
  "La sesión actual no corresponde al rol Cocina. Inicia sesión con una cuenta de cocina.";

// Error de una respuesta HTTP que conserva su código para distinguir
// sesión vencida (401) y rol sin permiso (403) del resto de errores.
class ErrorHttp extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ErrorHttp";
  }
}

// Estados que el backend usa para comandas y platillos.
type EstadoPedido =
  | "RECEIVED"
  | "IN_PREPARATION"
  | "READY"
  | "CANCELLED";

const ETIQUETAS_ESTADO: Record<EstadoPedido, string> = {
  RECEIVED: "Recibido",
  IN_PREPARATION: "En preparación",
  READY: "Listo",
  CANCELLED: "Cancelado",
};

const ESTILOS_ESTADO: Record<EstadoPedido, string> = {
  RECEIVED: "bg-yellow-50 text-yellow-700",
  IN_PREPARATION: "bg-orange-50 text-orange-700",
  READY: "bg-green-50 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

function normalizarEstado(valor: unknown): EstadoPedido | null {
  return typeof valor === "string" && valor in ETIQUETAS_ESTADO
    ? (valor as EstadoPedido)
    : null;
}

function etiquetaEstado(valor: unknown): string {
  const estado = normalizarEstado(valor);
  return estado ? ETIQUETAS_ESTADO[estado] : "Estado desconocido";
}

function estiloEstado(valor: unknown): string {
  const estado = normalizarEstado(valor);
  return estado ? ESTILOS_ESTADO[estado] : "bg-slate-100 text-slate-600";
}

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

type OrderItem = {
  id: string;
  dishId: string;
  quantity: number;
  // Valor crudo del backend (EstadoPedido); se interpreta con normalizarEstado().
  status: string;
  dish: {
    name: string;
    branchDishes: {
      branchId: string;
      stockStatus: string;
    }[];
  };
};

type KitchenOrder = {
  id: string;
  orderNumber?: string | null;
  branchId: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  account?: {
    table?: {
      number: number;
    } | null;
  } | null;
};

type PlatilloSeleccionado = {
  dishId: string;
  branchId: string;
  dishName: string;
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

async function apiH8(path: string, body?: unknown) {
  const response = await fetch(`/api/cocina/${path}`, {
    method: body === undefined ? "GET" : "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
    credentials: "same-origin",
    cache: "no-store",
  });

  const datos = await leerRespuesta(response);

  if (!response.ok) {
    throw new ErrorHttp(obtenerError(datos, response.status), response.status);
  }

  return datos;
}

async function apiH9(dishId: string, branchId: string) {
  const response = await fetch(
    `/api/cocina/out-of-stock/${encodeURIComponent(dishId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branchId }),
      credentials: "same-origin",
      cache: "no-store",
    },
  );

  const datos = await leerRespuesta(response);

  if (!response.ok) {
    throw new Error(obtenerError(datos, response.status));
  }

  return datos;
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export default function KitchenOrders() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [cargando, setCargando] = useState(true);
  // Errores de carga: los reemplaza o limpia cada consulta automática.
  const [errorCargaH7, setErrorCargaH7] = useState("");
  const [errorCargaH8, setErrorCargaH8] = useState("");
  // Errores de acciones: solo se limpian al iniciar otra acción.
  const [errorAccionH7, setErrorAccionH7] = useState("");
  const [errorAccionH8, setErrorAccionH8] = useState("");
  const [errorH9, setErrorH9] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [platilloSeleccionado, setPlatilloSeleccionado] =
    useState<PlatilloSeleccionado | null>(null);

  const [agotados, setAgotados] = useState<Set<string>>(new Set());

  // Bloqueo síncrono contra doble clic: el estado de React no se actualiza
  // hasta el siguiente render, así que dos clics seguidos verían null.
  const accionEnCurso = useRef(false);

  // Secuencia de consultas: solo se aplica la respuesta más reciente.
  const secuenciaComandas = useRef(0);
  const secuenciaPreparacion = useRef(0);

  // Descarta las consultas en vuelo iniciadas antes de una acción.
  const invalidarConsultas = () => {
    secuenciaComandas.current += 1;
    secuenciaPreparacion.current += 1;
  };

  const iniciarAccion = (id: string) => {
    if (accionEnCurso.current) return false;
    accionEnCurso.current = true;
    invalidarConsultas();
    setProcesandoId(id);
    setMensaje("");
    return true;
  };

  const terminarAccion = () => {
    accionEnCurso.current = false;
    setProcesandoId(null);
  };

  const router = useRouter();
  const redirigiendo = useRef(false);

  // Sesión de las consultas automáticas:
  // - 401 (token vencido o inválido): se vuelve a iniciar sesión.
  // - 403 (la sesión no es de Cocina): se vacían ambas listas para no
  //   mostrar datos viejos como si siguieran vigentes.
  // Devuelve true si el error ya quedó atendido.
  const manejarAccesoDenegado = useCallback(
    (err: unknown) => {
      if (!(err instanceof ErrorHttp)) return false;

      if (err.status === 401) {
        if (!redirigiendo.current) {
          redirigiendo.current = true;
          router.replace("/login");
        }
        return true;
      }

      if (err.status === 403) {
        setComandas([]);
        setOrders([]);
        setErrorCargaH7(SESION_NO_COCINA);
        setErrorCargaH8(SESION_NO_COCINA);
        return true;
      }

      return false;
    },
    [router],
  );

  const cargarComandas = useCallback(async (inicial = false) => {
    const solicitud = ++secuenciaComandas.current;
    if (inicial) setCargando(true);

    try {
      const response = await fetch("/api/kitchen/orders", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const datos = await leerRespuesta(response);

      if (solicitud !== secuenciaComandas.current) return;

      if (!response.ok) {
        throw new ErrorHttp(obtenerError(datos, response.status), response.status);
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
            new Date(b.createdAt).getTime(),
        ),
      );

      setErrorCargaH7("");
    } catch (err) {
      if (solicitud !== secuenciaComandas.current) return;
      if (manejarAccesoDenegado(err)) return;

      setErrorCargaH7(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las comandas recibidas.",
      );
    } finally {
      if (inicial) setCargando(false);
    }
  }, [manejarAccesoDenegado]);

  const cargarPreparacion = useCallback(async () => {
    const solicitud = ++secuenciaPreparacion.current;

    try {
      const datos = await apiH8("orders/in-preparation");

      if (solicitud !== secuenciaPreparacion.current) return;

      const items = Array.isArray(datos)
        ? datos
        : typeof datos === "object" &&
            datos !== null &&
            "items" in datos &&
            Array.isArray(datos.items)
          ? datos.items
          : [];

      setOrders(items as KitchenOrder[]);
      setErrorCargaH8("");
    } catch (err) {
      if (solicitud !== secuenciaPreparacion.current) return;
      if (manejarAccesoDenegado(err)) return;

      setErrorCargaH8(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las comandas en preparación.",
      );
    }
  }, [manejarAccesoDenegado]);

  const actualizarPanel = useCallback(async (inicial = false) => {
    await Promise.all([
      cargarComandas(inicial),
      cargarPreparacion(),
    ]);
  }, [cargarComandas, cargarPreparacion]);

  useEffect(() => {
    const iniciar = window.setTimeout(() => {
      void actualizarPanel(true);
    }, 0);

    const intervalo = window.setInterval(() => {
      void actualizarPanel();
    }, 5000);

    return () => {
      window.clearTimeout(iniciar);
      window.clearInterval(intervalo);
    };
  }, [actualizarPanel]);

  const tomarComanda = async (id: string) => {
    if (!iniciarAccion(id)) return;

    setErrorAccionH7("");

    try {
      const response = await fetch(
        `/api/kitchen/orders/${encodeURIComponent(id)}/take`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      const datos = await leerRespuesta(response);

      if (response.status === 409) {
        throw new Error(
          `${obtenerError(datos, 409)} Otra persona pudo haberla tomado; la lista se actualizó.`,
        );
      }

      if (!response.ok) {
        throw new Error(obtenerError(datos, response.status));
      }

      setMensaje("Comanda tomada correctamente. ¡A preparar!");
    } catch (err) {
      setErrorAccionH7(
        err instanceof Error
          ? err.message
          : "No se pudo tomar la comanda.",
      );
    } finally {
      // Tras éxito o conflicto se recargan ambas listas con los estados reales
      // del backend antes de liberar los botones. Los errores de acción no se
      // borran con esta recarga.
      await actualizarPanel();
      terminarAccion();
    }
  };

  const marcarPlatilloListo = async (
    orderId: string,
    itemId: string,
  ) => {
    const key = `${orderId}-${itemId}`;

    if (!iniciarAccion(key)) return;

    setErrorAccionH8("");

    try {
      await apiH8(
        `orders/${orderId}/items/${itemId}/status`,
        { status: "Listo" },
      );

      setMensaje("Platillo marcado como listo.");
    } catch (err) {
      setErrorAccionH8(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el platillo.",
      );
    } finally {
      // Recarga con los estados reales antes de liberar los botones.
      await actualizarPanel();
      terminarAccion();
    }
  };

  const confirmarPlatilloAgotado = async () => {
    if (!platilloSeleccionado) return;

    const { dishId, branchId, dishName } = platilloSeleccionado;
    const key = `${branchId}-${dishId}`;

    if (!iniciarAccion(key)) return;

    setErrorH9("");

    try {
      await apiH9(dishId, branchId);

      setAgotados((actuales) => {
        const nuevos = new Set(actuales);
        nuevos.add(key);
        return nuevos;
      });

      setMensaje(
        `El platillo "${dishName}" fue marcado como agotado correctamente.`,
      );

      setPlatilloSeleccionado(null);
    } catch (err) {
      setErrorH9(
        err instanceof Error
          ? err.message
          : "No se pudo marcar el platillo como agotado.",
      );
    } finally {
      // Recarga con los estados reales antes de liberar los botones.
      await actualizarPanel();
      terminarAccion();
    }
  };

  const marcarComandaLista = async (orderId: string) => {
    if (!iniciarAccion(orderId)) return;

    setErrorAccionH8("");

    try {
      await apiH8(`orders/${orderId}/status`, {
        status: "Listo",
      });

      setMensaje("¡Comanda marcada como lista!");
    } catch (err) {
      setErrorAccionH8(
        err instanceof Error
          ? err.message
          : "No se pudo marcar la comanda como lista.",
      );
    } finally {
      // Recarga con los estados reales antes de liberar los botones.
      await actualizarPanel();
      terminarAccion();
    }
  };

  const platillosPendientes = orders.reduce(
    (total, order) =>
      total +
      order.items.filter(
        (item) => normalizarEstado(item.status) === "IN_PREPARATION",
      ).length,
    0,
  );

  const erroresH7 = [errorAccionH7, errorCargaH7].filter(Boolean);
  const erroresH8 = [errorAccionH8, errorCargaH8].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-[#252944] lg:flex">
      <aside className="flex w-full flex-col bg-[#171b36] text-white lg:min-h-screen lg:w-64 lg:shrink-0">
        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7564e8] text-xl font-bold">
              N
            </div>
            <div>
              <p className="text-lg font-bold">Núcleo Digital</p>
              <p className="text-xs text-slate-400">
                Sistema de restaurante
              </p>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-4 lg:flex-col">
          <Link
            href="/"
            className="rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10"
          >
            Inicio
          </Link>
          <a
            href="/cocina"
            className="rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
          >
            Cocina
          </a>
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7564e8] font-semibold">
              C
            </div>
            <div>
              <p className="text-sm font-semibold">Personal de cocina</p>
              <p className="text-xs text-slate-400">
                Preparación de pedidos
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-[#8c9cbd]">
                Operaciones / Cocina
              </p>
              <h1 className="text-3xl font-bold text-[#20233e]">
                Panel de cocina
              </h1>
              <p className="mt-2 text-sm text-[#7184a6]">
                Visualiza las comandas recibidas y gestiona su preparación.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Actualización automática cada 5 segundos.
              </p>
            </div>

            <button
              type="button"
              disabled={cargando}
              onClick={() => void actualizarPanel(true)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {cargando ? "Actualizando..." : "Actualizar comandas"}
            </button>
          </header>

          {mensaje && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
            >
              {mensaje}
            </div>
          )}

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Comandas recibidas
              </p>
              <p className="mt-2 text-3xl font-bold text-[#7564e8]">
                {comandas.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Comandas en preparación
              </p>
              <p className="mt-2 text-3xl font-bold text-orange-600">
                {orders.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                Platillos pendientes
              </p>
              <p className="mt-2 text-3xl font-bold text-[#20233e]">
                {platillosPendientes}
              </p>
            </div>
          </div>

          <section className="mb-10">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-[#20233e]">
                Comandas recibidas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Toma una comanda para comenzar su preparación.
              </p>
            </div>

            {erroresH7.map((error, indice) => (
              <div
                key={`${indice}-${error}`}
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            ))}

            {cargando ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                Cargando comandas...
              </div>
            ) : comandas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 className="text-lg font-bold text-[#20233e]">
                  No hay comandas pendientes
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Las nuevas comandas aparecerán automáticamente aquí.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {comandas.map((comanda) => (
                  <article
                    key={comanda.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-500">
                          {comanda.tableNumber
                            ? `Mesa ${comanda.tableNumber}`
                            : "Para llevar"}
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-[#20233e]">
                          Comanda #
                          {comanda.orderNumber ?? shortId(comanda.id)}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${estiloEstado(comanda.status)}`}
                      >
                        {etiquetaEstado(comanda.status)}
                      </span>
                    </div>

                    <div className="mb-5 rounded-xl bg-[#f5f6fb] p-4">
                      <p className="mb-1 text-sm font-medium text-slate-600">
                        Notas especiales
                      </p>
                      <p className="text-sm text-slate-500">
                        {comanda.notes || "Sin notas especiales."}
                      </p>
                    </div>

                    <p className="mb-4 text-xs text-slate-400">
                      Recibida:{" "}
                      {new Date(comanda.createdAt).toLocaleString("es-SV")}
                    </p>

                    <button
                      type="button"
                      onClick={() => void tomarComanda(comanda.id)}
                      disabled={procesandoId !== null}
                      className="w-full rounded-xl bg-[#7564e8] px-5 py-3 font-semibold text-white transition hover:bg-[#6250d5] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {procesandoId === comanda.id
                        ? "Tomando comanda..."
                        : "Tomar comanda"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-[#20233e]">
                Comandas en preparación
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Marca cada platillo como listo o agotado y finaliza la comanda.
              </p>
            </div>

            {erroresH8.map((error, indice) => (
              <div
                key={`${indice}-${error}`}
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            ))}

            {errorH9 && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {errorH9}
              </div>
            )}

            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 className="text-lg font-bold text-[#20233e]">
                  No hay comandas en preparación
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Las comandas aparecerán aquí cuando sean tomadas por cocina.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((order) => {
                  // Debe coincidir con KitchenService.markOrderReady: el
                  // backend exige que TODOS los platillos estén en READY
                  // (incluidos los cancelados), así que no se excluyen aquí.
                  const allReady =
                    order.items.length > 0 &&
                    order.items.every(
                      (item) => normalizarEstado(item.status) === "READY",
                    );

                  return (
                    <article
                      key={order.id}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-400">
                            Comanda
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-[#20233e]">
                            #{order.orderNumber ?? shortId(order.id)}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {order.account?.table?.number
                              ? `Mesa ${order.account.table.number}`
                              : "Para llevar"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-4 py-2 text-xs font-semibold ${estiloEstado(order.status)}`}
                        >
                          {etiquetaEstado(order.status)}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {order.items.map((item) => {
                          const estado = normalizarEstado(item.status);
                          const ready = estado === "READY";
                          const key = `${order.id}-${item.id}`;
                          const stockKey = `${order.branchId}-${item.dishId}`;
                          // Disponibilidad del platillo en la sucursal; es
                          // independiente del estado de este platillo.
                          const agotado =
                            item.dish.branchDishes.some(
                              (branchDish) =>
                                branchDish.branchId === order.branchId &&
                                branchDish.stockStatus === "OUT_OF_STOCK",
                            ) || agotados.has(stockKey);
                          // El backend solo acepta terminar platillos en
                          // preparación. Un platillo agotado que ya forma
                          // parte de la comanda se puede terminar.
                          const puedeTerminar =
                            estado === "IN_PREPARATION" &&
                            procesandoId === null;
                          const puedeMarcarAgotado =
                            !agotado &&
                            (estado === "RECEIVED" ||
                              estado === "IN_PREPARATION") &&
                            procesandoId === null;

                          return (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-[#fafbfe] p-4"
                            >
                              <div>
                                <p className="font-semibold text-[#252944]">
                                  {item.dish.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Cantidad: {item.quantity}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span
                                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${estiloEstado(item.status)}`}
                                  >
                                    {etiquetaEstado(item.status)}
                                  </span>

                                  {agotado && (
                                    <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                      Agotado en sucursal
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={!puedeTerminar}
                                  onClick={() =>
                                    void marcarPlatilloListo(
                                      order.id,
                                      item.id,
                                    )
                                  }
                                  className="rounded-xl bg-[#7564e8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {procesandoId === key
                                    ? "Procesando..."
                                    : ready
                                      ? "Platillo terminado"
                                      : "Terminar platillo"}
                                </button>

                                <button
                                  type="button"
                                  disabled={!puedeMarcarAgotado}
                                  onClick={() => {
                                    setErrorH9("");
                                    setPlatilloSeleccionado({
                                      dishId: item.dishId,
                                      branchId: order.branchId,
                                      dishName: item.dish.name,
                                    });
                                  }}
                                  className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {procesandoId === stockKey
                                    ? "Procesando..."
                                    : agotado
                                      ? "Agotado"
                                      : "Marcar agotado"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
                        <p className="text-sm text-slate-500">
                          {allReady
                            ? "Todos los platillos están listos."
                            : "Aún hay platillos pendientes de preparación."}
                        </p>

                        <button
                          type="button"
                          disabled={
                            !allReady ||
                            procesandoId !== null
                          }
                          onClick={() =>
                            void marcarComandaLista(order.id)
                          }
                          className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {procesandoId === order.id
                            ? "Procesando..."
                            : "Marcar comanda lista"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
            Núcleo Digital · Panel de cocina · H7 + H8 + H9
          </footer>
        </div>
      </main>

      {platilloSeleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-agotado-titulo"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl text-red-600">
              !
            </div>

            <h2
              id="confirmar-agotado-titulo"
              className="text-xl font-bold text-[#20233e]"
            >
              Confirmar platillo agotado
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              ¿Seguro que deseas marcar{" "}
              <strong>{platilloSeleccionado.dishName}</strong> como agotado?
              Dejará de estar disponible para nuevos pedidos en esta sucursal
              y se notificará a los meseros con comandas afectadas.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={procesandoId !== null}
                onClick={() => setPlatilloSeleccionado(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={procesandoId !== null}
                onClick={() => void confirmarPlatilloAgotado()}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {procesandoId !== null
                  ? "Procesando..."
                  : "Sí, marcar agotado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
