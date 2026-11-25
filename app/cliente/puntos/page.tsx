"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BarraLateral from "@/app/components/BarraLateral";
import CampanaNotificaciones from "@/app/components/CampanaNotificaciones";
import {
  consultarLealtad,
  LoyaltyApiError,
  obtenerSaldoLealtad,
  type SaldoLealtad,
} from "@/lib/services/loyalty";

type Movimiento = {
  id: string;
  fecha: string;
  // Código del backend (LoyaltyMovementType), por ejemplo EARNED.
  tipo: string;
  descripcion: string;
  puntos: number;
};

type Acreditacion = {
  puntos: number;
  fecha: string;
};

// Tipos de movimiento del backend traducidos al español. Hoy el backend solo
// genera EARNED; los demás se incluyen por si el enum crece.
const TIPOS_MOVIMIENTO: Record<string, string> = {
  EARNED: "Puntos acumulados",
  REDEEMED: "Puntos canjeados",
  RESERVED: "Puntos reservados",
  RELEASED: "Puntos liberados",
  EXPIRED: "Puntos vencidos",
  ADJUSTMENT: "Ajuste de puntos",
};

function etiquetaMovimiento(tipo: string) {
  return TIPOS_MOVIMIENTO[tipo.toUpperCase()] ?? "Movimiento de puntos";
}

// Una acreditación se considera reciente durante 24 horas.
const VENTANA_ACREDITACION_MS = 24 * 60 * 60 * 1000;

// Devuelve la suma de los puntos acumulados en las últimas 24 horas, o null si
// no hay ninguno. Se calcula al cargar, no en el render, porque usa la hora.
function acreditacionReciente(
  movimientos: Movimiento[],
  ahora: number,
): Acreditacion | null {
  const recientes = movimientos.filter((movimiento) => {
    const fecha = new Date(movimiento.fecha).getTime();
    return (
      movimiento.tipo.toUpperCase() === "EARNED" &&
      movimiento.puntos > 0 &&
      Number.isFinite(fecha) &&
      ahora - fecha >= 0 &&
      ahora - fecha <= VENTANA_ACREDITACION_MS
    );
  });

  if (recientes.length === 0) return null;

  const masReciente = recientes.reduce((actual, movimiento) =>
    new Date(movimiento.fecha).getTime() > new Date(actual.fecha).getTime()
      ? movimiento
      : actual,
  );

  return {
    puntos: recientes.reduce((total, movimiento) => total + movimiento.puntos, 0),
    fecha: masReciente.fecha,
  };
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function extraerMovimientos(valor: unknown): Movimiento[] | null {
  const respuesta = objeto(valor);
  const lista = Array.isArray(valor)
    ? valor
    : Array.isArray(respuesta?.data)
      ? respuesta.data
      : Array.isArray(respuesta?.movements)
        ? respuesta.movements
        : Array.isArray(respuesta?.items)
          ? respuesta.items
          : null;

  if (!lista) return null;

  return lista.map((elemento, indice) => {
    const item = objeto(elemento) ?? {};
    const puntosRaw = item.points ?? item.amount ?? item.pointsDelta ?? 0;
    const puntos = Number(puntosRaw);
    const fechaRaw = item.date ?? item.createdAt ?? item.movementDate;
    const tipoRaw = item.type ?? item.movementType;
    const descripcionRaw = item.description;

    return {
      id: String(item.id ?? indice),
      fecha: typeof fechaRaw === "string" ? fechaRaw : "",
      tipo: typeof tipoRaw === "string" ? tipoRaw : "",
      descripcion: typeof descripcionRaw === "string" ? descripcionRaw.trim() : "",
      puntos: Number.isFinite(puntos) ? puntos : 0,
    };
  });
}

function formatoFecha(valor: string) {
  if (!valor) return "Fecha no disponible";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

function errorLealtad(error: unknown): Error {
  if (error instanceof LoyaltyApiError) {
    if (error.status === 401) return new Error("AUTH_REQUIRED");
    if (error.status === 403) {
      return new Error("No tienes permiso para consultar esta información.");
    }
    return new Error(
      error.message || "No se pudo consultar la información de puntos. Intenta de nuevo.",
    );
  }
  return error instanceof Error
    ? error
    : new Error("No se pudo consultar la información de puntos. Intenta de nuevo.");
}

async function consultarSaldo(): Promise<SaldoLealtad> {
  try {
    // obtenerSaldoLealtad ya convierte el 404 (sin cuenta de puntos) en saldo cero.
    return await obtenerSaldoLealtad();
  } catch (error) {
    throw errorLealtad(error);
  }
}

async function consultarMovimientos(): Promise<unknown> {
  try {
    return await consultarLealtad<unknown>("/api/cliente/loyalty/movements");
  } catch (error) {
    // Un cliente sin cuenta de puntos no tiene movimientos: estado vacío.
    if (error instanceof LoyaltyApiError && error.status === 404) return [];
    throw errorLealtad(error);
  }
}

export default function PuntosPage() {
  const router = useRouter();
  const [saldo, setSaldo] = useState<SaldoLealtad | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [acreditacion, setAcreditacion] = useState<Acreditacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorSaldo, setErrorSaldo] = useState("");
  const [errorMovimientos, setErrorMovimientos] = useState("");

  useEffect(() => {
    let activa = true;

    async function cargar() {
      setCargando(true);
      const [resultadoSaldo, resultadoMovimientos] = await Promise.allSettled([
        consultarSaldo(),
        consultarMovimientos(),
      ]);

      if (!activa) return;

      const requiereLogin = [resultadoSaldo, resultadoMovimientos].some(
        (resultado) =>
          resultado.status === "rejected" &&
          resultado.reason instanceof Error &&
          resultado.reason.message === "AUTH_REQUIRED",
      );

      if (requiereLogin) {
        router.push("/login");
        setCargando(false);
        return;
      }

      if (resultadoSaldo.status === "fulfilled") {
        setSaldo(resultadoSaldo.value);
        setErrorSaldo("");
      } else {
        setErrorSaldo(
          resultadoSaldo.reason instanceof Error
            ? resultadoSaldo.reason.message
            : "No se pudo consultar el saldo de puntos.",
        );
      }

      if (resultadoMovimientos.status === "fulfilled") {
        const lista = extraerMovimientos(resultadoMovimientos.value);
        if (lista === null) {
          setErrorMovimientos("No se pudo interpretar el historial recibido.");
        } else {
          setMovimientos(lista);
          setAcreditacion(acreditacionReciente(lista, Date.now()));
          setErrorMovimientos("");
        }
      } else {
        setErrorMovimientos(
          resultadoMovimientos.reason instanceof Error
            ? resultadoMovimientos.reason.message
            : "No se pudo consultar el historial de puntos.",
        );
      }

      setCargando(false);
    }

    void cargar();
    return () => {
      activa = false;
    };
  }, [router]);

  const formatoPuntos = (valor: number) => new Intl.NumberFormat("es").format(valor);

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800 lg:flex">
      <BarraLateral />

      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-slate-400">Núcleo Digital / Cliente / Mis puntos</p>
              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">Mis puntos</h1>
              <p className="mt-2 text-sm text-slate-500">Consulta tu saldo y el historial de movimientos.</p>
            </div>
            <CampanaNotificaciones />
          </header>

          {acreditacion && (
            <div role="status" className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
              Se acreditaron <strong>+{formatoPuntos(acreditacion.puntos)} puntos</strong> por tus compras recientes
              (último movimiento: {formatoFecha(acreditacion.fecha)}).
            </div>
          )}

          {cargando && (
            <p role="status" className="mb-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Cargando tu información de puntos…
            </p>
          )}

          <section aria-labelledby="saldo-heading" className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-[#7564e8]">Programa de lealtad</p>
            <h2 id="saldo-heading" className="mt-2 text-lg font-semibold text-[#20233e]">Saldo disponible</h2>
            {errorSaldo ? (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorSaldo}</p>
            ) : saldo !== null ? (
              <>
                <p className="mt-2 text-4xl font-bold tracking-tight text-[#20233e]">
                  {formatoPuntos(saldo.availablePoints)} <span className="text-lg font-semibold text-slate-500">puntos</span>
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-500">
                  <div className="flex gap-2">
                    <dt>Total acumulado:</dt>
                    <dd className="font-semibold text-slate-700">{formatoPuntos(saldo.totalPoints)} puntos</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Reservados en canjes:</dt>
                    <dd className="font-semibold text-slate-700">{formatoPuntos(saldo.reservedPoints)} puntos</dd>
                  </div>
                </dl>
                {saldo.totalPoints === 0 && (
                  <p className="mt-3 text-sm text-slate-500">Aún no acumulas puntos. Los obtendrás con tus compras pagadas.</p>
                )}
              </>
            ) : !cargando ? (
              <p className="mt-3 text-sm text-slate-500">No hay saldo disponible para mostrar.</p>
            ) : null}
          </section>

          <section aria-labelledby="movimientos-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
              <h2 id="movimientos-heading" className="text-lg font-semibold text-[#20233e]">Historial de movimientos</h2>
              <p className="mt-1 text-sm text-slate-500">Acreditaciones y otros movimientos registrados.</p>
            </div>

            {errorMovimientos ? (
              <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMovimientos}</p>
            ) : cargando && movimientos === null ? (
              <p className="px-6 py-14 text-center text-sm text-slate-500">Cargando movimientos…</p>
            ) : movimientos?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold sm:px-8">Fecha</th>
                      <th className="px-6 py-4 font-semibold">Tipo de movimiento</th>
                      <th className="px-6 py-4 text-right font-semibold sm:px-8">Puntos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movimientos.map((movimiento) => (
                      <tr key={movimiento.id}>
                        <td className="px-6 py-4 text-slate-600 sm:px-8">{formatoFecha(movimiento.fecha)}</td>
                        <td className="px-6 py-4 font-medium text-[#252944]">
                          {etiquetaMovimiento(movimiento.tipo)}
                          {movimiento.descripcion && movimiento.descripcion !== etiquetaMovimiento(movimiento.tipo) && (
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">{movimiento.descripcion}</span>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-right font-semibold sm:px-8 ${movimiento.puntos > 0 ? "text-green-700" : "text-slate-600"}`}>
                          {movimiento.puntos > 0 ? "+" : ""}{formatoPuntos(movimiento.puntos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 py-14 text-center text-sm text-slate-500">Aún no tienes movimientos de puntos.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
