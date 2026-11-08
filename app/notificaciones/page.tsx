"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BarraLateral from "@/app/components/BarraLateral";
import CampanaNotificaciones from "@/app/components/CampanaNotificaciones";
import { useSesion } from "@/lib/stores/sesion";
import type { RolUsuario } from "@/lib/stores/sesion";

type Estado = "NO_LEIDA" | "LEIDA";
type Modulo = "COCINA" | "RESERVAS" | "INVENTARIO";

type Aviso = {
  id: string;
  title: string;
  message: string;
  sourceModule: Modulo;
  referenceType: string | null;
  referenceId: string | null;
  status: Estado;
  createdAt: string;
  readAt: string | null;
};

type Respuesta = {
  data: Aviso[];
  total: number;
  page: number;
  limit: number;
};

const POR_PAGINA = 10;

const textoModulo: Record<Modulo, string> = {
  COCINA: "Cocina",
  RESERVAS: "Reservas",
  INVENTARIO: "Inventario",
};

// Formato dd/mm/aaaa hh:mm (H26).
function fecha(valor: string) {
  const d = new Date(valor);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// "Ver detalle": pantalla del registro que originó el aviso,
// solo cuando esa pantalla existe para el rol de la sesión.
function detalle(aviso: Aviso, rol: RolUsuario | undefined) {
  switch (aviso.referenceType) {
    case "InventoryAlert":
      return rol === "GERENTE" ? "/gerente/inventario/alertas" : null;
    case "Order":
      if (rol === "MESERO") return "/mesero/pos";
      if (rol === "CLIENTE") return "/cliente/pedido-para-llevar";
      return null;
    case "Dish":
      if (rol === "MESERO") return "/mesero/pos";
      return "/menu";
    default:
      return null;
  }
}

export default function NotificacionesPage() {
  const router = useRouter();
  const usuario = useSesion((estado) => estado.usuario);
  const noLeidas = useSesion((estado) => estado.noLeidas);
  const cargarNoLeidas = useSesion((estado) => estado.cargarNoLeidas);

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [marcando, setMarcando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const [estado, setEstado] = useState<"" | Estado>("");
  const [modulo, setModulo] = useState<"" | Modulo>("");
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const cargarAvisos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const parametros = new URLSearchParams({
        page: String(pagina),
        limit: String(POR_PAGINA),
      });
      if (estado) parametros.set("status", estado);
      if (modulo) parametros.set("sourceModule", modulo);

      const respuesta = await fetch(
        `/api/notificaciones/notifications?${parametros.toString()}`,
        { cache: "no-store" },
      );

      // Sin sesión: se redirige a /login.
      if (respuesta.status === 401) {
        router.push("/login");
        return;
      }

      if (!respuesta.ok) {
        throw new Error(
          "No se pudieron cargar las notificaciones. Intente de nuevo.",
        );
      }

      const datos: Respuesta = await respuesta.json();
      setAvisos(datos.data);
      setTotal(datos.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las notificaciones. Intente de nuevo.",
      );
    } finally {
      setCargando(false);
    }
  }, [estado, modulo, pagina, router]);

  // La lista se carga al abrir la pantalla y al cambiar un filtro o de página.
  useEffect(() => {
    queueMicrotask(() => {
      void cargarAvisos();
    });
  }, [cargarAvisos]);

  // Al abrir un aviso se expande y, si estaba No leída, se marca como Leída.
  async function abrirAviso(aviso: Aviso) {
    setAbierto(abierto === aviso.id ? null : aviso.id);
    if (aviso.status === "LEIDA") return;

    const respuesta = await fetch(
      `/api/notificaciones/notifications/${encodeURIComponent(aviso.id)}/read`,
      { method: "PATCH" },
    );

    if (respuesta.status === 401) {
      router.push("/login");
      return;
    }

    if (respuesta.ok) {
      const datos: { status: Estado; readAt: string } = await respuesta.json();
      setAvisos((actuales) =>
        actuales.map((item) =>
          item.id === aviso.id
            ? { ...item, status: datos.status, readAt: datos.readAt }
            : item,
        ),
      );
      void cargarNoLeidas();
    }
  }

  async function marcarTodas() {
    setMarcando(true);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(
        "/api/notificaciones/notifications/read-all",
        { method: "PATCH" },
      );

      if (respuesta.status === 401) {
        router.push("/login");
        return;
      }

      if (!respuesta.ok) {
        throw new Error(
          "No se pudieron cargar las notificaciones. Intente de nuevo.",
        );
      }

      setMensaje("Todas las notificaciones se marcaron como leídas.");
      await Promise.all([cargarAvisos(), cargarNoLeidas()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las notificaciones. Intente de nuevo.",
      );
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800 lg:flex">
      {/* BARRA LATERAL */}
      <BarraLateral />

      {/* CONTENIDO PRINCIPAL */}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              {/* Regresa a la pantalla desde donde se abrió la bandeja. */}
              <button
                type="button"
                onClick={() =>
                  window.history.length > 1 ? router.back() : router.push("/")
                }
                className="mb-3 text-sm font-medium text-violet-700 hover:underline"
              >
                ← Volver
              </button>
              <p className="mb-2 text-sm text-slate-400">
                Núcleo Digital / Notificaciones
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
                Notificaciones
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Consulta los avisos de tus pedidos, reservaciones, comandas e
                inventario.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <CampanaNotificaciones />
              <button
                type="button"
                onClick={() => void marcarTodas()}
                disabled={marcando || noLeidas === 0}
                className="rounded-xl bg-[#7564e8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6250d5] disabled:opacity-50"
              >
                {marcando ? "Marcando..." : "Marcar todas como leídas"}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {mensaje && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
            >
              {mensaje}
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* FILTROS */}
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">Estado</legend>
                  {(
                    [
                      ["", "Todas"],
                      ["NO_LEIDA", "No leídas"],
                      ["LEIDA", "Leídas"],
                    ] as const
                  ).map(([valor, texto]) => (
                    <label
                      key={texto}
                      className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        estado === valor
                          ? "border-[#7564e8] bg-[#f0edff] text-[#7564e8]"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="estado"
                        value={valor}
                        checked={estado === valor}
                        onChange={() => {
                          setPagina(1);
                          setEstado(valor);
                        }}
                        className="sr-only"
                      />
                      {texto}
                    </label>
                  ))}
                </fieldset>

                <select
                  aria-label="Módulo de origen"
                  value={modulo}
                  onChange={(e) => {
                    setPagina(1);
                    setModulo(e.target.value as "" | Modulo);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-[#7564e8]"
                >
                  <option value="">Todos los módulos</option>
                  <option value="COCINA">Cocina</option>
                  <option value="RESERVAS">Reservas</option>
                  <option value="INVENTARIO">Inventario</option>
                </select>
              </div>
            </div>

            {/* LISTA DE AVISOS */}
            <div className="divide-y divide-slate-100">
              {cargando ? (
                <p className="px-5 py-16 text-center text-sm text-slate-500">
                  Cargando notificaciones…
                </p>
              ) : avisos.length === 0 ? (
                <p className="px-5 py-16 text-center text-sm text-slate-500">
                  No tienes notificaciones.
                </p>
              ) : (
                avisos.map((aviso) => {
                  const noLeida = aviso.status === "NO_LEIDA";
                  const expandido = abierto === aviso.id;
                  const enlace = detalle(aviso, usuario?.role);

                  return (
                    <article
                      key={aviso.id}
                      className={`transition hover:bg-slate-50/70 ${
                        noLeida ? "bg-[#faf9ff]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void abrirAviso(aviso)}
                        aria-expanded={expandido}
                        className="flex w-full items-start gap-4 px-5 py-5 text-left sm:px-6"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                            noLeida ? "bg-[#4f7cff]" : "bg-transparent"
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2
                              className={`text-sm text-[#252944] ${
                                noLeida ? "font-bold" : "font-medium"
                              }`}
                            >
                              {aviso.title}
                            </h2>
                            <span className="inline-flex rounded-lg bg-[#edf2ff] px-2.5 py-1 text-xs font-medium text-[#5269bc]">
                              {textoModulo[aviso.sourceModule]}
                            </span>
                            <span
                              className={
                                noLeida
                                  ? "inline-flex rounded-full bg-[#f0edff] px-2.5 py-1 text-xs font-semibold text-[#7564e8]"
                                  : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                              }
                            >
                              {noLeida ? "No leída" : "Leída"}
                            </span>
                          </div>

                          <p
                            className={`mt-2 text-sm text-slate-500 ${
                              expandido ? "" : "line-clamp-1"
                            } ${noLeida ? "font-semibold text-slate-600" : ""}`}
                          >
                            {aviso.message}
                          </p>
                        </div>

                        <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                          {fecha(aviso.createdAt)}
                        </span>
                      </button>

                      {expandido && enlace && (
                        <div className="px-5 pb-5 pl-[3.25rem] sm:px-6 sm:pl-[3.5rem]">
                          <Link
                            href={enlace}
                            className="text-sm font-semibold text-[#7564e8] hover:underline"
                          >
                            Ver detalle
                          </Link>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>

            {/* PAGINACIÓN */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <p className="text-sm text-slate-500">
                Mostrando{" "}
                <strong className="text-slate-700">{avisos.length}</strong> de{" "}
                <strong className="text-slate-700">{total}</strong> avisos
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPagina(pagina - 1)}
                  disabled={cargando || pagina <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-slate-500">
                  Página {pagina} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(pagina + 1)}
                  disabled={cargando || pagina >= totalPaginas}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
