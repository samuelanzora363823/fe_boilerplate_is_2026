"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BarraLateral from "@/app/components/BarraLateral";
import CampanaNotificaciones from "@/app/components/CampanaNotificaciones";
import {
  LoyaltyApiError,
  obtenerBeneficiosLealtad,
  obtenerPedidosTakeawayCliente,
  obtenerSaldoLealtad,
  solicitarCanjeLealtad,
  type BeneficioLealtad,
  type PedidoTakeawayCliente,
  type ResultadoCanje,
  type SaldoLealtad,
} from "@/lib/services/loyalty";

function errorConsulta(error: unknown) {
  if (!(error instanceof LoyaltyApiError)) {
    return "No se pudo conectar con el servidor. Intenta de nuevo.";
  }

  switch (error.status) {
    case 400:
      return error.message || "La solicitud no es válida.";
    case 401:
      return "AUTH_REQUIRED";
    case 403:
      return error.message || "No tienes permiso para consultar esta información.";
    case 404:
      return error.message || "No se encontró la información solicitada.";
    case 409:
      return error.message || "El canje no se puede completar en este momento.";
    default:
      return error.message || "Ocurrió un error al consultar el servidor.";
  }
}

function formatoDescuento(beneficio: BeneficioLealtad) {
  const valor = Number(beneficio.discountValue);
  if (beneficio.discountType === "PERCENTAGE") {
    return `${new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(valor)}% de descuento`;
  }
  return `${new Intl.NumberFormat("es", {
    style: "currency",
    currency: "USD",
  }).format(valor)} de descuento`;
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency: "USD",
  }).format(valor);
}

export default function BeneficiosPage() {
  const router = useRouter();
  // Saldo completo; para decidir si se puede canjear se usa solo availablePoints.
  const [saldoLealtad, setSaldoLealtad] = useState<SaldoLealtad | null>(null);
  const [beneficios, setBeneficios] = useState<BeneficioLealtad[]>([]);
  const [pedidos, setPedidos] = useState<PedidoTakeawayCliente[]>([]);
  const [seleccionado, setSeleccionado] = useState("");
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState("");
  const [pedidosReservados, setPedidosReservados] = useState<Record<string, number>>({});
  const [ahora, setAhora] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [errorCanje, setErrorCanje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCanje | null>(null);

  useEffect(() => {
    let activa = true;

    async function cargar() {
      setCargando(true);
      setError("");
      const [resultadoSaldo, resultadoBeneficios, resultadoPedidos] = await Promise.allSettled([
        obtenerSaldoLealtad(),
        obtenerBeneficiosLealtad(),
        obtenerPedidosTakeawayCliente(),
      ]);

      if (!activa) return;

      const requiereLogin = [resultadoSaldo, resultadoBeneficios, resultadoPedidos].some(
        (respuesta) =>
          respuesta.status === "rejected" &&
          respuesta.reason instanceof LoyaltyApiError &&
          respuesta.reason.status === 401,
      );

      if (requiereLogin) {
        router.push("/login");
        setCargando(false);
        return;
      }

      const errores: string[] = [];
      if (resultadoSaldo.status === "fulfilled") {
        setSaldoLealtad(resultadoSaldo.value);
      } else {
        errores.push(`Saldo: ${errorConsulta(resultadoSaldo.reason)}`);
      }

      if (resultadoBeneficios.status === "fulfilled") {
        // El backend ya filtra activos; se filtra también para no mostrar inactivos.
        setBeneficios(
          resultadoBeneficios.value.items.filter((beneficio) => beneficio.active),
        );
      } else {
        errores.push(`Beneficios: ${errorConsulta(resultadoBeneficios.reason)}`);
      }

      if (resultadoPedidos.status === "fulfilled") {
        setPedidos(resultadoPedidos.value);
      } else {
        errores.push(`Pedidos: ${errorConsulta(resultadoPedidos.reason)}`);
      }

      setError(errores.join(" "));
      setCargando(false);
    }

    void cargar();
    return () => {
      activa = false;
    };
  }, [router]);

  useEffect(() => {
    const expiraciones = Object.values(pedidosReservados).filter(
      (expira) => expira > Date.now(),
    );
    if (expiraciones.length === 0) return;

    const timeout = window.setTimeout(() => {
      const horaActual = Date.now();
      setPedidosReservados((actuales) => {
        return Object.fromEntries(
          Object.entries(actuales).filter(([, expira]) => expira > horaActual),
        );
      });
      setAhora(horaActual);
      void obtenerPedidosTakeawayCliente()
        .then(setPedidos)
        .catch(() => undefined);
    }, Math.max(0, Math.min(...expiraciones) - Date.now()));

    return () => window.clearTimeout(timeout);
  }, [pedidosReservados]);

  // Puntos que el cliente puede usar ahora (excluye los reservados).
  const saldo = saldoLealtad?.availablePoints ?? null;

  const beneficioSeleccionado = beneficios.find(
    (beneficio) => beneficio.id === seleccionado,
  );
  const pedidosReservadosIds = new Set(
    Object.entries(pedidosReservados)
      .filter(([, expira]) => expira > ahora)
      .map(([id]) => id),
  );
  const pedidosElegibles = pedidos.filter(
    (pedido) =>
      pedido.status === "PENDING_PAYMENT" && !pedidosReservadosIds.has(pedido.id),
  );
  const compraSeleccionada = pedidosElegibles.find(
    (pedido) => pedido.id === pedidoSeleccionado,
  );
  const puntosInsuficientes = Boolean(
    beneficioSeleccionado &&
      saldo !== null &&
      saldo < beneficioSeleccionado.pointsRequired,
  );

  async function confirmarCanje() {
    if (!beneficioSeleccionado || !compraSeleccionada || enviando) return;

    setEnviando(true);
    setErrorCanje("");
    setResultado(null);
    try {
      const respuesta = await solicitarCanjeLealtad({
        benefitId: beneficioSeleccionado.id,
        orderId: compraSeleccionada.id,
      });
      setResultado(respuesta);
      // No se usa respuesta.balance: POST /redemptions conserva su contrato
      // anterior. El saldo se vuelve a consultar abajo.
      queueMicrotask(() => {
        const horaCanje = Date.now();
        setAhora(horaCanje);
        setPedidosReservados((previos) => ({
          ...previos,
          [compraSeleccionada.id]: horaCanje + 15 * 60 * 1000,
        }));
      });
      setPedidoSeleccionado("");

      const [saldoActualizado, beneficiosActualizados, pedidosActualizados] = await Promise.allSettled([
        obtenerSaldoLealtad(),
        obtenerBeneficiosLealtad(),
        obtenerPedidosTakeawayCliente(),
      ]);
      if (saldoActualizado.status === "fulfilled") {
        setSaldoLealtad(saldoActualizado.value);
      } else {
        // El canje sí se registró; el saldo mostrado puede estar desactualizado.
        setSaldoLealtad(null);
        setErrorCanje(
          "El canje se registró, pero no se pudo actualizar tu saldo. Recarga la página para consultarlo.",
        );
      }
      if (beneficiosActualizados.status === "fulfilled") {
        setBeneficios(
          beneficiosActualizados.value.items.filter((beneficio) => beneficio.active),
        );
      }
      if (pedidosActualizados.status === "fulfilled") {
        setPedidos(pedidosActualizados.value);
      }
    } catch (error) {
      const mensaje = errorConsulta(error);
      if (mensaje === "AUTH_REQUIRED") {
        router.push("/login");
      } else {
        setErrorCanje(mensaje);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800 lg:flex">
      <BarraLateral />

      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm text-slate-400">Núcleo Digital / Cliente / Beneficios</p>
              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">Beneficios de lealtad</h1>
              <p className="mt-2 text-sm text-slate-500">Canjea tus puntos por descuentos disponibles.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/cliente/puntos" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#5546ba] shadow-sm transition hover:border-[#c9c1ff]">
                Ver movimientos
              </Link>
              <CampanaNotificaciones />
            </div>
          </header>

          {cargando && (
            <p role="status" className="mb-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Cargando saldo y beneficios…
            </p>
          )}

          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#ddd6fe] bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-sm font-semibold text-[#7564e8]">Puntos disponibles</p>
              {saldoLealtad !== null ? (
                <>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-[#20233e]">
                    {new Intl.NumberFormat("es").format(saldoLealtad.availablePoints)} <span className="text-lg font-semibold text-slate-500">puntos</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Total acumulado: {new Intl.NumberFormat("es").format(saldoLealtad.totalPoints)} · Reservados: {new Intl.NumberFormat("es").format(saldoLealtad.reservedPoints)}
                  </p>
                </>
              ) : !cargando ? (
                <p className="mt-2 text-sm text-slate-500">No se pudo cargar el saldo.</p>
              ) : null}
            </div>
            <Link href="/cliente/puntos" className="text-sm font-semibold text-[#7564e8] hover:underline">
              Consultar mi historial →
            </Link>
          </section>

          {errorCanje && (
            <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorCanje}
            </div>
          )}

          {resultado && (
            <section role="status" className="mb-7 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900 shadow-sm">
              <h2 className="text-lg font-bold">Canje confirmado</h2>
              <p className="mt-2 text-sm">Puntos reservados: <strong>{resultado.pointsRedeemed}</strong></p>
              <p className="mt-1 text-sm">Descuento aplicado: <strong>{dinero(resultado.discountApplied)}</strong></p>
              <p className="mt-1 text-sm">Estado: <strong>{resultado.status}</strong></p>
              {!enviando && saldo !== null && (
                <p className="mt-1 text-sm">Saldo disponible: <strong>{new Intl.NumberFormat("es").format(saldo)} puntos</strong></p>
              )}
              <p className="mt-3 text-sm">La reserva se mantiene durante 15 minutos. Si no se completa el pago dentro de ese plazo, el backend libera los puntos.</p>
            </section>
          )}

          <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#20233e]">Elige un pedido para llevar</h2>
              <p className="mt-1 text-sm text-slate-500">Solo se pueden canjear pedidos propios pendientes de pago.</p>
            </div>
            {!cargando && pedidosElegibles.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                No tienes pedidos para llevar pendientes de pago que puedan usarse para un canje.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {pedidosElegibles.map((pedido) => (
                  <button
                    type="button"
                    key={pedido.id}
                    onClick={() => {
                      setPedidoSeleccionado(pedido.id);
                      setResultado(null);
                      setErrorCanje("");
                    }}
                    aria-pressed={pedidoSeleccionado === pedido.id}
                    className={`rounded-xl border p-4 text-left transition ${pedidoSeleccionado === pedido.id ? "border-[#7564e8] bg-[#faf9ff] ring-2 ring-[#7564e8]/20" : "border-slate-200 hover:border-[#c9c1ff]"}`}
                  >
                    <span className="block font-semibold text-[#252944]">Pedido {pedido.orderNumber}</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {dinero(Number(pedido.total))} · {new Date(pedido.createdAt).toLocaleString("es-SV")}
                    </span>
                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Pendiente de pago
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="beneficios-heading">
            <div className="mb-4">
              <h2 id="beneficios-heading" className="text-xl font-bold text-[#20233e]">Beneficios disponibles</h2>
              <p className="mt-1 text-sm text-slate-500">Selecciona un beneficio para revisar el canje.</p>
            </div>

            {!cargando && !error && beneficios.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
                <p className="text-base font-semibold text-[#252944]">No hay beneficios disponibles por ahora.</p>
                <p className="mt-2 text-sm text-slate-500">Vuelve más tarde para consultar nuevas opciones.</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {beneficios.map((beneficio) => {
                  const seleccionadoActual = beneficio.id === seleccionado;
                  const insuficientes = saldo !== null && saldo < beneficio.pointsRequired;
                  return (
                    <button
                      type="button"
                      key={beneficio.id}
                      onClick={() => {
                        setSeleccionado(beneficio.id);
                        setResultado(null);
                        setErrorCanje("");
                      }}
                      aria-pressed={seleccionadoActual}
                      className={`rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${seleccionadoActual ? "border-[#7564e8] ring-2 ring-[#7564e8]/20" : "border-slate-200"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold text-[#20233e]">{beneficio.name}</h3>
                        <span className="shrink-0 rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#6250d5]">
                          {new Intl.NumberFormat("es").format(beneficio.pointsRequired)} pts
                        </span>
                      </div>
                      <p className="mt-4 text-2xl font-bold text-[#7564e8]">{formatoDescuento(beneficio)}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Tipo: {beneficio.discountType === "PERCENTAGE" ? "Porcentaje" : "Monto fijo"}
                      </p>
                      {insuficientes && (
                        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                          No tienes puntos suficientes para este beneficio.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {beneficioSeleccionado && !resultado && (
            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-[#20233e]">Solicitar canje</h2>
              <p className="mt-2 text-sm text-slate-500">
                Beneficio seleccionado: <strong>{beneficioSeleccionado.name}</strong>
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Se usan tus puntos disponibles (sin contar los reservados); el backend vuelve a validarlos al solicitar el canje.
              </p>
              {puntosInsuficientes && (
                <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Necesitas {beneficioSeleccionado.pointsRequired} puntos y tienes {saldo}.
                </p>
              )}
              {!compraSeleccionada && (
                <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  Selecciona un pedido para llevar pendiente de pago para continuar.
                </p>
              )}
              <button
                type="button"
                onClick={() => void confirmarCanje()}
                disabled={cargando || enviando || saldo === null || puntosInsuficientes || !beneficioSeleccionado || !compraSeleccionada}
                className="mt-5 rounded-xl bg-[#7564e8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6250d5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? "Solicitando canje…" : "Solicitar canje"}
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
