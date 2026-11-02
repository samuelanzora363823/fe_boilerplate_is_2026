
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type Estado = "ACTIVE" | "DISABLED" | "OUT_OF_STOCK";

type Platillo = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  categoryId: string;
  tags: string[];
  status: Estado;
};

type FormularioPlatillo = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  tags: string;
};

const CATEGORIA_INICIAL =
  "92c7329b-5134-4a9c-b26b-7c1a247f8395";

const formularioVacio = (): FormularioPlatillo => ({
  name: "",
  description: "",
  price: "",
  categoryId: CATEGORIA_INICIAL,
  tags: "",
});

const nombresEstado: Record<Estado, string> = {
  ACTIVE: "Activo",
  DISABLED: "Deshabilitado",
  OUT_OF_STOCK: "Agotado",
};

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

  return `No se pudo completar la operación (HTTP ${status})`;
}

async function leerRespuesta(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return { message: texto };
  }
}

export default function MenuPage() {
  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [nuevoPlatillo, setNuevoPlatillo] =
    useState<FormularioPlatillo>(formularioVacio);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const cargarPlatillos = useCallback(async () => {
    setCargando(true);

    try {
      const respuesta = await fetch("/api/menu", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const datos = await leerRespuesta(respuesta);

      if (!respuesta.ok) {
        throw new Error(obtenerError(datos, respuesta.status));
      }

      if (!Array.isArray(datos)) {
        throw new Error("La respuesta del menú no es válida.");
      }

      setPlatillos(datos as Platillo[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los platillos."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarPlatillos();
  }, [cargarPlatillos]);

  const actualizarCampo = (
    campo: keyof FormularioPlatillo,
    valor: string
  ) => {
    setNuevoPlatillo((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const limpiarFormulario = () => {
    setNuevoPlatillo(formularioVacio());
    setEditandoId(null);
    setMostrarFormulario(false);
  };

  const abrirAgregar = () => {
    if (guardando || procesandoId) return;

    if (mostrarFormulario && editandoId === null) {
      limpiarFormulario();
    } else {
      setNuevoPlatillo(formularioVacio());
      setEditandoId(null);
      setMostrarFormulario(true);
    }

    setError("");
    setMensaje("");
  };

  const abrirEditar = (platillo: Platillo) => {
    if (guardando || procesandoId) return;

    setNuevoPlatillo({
      name: platillo.name,
      description: platillo.description ?? "",
      price: String(platillo.price),
      categoryId: platillo.categoryId,
      tags: Array.isArray(platillo.tags)
        ? platillo.tags.join(", ")
        : "",
    });

    setEditandoId(platillo.id);
    setMostrarFormulario(true);
    setError("");
    setMensaje("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const guardarPlatillo = async (
    evento: FormEvent<HTMLFormElement>
  ) => {
    evento.preventDefault();

    if (guardando || procesandoId) return;

    setError("");
    setMensaje("");

    const nombre = nuevoPlatillo.name.trim();
    const descripcion = nuevoPlatillo.description.trim();
    const precioTexto = nuevoPlatillo.price.trim();
    const precioNumero = Number(precioTexto);
    const categoria = nuevoPlatillo.categoryId.trim();

    if (!nombre) {
      setError("El nombre del platillo es obligatorio.");
      return;
    }

    if (
      !/^\d+(\.\d{1,2})?$/.test(precioTexto) ||
      !Number.isFinite(precioNumero) ||
      precioNumero <= 0 ||
      precioNumero > 99999999.99
    ) {
      setError(
        "El precio debe ser positivo y tener máximo dos decimales."
      );
      return;
    }

    if (!categoria) {
      setError("La categoría es obligatoria.");
      return;
    }

    const datosPlatillo = {
      name: nombre,
      description: descripcion,

      // El backend NestJS exige que price sea string.
      price: precioTexto,

      categoryId: categoria,
      tags: nuevoPlatillo.tags
        .split(",")
        .map((etiqueta) => etiqueta.trim())
        .filter(Boolean),
    };

    const esEdicion = editandoId !== null;

    const endpoint = esEdicion
      ? `/api/menu/${encodeURIComponent(editandoId)}`
      : "/api/menu";

    setGuardando(true);

    try {
      const respuesta = await fetch(endpoint, {
        method: esEdicion ? "PUT" : "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(datosPlatillo),
      });

      const datos = await leerRespuesta(respuesta);

      if (!respuesta.ok) {
        throw new Error(obtenerError(datos, respuesta.status));
      }

      limpiarFormulario();

      setMensaje(
        esEdicion
          ? `El platillo "${nombre}" se actualizó correctamente.`
          : `El platillo "${nombre}" se agregó correctamente.`
      );

      await cargarPlatillos();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el platillo."
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (
    platillo: Platillo,
    accion: "disable" | "reactivate"
  ) => {
    if (guardando || procesandoId) return;

    const deshabilitar = accion === "disable";

    const confirmacion = window.confirm(
      deshabilitar
        ? `¿Deseas deshabilitar el platillo "${platillo.name}"?`
        : `¿Deseas reactivar el platillo "${platillo.name}"?`
    );

    if (!confirmacion) return;

    setError("");
    setMensaje("");
    setProcesandoId(platillo.id);

    try {
      // Ambas acciones usan una única ruta Next.js.
      const endpoint =
        `/api/menu/${encodeURIComponent(platillo.id)}` +
        `?accion=${accion}`;

      const respuesta = await fetch(endpoint, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
      });

      const datos = await leerRespuesta(respuesta);

      if (!respuesta.ok) {
        throw new Error(obtenerError(datos, respuesta.status));
      }

      setMensaje(
        deshabilitar
          ? `El platillo "${platillo.name}" fue deshabilitado.`
          : `El platillo "${platillo.name}" fue reactivado.`
      );

      await cargarPlatillos();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el estado del platillo."
      );
    } finally {
      setProcesandoId(null);
    }
  };

  const filtrados = platillos.filter((platillo) =>
    platillo.name
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase())
  );

  const operacionEnCurso = guardando || procesandoId !== null;

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Catálogo de Menú
            </h1>

            <p className="mt-2 text-zinc-400">
              Administración de platillos
            </p>
          </div>

          <button
            type="button"
            onClick={abrirAgregar}
            disabled={operacionEnCurso}
            className="rounded-lg bg-purple-600 px-5 py-3 font-medium transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mostrarFormulario && editandoId === null
              ? "Cerrar formulario"
              : "+ Agregar platillo"}
          </button>
        </div>

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

        {mostrarFormulario && (
          <form
            onSubmit={guardarPlatillo}
            className="mb-8 space-y-5 rounded-xl border border-purple-900 bg-zinc-900 p-6"
          >
            <div>
              <h2 className="text-xl font-semibold">
                {editandoId
                  ? "Editar platillo"
                  : "Agregar nuevo platillo"}
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                {editandoId
                  ? "Modifica los datos del platillo seleccionado."
                  : "Completa los datos del nuevo platillo."}
              </p>
            </div>

            <div>
              <label
                htmlFor="nombre"
                className="mb-2 block text-sm font-medium"
              >
                Nombre del platillo
              </label>

              <input
                id="nombre"
                type="text"
                required
                maxLength={100}
                placeholder="Ej. Carne asada"
                value={nuevoPlatillo.name}
                onChange={(e) =>
                  actualizarCampo("name", e.target.value)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label
                htmlFor="descripcion"
                className="mb-2 block text-sm font-medium"
              >
                Descripción
              </label>

              <textarea
                id="descripcion"
                rows={3}
                maxLength={255}
                placeholder="Ingredientes o acompañamientos"
                value={nuevoPlatillo.description}
                onChange={(e) =>
                  actualizarCampo("description", e.target.value)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="precio"
                  className="mb-2 block text-sm font-medium"
                >
                  Precio ($)
                </label>

                <input
                  id="precio"
                  type="number"
                  required
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  placeholder="8.50"
                  value={nuevoPlatillo.price}
                  onChange={(e) =>
                    actualizarCampo("price", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label
                  htmlFor="categoria"
                  className="mb-2 block text-sm font-medium"
                >
                  Categoría (UUID)
                </label>

                <input
                  id="categoria"
                  type="text"
                  required
                  placeholder="UUID de la categoría"
                  value={nuevoPlatillo.categoryId}
                  onChange={(e) =>
                    actualizarCampo("categoryId", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="etiquetas"
                className="mb-2 block text-sm font-medium"
              >
                Etiquetas dietéticas
              </label>

              <input
                id="etiquetas"
                type="text"
                placeholder="Ej. Sin gluten, Vegetariano"
                value={nuevoPlatillo.tags}
                onChange={(e) =>
                  actualizarCampo("tags", e.target.value)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 outline-none focus:border-purple-500"
              />

              <p className="mt-2 text-xs text-zinc-500">
                Separa las etiquetas utilizando comas.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={operacionEnCurso}
                className="rounded-lg bg-purple-600 px-6 py-3 font-medium hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {guardando
                  ? "Guardando..."
                  : editandoId
                    ? "Guardar cambios"
                    : "Guardar platillo"}
              </button>

              <button
                type="button"
                disabled={operacionEnCurso}
                onClick={() => {
                  limpiarFormulario();
                  setError("");
                }}
                className="rounded-lg bg-zinc-700 px-6 py-3 hover:bg-zinc-600 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            placeholder="Buscar platillo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 outline-none focus:border-purple-500 md:max-w-md"
          />

          <button
            type="button"
            disabled={cargando || operacionEnCurso}
            onClick={() => {
              setError("");
              void cargarPlatillos();
            }}
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {cargando
              ? "Actualizando..."
              : "Actualizar menú"}
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left">
            <thead className="bg-zinc-900">
              <tr>
                {[
                  "Nombre",
                  "Descripción",
                  "Precio",
                  "Categoría",
                  "Estado",
                  "Acciones",
                ].map((columna) => (
                  <th
                    key={columna}
                    className="p-4 text-sm font-semibold"
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!cargando &&
                filtrados.map((platillo) => (
                  <tr
                    key={platillo.id}
                    className="border-t border-zinc-800 hover:bg-zinc-900/50"
                  >
                    <td className="p-4 font-medium">
                      {platillo.name}
                    </td>

                    <td className="p-4 text-sm text-zinc-300">
                      {platillo.description ||
                        "Sin descripción"}
                    </td>

                    <td className="p-4 font-medium">
                      ${Number(platillo.price).toFixed(2)}
                    </td>

                    <td className="p-4 text-xs text-zinc-400">
                      {platillo.categoryId}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          platillo.status === "ACTIVE"
                            ? "bg-green-950 text-green-300"
                            : platillo.status === "DISABLED"
                              ? "bg-red-950 text-red-300"
                              : "bg-yellow-950 text-yellow-300"
                        }`}
                      >
                        {nombresEstado[platillo.status]}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={operacionEnCurso}
                          onClick={() => abrirEditar(platillo)}
                          className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Editar
                        </button>

                        {platillo.status === "ACTIVE" ? (
                          <button
                            type="button"
                            disabled={operacionEnCurso}
                            onClick={() =>
                              void cambiarEstado(
                                platillo,
                                "disable"
                              )
                            }
                            className="rounded-lg bg-red-800 px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {procesandoId === platillo.id
                              ? "Procesando..."
                              : "Deshabilitar"}
                          </button>
                        )  : platillo.status === "DISABLED" ||
    platillo.status === "OUT_OF_STOCK" ? (
                          <button
                            type="button"
                            disabled={operacionEnCurso}
                            onClick={() =>
                              void cambiarEstado(
                                platillo,
                                "reactivate"
                              )
                            }
                            className="rounded-lg bg-green-800 px-3 py-2 text-sm font-medium hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {procesandoId === platillo.id
                              ? "Procesando..."
                              : "Reactivar"}
                          </button>
                        ) : (
                          <span className="px-2 py-2 text-xs text-yellow-400">
                            Agotado
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {cargando && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-zinc-400"
                  >
                    Cargando platillos...
                  </td>
                </tr>
              )}

              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-zinc-400"
                  >
                    {busqueda
                      ? "No se encontraron platillos con ese nombre."
                      : "No hay platillos para mostrar."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          Total de platillos: {platillos.length}
        </p>
      </div>
    </main>
  );
}
