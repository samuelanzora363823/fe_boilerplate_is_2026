"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BarraLateral from "@/app/components/BarraLateral";
import CampanaNotificaciones from "@/app/components/CampanaNotificaciones";
import { useSesion } from "@/lib/stores/sesion";

type Sucursal = { id: string; name: string };

type Bloque = {
  hour: number;
  label: string;
  orderCount: number;
  isPeak: boolean;
};

type Reporte = {
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  totalOrders: number;
  hours: Bloque[];
};

type Campo = "branchId" | "from" | "to";
type Errores = Partial<Record<Campo, string>>;

const SIN_PERMISO = "No tiene permiso para ver reportes.";
const ERROR_SERVIDOR = "No se pudo generar el reporte. Intente de nuevo.";
const DIA_MS = 24 * 60 * 60 * 1000;

const dos = (n: number) => String(n).padStart(2, "0");
const aTexto = (d: Date) =>
  `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const aFechaUtc = (valor: string) => {
  const [a, m, d] = valor.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
// dd/mm/aaaa para mostrar el período.
const mostrar = (valor: string) => valor.split("-").reverse().join("/");

// Período por defecto: primer día del mes actual a hoy (Épica 10).
function hoy() {
  return aTexto(new Date());
}
function primeroDelMes() {
  const d = new Date();
  return aTexto(new Date(d.getFullYear(), d.getMonth(), 1));
}

// Mismas reglas que el backend; los mensajes se muestran debajo del campo.
function validar(sucursal: string, desde: string, hasta: string): Errores {
  const errores: Errores = {};
  if (!sucursal) errores.branchId = "Seleccione una sucursal.";
  if (!desde) errores.from = "La fecha inicial es obligatoria.";
  if (!hasta) errores.to = "La fecha final es obligatoria.";
  if (desde && hasta) {
    if (desde > hasta) {
      errores.from = "La fecha inicial no puede ser posterior a la fecha final.";
    } else if (hasta > hoy()) {
      errores.to = "La fecha final no puede ser posterior a hoy.";
    } else if ((aFechaUtc(hasta) - aFechaUtc(desde)) / DIA_MS + 1 > 366) {
      errores.to = "El período no puede superar 366 días.";
    }
  } else if (hasta && hasta > hoy()) {
    errores.to = "La fecha final no puede ser posterior a hoy.";
  }
  return errores;
}

export default function HorariosPicoPage() {
  const router = useRouter();
  const cargarUsuario = useSesion((estado) => estado.cargarUsuario);

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursal, setSucursal] = useState("");
  const [desde, setDesde] = useState(primeroDelMes);
  const [hasta, setHasta] = useState(hoy);
  const [tocado, setTocado] = useState(false);
  const [erroresServidor, setErroresServidor] = useState<Errores>({});

  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [sinPermiso, setSinPermiso] = useState(false);

  const errores = validar(sucursal, desde, hasta);
  const hayErrores = Object.keys(errores).length > 0;
  // "Seleccione una sucursal." solo después de tocar el filtro.
  const visibles: Errores = {
    ...errores,
    branchId: tocado ? errores.branchId : undefined,
    ...Object.fromEntries(
      Object.entries(erroresServidor).filter(([, valor]) => valor)
    ),
  };

  // Al abrir: se valida el rol y se carga la lista de sucursales.
  useEffect(() => {
    queueMicrotask(async () => {
      const actual = await cargarUsuario();
      if (actual && actual.role !== "GERENTE_GENERAL") {
        setSinPermiso(true);
        return;
      }

      try {
        const respuesta = await fetch("/api/reportes/branches", {
          cache: "no-store",
        });
        if (respuesta.status === 401) {
          router.push("/login");
          return;
        }
        if (respuesta.status === 403) {
          setSinPermiso(true);
          return;
        }
        if (!respuesta.ok) throw new Error();
        const datos: { data: Sucursal[] } = await respuesta.json();
        setSucursales(datos.data);
      } catch {
        setError(ERROR_SERVIDOR);
      }
    });
  }, [cargarUsuario, router]);

  async function generar() {
    setTocado(true);
    if (hayErrores) return;

    setCargando(true);
    setError("");
    setErroresServidor({});

    try {
      const parametros = new URLSearchParams({
        branchId: sucursal,
        from: desde,
        to: hasta,
      });
      const respuesta = await fetch(
        `/api/reportes/reports/peak-hours?${parametros.toString()}`,
        { cache: "no-store" }
      );

      if (respuesta.status === 401) {
        router.push("/login");
        return;
      }
      if (respuesta.status === 403) {
        setSinPermiso(true);
        return;
      }

      const datos = await respuesta.json();

      if (respuesta.status === 400 && datos.field) {
        setErroresServidor({ [datos.field as Campo]: datos.message });
        setReporte(null);
        return;
      }
      if (!respuesta.ok) {
        throw new Error(datos.message ?? ERROR_SERVIDOR);
      }

      setReporte(datos as Reporte);
    } catch {
      setReporte(null);
      setError(ERROR_SERVIDOR);
    } finally {
      setCargando(false);
    }
  }

  const maximo = Math.max(1, ...(reporte?.hours.map((h) => h.orderCount) ?? []));

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800 lg:flex">
      {/* BARRA LATERAL */}
      <BarraLateral />

      {/* CONTENIDO PRINCIPAL */}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-slate-400">
                Reportes / Horarios pico
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
                Horarios pico
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Consulta las horas con más pedidos de cada sucursal para
                planificar el personal.
              </p>
            </div>
            <CampanaNotificaciones />
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

              {/* FILTROS */}
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-start">
                  <div>
                    <label
                      htmlFor="sucursal"
                      className="mb-2 block text-sm font-semibold text-[#252944]"
                    >
                      Sucursal
                    </label>
                    <select
                      id="sucursal"
                      value={sucursal}
                      onChange={(e) => {
                        setTocado(true);
                        setSucursal(e.target.value);
                        setErroresServidor({});
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-[#7564e8]"
                    >
                      <option value="">Seleccione una sucursal</option>
                      {sucursales.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {visibles.branchId && (
                      <p className="mt-2 text-xs text-red-600">
                        {visibles.branchId}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="desde"
                      className="mb-2 block text-sm font-semibold text-[#252944]"
                    >
                      Fecha inicial
                    </label>
                    <input
                      id="desde"
                      type="date"
                      value={desde}
                      max={hoy()}
                      onChange={(e) => {
                        setDesde(e.target.value);
                        setErroresServidor({});
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-600 outline-none focus:border-[#7564e8]"
                    />
                    {visibles.from && (
                      <p className="mt-2 text-xs text-red-600">
                        {visibles.from}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="hasta"
                      className="mb-2 block text-sm font-semibold text-[#252944]"
                    >
                      Fecha final
                    </label>
                    <input
                      id="hasta"
                      type="date"
                      value={hasta}
                      max={hoy()}
                      onChange={(e) => {
                        setHasta(e.target.value);
                        setErroresServidor({});
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-600 outline-none focus:border-[#7564e8]"
                    />
                    {visibles.to && (
                      <p className="mt-2 text-xs text-red-600">
                        {visibles.to}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void generar()}
                    disabled={cargando || hayErrores}
                    className="rounded-xl bg-[#7564e8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6250d5] disabled:opacity-50 md:mt-7"
                  >
                    Generar reporte
                  </button>
                </div>
              </section>

              {/* RESULTADO */}
              {cargando ? (
                <EstadoVacio texto="Generando reporte…" />
              ) : !reporte ? (
                <EstadoVacio texto="Seleccione una sucursal para generar el reporte." />
              ) : reporte.totalOrders === 0 ? (
                <EstadoVacio texto="No hay pedidos registrados en el período seleccionado." />
              ) : (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
                    <div>
                      <h2 className="text-lg font-bold text-[#20233e]">
                        Pedidos por hora – {reporte.branchName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Del {mostrar(reporte.from)} al {mostrar(reporte.to)} ·{" "}
                        <strong className="text-slate-700">
                          {reporte.totalOrders}
                        </strong>{" "}
                        pedidos
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded bg-[#7564e8]" />
                        Hora pico
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded bg-[#d9d3ff]" />
                        Otras horas
                      </span>
                    </div>
                  </div>

                  {/* GRÁFICO DE BARRAS */}
                  <div className="overflow-x-auto px-5 pb-4 pt-6 sm:px-6">
                    <div
                      className="flex h-64 min-w-[640px] items-end gap-2"
                      role="img"
                      aria-label="Gráfico de pedidos por hora"
                    >
                      {reporte.hours.map((bloque) => (
                        <div
                          key={bloque.hour}
                          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                        >
                          <span
                            className={`text-xs ${
                              bloque.isPeak
                                ? "font-bold text-[#7564e8]"
                                : "text-slate-500"
                            }`}
                          >
                            {bloque.orderCount}
                          </span>
                          <div
                            title={`${bloque.label}: ${bloque.orderCount} pedidos`}
                            className={`w-full rounded-t-lg ${
                              bloque.isPeak ? "bg-[#7564e8]" : "bg-[#d9d3ff]"
                            }`}
                            style={{
                              height: `${(bloque.orderCount / maximo) * 85}%`,
                              minHeight: bloque.orderCount > 0 ? 4 : 1,
                            }}
                          />
                          <span className="text-[11px] text-slate-400">
                            {dos(bloque.hour)}h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TABLA */}
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full min-w-[520px] text-left">
                      <thead className="bg-[#f9f9fd]">
                        <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-4">Hora</th>
                          <th className="px-5 py-4">Pedidos</th>
                          <th className="px-5 py-4">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reporte.hours.map((bloque) => (
                          <tr
                            key={bloque.hour}
                            className={bloque.isPeak ? "bg-[#faf9ff]" : ""}
                          >
                            <td
                              className={`px-5 py-3 text-sm ${
                                bloque.isPeak
                                  ? "font-semibold text-[#252944]"
                                  : "text-slate-600"
                              }`}
                            >
                              {bloque.label}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-600">
                              {bloque.orderCount}
                            </td>
                            <td className="px-5 py-3 text-sm">
                              {bloque.isPeak && (
                                <span className="inline-flex rounded-full bg-[#f0edff] px-2.5 py-1 text-xs font-semibold text-[#7564e8]">
                                  Hora pico
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EstadoVacio({ texto }: { texto: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-500 shadow-sm">
      {texto}
    </section>
  );
}
