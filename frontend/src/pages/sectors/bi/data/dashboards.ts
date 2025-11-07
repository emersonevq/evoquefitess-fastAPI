export interface Dashboard {
  id: string;
  title: string;
  description: string;
  reportId: string;
  category: string;
  allowedUsers?: string[];
}

export interface DashboardCategory {
  id: string;
  name: string;
  dashboards: Dashboard[];
}

const TENANT_ID = "9f45f492-87a3-4214-862d-4c0d080aa136";

export const dashboardsData: DashboardCategory[] = [
  {
    id: "ti",
    name: "TI",
    dashboards: [
      {
        id: "analise-ocs",
        title: "Análise de OC's",
        description: "Análise detalhada de ordens de compra",
        reportId: "8799e0cf-fe55-4670-8a67-ceeee9744bc4",
        category: "ti",
        allowedUsers: ["André Santiago", "Matheus Domiciano", "Benwilson Jolo"],
      },
    ],
  },
  {
    id: "sac",
    name: "SAC",
    dashboards: [
      {
        id: "central-relacionamento",
        title: "Central de Relacionamento",
        description: "Gerenciamento de relacionamento com clientes",
        reportId: "837fb0a1-d589-4857-ad9d-44a34fb70b05",
        category: "sac",
        allowedUsers: ["Yasmin Cruz", "Regiane Queiroz"],
      },
    ],
  },
  {
    id: "comercial",
    name: "Comercial",
    dashboards: [
      {
        id: "central-vendas",
        title: "Central de Vendas",
        description: "Dashboard de vendas e performance comercial",
        reportId: "737afc5a-c604-4583-9e71-3f8e81d0f276",
        category: "comercial",
        allowedUsers: [
          "Patricia Madeira",
          "Iuri Venancio",
          "Taina Sousa",
          "Larissa Mota",
        ],
      },
      {
        id: "comercial-geral",
        title: "Comercial",
        description: "Análise geral comercial",
        reportId: "0117fd5b-b3c0-46ff-8c1e-c35ff5d4bb8d",
        category: "comercial",
        allowedUsers: [
          "Patricia Madeira",
          "Iuri Venancio",
          "Taina Sousa",
          "Larissa Mota",
        ],
      },
    ],
  },
  {
    id: "unidades",
    name: "Unidades Regionais",
    dashboards: [
      {
        id: "controle-cotas",
        title: "Controle de Cotas",
        description: "Controle e acompanhamento de cotas por unidade",
        reportId: "4bc4c1aa-b8c5-4a8a-b3a2-2417cdfb17c2",
        category: "unidades",
        allowedUsers: ["Tiago Garbe", "Benwilson Jolo"],
      },
    ],
  },
  {
    id: "contabil",
    name: "Contábil",
    dashboards: [
      {
        id: "fiscal",
        title: "Fiscal",
        description: "Análise de impostos e conformidade fiscal",
        reportId: "34adf0c5-d4ff-49ab-bffd-26eef0df797e",
        category: "contabil",
        allowedUsers: ["Henrique Vidgal", "Benwilson Jolo"],
      },
    ],
  },
  {
    id: "produtos",
    name: "Produtos",
    dashboards: [
      {
        id: "produtos-geral",
        title: "Produtos",
        description: "Gestão e análise de produtos",
        reportId: "74dc6b4a-8b03-4837-881f-37f6b2d8e6a5",
        category: "produtos",
        allowedUsers: [],
      },
    ],
  },
];

export function getPowerBIEmbedUrl(reportId: string): string {
  return `https://app.powerbi.com/reportEmbed?reportId=${reportId}&autoAuth=true&ctid=${TENANT_ID}`;
}

export function getAllDashboards(): Dashboard[] {
  return dashboardsData.flatMap((category) => category.dashboards);
}

export function getDashboardById(id: string): Dashboard | undefined {
  for (const category of dashboardsData) {
    const dashboard = category.dashboards.find((d) => d.id === id);
    if (dashboard) return dashboard;
  }
  return undefined;
}

export function getCategoryById(id: string): DashboardCategory | undefined {
  return dashboardsData.find((category) => category.id === id);
}
