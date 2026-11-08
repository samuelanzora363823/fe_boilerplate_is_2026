
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { getSession } from "@/lib/session";

type UserRole = "GERENTE" | "MESERO" | "COCINA" | "CLIENTE";

type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
};

type Module = {
  title: string;
  href: string;
  description: string;
  icon: "menu" | "pos" | "takeaway" | "view" | "inventory";
};

const modules: Record<UserRole, Module[]> = {
  GERENTE: [
    {
      title: "Administrar menú",
      href: "/gerente/menu",
      description:
        "Agrega, edita y administra los platillos del restaurante.",
      icon: "menu",
    },
    {
      title: "Consultar menú",
      href: "/menu",
      description:
        "Consulta los platillos, precios y categorías disponibles.",
      icon: "view",
    },
    {
      title: "Inventario",
      href: "/gerente/inventario/movimientos/nuevo",
      description:
        "Registra las entradas y salidas de insumos de tu sucursal.",
      icon: "inventory",
    },
  ],
  MESERO: [
    {
      title: "Punto de venta (POS)",
      href: "/mesero/pos",
      description:
        "Gestiona mesas, registra pedidos y atiende a los clientes.",
      icon: "pos",
    },
  ],
  COCINA: [],
  CLIENTE: [
    {
      title: "Consultar menú",
      href: "/menu",
      description:
        "Explora los platillos disponibles del restaurante.",
      icon: "view",
    },
    {
      title: "Pedido para llevar",
      href: "/cliente/pedido-para-llevar",
      description:
        "Realiza y registra tus pedidos para llevar.",
      icon: "takeaway",
    },
  ],
};

const roleLabels: Record<UserRole, string> = {
  GERENTE: "Gerente",
  MESERO: "Mesero",
  COCINA: "Cocina",
  CLIENTE: "Cliente",
};

function Icon({
  name,
  size = 22,
}: {
  name: "home" | "menu" | "pos" | "takeaway" | "view" | "inventory" | "logout" | "arrow";
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="m3 10 9-7 9 7v10H3z" />
          <path d="M9 20v-7h6v7" />
        </svg>
      );

    case "menu":
      return (
        <svg {...props}>
          <path d="M4 5h16M4 12h16M4 19h16" />
        </svg>
      );

    case "pos":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 15h3M15 15h2" />
        </svg>
      );

    case "takeaway":
      return (
        <svg {...props}>
          <path d="M5 9h14l-1 12H6L5 9Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        </svg>
      );

    case "view":
      return (
        <svg {...props}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );

    case "inventory":
      return (
        <svg {...props}>
          <path d="m3 7 9-4 9 4-9 4-9-4Z" />
          <path d="M3 7v10l9 4 9-4V7M12 11v10" />
        </svg>
      );

    case "logout":
      return (
        <svg {...props}>
          <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
          <path d="m15 16 4-4-4-4M19 12H9" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...props}>
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      );
  }
}

export default async function Home() {
  const token = await getSession();

  if (!token) {
    redirect("/login");
  }

  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    throw new Error("API_URL no está configurada.");
  }

  const response = await fetch(
    `${apiUrl.replace(/\/$/, "")}/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error("No se pudo obtener el usuario.");
  }

  const user: CurrentUser = await response.json();
  const availableModules = modules[user.role] ?? [];
  const roleLabel = roleLabels[user.role] ?? user.role;

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-[#252944] lg:flex">
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

        <nav
          aria-label="Navegación principal"
          className="flex gap-2 overflow-x-auto p-4 lg:flex-col"
        >
          <Link
            href="/"
            aria-current="page"
            className="flex shrink-0 items-center gap-3 rounded-xl bg-[#7564e8] px-4 py-3 text-sm font-semibold text-white"
          >
            <Icon name="home" size={19} />
            Inicio
          </Link>

          {availableModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name={module.icon} size={19} />
              {module.title}
            </Link>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7564e8] font-semibold">
              {roleLabel.charAt(0)}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold">{roleLabel}</p>
              <p className="truncate text-xs text-slate-400">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {/* ENCABEZADO */}
          <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="mb-2 text-sm text-[#8c9cbd]">
                Núcleo Digital / Inicio
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-[#20233e]">
                Panel principal
              </h1>

              <p className="mt-2 text-sm text-[#7184a6]">
                Bienvenido al sistema de gestión del restaurante.
              </p>
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#454b69] shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Icon name="logout" size={18} />
                Cerrar sesión
              </button>
            </form>
          </header>

          {/* INFORMACIÓN DEL USUARIO */}
          <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-2xl font-bold text-[#7564e8]">
                {roleLabel.charAt(0)}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-[#20233e]">
                  Bienvenido, {roleLabel}
                </h2>

                <p className="mt-1 break-all text-sm text-slate-500">
                  {user.email}
                </p>
              </div>

              <span className="rounded-full bg-[#f0edff] px-4 py-2 text-xs font-semibold text-[#7564e8]">
                {user.role}
              </span>
            </div>
          </section>

          {/* MÓDULOS */}
          <section>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-[#20233e]">
                Módulos disponibles
              </h2>

              <p className="mt-1 text-sm text-[#7184a6]">
                Selecciona el módulo que deseas utilizar.
              </p>
            </div>

            {availableModules.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {availableModules.map((module) => (
                  <Link
                    key={module.href}
                    href={module.href}
                    className="group flex min-h-60 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#c9c1ff] hover:shadow-lg"
                  >
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7564e8] transition group-hover:bg-[#7564e8] group-hover:text-white">
                      <Icon name={module.icon} size={27} />
                    </div>

                    <h3 className="text-lg font-bold text-[#252944]">
                      {module.title}
                    </h3>

                    <p className="mt-3 flex-1 text-sm leading-6 text-[#7184a6]">
                      {module.description}
                    </p>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm font-semibold text-[#7564e8]">
                        Acceder al módulo
                      </span>

                      <span className="text-[#7564e8] transition-transform group-hover:translate-x-1">
                        <Icon name="arrow" size={19} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0edff] text-[#7564e8]">
                  <Icon name="menu" size={26} />
                </div>

                <h3 className="text-lg font-semibold text-[#252944]">
                  Sin módulos disponibles
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Todavía no hay módulos habilitados para el rol{" "}
                  {roleLabel}.
                </p>
              </div>
            )}
          </section>

          {/* PIE DE PÁGINA */}
          <footer className="mt-12 border-t border-slate-200 py-5 text-center text-xs text-[#94a3b8]">
            Núcleo Digital · Sistema de gestión de restaurante
          </footer>
        </div>
      </main>
    </div>
  );
}
