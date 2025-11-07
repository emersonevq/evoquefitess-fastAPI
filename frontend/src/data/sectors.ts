import { Server, ShoppingCart, Wrench, BarChart3 } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export interface Sector {
  slug: string;
  title: string;
  description: string;
  icon: IconType;
}

export const sectors: Sector[] = [
  {
    slug: "ti",
    title: "Setor de TI",
    description: "Gerencie chamados e otimize serviços de tecnologia.",
    icon: Server,
  },
  {
    slug: "compras",
    title: "Setor de Compras",
    description: "Registre e acompanhe solicitações de compras.",
    icon: ShoppingCart,
  },
  {
    slug: "manutencao",
    title: "Setor de Manutenção",
    description: "Gerencie solicitações e acompanhe reparos.",
    icon: Wrench,
  },
  {
    slug: "bi",
    title: "Portal de BI",
    description: "Analise dados e visualize insights em dashboards.",
    icon: BarChart3,
  },
];
