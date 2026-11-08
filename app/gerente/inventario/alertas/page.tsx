"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Alerta = {
  id: string; supplyId: string; supplyName: string; unit: string;
  quantityAtAlert: number; status: "ACTIVA" | "ATENDIDA"; createdAt: string;
};

export default function AlertasInventario() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await fetch("/api/inventario/inventory/alerts", { cache: "no-store" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.message || "No se pudieron cargar las alertas");
      setAlertas(datos);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al consultar alertas");
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function atender(id: string) {
    setProcesando(id);
    try {
      const respuesta = await fetch(`/api/inventario/inventory/alerts/${encodeURIComponent(id)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Atendida" }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.message || "No se pudo atender la alerta");
      setAlertas((previas) => previas.map((alerta) => alerta.id === id ? { ...alerta, status: "ATENDIDA" } : alerta));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error al actualizar la alerta"); }
    finally { setProcesando(null); }
  }

  const activas = alertas.filter((a) => a.status === "ACTIVA").length;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/gerente/inventario" className="text-sm font-medium text-violet-700 hover:underline">← Volver al inventario</Link>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold">Alertas de inventario</h1>
            <p className="mt-2 text-slate-500">Insumos que alcanzaron su nivel mínimo. {activas} alerta(s) activa(s).</p></div>
          <button onClick={() => void cargar()} disabled={cargando} className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Actualizar</button>
        </div>
        {error && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
        {cargando ? <p className="mt-8">Cargando alertas…</p> : alertas.length === 0 ?
          <p className="mt-8 rounded-xl border bg-white p-8 text-slate-500">No hay alertas registradas.</p> :
          <div className="mt-8 space-y-3">{alertas.map((a) => (
            <article key={a.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5 shadow-sm">
              <div><h2 className="font-semibold">{a.supplyName}</h2>
                <p className="mt-1 text-sm text-slate-500">Cantidad al generar la alerta: {a.quantityAtAlert} {a.unit} · {new Date(a.createdAt).toLocaleString("es-SV")}</p>
                <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${a.status === "ACTIVA" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{a.status === "ACTIVA" ? "Activa" : "Atendida"}</span>
              </div>
              {a.status === "ACTIVA" && <button onClick={() => void atender(a.id)} disabled={procesando === a.id} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{procesando === a.id ? "Guardando…" : "Marcar como atendida"}</button>}
            </article>
          ))}</div>}
      </div>
    </main>
  );
}
