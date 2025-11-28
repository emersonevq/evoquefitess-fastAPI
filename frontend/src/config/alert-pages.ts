/**
 * Mapeamento de todas as páginas disponíveis no sistema
 * Usado para configurar em quais páginas os alertas serão exibidos
 */

export const ALERT_PAGES = {
  // Páginas públicas
  home: {
    id: "home",
    label: "Página Inicial",
    path: "/",
    category: "Públicas",
  },
  login: {
    id: "login",
    label: "Página de Login",
    path: "/login",
    category: "Públicas",
  },
  forgotPassword: {
    id: "forgotPassword",
    label: "Recuperar Senha",
    path: "/auth/forgot-password",
    category: "Públicas",
  },
  changePassword: {
    id: "changePassword",
    label: "Alterar Senha",
    path: "/auth/change-password",
    category: "Autenticação",
  },
  resetPasswordSuccess: {
    id: "resetPasswordSuccess",
    label: "Senha Resetada",
    path: "/auth/reset-password-success",
    category: "Autenticação",
  },
  accessDenied: {
    id: "accessDenied",
    label: "Acesso Negado",
    path: "/access-denied",
    category: "Erros",
  },

  // Setores
  sectorTI: {
    id: "sectorTI",
    label: "Setor de TI",
    path: "/setor/ti",
    category: "Setores",
  },
  sectorBI: {
    id: "sectorBI",
    label: "Portal de BI",
    path: "/setor/bi",
    category: "Setores",
  },
  sectorCompras: {
    id: "sectorCompras",
    label: "Setor de Compras",
    path: "/setor/compras",
    category: "Setores",
  },
  sectorManutencao: {
    id: "sectorManutencao",
    label: "Setor de Manutenção",
    path: "/setor/manutencao",
    category: "Setores",
  },
  sectorFinanceiro: {
    id: "sectorFinanceiro",
    label: "Setor Financeiro",
    path: "/setor/financeiro",
    category: "Setores",
  },
  sectorMarketing: {
    id: "sectorMarketing",
    label: "Setor de Marketing",
    path: "/setor/marketing",
    category: "Setores",
  },
  sectorProdutos: {
    id: "sectorProdutos",
    label: "Setor de Produtos",
    path: "/setor/produtos",
    category: "Setores",
  },
  sectorComercial: {
    id: "sectorComercial",
    label: "Setor Comercial",
    path: "/setor/comercial",
    category: "Setores",
  },
  sectorOutrosServicos: {
    id: "sectorOutrosServicos",
    label: "Outros Serviços",
    path: "/setor/outros-servicos",
    category: "Setores",
  },

  // Admin - TI
  tiAdminOverview: {
    id: "tiAdminOverview",
    label: "Dashboard Admin TI",
    path: "/setor/ti/admin/overview",
    category: "Admin TI",
  },
  tiAdminChamados: {
    id: "tiAdminChamados",
    label: "Gestão de Chamados",
    path: "/setor/ti/admin/chamados",
    category: "Admin TI",
  },
  tiAdminUsuarios: {
    id: "tiAdminUsuarios",
    label: "Gestão de Usuários",
    path: "/setor/ti/admin/usuarios",
    category: "Admin TI",
  },
  tiAdminMonitoramento: {
    id: "tiAdminMonitoramento",
    label: "Monitoramento",
    path: "/setor/ti/admin/monitoramento",
    category: "Admin TI",
  },
  tiAdminHistorico: {
    id: "tiAdminHistorico",
    label: "Histórico",
    path: "/setor/ti/admin/historico",
    category: "Admin TI",
  },
  tiAdminIntegracoes: {
    id: "tiAdminIntegracoes",
    label: "Integrações",
    path: "/setor/ti/admin/integracoes",
    category: "Admin TI",
  },
  tiAdminConfiguracoes: {
    id: "tiAdminConfiguracoes",
    label: "Configurações",
    path: "/setor/ti/admin/configuracoes",
    category: "Admin TI",
  },
} as const;

export type AlertPageId = keyof typeof ALERT_PAGES;

/**
 * Agrupa páginas por categoria
 */
export const groupPagesByCategory = () => {
  const grouped = Object.values(ALERT_PAGES).reduce(
    (acc, page) => {
      if (!acc[page.category]) {
        acc[page.category] = [];
      }
      acc[page.category].push(page);
      return acc;
    },
    {} as Record<string, (typeof ALERT_PAGES)[AlertPageId][]>,
  );

  return grouped;
};

/**
 * Verifica se a página atual deve mostrar um alerta
 */
export const shouldShowAlertOnPage = (
  alertPages: string[] | null | undefined,
  currentPath: string,
): boolean => {
  // Se não houver páginas configuradas, mostrar em todas
  if (!alertPages || alertPages.length === 0) {
    return true;
  }

  // Verificar se a página atual está na lista
  return alertPages.some((pageId) => {
    const page = ALERT_PAGES[pageId as AlertPageId];
    if (!page) return false;

    // Comparação exata de caminho
    if (currentPath === page.path) return true;

    // Comparação com rota dinâmica (ex: /setor/:slug)
    const pathParts = currentPath.split("/");
    const pageParts = page.path.split("/");

    if (pathParts.length === pageParts.length) {
      return pathParts.every(
        (part, idx) =>
          pageParts[idx] === part || pageParts[idx]?.startsWith(":"),
      );
    }

    return false;
  });
};
