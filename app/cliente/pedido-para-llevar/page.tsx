"use client";
import { useEffect, useMemo, useState } from "react";
type Branch = { id: string; name: string };
type Dish = { id: string; name: string; price: string | number; category?: string };
type CartItem = { dish: Dish; quantity: number; notes: string };
type Result = { orderId: string; orderNumber: string; status: string };
export default function TakeawayPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => cart.reduce((sum, i) => sum + Number(i.dish.price) * i.quantity, 0), [cart]);
  useEffect(() => { fetch("/api/menu/branches").then(r => r.json()).then(data => { if (Array.isArray(data)) setBranches(data); else setError("No se pudieron cargar las sucursales"); }).catch(() => setError("Error al consultar sucursales")); }, []);
  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();
    fetch(`/api/menu/branch/${branchId}/filter`, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.message ?? "Error al consultar menú"); return data; }).then(data => { if (!controller.signal.aborted) setDishes(data); }).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [branchId]);
  function add(dish: Dish) { setCart(prev => { const existing = prev.find(i => i.dish.id === dish.id); return existing ? prev.map(i => i.dish.id === dish.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { dish, quantity: 1, notes: "" }]; }); }
  async function confirm() {
    if (!branchId || !cart.length || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/cliente/takeaway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId, items: cart.map(i => ({ dishId: i.dish.id, quantity: i.quantity, notes: i.notes })) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "No se pudo registrar el pedido");
      setResult(data); setCart([]);
    } catch (e) { setError(e instanceof Error ? e.message : "Error desconocido"); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-5xl p-6 space-y-6">
    <h1 className="text-3xl font-bold">Pedido para llevar</h1>
    <p>El pedido queda pendiente de pago. No se enviará a cocina hasta la confirmación del pago.</p>
    {result ? <section className="rounded border p-5 space-y-2"><h2 className="text-xl font-bold">Pedido registrado</h2><p>Número de orden: <strong>{result.orderNumber}</strong></p><p>Estado: {result.status}</p><p>Conserva este número para pagar cuando esté disponible el módulo de pagos.</p><button className="underline" onClick={() => setResult(null)}>Nuevo pedido</button></section> : <>
      <label className="block">Sucursal <select className="block w-full border rounded p-2 bg-transparent" value={branchId} onChange={e => { setBranchId(e.target.value); setCart([]); setDishes([]); setError(""); }}><option value="">Selecciona una sucursal</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{dishes.map(d => <div key={d.id} className="border rounded p-3 flex justify-between items-center gap-3"><span>{d.name} — ${Number(d.price).toFixed(2)}</span><button className="rounded border px-3 py-1" onClick={() => add(d)}>Agregar</button></div>)}</div>
      <h2 className="text-2xl font-semibold">Carrito</h2>
      {cart.length === 0 ? <p>Tu carrito está vacío.</p> : cart.map(i => <div key={i.dish.id} className="border rounded p-3 space-y-2"><p>{i.dish.name} — ${Number(i.dish.price).toFixed(2)}</p><label>Cantidad <input className="w-20 border rounded p-1 bg-transparent" type="number" min={1} value={i.quantity} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1) setCart(prev => prev.map(x => x.dish.id === i.dish.id ? { ...x, quantity: n } : x)); }} /></label><label className="block">Notas <input maxLength={100} className="w-full border rounded p-1 bg-transparent" value={i.notes} onChange={e => setCart(prev => prev.map(x => x.dish.id === i.dish.id ? { ...x, notes: e.target.value } : x))}/></label><button className="underline" onClick={() => setCart(prev => prev.filter(x => x.dish.id !== i.dish.id))}>Quitar</button></div>)}
      <p className="font-bold">Total: ${total.toFixed(2)}</p><button className="rounded bg-blue-700 text-white px-5 py-3 disabled:opacity-50" disabled={!branchId || !cart.length || busy} onClick={confirm}>{busy ? "Registrando..." : "Confirmar pedido y continuar al pago"}</button>
    </>}
  </main>;
}
