"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSesion } from "@/lib/stores/sesion";
import type { RolUsuario } from "@/lib/stores/sesion";

// Barra lateral compartida (mismo diseño que /gerente/menu).
// Las opciones dependen del rol de la sesión.

type Opcion = {
  titulo: string;
  href?: string;
  icono: string;
};

const opcionesPorRol: Record<RolUsuario, Opcion[]> = {
  GERENTE: [
    { titulo: "Inicio", href: "/", icono: "inicio" },
    { titulo: "Menú", href: "/gerente/menu", icono: "menu" },
    { titulo: "Inventario", href: "/gerente/inventario", icono: "inventario" },
    { titulo: "Reportes", icono: "cuadro" },
    { titulo: "Configuración", icono: "cuadro" },
  ],
  MESERO: [
    { titulo: "Inicio", href: "/", icono: "inicio" },
    { titulo: "Punto de venta (POS)", href: "/mesero/pos", icono: "pos" },
  ],
  CLIENTE: [
    { titulo: "Inicio", href: "/", icono: "inicio" },
    { titulo: "Consultar menú", href: "/menu", icono: "menu" },
    {
      titulo: "Pedido para llevar",
      href: "/cliente/pedido-para-llevar",
      icono: "llevar",
    },
  ],
  COCINA: [{ titulo: "Inicio", href: "/", icono: "inicio" }],
  GERENTE_GENERAL: [{ titulo: "Inicio", href: "/", icono: "inicio" }],
};

const etiquetasRol: Record<RolUsuario, string> = {
  GERENTE: "Gerente",
  MESERO: "Mesero",
  COCINA: "Cocina",
  CLIENTE: "Cliente",
  GERENTE_GENERAL: "Gerente general",
};

function Icono({ nombre, size = 20 }: { nombre: string; size?: number }) {
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
    case "pos":
      return (
        <svg {...base}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 15h3M15 15h2" />
        </svg>
      );
    case "llevar":
      return (
        <svg {...base}>
          <path d="M5 9h14l-1 12H6L5 9Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
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

export default function BarraLateral() {
  const ruta = usePathname();
  const usuario = useSesion((estado) => estado.usuario);
  const cargarUsuario = useSesion((estado) => estado.cargarUsuario);

  useEffect(() => {
    queueMicrotask(() => {
      void cargarUsuario();
    });
  }, [cargarUsuario]);

  const opciones = usuario
    ? (opcionesPorRol[usuario.role] ?? opcionesPorRol.CLIENTE)
    : [];
  const rol = usuario ? (etiquetasRol[usuario.role] ?? usuario.role) : "";

  const activa = (href: string) =>
    href === "/" ? ruta === "/" : ruta.startsWith(href);

  return (
    <aside className="flex w-full flex-col bg-[#171b36] text-white lg:min-h-screen lg:w-64 lg:shrink-0">
      <div className="border-b border-white/10 px-6 py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7564e8] text-xl font-bold">
            N
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Núcleo Digital</p>
            <p className="text-xs text-slate-400">Sistema de restaurante</p>
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto p-4 lg:flex-col">
        {opciones.map((opcion) =>
          opcion.href ? (
            <Link
              key={opcion.titulo}
              href={opcion.href}
              className={
                activa(opcion.href)
                  ? "flex shrink-0 items-center gap-3 rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
                  : "flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10"
              }
            >
              <Icono nombre={opcion.icono} />
              {opcion.titulo}
            </Link>
          ) : (
            <div
              key={opcion.titulo}
              className="flex shrink-0 cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500"
            >
              <Icono nombre={opcion.icono} />
              {opcion.titulo}
            </div>
          ),
        )}
      </nav>

      {usuario && (
        <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7564e8] font-semibold">
              {rol.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{rol}</p>
              <p className="truncate text-xs text-slate-400">{usuario.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
