"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSesion } from "@/lib/stores/sesion";

// H26: campana con la cantidad de avisos No leída.
// Se actualiza al montarse y cada 30 segundos (consulta periódica HTTP).
const CADA_30_SEGUNDOS = 30_000;

export default function CampanaNotificaciones({
  variante = "claro",
}: {
  variante?: "claro" | "oscuro";
}) {
  const noLeidas = useSesion((estado) => estado.noLeidas);
  const cargarNoLeidas = useSesion((estado) => estado.cargarNoLeidas);

  useEffect(() => {
    queueMicrotask(() => {
      void cargarNoLeidas();
    });
    const intervalo = setInterval(
      () => void cargarNoLeidas(),
      CADA_30_SEGUNDOS,
    );
    return () => clearInterval(intervalo);
  }, [cargarNoLeidas]);

  const insignia = noLeidas > 9 ? "9+" : String(noLeidas);

  return (
    <Link
      href="/notificaciones"
      aria-label={`Notificaciones: ${noLeidas} sin leer`}
      title="Notificaciones"
      className={
        variante === "oscuro"
          ? "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
          : "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#454b69] shadow-sm transition hover:border-[#c9c1ff] hover:text-[#7564e8]"
      }
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>

      {noLeidas > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
          {insignia}
        </span>
      )}
    </Link>
  );
}
