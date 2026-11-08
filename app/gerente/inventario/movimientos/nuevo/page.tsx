"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSesion } from "@/lib/stores/sesion";

type Unidad = "KG" | "G" | "L" | "ML" | "UNIDAD";
type TipoMovimiento = "ENTRADA" | "SALIDA";

type Insumo = {
  supplyId: string;
  name: string;
  unit: Unidad;
  quantity: number;
  minimumStock: number;
  lowStock: boolean;
};

type Formulario = {
  supplyId: string;
  type: TipoMovimiento;
  quantity: string;
  reason: string;
};

type Errores = Partial<Record<keyof Formulario, string>>;

const formularioInicial: Formulario = {
  supplyId: "",
  type: "ENTRADA",
  quantity: "",
  reason: "",
};

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
    case "inicio":
      return (
        <svg {...base}>
          <path d="m3 10 9-7 9 7v10H3z" />
          <path d="M9 20v-7h6v7" />
        </svg>
      );
    case "menu":
      return (
        <svg {...base}>
          <path d="M4 5h16M4 12h16M4 19h16" />
        </svg>
      );
    case "inventario":
      return (
        <svg {...base}>
          <path d="m3 7 9-4 9 4-9 4-9-4Z" />
          <path d="M3 7v10l9 4 9-4V7M12 11v10" />
        </svg>
      );
    case "entrada":
      return (
        <svg {...base}>
          <path d="M12 4v12m-5-5 5 5 5-5M5 20h14" />
        </svg>
      );
    case "salida":
      return (
        <svg {...base}>
          <path d="M12 20V8m-5 5 5-5 5 5M5 4h14" />
        </svg>
      );
    case "cerrar":
      return (
        <svg {...base}>
          <path d="M5 5 19 19M19 5 5 19" />
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

function validar(formulario: Formulario): Errores {
  const errores: Errores = {};
  const numero = Number(formulario.quantity);
  const decimales = formulario.quantity.split(".")[1]?.length ?? 0;
  const motivo = formulario.reason.trim();

  if (!formulario.supplyId) errores.supplyId = "Selecciona un insumo.";

  if (!formulario.quantity) {
    errores.quantity = "Ingresa una cantidad.";
  } else if (!Number.isFinite(numero) || numero <= 0) {
    errores.quantity = "La cantidad debe ser mayor que 0.";
  } else if (decimales > 3) {
    errores.quantity = "La cantidad admite máximo 3 decimales.";
  } else if (numero > 99999.999) {
    errores.quantity = "La cantidad máxima es 99 999.999.";
  }

  if (motivo.length < 3) {
    errores.reason = "El motivo debe tener entre 3 y 200 caracteres.";
  }

  return errores;
}

const SIN_PERMISO =
  "No tiene permiso para registrar movimientos de inventario.";

export default function RegistrarMovimientoPage() {
  const router = useRouter();
  const cargarUsuario = useSesion((estado) => estado.cargarUsuario);
  const sucursal = useSesion((estado) => estado.sucursal);
  const guardarSucursal = useSesion((estado) => estado.guardarSucursal);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [formulario, setFormulario] =
    useState<Formulario>(formularioInicial);
  const [tocados, setTocados] = useState<Partial<Record<keyof Formulario, boolean>>>({});
  const [busquedaInsumo, setBusquedaInsumo] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const cargarInsumos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const sesion = await cargarUsuario();

      if (sesion && sesion.role !== "GERENTE") {
        setSinPermiso(true);
        return;
      }

      const respuesta = await fetch("/api/inventario/inventory?limit=100", {
        cache: "no-store",
      });

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
        throw new Error("No se pudieron cargar los insumos.");
      }

      // Respuesta paginada de H15: { data, total, page, limit, lowStockCount, branch }.
      const datos: {
        data: Insumo[];
        branch: { id: string; name: string };
      } = await respuesta.json();
      setInsumos(datos.data);
      guardarSucursal(datos.branch);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar los insumos."
      );
    } finally {
      setCargando(false);
    }
  }, [cargarUsuario, guardarSucursal, router]);

  useEffect(() => {
    // La carga se difiere para evitar setState
    // síncrono dentro del efecto.
    queueMicrotask(() => {
      void cargarInsumos();
    });
  }, [cargarInsumos]);

  // Los errores se recalculan con cada cambio; solo se muestran
  // en los campos que el usuario ya tocó.
  const errores = useMemo(() => validar(formulario), [formulario]);
  const hayErrores = Object.keys(errores).length > 0;

  const insumosFiltrados = useMemo(() => {
    const normalizar = (texto: string) =>
      texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const texto = normalizar(busquedaInsumo.trim());
    return insumos.filter(
      (insumo) => !texto || normalizar(insumo.name).includes(texto)
    );
  }, [insumos, busquedaInsumo]);

  function elegirInsumo(insumo: Insumo) {
    setFormulario((actual) => ({ ...actual, supplyId: insumo.supplyId }));
    setBusquedaInsumo(insumo.name);
    setListaAbierta(false);
  }

  const marcar = (campo: keyof Formulario) =>
    setTocados((actual) => ({ ...actual, [campo]: true }));

  const insumoSeleccionado = useMemo(
    () => insumos.find((insumo) => insumo.supplyId === formulario.supplyId),
    [insumos, formulario.supplyId]
  );

  function solicitarConfirmacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMensaje("");

    setTocados({ supplyId: true, quantity: true, reason: true });

    if (!hayErrores) {
      setConfirmando(true);
    }
  }

  async function registrarMovimiento() {
    setGuardando(true);
    setError("");

    try {
      const respuesta = await fetch("/api/inventario/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplyId: formulario.supplyId,
          type: formulario.type,
          quantity: Number(formulario.quantity),
          reason: formulario.reason.trim(),
        }),
      });

      const datos = await respuesta.json();

      if (respuesta.status === 401) {
        router.push("/login");
        return;
      }

      // Errores con la forma { code, message, field } (H14).
      if (respuesta.status === 409 || respuesta.status === 400) {
        throw new Error(datos.message);
      }

      if (respuesta.status === 403) {
        throw new Error(SIN_PERMISO);
      }

      if (!respuesta.ok) {
        throw new Error(
          "No se pudo registrar el movimiento. Intente de nuevo."
        );
      }

      const texto = `Movimiento registrado. Existencias de ${datos.supplyName}: ${cantidad(datos.resultingQuantity)} ${textoUnidad(datos.unit)}.`;
      setMensaje(texto);
      setFormulario(formularioInicial);
      setTocados({});
      setBusquedaInsumo("");

      // Regresa a la consulta de existencias (H15) con el mensaje de éxito.
      router.push(`/gerente/inventario?mensaje=${encodeURIComponent(texto)}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el movimiento. Intente de nuevo."
      );
    } finally {
      setGuardando(false);
      setConfirmando(false);
    }
  }

  const errorDe = (campo: keyof Formulario) =>
    tocados[campo] ? errores[campo] : undefined;

  const claseCampo = (campo: keyof Formulario) =>
    `mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-[#7564e8] ${
      errorDe(campo) ? "border-red-300" : "border-slate-200"
    }`;

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800 lg:flex">
      {/* BARRA LATERAL */}
      <aside className="flex w-full flex-col bg-[#171b36] text-white lg:min-h-screen lg:w-64 lg:shrink-0">
        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7564e8] text-xl font-bold">
              N
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">
                Núcleo Digital
              </p>
              <p className="text-xs text-slate-400">
                Sistema de restaurante
              </p>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-4 lg:flex-col">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10"
          >
            <Icono nombre="inicio" />
            Inicio
          </Link>

          <Link
            href="/gerente/menu"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10"
          >
            <Icono nombre="menu" />
            Menú
          </Link>

          <Link
            href="/gerente/inventario"
            className="flex items-center gap-3 rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
          >
            <Icono nombre="inventario" />
            Inventario
          </Link>

          <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
            <Icono nombre="cuadro" />
            Reportes
          </div>

          <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
            <Icono nombre="cuadro" />
            Configuración
          </div>
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7564e8] font-semibold">
              G
            </div>
            <div>
              <p className="text-sm font-semibold">Gerente</p>
              <p className="text-xs text-slate-400">
                Administración
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7">
            <p className="mb-2 text-sm text-slate-400">
              Administración / Inventario / Registrar movimiento
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
              Registrar movimiento de inventario
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Registra las entradas y salidas de insumos de tu sucursal.
            </p>
            {sucursal && (
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#f0edff] px-3 py-1.5 text-xs font-semibold text-[#7564e8]">
                Sucursal: {sucursal.name}
              </span>
            )}
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

          <div>
            {/* FORMULARIO */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-bold text-[#20233e]">
                Datos del movimiento
              </h2>

              {sinPermiso ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {SIN_PERMISO}
                </p>
              ) : cargando ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Cargando insumos…
                </p>
              ) : insumos.length === 0 && !error ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Tu sucursal no tiene insumos registrados.
                </p>
              ) : (
                <form
                  onSubmit={solicitarConfirmacion}
                  noValidate
                  className="space-y-5"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                  <div className="relative">
                    <label
                      htmlFor="insumo"
                      className="block text-sm font-medium"
                    >
                      Insumo
                    </label>
                    {/* Lista desplegable con búsqueda (H14). */}
                    <input
                      id="insumo"
                      role="combobox"
                      aria-expanded={listaAbierta}
                      aria-controls="insumos-lista"
                      aria-autocomplete="list"
                      autoComplete="off"
                      value={busquedaInsumo}
                      onChange={(e) => {
                        setBusquedaInsumo(e.target.value);
                        setFormulario({ ...formulario, supplyId: "" });
                        setListaAbierta(true);
                      }}
                      onFocus={() => setListaAbierta(true)}
                      onBlur={() => {
                        // Se espera al clic sobre una opción antes de cerrar.
                        setTimeout(() => setListaAbierta(false), 150);
                        marcar("supplyId");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setListaAbierta(false);
                        if (e.key === "Enter" && listaAbierta) {
                          e.preventDefault();
                          if (insumosFiltrados[0]) {
                            elegirInsumo(insumosFiltrados[0]);
                          }
                        }
                      }}
                      placeholder="Buscar y seleccionar un insumo..."
                      className={claseCampo("supplyId")}
                    />

                    {listaAbierta && (
                      <ul
                        id="insumos-lista"
                        role="listbox"
                        className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-lg"
                      >
                        {insumosFiltrados.length === 0 ? (
                          <li className="px-4 py-3 text-sm text-slate-500">
                            No hay insumos que coincidan con la búsqueda.
                          </li>
                        ) : (
                          insumosFiltrados.map((insumo) => (
                            <li
                              key={insumo.supplyId}
                              role="option"
                              aria-selected={
                                insumo.supplyId === formulario.supplyId
                              }
                              onMouseDown={(e) => {
                                e.preventDefault();
                                elegirInsumo(insumo);
                              }}
                              className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-[#f0edff]"
                            >
                              <span className="font-medium text-[#252944]">
                                {insumo.name}
                              </span>
                              <span
                                className={
                                  insumo.lowStock
                                    ? "text-xs font-semibold text-red-600"
                                    : "text-xs text-slate-500"
                                }
                              >
                                {cantidad(insumo.quantity)}{" "}
                                {textoUnidad(insumo.unit)} disponibles
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    )}

                    {errorDe("supplyId") && (
                      <span className="mt-1 block text-xs text-red-600">
                        {errorDe("supplyId")}
                      </span>
                    )}

                    {insumoSeleccionado && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>
                          Disponible:{" "}
                          <strong className="text-[#252944]">
                            {cantidad(insumoSeleccionado.quantity)}{" "}
                            {textoUnidad(insumoSeleccionado.unit)}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Mínimo:{" "}
                          <strong className="text-[#252944]">
                            {cantidad(insumoSeleccionado.minimumStock)}{" "}
                            {textoUnidad(insumoSeleccionado.unit)}
                          </strong>
                        </span>
                        <span
                          className={
                            insumoSeleccionado.lowStock
                              ? "inline-flex rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700"
                              : "inline-flex rounded-full bg-green-50 px-2.5 py-1 font-semibold text-green-700"
                          }
                        >
                          {insumoSeleccionado.lowStock
                            ? "Por agotarse"
                            : "Normal"}
                        </span>
                      </div>
                    )}
                  </div>

                  <fieldset>
                    <legend className="text-sm font-medium">
                      Tipo de movimiento
                    </legend>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {(["ENTRADA", "SALIDA"] as const).map((tipo) => (
                        <label
                          key={tipo}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                            formulario.type === tipo
                              ? "border-[#7564e8] bg-[#f0edff] text-[#7564e8]"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="tipo"
                            value={tipo}
                            checked={formulario.type === tipo}
                            onChange={() =>
                              setFormulario({ ...formulario, type: tipo })
                            }
                            className="sr-only"
                          />
                          <Icono
                            nombre={tipo === "ENTRADA" ? "entrada" : "salida"}
                            size={18}
                          />
                          {tipo === "ENTRADA" ? "Entrada" : "Salida"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">

                  <label className="block text-sm font-medium">
                    Cantidad
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.001"
                        max="99999.999"
                        step="0.001"
                        value={formulario.quantity}
                        onChange={(e) =>
                          setFormulario({
                            ...formulario,
                            quantity: e.target.value,
                          })
                        }
                        onBlur={() => marcar("quantity")}
                        placeholder="0.000"
                        className={`${claseCampo("quantity")} pr-28`}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-sm text-slate-400">
                        {insumoSeleccionado
                          ? textoUnidad(insumoSeleccionado.unit)
                          : "unidad"}
                      </span>
                    </div>
                    {errorDe("quantity") && (
                      <span className="mt-1 block text-xs text-red-600">
                        {errorDe("quantity")}
                      </span>
                    )}
                  </label>

                  <label className="block text-sm font-medium">
                    Motivo
                    <textarea
                      rows={3}
                      maxLength={200}
                      value={formulario.reason}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          reason: e.target.value,
                        })
                      }
                      onBlur={() => marcar("reason")}
                      placeholder="Ej. Compra a proveedor, merma, uso en cocina..."
                      className={`${claseCampo("reason")} resize-y`}
                    />
                    <span className="mt-1 flex justify-between text-xs">
                      <span className="text-red-600">{errorDe("reason")}</span>
                      <span className="text-slate-400">
                        {formulario.reason.length}/200
                      </span>
                    </span>
                  </label>

                  </div>

                  <div className="flex justify-end gap-3">
                    <Link
                      href="/gerente/inventario"
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </Link>

                    <button
                      type="submit"
                      disabled={guardando || hayErrores}
                      className="rounded-xl bg-[#7564e8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
                    >
                      {guardando ? "Registrando..." : "Registrar"}
                    </button>
                  </div>
                </form>
              )}
            </section>

          </div>
        </div>
      </main>

      {/* CONFIRMACIÓN PREVIA */}
      {confirmando && insumoSeleccionado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171b36]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="confirmar-titulo"
                className="text-lg font-bold text-[#20233e]"
              >
                Confirmar movimiento
              </h2>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                aria-label="Cerrar confirmación"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <Icono nombre="cerrar" />
              </button>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              ¿Registrar{" "}
              <strong>
                {formulario.type === "ENTRADA" ? "Entrada" : "Salida"}
              </strong>{" "}
              de{" "}
              <strong>
                {formulario.quantity} {textoUnidad(insumoSeleccionado.unit)}
              </strong>{" "}
              de <strong>{insumoSeleccionado.name}</strong>? Los movimientos
              no se pueden editar ni eliminar.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={guardando}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => void registrarMovimiento()}
                disabled={guardando}
                className="rounded-xl bg-[#7564e8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
              >
                {guardando ? "Registrando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
