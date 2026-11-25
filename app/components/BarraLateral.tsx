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
    { titulo: "Fidelización", href: "/gerente/fidelizacion", icono: "beneficios" },
    { titulo: "Ventas", href: "/gerente/reportes/ventas", icono: "ventas" },
    { titulo: "Platillos más vendidos", href: "/gerente/reportes/platillos", icono: "estrella" },
    { titulo: "Horarios pico", href: "/gerente/reportes/horarios-pico", icono: "reloj" },
    { titulo: "Ocupación proyectada", href: "/gerente/reportes/ocupacion-proyectada", icono: "ocupacion" },
    { titulo: "Calificaciones y reseñas", href: "/gerente/reportes/resenas", icono: "estrella" },
    { titulo: "Comparación de sucursales", href: "/gerente/reportes/comparacion-sucursales", icono: "comparar" },
    { titulo: "Configuración", icono: "cuadro" },
  ],
  MESERO: [
    { titulo: "Inicio", href: "/", icono: "inicio" },
    { titulo: "Punto de venta (POS)", href: "/mesero/pos", icono: "pos" },
    {
      titulo: "Disponibilidad de mesas",
      href: "/mesero/mesas/disponibilidad",
      icono: "mesas",
    },
    { titulo: "Cuentas", href: "/mesero/cuentas", icono: "cuentas" },
    { titulo: "Comprobantes", href: "/mesero/comprobantes", icono: "cuentas" },
  ],
  CLIENTE: [
    { titulo: "Inicio", href: "/", icono: "inicio" },
    { titulo: "Reservas", href: "/reservas/nueva", icono: "reservas" },
    { titulo: "Mis reservas", href: "/cliente/reservas", icono: "reservas" },
    { titulo: "Consultar menú", href: "/menu", icono: "menu" },
    {
      titulo: "Pedido para llevar",
      href: "/cliente/pedido-para-llevar",
      icono: "llevar",
    },
    { titulo: "Mis puntos", href: "/cliente/puntos", icono: "puntos" },
    { titulo: "Beneficios", href: "/cliente/beneficios", icono: "beneficios" },
    { titulo: "Mis reseñas", href: "/cliente/resenas", icono: "estrella" },
  ],
  COCINA: [{ titulo: "Inicio", href: "/", icono: "inicio" }],
};

const etiquetasRol: Record<RolUsuario, string> = {
  GERENTE: "Gerente",
  MESERO: "Mesero",
  COCINA: "Cocina",
  CLIENTE: "Cliente",
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
    case "ventas":
      return (
        <svg {...base}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case "estrella":
      return (
        <svg {...base}>
          <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
        </svg>
      );
    case "comparar":
      return (
        <svg {...base}>
          <path d="M3 21h18M6 21V9M12 21V4M18 21v-6" />
        </svg>
      );
    case "reloj":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "ocupacion":
      return (
        <svg {...base}>
          <path d="M4 20V5M4 20h17" />
          <path d="m7 15 4-4 3 2 5-7" />
          <circle cx="7" cy="15" r="1" fill="currentColor" />
          <circle cx="11" cy="11" r="1" fill="currentColor" />
          <circle cx="14" cy="13" r="1" fill="currentColor" />
          <circle cx="19" cy="6" r="1" fill="currentColor" />
        </svg>
      );
    case "pos":
      return (
        <svg {...base}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 15h3M15 15h2" />
        </svg>
      );
    case "mesas":
      return (
        <svg {...base}>
          <rect x="4" y="5" width="16" height="9" rx="2" />
          <path d="M7 14v5M17 14v5M2 9h2M20 9h2" />
          <circle cx="8" cy="9.5" r=".7" fill="currentColor" stroke="none" />
          <circle cx="12" cy="9.5" r=".7" fill="currentColor" stroke="none" />
          <circle cx="16" cy="9.5" r=".7" fill="currentColor" stroke="none" />
        </svg>
      );
    case "cuentas":
      return (
        <svg {...base}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "llevar":
      return (
        <svg {...base}>
          <path d="M5 9h14l-1 12H6L5 9Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        </svg>
      );
    case "reservas":
      return (
        <svg {...base}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h6" />
        </svg>
      );
    case "puntos":
      return (
        <svg {...base}>
          <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
        </svg>
      );
    case "beneficios":
      return (
        <svg {...base}>
          <path d="M20 12v8H4v-8M2 7h20v5H2zM12 20V7" />
          <path d="M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5V7ZM12 7h4.5A2.5 2.5 0 1 0 14 4.5V7Z" />
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
