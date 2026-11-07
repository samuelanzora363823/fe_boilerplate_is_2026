
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Estado = "ACTIVE" | "DISABLED" | "OUT_OF_STOCK";

type Categoria = {
  id: string;
  name: string;
};

type Platillo = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  categoryId: string;
  tags: string[];
  status: Estado;
  imageUrl?: string | null;
};

type Formulario = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  tags: string;
};

const formularioInicial: Formulario = {
  name: "",
  description: "",
  price: "",
  categoryId: "",
  tags: "",
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
    case "buscar":
      return (
        <svg {...base}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 5 5" />
        </svg>
      );
    case "editar":
      return (
        <svg {...base}>
          <path d="m4 20 4.5-1 11-11a2 2 0 0 0-3-3l-11 11L4 20Z" />
          <path d="m14.5 7.5 3 3" />
        </svg>
      );
    case "apagar":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.7 5.7 18.3 18.3" />
        </svg>
      );
    case "activar":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );
    case "cerrar":
      return (
        <svg {...base}>
          <path d="M5 5 19 19M19 5 5 19" />
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

function textoEstado(estado: Estado) {
  if (estado === "ACTIVE") return "Activo";
  if (estado === "DISABLED") return "Deshabilitado";
  return "Agotado";
}

function dinero(valor: number | string) {
  const numero = Number(valor);
  return Number.isFinite(numero)
    ? `$${numero.toFixed(2)}`
    : String(valor);
}

export default function GerenteMenuPage() {
  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [foto, setFoto] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formulario, setFormulario] =
    useState<Formulario>(formularioInicial);

  const cargarPlatillos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const respuesta = await fetch("/api/menu", {
        cache: "no-store",
      });

      if (!respuesta.ok) {
        throw new Error("No se pudo consultar el menú.");
      }

      const datos: Platillo[] = await respuesta.json();
      setPlatillos(datos);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar los platillos."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // La carga se difiere para evitar setState
    // síncrono dentro del efecto.
    queueMicrotask(() => {
      void cargarPlatillos();
    });

    const cargarCategorias = async () => {
      try {
        const respuesta = await fetch("/api/menu/categories", {
          cache: "no-store",
        });

        if (!respuesta.ok) {
          throw new Error("No se pudieron cargar las categorías.");
        }

        const datos: Categoria[] = await respuesta.json();
        setCategorias(datos);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error al cargar categorías."
        );
      }
    };

    void cargarCategorias();
  }, [cargarPlatillos]);

  const etiquetas = useMemo(() => {
    return Array.from(
      new Set(platillos.flatMap((platillo) => platillo.tags ?? []))
    ).sort();
  }, [platillos]);

  const platillosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return platillos.filter((platillo) => {
      const coincideBusqueda =
        !texto ||
        platillo.name.toLowerCase().includes(texto) ||
        (platillo.description ?? "").toLowerCase().includes(texto);

      const coincideCategoria =
        !filtroCategoria ||
        platillo.categoryId === filtroCategoria;

      const coincideEtiqueta =
        !filtroEtiqueta ||
        (platillo.tags ?? []).includes(filtroEtiqueta);

      const coincideEstado =
        !filtroEstado || platillo.status === filtroEstado;

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideEtiqueta &&
        coincideEstado
      );
    });
  }, [
    platillos,
    busqueda,
    filtroCategoria,
    filtroEtiqueta,
    filtroEstado,
  ]);

  const nombreCategoria = (id: string) =>
    categorias.find((categoria) => categoria.id === id)?.name ??
    "Sin categoría";

  function abrirNuevo() {
    setEditandoId(null);
    setFoto(null);
    setVistaPrevia(null);
    setFormulario(formularioInicial);
    setMensaje("");
    setError("");
    setMostrarFormulario(true);
  }

  function abrirEditar(platillo: Platillo) {
    setEditandoId(platillo.id);
    setFoto(null);
    setVistaPrevia(platillo.imageUrl ?? null);
    setFormulario({
      name: platillo.name,
      description: platillo.description ?? "",
      price: String(platillo.price),
      categoryId: platillo.categoryId,
      tags: (platillo.tags ?? []).join(", "),
    });
    setMensaje("");
    setError("");
    setMostrarFormulario(true);
  }

  function cerrarFormulario() {
    if (guardando) return;
    setMostrarFormulario(false);
    setEditandoId(null);
    setFoto(null);
    setVistaPrevia(null);
    setFormulario(formularioInicial);
  }

  async function guardarPlatillo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setMensaje("");

    const precio = Number(formulario.price);

    if (!formulario.name.trim()) {
      setError("Debes ingresar el nombre del platillo.");
      return;
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      setError("Ingresa un precio válido mayor que cero.");
      return;
    }

    if (!formulario.categoryId) {
      setError("Selecciona una categoría.");
      return;
    }

    const datos = {
      name: formulario.name.trim(),
      description: formulario.description.trim(),
      price: precio,
      categoryId: formulario.categoryId,
      tags: formulario.tags
        .split(",")
        .map((etiqueta) => etiqueta.trim())
        .filter(Boolean),
    };

    setGuardando(true);

    try {
      const respuesta = await fetch(
        editandoId ? `/api/menu/${editandoId}` : "/api/menu",
        {
          method: editandoId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(datos),
        }
      );

      if (!respuesta.ok) {
        const detalle = await respuesta.text();
        throw new Error(
          detalle || "No se pudo guardar el platillo."
        );
      }

      const guardado = await respuesta.json();
      const idGuardado: string = editandoId ?? guardado.id;
      let fotoError = false;
      if (foto) {
        const form = new FormData();
        form.append("image", foto);
        const subida = await fetch(`/api/menu/dish/${idGuardado}/image`, { method: "POST", body: form });
        if (!subida.ok) {
          fotoError = true;
          const detalle = await subida.json().catch(() => ({}));
          setError(detalle.message ?? "El platillo se guardó, pero la foto no pudo subirse.");
        }
      }
      const estabaEditando = Boolean(editandoId);
      setMostrarFormulario(false);
      setEditandoId(null);
      setFoto(null);
      setVistaPrevia(null);
      setFormulario(formularioInicial);

      await cargarPlatillos();

      setMensaje(
        fotoError ? "Platillo guardado, pero la fotografía no se pudo subir." : estabaEditando
          ? "Platillo actualizado correctamente."
          : "Platillo agregado correctamente."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el platillo."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(platillo: Platillo) {
    const deshabilitar = platillo.status === "ACTIVE";
    const accion = deshabilitar ? "disable" : "reactivate";

    const confirmado = window.confirm(
      deshabilitar
        ? `¿Deshabilitar "${platillo.name}"?`
        : `¿Reactivar "${platillo.name}"?`
    );

    if (!confirmado) return;

    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(
        `/api/menu/${platillo.id}?accion=${accion}`,
        { method: "PATCH" }
      );

      if (!respuesta.ok) {
        const detalle = await respuesta.text();
        throw new Error(
          detalle || "No se pudo cambiar el estado."
        );
      }

      await cargarPlatillos();

      setMensaje(
        deshabilitar
          ? "Platillo deshabilitado correctamente."
          : "Platillo reactivado correctamente."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cambiar el estado."
      );
    }
  }

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
            className="flex items-center gap-3 rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
          >
            <Icono nombre="menu" />
            Menú
          </Link>

          <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
            <Icono nombre="cuadro" />
            Inventario
          </div>

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
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-slate-400">
                Administración / Menú
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
                Catálogo de Menú
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Administra los platillos disponibles en tu restaurante.
              </p>
            </div>

            <button
              type="button"
              onClick={abrirNuevo}
              className="flex items-center gap-2 rounded-xl bg-[#7564e8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6250d5]"
            >
              <Icono nombre="mas" size={18} />
              Agregar platillo
            </button>
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

          {/* FORMULARIO */}
          {mostrarFormulario && (
            <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#20233e]">
                  {editandoId
                    ? "Editar platillo"
                    : "Agregar nuevo platillo"}
                </h2>

                <button
                  type="button"
                  onClick={cerrarFormulario}
                  aria-label="Cerrar formulario"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Icono nombre="cerrar" />
                </button>
              </div>

              <form onSubmit={guardarPlatillo} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Nombre del platillo
                    <input
                      required
                      value={formulario.name}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          name: e.target.value,
                        })
                      }
                      placeholder="Ej. Hamburguesa clásica"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#7564e8]"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Precio ($)
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formulario.price}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          price: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#7564e8]"
                    />
                  </label>

                  <label className="block text-sm font-medium">
                    Categoría
                    <select
                      required
                      value={formulario.categoryId}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          categoryId: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#7564e8]"
                    >
                      <option value="">Seleccionar categoría</option>
                      {categorias.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium">
                    Etiquetas
                    <input
                      value={formulario.tags}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          tags: e.target.value,
                        })
                      }
                      placeholder="Popular, Vegetariano, Picante"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#7564e8]"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium">
                  Descripción
                  <textarea
                    rows={3}
                    value={formulario.description}
                    onChange={(e) =>
                      setFormulario({
                        ...formulario,
                        description: e.target.value,
                      })
                    }
                    placeholder="Descripción del platillo..."
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#7564e8]"
                  />
                </label>

                <div className="rounded-xl border border-dashed border-[#c9c1ff] bg-[#faf9ff] p-5">
                <label htmlFor="dish-photo" className="block text-sm font-semibold text-[#252944]">Fotografía del platillo (opcional)</label>
                <p className="mt-1 text-xs text-slate-500">JPG, PNG o WebP, máximo 5 MB. Al editar puedes conservar o reemplazar la foto.</p>
                <input id="dish-photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-sm" onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
                    setError("La fotografía debe ser JPG, PNG o WebP y pesar máximo 5 MB.");
                    e.target.value = "";
                    return;
                  }
                  setFoto(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setVistaPrevia(typeof reader.result === "string" ? reader.result : null);
                    reader.readAsDataURL(file);
                  }
                }} />
                {vistaPrevia && <img src={vistaPrevia} alt="Vista previa del platillo" className="mt-4 h-40 w-56 rounded-xl object-cover" />}
              </div>

              <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={cerrarFormulario}
                    disabled={guardando}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={guardando}
                    className="rounded-xl bg-[#7564e8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6250d5] disabled:opacity-50"
                  >
                    {guardando
                      ? "Guardando..."
                      : editandoId
                        ? "Guardar cambios"
                        : "Crear platillo"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* FILTROS Y TABLA */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#20233e]">
                    Lista de platillos
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Consulta y administra tu catálogo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void cargarPlatillos()}
                  disabled={cargando}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Icono nombre="refrescar" size={16} />
                  Actualizar
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icono nombre="buscar" size={18} />
                  </div>
                  <input
                    aria-label="Buscar platillos"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar platillo..."
                    className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-[#7564e8]"
                  />
                </div>

                <select
                  aria-label="Filtrar por categoría"
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-[#7564e8]"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por etiqueta"
                  value={filtroEtiqueta}
                  onChange={(e) => setFiltroEtiqueta(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-[#7564e8]"
                >
                  <option value="">Todas las etiquetas</option>
                  {etiquetas.map((etiqueta) => (
                    <option key={etiqueta} value={etiqueta}>
                      {etiqueta}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por estado"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-[#7564e8]"
                >
                  <option value="">Todos los estados</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="DISABLED">Deshabilitado</option>
                  <option value="OUT_OF_STOCK">Agotado</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead className="bg-[#f9f9fd]">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">Platillo</th>
                    <th className="px-5 py-4">Descripción</th>
                    <th className="px-5 py-4">Precio</th>
                    <th className="px-5 py-4">Categoría</th>
                    <th className="px-5 py-4">Etiquetas</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4 text-center">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {cargando ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-16 text-center text-sm text-slate-500"
                      >
                        Cargando platillos...
                      </td>
                    </tr>
                  ) : platillosFiltrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-16 text-center text-sm text-slate-500"
                      >
                        No se encontraron platillos.
                      </td>
                    </tr>
                  ) : (
                    platillosFiltrados.map((platillo) => (
                      <tr
                        key={platillo.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f0edff] text-[#7564e8]">
                              {platillo.imageUrl ? <img src={platillo.imageUrl} alt={platillo.name} className="h-12 w-12 rounded-xl object-cover" /> : <Icono nombre="cuadro" size={23} />}
                            </div>
                            <span className="max-w-44 text-sm font-semibold text-[#252944]">
                              {platillo.name}
                            </span>
                          </div>
                        </td>

                        <td className="max-w-60 px-5 py-5 text-sm text-slate-500">
                          <p className="line-clamp-2">
                            {platillo.description || "Sin descripción"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-5 text-sm font-bold text-[#252944]">
                          {dinero(platillo.price)}
                        </td>

                        <td className="px-5 py-5">
                          <span className="inline-flex rounded-lg bg-[#edf2ff] px-3 py-1.5 text-xs font-medium text-[#5269bc]">
                            {nombreCategoria(platillo.categoryId)}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <div className="flex max-w-52 flex-wrap gap-1.5">
                            {(platillo.tags ?? []).length ? (
                              platillo.tags.map((etiqueta) => (
                                <span
                                  key={etiqueta}
                                  className="rounded-lg bg-[#fff2df] px-2.5 py-1 text-xs font-medium text-[#a56d25]"
                                >
                                  {etiqueta}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">
                                Sin etiquetas
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={
                              platillo.status === "ACTIVE"
                                ? "inline-flex rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700"
                                : platillo.status === "DISABLED"
                                  ? "inline-flex rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                                  : "inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                            }
                          >
                            {textoEstado(platillo.status)}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditar(platillo)}
                              title="Editar platillo"
                              aria-label={`Editar ${platillo.name}`}
                              className="rounded-lg p-2 text-[#7564e8] hover:bg-[#f0edff]"
                            >
                              <Icono nombre="editar" size={19} />
                            </button>

                            <button
                              type="button"
                              onClick={() => void cambiarEstado(platillo)}
                              title={
                                platillo.status === "ACTIVE"
                                  ? "Deshabilitar platillo"
                                  : "Reactivar platillo"
                              }
                              aria-label={
                                platillo.status === "ACTIVE"
                                  ? `Deshabilitar ${platillo.name}`
                                  : `Reactivar ${platillo.name}`
                              }
                              className={
                                platillo.status === "ACTIVE"
                                  ? "rounded-lg p-2 text-red-500 hover:bg-red-50"
                                  : "rounded-lg p-2 text-green-600 hover:bg-green-50"
                              }
                            >
                              <Icono
                                nombre={
                                  platillo.status === "ACTIVE"
                                    ? "apagar"
                                    : "activar"
                                }
                                size={19}
                              />
                            </button>
                          </div>
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
                  {platillosFiltrados.length}
                </strong>{" "}
                de{" "}
                <strong className="text-slate-700">
                  {platillos.length}
                </strong>{" "}
                platillos
              </p>

              <span className="text-xs text-slate-400">
                Núcleo Digital · Administración del menú
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
