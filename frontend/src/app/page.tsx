import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { authenticationReady, ownerId } from "@/lib/private-config";
import PrivateDashboard from "@/components/PrivateDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!authenticationReady()) redirect("/login");
  const session = await auth();
  if (!session?.user || session.user.id !== ownerId()) redirect("/login");

  return (
    <main className="private-shell jarvis-shell">
      <header className="private-header jarvis-header">
        <div className="jarvis-wordmark" aria-label="JARVIS, centro de mando personal">
          <h1>JARVIS</h1>
          <span>CENTRO DE MANDO</span>
        </div>
        <div className="jarvis-header-actions">
          <span className="jarvis-header-chip"><span aria-hidden="true">✦</span> PRIVADO</span>
          <span className="jarvis-header-chip" title="Límite de gasto automático; no indica consumo real">LÍMITE $0</span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="private-button secondary jarvis-logout" type="submit">Cerrar sesión</button>
          </form>
        </div>
      </header>
      <PrivateDashboard />
    </main>
  );
}
