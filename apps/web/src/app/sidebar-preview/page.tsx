import AppShell from "@/components/layout/AppShell";

export default function SidebarPreviewPage() {
  return (
    <AppShell>
      <div className="workspace-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Vista previa</p>
            <h1>Atención</h1>
            <p>Comprueba la navegación en sus estados expandido y compacto.</p>
          </div>
        </div>
        <section className="panel-card" style={{ minHeight: 480, padding: 24 }}>
          <p>Contenido de referencia para revisar el sidebar.</p>
        </section>
      </div>
    </AppShell>
  );
}
