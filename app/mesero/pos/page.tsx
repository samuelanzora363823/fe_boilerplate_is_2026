
"use client";

import { useCallback, useEffect, useState } from "react";

type Table = {
  id: string;
  number: number;
  capacity: number;
  status: string;
  accounts: { id: string }[];
};

type Dish = {
  id: string;
  name: string;
  price: string;
  category: { name: string };
};

type Item = {
  dishId: string;
  quantity: number;
  notes: string;
};

async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/mesero/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message ?? `Error ${response.status}`,
    );
  }

  return data;
}

export default function POS() {
  const [tables, setTables] = useState<Table[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [tableId, setTableId] = useState("");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [accountId, setAccountId] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [tablesData, dishesData] = await Promise.all([
        api("tables/my-branch"),
        api("orders/table/menu"),
      ]);

      setTables(tablesData);
      setDishes(dishesData);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar los datos",
      );
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function changeTable(id: string) {
    setTableId(id);
    setAccountId("");
    setItems([]);
    setEmail("");
    setMessage("");
    setError("");
  }

  function add(dishId: string) {
    setItems((previous) => {
      const existing = previous.find(
        (item) => item.dishId === dishId,
      );

      if (existing) {
        return previous.map((item) =>
          item.dishId === dishId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }

      return [
        ...previous,
        {
          dishId,
          quantity: 1,
          notes: "",
        },
      ];
    });
  }

  function updateQuantity(dishId: string, quantity: number) {
    setItems((previous) =>
      previous.map((item) =>
        item.dishId === dishId
          ? { ...item, quantity }
          : item,
      ),
    );
  }

  function updateNotes(dishId: string, notes: string) {
    setItems((previous) =>
      previous.map((item) =>
        item.dishId === dishId
          ? { ...item, notes: notes.slice(0, 100) }
          : item,
      ),
    );
  }

  function remove(dishId: string) {
    setItems((previous) =>
      previous.filter((item) => item.dishId !== dishId),
    );
  }

  async function open() {
    if (!tableId || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await api("accounts", {
        tableId,
        ...(email.trim()
          ? { customerEmail: email.trim() }
          : {}),
      });

      setAccountId(result.id);
      setMessage("Cuenta abierta correctamente.");

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo abrir la cuenta",
      );
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const invalidItems = items.some(
      (item) =>
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.notes.length > 100,
    );

    if (
      !accountId ||
      items.length === 0 ||
      invalidItems ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await api("orders/table", {
        accountId,
        items,
      });

      setItems([]);

      setMessage(
        `Pedido ${result.id} registrado y enviado a cocina.`,
      );

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el pedido",
      );
    } finally {
      setLoading(false);
    }
  }

  const selected = tables.find(
    (table) => table.id === tableId,
  );

  const total = items.reduce((sum, item) => {
    const dish = dishes.find(
      (dish) => dish.id === item.dishId,
    );

    return sum + Number(dish?.price ?? 0) * item.quantity;
  }, 0);

  const invalidItems = items.some(
    (item) =>
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.notes.length > 100,
  );

  const canOpenAccount = Boolean(
    !loading &&
    !loadingData &&
    tableId &&
    selected?.status !== "RESERVED",
  );

  const canSendOrder = Boolean(
    !loading &&
    accountId &&
    items.length > 0 &&
    !invalidItems,
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">
        Punto de venta · Pedido en mesa
      </h1>

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-xl font-semibold">
          1. Abrir cuenta
        </h2>

        <label className="block">
          Mesa

          <select
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={tableId}
            onChange={(event) =>
              changeTable(event.target.value)
            }
            disabled={loading || loadingData}
          >
            <option value="">
              {loadingData
                ? "Cargando mesas..."
                : "Seleccione mesa"}
            </option>

            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                Mesa {table.number} · {table.capacity} personas ·{" "}
                {table.status === "OCCUPIED"
                  ? "Ocupada"
                  : table.status === "FREE"
                    ? "Libre"
                    : "Reservada"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          Correo del cliente (opcional)

          <input
            className="mt-1 w-full rounded border bg-transparent p-2"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="cliente@ejemplo.com"
            disabled={loading}
          />
        </label>

        <button
          type="button"
          className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={!canOpenAccount}
          onClick={() => void open()}
        >
          {loading
            ? "Procesando..."
            : accountId
              ? "Consultar cuenta"
              : "Abrir cuenta"}
        </button>

        {accountId && (
          <p className="text-sm">
            Cuenta activa: {accountId}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-xl font-semibold">
          2. Seleccionar platillos
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className="flex items-center justify-between gap-3 rounded border p-3"
            >
              <span>
                {dish.name} · $
                {Number(dish.price).toFixed(2)}

                <small className="block opacity-60">
                  {dish.category.name}
                </small>
              </span>

              <button
                type="button"
                className="rounded bg-violet-700 px-3 py-2 text-white disabled:opacity-50"
                disabled={loading}
                onClick={() => add(dish.id)}
              >
                Agregar
              </button>
            </div>
          ))}
        </div>

        {!loadingData && dishes.length === 0 && (
          <p>No hay platillos disponibles.</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-xl font-semibold">
          3. Confirmar pedido
        </h2>

        {items.length === 0 && (
          <p>Agrega al menos un platillo.</p>
        )}

        {items.map((item) => {
          const dish = dishes.find(
            (dish) => dish.id === item.dishId,
          );

          return (
            <div
              key={item.dishId}
              className="grid gap-2 rounded border p-3 sm:grid-cols-[1fr_100px_2fr_auto]"
            >
              <span>{dish?.name ?? "Platillo"}</span>

              <input
                aria-label={`Cantidad de ${dish?.name ?? "platillo"}`}
                className="rounded border bg-transparent p-2"
                type="number"
                min={1}
                step={1}
                value={item.quantity}
                disabled={loading}
                onChange={(event) =>
                  updateQuantity(
                    item.dishId,
                    Number(event.target.value),
                  )
                }
              />

              <textarea
                aria-label={`Notas especiales de ${dish?.name ?? "platillo"}`}
                maxLength={100}
                className="rounded border bg-transparent p-2"
                placeholder="Notas especiales"
                value={item.notes}
                disabled={loading}
                onChange={(event) =>
                  updateNotes(
                    item.dishId,
                    event.target.value,
                  )
                }
              />

              <button
                type="button"
                disabled={loading}
                onClick={() => remove(item.dishId)}
              >
                Quitar
              </button>
            </div>
          );
        })}

        <p className="font-bold">
          Total: ${total.toFixed(2)}
        </p>

        <button
          type="button"
          className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={!canSendOrder}
          onClick={() => void send()}
        >
          {loading
            ? "Enviando..."
            : "Enviar a cocina"}
        </button>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded bg-red-950 p-3 text-red-200"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded bg-green-950 p-3 text-green-200"
        >
          {message}
        </p>
      )}
    </main>
  );
}
