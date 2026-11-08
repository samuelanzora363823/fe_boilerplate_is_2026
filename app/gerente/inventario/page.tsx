"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSesion } from "@/lib/stores/sesion";
import BarraLateral from "@/app/components/BarraLateral";

type Unidad = "KG" | "G" | "L" | "ML" | "UNIDAD";

type Existencia = {
  branchInventoryId: string;
  supplyId: string;
  name: string;
  unit: Unidad;
  quantity: number;
  minimumStock: number;
  lowStock: boolean;
  updatedAt: string;
};

type Respuesta = {
  data: Existencia[];
  total: number;
  page: number;
  limit: number;
  lowStockCount: number;
  branch: { id: string; name: string };
};

const POR_PAGINA = 20;
const MAX_BUSQUEDA = 50;
const SIN_PERMISO = "No tiene permiso para ver el inventario.";

function Icono({
  nombre,
  size = 20,
}: {
  nombre: string;
  size?: number;
}) {
  const base = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (nombre) {
    case "inventario":
      return (
        <svg {...base}>
          <path d="m3 7 9-4 9 4-9 4-9-4Z" />
          <path d="M3 7v10l9 4 9-4V7M12 11v10" />
        </svg>
      );
    case "alerta":
      return (
        <svg {...base}>
          <path d="M12 3 2 20h20L12 3Z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
      );
    case "buscar":
      return (
        <svg {...base}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 5 5" />
        </svg>
      );
    case "refrescar":
      return (
        <svg {...base}>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M5.5 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.5-2" />
        </svg>
      );
    case "mas":
      return (
        <svg {...base}>
          <path d="M12 4v16M4 12h16" />
        </svg>
      );
    default:
      return (
        <svg {...base}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      );
  }
}

function textoUnidad(unidad: Unidad) {
  if (unidad === "UNIDAD") return "unidades";
  return unidad.toLowerCase();
}

function cantidad(valor: number) {
  return Number(valor.toFixed(3)).toString();
}

// Formato dd/mm/aaaa hh:mm (H15).
function fecha(valor: string) {
  const d = new Date(valor);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export default function InventarioPage() {
  const router = useRouter();
  const cargarUsuario = useSesion((estado) => estado.cargarUsuario);
  const sucursal = useSesion((estado) => estado.sucursal);
  const guardarSucursal = useSesion((estado) => estado.guardarSucursal);

  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [total, setTotal] = useState(0);
  const [porAgotarse, setPorAgotarse] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [sinPermiso, setSinPermiso] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [soloPorAgotarse, setSoloPorAgotarse] = useState(false);
  const [pagina, setPagina] = useState(1);

  const busquedaInvalida = busqueda.length > MAX_BUSQUEDA;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = Boolean(busquedaAplicada) || soloPorAgotarse;

  const cargarInventario = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const sesion = await cargarUsuario();

      if (sesion && sesion.role !== "GERENTE") {
        setSinPermiso(true);
        return;
      }

      const parametros = new URLSearchParams({
        page: String(pagina),
        limit: String(POR_PAGINA),
        lowStock: String(soloPorAgotarse),
      });
      if (busquedaAplicada) parametros.set("search", busquedaAplicada);

      const respuesta = await fetch(
        `/api/inventario/inventory?${parametros.toString()}`,
        { cache: "no-store" }
      );

      // Sesión vencida: se vuelve a iniciar sesión.
      if (respuesta.status === 401) {
        router.push("/login");
        return;
      }

      if (respuesta.status === 403) {
        setSinPermiso(true);
        return;
      }

      if (!respuesta.ok) {
        throw new Error("No se pudo cargar el inventario. Intente de nuevo.");
      }

      const datos: Respuesta = await respuesta.json();
      setExistencias(datos.data);
      setTotal(datos.total);
      setPorAgotarse(datos.lowStockCount);
      guardarSucursal(datos.branch);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el inventario. Intente de nuevo."
      );
    } finally {
      setCargando(false);
    }
  }, [
    busquedaAplicada,
    cargarUsuario,
    guardarSucursal,
    pagina,
    router,
    soloPorAgotarse,
  ]);

  // Mensaje de éxito al regresar de registrar un movimiento (H14).
  useEffect(() => {
    const texto = new URLSearchParams(window.location.search).get("mensaje");
    if (texto) {
      queueMicrotask(() => setMensaje(texto));
      router.replace("/gerente/inventario");
    }
  }, [router]);

  // La lista se carga al abrir, al cambiar búsqueda, filtro o página.
  useEffect(() => {
    // La carga se difiere para evitar setState
    // síncrono dentro del efecto.
    queueMicrotask(() => {
      void cargarInventario();
    });
  }, [cargarInventario]);

  // La búsqueda se aplica 500 ms después de dejar de escribir.
  useEffect(() => {
    if (busquedaInvalida) return;

    const espera = setTimeout(() => {
      const texto = busqueda.trim();
      if (texto !== busquedaAplicada) {
        setPagina(1);
        setBusquedaAplicada(texto);
      }
    }, 500);

    return () => clearTimeout(espera);
  }, [busqueda, busquedaAplicada, busquedaInvalida]);

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800 lg:flex">
      {/* BARRA LATERAL */}
      <BarraLateral />

      {/* CONTENIDO PRINCIPAL */}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-slate-400">
                Administración / Inventario
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
                Inventario de la sucursal
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Consulta las existencias de insumos e identifica los que
                están por agotarse.
              </p>
              {sucursal && (
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#f0edff] px-3 py-1.5 text-xs font-semibold text-[#7564e8]">
                  Sucursal: {sucursal.name}
                </span>
              )}
            </div>

            {!sinPermiso && (
              <div className="flex flex-wrap gap-3">
              <Link href="/gerente/inventario/alertas" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100">
                <Icono nombre="alerta" size={18} /> Ver alertas
              </Link>
              <Link
                href="/gerente/inventario/movimientos/nuevo"
                className="flex items-center gap-2 rounded-xl bg-[#7564e8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6250d5]"
              >
                <Icono nombre="mas" size={18} />
                Registrar movimiento
              </Link>
              </div>
            )}
          </div>

          {sinPermiso ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {SIN_PERMISO}
            </div>
          ) : (
            <>
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

              {/* TARJETA: INSUMOS POR AGOTARSE */}
              <section className="mb-7 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div
                  className={
                    porAgotarse > 0
                      ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600"
                      : "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7564e8]"
                  }
                >
                  <Icono nombre="alerta" size={26} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Insumos por agotarse</p>
                  <p className="text-3xl font-bold text-[#20233e]">
                    {porAgotarse}
                  </p>
                </div>
              </section>

              {/* FILTROS Y TABLA */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#20233e]">
                        Existencias
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Insumos de tu sucursal ordenados de la A a la Z.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMensaje("");
                        void cargarInventario();
                      }}
                      disabled={cargando}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Icono nombre="refrescar" size={16} />
                      Actualizar
                    </button>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <Icono nombre="buscar" size={18} />
                        </div>
                        <input
                          aria-label="Buscar insumo"
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar insumo..."
                          className={`w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none focus:border-[#7564e8] ${
                            busquedaInvalida
                              ? "border-red-300"
                              : "border-slate-200"
                          }`}
                        />
                      </div>
                      {busquedaInvalida && (
                        <span className="mt-1 block text-xs text-red-600">
                          La búsqueda admite máximo 50 caracteres.
                        </span>
                      )}
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                      <span>Solo por agotarse</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={soloPorAgotarse}
                        aria-label="Solo por agotarse"
                        onClick={() => {
                          setPagina(1);
                          setSoloPorAgotarse(!soloPorAgotarse);
                        }}
                        className={`relative h-6 w-11 rounded-full transition ${
                          soloPorAgotarse ? "bg-[#7564e8]" : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                            soloPorAgotarse ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead className="bg-[#f9f9fd]">
                      <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-4">Insumo</th>
                        <th className="px-5 py-4">Unidad</th>
                        <th className="px-5 py-4">Existencias</th>
                        <th className="px-5 py-4">Mínimo</th>
                        <th className="px-5 py-4">Estado</th>
                        <th className="px-5 py-4">Última actualización</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {cargando ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-16 text-center text-sm text-slate-500"
                          >
                            Cargando inventario…
                          </td>
                        </tr>
                      ) : existencias.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-16 text-center text-sm text-slate-500"
                          >
                            {hayFiltros
                              ? "No hay insumos que coincidan con la búsqueda."
                              : "Tu sucursal no tiene insumos registrados."}
                          </td>
                        </tr>
                      ) : (
                        existencias.map((insumo) => (
                          <tr
                            key={insumo.branchInventoryId}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                                  <Icono nombre="inventario" size={23} />
                                </div>
                                <span className="text-sm font-semibold text-[#252944]">
                                  {insumo.name}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-5">
                              <span className="inline-flex rounded-lg bg-[#edf2ff] px-3 py-1.5 text-xs font-medium text-[#5269bc]">
                                {textoUnidad(insumo.unit)}
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-5 py-5 text-sm font-bold text-[#252944]">
                              {cantidad(insumo.quantity)}
                            </td>

                            <td className="whitespace-nowrap px-5 py-5 text-sm text-slate-500">
                              {cantidad(insumo.minimumStock)}
                            </td>

                            <td className="px-5 py-5">
                              <span
                                className={
                                  insumo.lowStock
                                    ? "inline-flex rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                                    : "inline-flex rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700"
                                }
                              >
                                {insumo.lowStock ? "Por agotarse" : "Normal"}
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-5 py-5 text-sm text-slate-500">
                              {fecha(insumo.updatedAt)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
                  <p className="text-sm text-slate-500">
                    Mostrando{" "}
                    <strong className="text-slate-700">
                      {existencias.length}
                    </strong>{" "}
                    de <strong className="text-slate-700">{total}</strong>{" "}
                    insumos
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
