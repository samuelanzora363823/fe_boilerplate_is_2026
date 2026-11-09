import { verificarRol } from "@/lib/auth";
import KitchenOrders from "./kitchen-orders";

export const dynamic = "force-dynamic";

export default async function CocinaPage() {
  await verificarRol("COCINA");

  return <KitchenOrders />;
}