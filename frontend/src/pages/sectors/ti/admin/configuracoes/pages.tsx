import { SLA as SLAConfig } from "./SLAConfig";
import { PrioridadesProblemas } from "./PrioridadesProblemas";

export function SLA() {
  return <SLAConfig />;
}
export function Prioridades() {
  return <PrioridadesProblemas />;
}
export function Notificacoes() {
  return <Panel title="Notificações" />;
}
export function Sistema() {
  return <Panel title="Sistema" />;
}
export function Seguranca() {
  return <Panel title="Segurança" />;
}
export function Chamados() {
  return <Panel title="Chamados" />;
}
export function Email() {
  return <Panel title="Configurações de E-mail" />;
}
export function Integracoes() {
  return <Panel title="Integrações" />;
}
export function Acoes() {
  return <Panel title="Ações do Sistema" />;
}

function Panel({ title }: { title: string }) {
  return (
    <div className="card-surface rounded-xl p-4 text-sm">
      <div className="font-semibold mb-2">{title}</div>
      <p className="text-muted-foreground">
        Configurações mock para {title.toLowerCase()}.
      </p>
    </div>
  );
}
