import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_URL = (process.env.API_URL || "http://localhost:3000/api/v1").replace(/\/+$/, "");
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = await getSession();
  if (!token) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  const { id } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
      return NextResponse.json({ message: "Selecciona JPG, PNG o WebP de hasta 5 MB" }, { status: 400 });
    }
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await fetch(`${API_URL}/menu/dish/${encodeURIComponent(id)}/image`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data, mimeType: file.type }), cache: "no-store",
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ message: "No se pudo subir la fotografía" }, { status: 502 });
  }
}
