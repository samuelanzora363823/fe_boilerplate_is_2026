"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import BarraLateral from "@/app/components/BarraLateral";
import CampanaNotificaciones from "@/app/components/CampanaNotificaciones";
import { useSesion } from "@/lib/stores/sesion";
import {
  ErrorLealtadAdmin,
  NOMBRE_MAX,
  cambiarEstadoBeneficio,
  crearBeneficio,
  editarBeneficio,
  guardarRegla,
  listarBeneficiosAdmin,
  obtenerHistorialRegla,
  obtenerRegla,
  validarBeneficio,
  validarTasa,
  type BeneficioAdmin,
  type CambioRegla,
  type ErroresBeneficio,
  type ReglaLealtad,
  type TipoDescuento,
} from "@/lib/services/loyalty-admin";

// H22: Administrar fidelización (Gerente).
const SIN_PERMISO = "No tiene permiso para administrar la fidelización.";
const ERROR_GUARDAR = "No se pudo guardar la configuración.";
const EXITO = "Configuración guardada.";

type FormBeneficio = {
  name: string;
  pointsRequired: string;
  discountType: TipoDescuento;
  discountValue: string;
};

const FORM_VACIO: FormBeneficio = {
  name: "",
  pointsRequired: "",
  discountType: "PERCENTAGE",
  discountValue: "",
};

const TIPOS: Record<TipoDescuento, string> = {
  PERCENTAGE: "Porcentaje",
  FIXED: "Monto fijo",
};

function valorDescuento(beneficio: Pick<BeneficioAdmin, "discountType" | "discountValue">) {
  return beneficio.discountType === "PERCENTAGE"
    ? `${beneficio.discountValue} %`
    : `$${beneficio.discountValue.toFixed(2)}`;
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-SV", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Aviso({ tipo, texto }: { tipo: "error" | "exito"; texto: string }) {
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={
        tipo === "error"
          ? "mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          : "mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
      }
    >
      {texto}
    </div>
  );
}

function ErrorCampo({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <span id={id} className="mt-1 block text-xs text-red-600">
      {texto}
    </span>
  );
}

export default function FidelizacionPage() {
  const router = useRouter();
  const cargarUsuario = useSesion((s) => s.cargarUsuario);

  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [regla, setRegla] = useState<ReglaLealtad | null>(null);
  const [tasa, setTasa] = useState("");
  const [tasaTocada, setTasaTocada] = useState(false);
  const [errorTasaServidor, setErrorTasaServidor] = useState("");
  const [guardandoRegla, setGuardandoRegla] = useState(false);

  const [historial, setHistorial] = useState<CambioRegla[]>([]);
  const [beneficios, setBeneficios] = useState<BeneficioAdmin[]>([]);

  const [form, setForm] = useState<FormBeneficio>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formTocado, setFormTocado] = useState(false);
  const [erroresServidor, setErroresServidor] = useState<ErroresBeneficio>({});
  const [guardandoBeneficio, setGuardandoBeneficio] = useState(false);

  const [porConfirmar, setPorConfirmar] = useState<BeneficioAdmin | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const errorTasa = validarTasa(tasa);
  const erroresForm = validarBeneficio(form);
  const formValido = Object.keys(erroresForm).length === 0;

  // 401 → iniciar sesión; 403 → sin permiso. Devuelve true si se manejó.
  const manejarAcceso = useCallback(
    (err: unknown) => {
      if (err instanceof ErrorLealtadAdmin && err.status === 401) {
        router.push("/login");
        return true;
      }
      if (err instanceof ErrorLealtadAdmin && err.status === 403) {
        setSinPermiso(true);
        return true;
      }
      return false;
    },
    [router],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const sesion = await cargarUsuario();
      if (sesion && sesion.role !== "GERENTE") {
        setSinPermiso(true);
        return;
      }

      const [reglaActual, cambios, lista] = await Promise.all([
        obtenerRegla(),
        obtenerHistorialRegla(),
        listarBeneficiosAdmin(),
      ]);
      setRegla(reglaActual);
      setTasa(String(reglaActual.pointsPerDollar));
      setHistorial(cambios.items);
      setBeneficios(lista.items);
    } catch (err) {
      if (!manejarAcceso(err)) {
        setError("No se pudo cargar la configuración de fidelización.");
      }
    } finally {
      setCargando(false);
    }
  }, [cargarUsuario, manejarAcceso]);

  useEffect(() => {
    // Se difiere para no llamar setState de forma síncrona dentro del efecto.
    queueMicrotask(() => {
      void cargar();
    });
  }, [cargar]);

  const recargarListas = async () => {
    const [cambios, lista] = await Promise.all([
      obtenerHistorialRegla(),
      listarBeneficiosAdmin(),
    ]);
    setHistorial(cambios.items);
    setBeneficios(lista.items);
  };

  const enviarRegla = async (e: FormEvent) => {
    e.preventDefault();
    setTasaTocada(true);
    setMensaje("");
    setError("");
    setErrorTasaServidor("");
    if (errorTasa) return;

    setGuardandoRegla(true);
    try {
      const guardada = await guardarRegla(Number(tasa.trim()));
      setRegla(guardada);
      setTasa(String(guardada.pointsPerDollar));
      setTasaTocada(false);
      setMensaje(EXITO);
      await recargarListas();
    } catch (err) {
      if (manejarAcceso(err)) return;
      if (err instanceof ErrorLealtadAdmin && err.status === 400) {
        setErrorTasaServidor(err.message);
      } else {
        setError(ERROR_GUARDAR);
      }
    } finally {
      setGuardandoRegla(false);
    }
  };

  const limpiarForm = () => {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setFormTocado(false);
    setErroresServidor({});
  };

  const empezarEdicion = (beneficio: BeneficioAdmin) => {
    setMensaje("");
    setError("");
    setErroresServidor({});
    setFormTocado(false);
    setEditandoId(beneficio.id);
    setForm({
      name: beneficio.name,
      pointsRequired: String(beneficio.pointsRequired),
      discountType: beneficio.discountType,
      discountValue: String(beneficio.discountValue),
    });
  };

  const enviarBeneficio = async (e: FormEvent) => {
    e.preventDefault();
    setFormTocado(true);
    setMensaje("");
    setError("");
    setErroresServidor({});
    if (!formValido) return;

    const datos = {
      name: form.name.trim(),
      pointsRequired: Number(form.pointsRequired.trim()),
      discountType: form.discountType,
      discountValue: Number(form.discountValue.trim()),
    };

    setGuardandoBeneficio(true);
    try {
      if (editandoId) await editarBeneficio(editandoId, datos);
      else await crearBeneficio(datos);
      limpiarForm();
      setMensaje(EXITO);
      await recargarListas();
    } catch (err) {
      if (manejarAcceso(err)) return;
      if (err instanceof ErrorLealtadAdmin && err.status === 409) {
        setErroresServidor({ name: "Ya existe un beneficio con ese nombre." });
      } else if (err instanceof ErrorLealtadAdmin && err.status === 404) {
        limpiarForm();
        setError("El beneficio ya no existe.");
        await recargarListas();
      } else if (err instanceof ErrorLealtadAdmin && err.status === 400) {
        setError(err.message);
      } else {
        setError(ERROR_GUARDAR);
      }
    } finally {
      setGuardandoBeneficio(false);
    }
  };

  const confirmarCambioEstado = async () => {
    if (!porConfirmar) return;
    setCambiandoEstado(true);
    setMensaje("");
    setError("");
    try {
      await cambiarEstadoBeneficio(porConfirmar.id, !porConfirmar.active);
      setMensaje(EXITO);
      await recargarListas();
    } catch (err) {
      if (manejarAcceso(err)) return;
      if (err instanceof ErrorLealtadAdmin && err.status === 404) {
        setError("El beneficio ya no existe.");
        await recargarListas();
      } else {
        setError(ERROR_GUARDAR);
      }
    } finally {
      setCambiandoEstado(false);
      setPorConfirmar(null);
    }
  };

  const errorNombre = erroresServidor.name ?? (formTocado ? erroresForm.name : undefined);
  const errorPuntos = formTocado ? erroresForm.pointsRequired : undefined;
  const errorValor = formTocado ? erroresForm.discountValue : undefined;
  const mostrarErrorTasa = errorTasaServidor || (tasaTocada ? errorTasa : null);

  const claseCampo = (conError: boolean) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[#7564e8] ${
      conError ? "border-red-300" : "border-slate-200"
    }`;

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800 lg:flex">
      <BarraLateral />

      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-slate-400">
                Administración / Fidelización
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
                Administrar fidelización
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Configura cuántos puntos gana el cliente por dólar y los
                beneficios que puede canjear.
              </p>
            </div>
            <CampanaNotificaciones />
          </div>

          {sinPermiso ? (
            <Aviso tipo="error" texto={SIN_PERMISO} />
          ) : cargando ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Cargando configuración…
            </p>
          ) : (
            <>
              {error && <Aviso tipo="error" texto={error} />}
              {mensaje && <Aviso tipo="exito" texto={mensaje} />}

              <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                {/* REGLA DE ACUMULACIÓN */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-[#20233e]">
                    Regla de acumulación
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {regla?.updatedAt
                      ? `Última actualización: ${fecha(regla.updatedAt)}`
                      : "Se usa el valor por defecto: aún no se ha guardado una regla."}
                  </p>

                  <form onSubmit={enviarRegla} noValidate className="mt-5">
                    <label
                      htmlFor="tasa"
                      className="mb-1 block text-sm font-medium text-slate-700"
                    >
                      Puntos por dólar
                    </label>
                    <input
                      id="tasa"
                      inputMode="decimal"
                      value={tasa}
                      onChange={(e) => {
                        setTasa(e.target.value);
                        setTasaTocada(true);
                        setErrorTasaServidor("");
                      }}
                      aria-invalid={Boolean(mostrarErrorTasa)}
                      aria-describedby="tasa-error"
                      className={claseCampo(Boolean(mostrarErrorTasa))}
                    />
                    <ErrorCampo id="tasa-error" texto={mostrarErrorTasa || undefined} />
                    <p className="mt-2 text-xs text-slate-400">
                      Mayor que 0, hasta 2 decimales. Solo afecta compras
                      futuras; los puntos ya acreditados no cambian.
                    </p>
                    <button
                      type="submit"
                      disabled={Boolean(errorTasa) || guardandoRegla}
                      className="mt-4 rounded-xl bg-[#7564e8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {guardandoRegla ? "Guardando…" : "Guardar regla"}
                    </button>
                  </form>
                </section>

                {/* CREAR / EDITAR BENEFICIO */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-[#20233e]">
                    {editandoId ? "Editar beneficio" : "Crear beneficio"}
                  </h2>

                  <form
                    onSubmit={enviarBeneficio}
                    noValidate
                    className="mt-5 grid gap-4 sm:grid-cols-2"
                  >
                    <div className="sm:col-span-2">
                      <label htmlFor="nombre" className="mb-1 block text-sm font-medium text-slate-700">
                        Nombre del beneficio
                      </label>
                      <input
                        id="nombre"
                        value={form.name}
                        maxLength={NOMBRE_MAX + 20}
                        onChange={(e) => {
                          setForm({ ...form, name: e.target.value });
                          setFormTocado(true);
                          setErroresServidor({});
                        }}
                        aria-invalid={Boolean(errorNombre)}
                        aria-describedby="nombre-error"
                        className={claseCampo(Boolean(errorNombre))}
                      />
                      <ErrorCampo id="nombre-error" texto={errorNombre} />
                    </div>

                    <div>
                      <label htmlFor="puntos" className="mb-1 block text-sm font-medium text-slate-700">
                        Puntos requeridos
                      </label>
                      <input
                        id="puntos"
                        inputMode="numeric"
                        value={form.pointsRequired}
                        onChange={(e) => {
                          setForm({ ...form, pointsRequired: e.target.value });
                          setFormTocado(true);
                        }}
                        aria-invalid={Boolean(errorPuntos)}
                        aria-describedby="puntos-error"
                        className={claseCampo(Boolean(errorPuntos))}
                      />
                      <ErrorCampo id="puntos-error" texto={errorPuntos} />
                    </div>

                    <div>
                      <label htmlFor="tipo" className="mb-1 block text-sm font-medium text-slate-700">
                        Tipo de descuento
                      </label>
                      <select
                        id="tipo"
                        value={form.discountType}
                        onChange={(e) => {
                          setForm({ ...form, discountType: e.target.value as TipoDescuento });
                          setFormTocado(true);
                        }}
                        className={claseCampo(false)}
                      >
                        <option value="PERCENTAGE">Porcentaje</option>
                        <option value="FIXED">Monto fijo</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="valor" className="mb-1 block text-sm font-medium text-slate-700">
                        Valor del descuento {form.discountType === "PERCENTAGE" ? "(%)" : "($)"}
                      </label>
                      <input
                        id="valor"
                        inputMode="decimal"
                        value={form.discountValue}
                        onChange={(e) => {
                          setForm({ ...form, discountValue: e.target.value });
                          setFormTocado(true);
                        }}
                        aria-invalid={Boolean(errorValor)}
                        aria-describedby="valor-error"
                        className={claseCampo(Boolean(errorValor))}
                      />
                      <ErrorCampo id="valor-error" texto={errorValor} />
                    </div>

                    <div className="flex flex-wrap gap-3 sm:col-span-2">
                      <button
                        type="submit"
                        disabled={(formTocado && !formValido) || guardandoBeneficio}
                        className="rounded-xl bg-[#7564e8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {guardandoBeneficio
                          ? "Guardando…"
                          : editandoId
                            ? "Guardar cambios"
                            : "Crear beneficio"}
                      </button>
                      {(editandoId || formTocado) && (
                        <button
                          type="button"
                          onClick={limpiarForm}
                          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </section>
              </div>

              {/* LISTA DE BENEFICIOS */}
              <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-[#20233e]">Beneficios</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Los beneficios inactivos no aparecen como canjeables para
                    el cliente; sus canjes anteriores se conservan.
                  </p>
                </div>

                {beneficios.length === 0 ? (
                  <p className="px-5 py-14 text-center text-sm text-slate-500">
                    Aún no hay beneficios.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead className="bg-[#f9f9fd]">
                        <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-4">Nombre</th>
                          <th className="px-5 py-4">Puntos</th>
                          <th className="px-5 py-4">Tipo</th>
                          <th className="px-5 py-4">Valor</th>
                          <th className="px-5 py-4">Estado</th>
                          <th className="px-5 py-4">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {beneficios.map((b) => (
                          <tr key={b.id} className={b.active ? "" : "bg-slate-50/60"}>
                            <td className="px-5 py-4 text-sm font-semibold text-[#252944]">
                              {b.name}
                              {b.updatedBy && (
                                <span className="mt-1 block text-xs font-normal text-slate-400">
                                  Modificado por {b.updatedBy.email}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-sm">{b.pointsRequired}</td>
                            <td className="px-5 py-4 text-sm">{TIPOS[b.discountType]}</td>
                            <td className="px-5 py-4 text-sm font-semibold">{valorDescuento(b)}</td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={b.active}
                                aria-label={`Estado de ${b.name}`}
                                onClick={() => setPorConfirmar(b)}
                                className="flex items-center gap-2 text-xs font-semibold"
                              >
                                <span
                                  className={`relative h-6 w-11 rounded-full transition ${
                                    b.active ? "bg-[#7564e8]" : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                                      b.active ? "left-6" : "left-1"
                                    }`}
                                  />
                                </span>
                                <span className={b.active ? "text-green-700" : "text-slate-500"}>
                                  {b.active ? "Activo" : "Inactivo"}
                                </span>
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => empezarEdicion(b)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* HISTORIAL DE LA REGLA */}
              <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-[#20233e]">
                    Historial de la regla
                  </h2>
                </div>
                {historial.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-500">
                    Aún no hay cambios en la regla.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="bg-[#f9f9fd]">
                        <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-4">Fecha</th>
                          <th className="px-5 py-4">Cambio</th>
                          <th className="px-5 py-4">Responsable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historial.map((h) => (
                          <tr key={h.id}>
                            <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                              {fecha(h.changedAt)}
                            </td>
                            <td className="px-5 py-4 text-sm">
                              {h.previousPointsPerDollar} → <strong>{h.newPointsPerDollar}</strong> puntos por dólar
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">{h.changedBy.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {/* CONFIRMACIÓN DE CAMBIO DE ESTADO */}
      {porConfirmar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="confirmar-titulo" className="text-lg font-bold text-[#20233e]">
              {porConfirmar.active ? "¿Desactivar beneficio?" : "¿Activar beneficio?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {porConfirmar.active
                ? `«${porConfirmar.name}» dejará de estar disponible para nuevos canjes. Los canjes ya realizados no cambian.`
                : `«${porConfirmar.name}» volverá a estar disponible para canjear.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPorConfirmar(null)}
                disabled={cambiandoEstado}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarCambioEstado()}
                disabled={cambiandoEstado}
                className="rounded-xl bg-[#7564e8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
              >
                {cambiandoEstado ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
