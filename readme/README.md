# Evoque Fitness - Sistema Interno

Sistema de gestão interno da Evoque Fitness com frontend React e backend Express organizados em monorepo.

## 🏗️ Estrutura do Projeto

```
├── frontend/                 # Aplicação React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # Componentes UI essenciais
│   │   │   └── layout/      # Componentes de layout
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── hooks/           # React hooks customizados
│   │   ├── lib/            # Utilitários
│   │   └── data/           # Dados estáticos
│   └── package.json
│
├── backend/                 # API Express
│   ├── src/
│   │   ├── routes/         # Rotas da API
│   │   ├── middleware/     # Middlewares
│   │   └── utils/          # Utilitários do backend
│   ├── shared/             # Tipos compartilhados
│   └── package.json
│
└── package.json            # Workspace raiz
```

## 🚀 Scripts Disponíveis

### Desenvolvimento

```bash
pnpm dev                    # Inicia frontend (3000) + backend (8000)
pnpm dev:frontend          # Apenas frontend
pnpm dev:backend           # Apenas backend
```

### Build & Deploy

```bash
pnpm build                 # Build completo
pnpm build:frontend        # Build apenas frontend
pnpm build:backend         # Build apenas backend
pnpm start                 # Inicia backend em produção
```

### Utilitários

```bash
pnpm install:all           # Instala deps em todos os projetos
pnpm typecheck            # TypeScript check completo
pnpm test                 # Executa todos os testes
pnpm clean                # Remove node_modules e dist
```

## 🎯 Tech Stack

### Frontend

- **React 18** + **TypeScript**
- **Vite** para build e dev server
- **React Router 6** para roteamento SPA
- **TailwindCSS** para estilização
- **Radix UI** componentes acessíveis
- **React Query** para gerenciamento de estado
- **Framer Motion** para animações

### Backend

- **Node.js** + **Express**
- **TypeScript**
- **Zod** para validação
- **CORS** habilitado
- **Hot reload** com tsx

## 📦 Componentes UI Essenciais

Mantidos apenas os componentes realmente utilizados:

- `button`, `input`, `label` (auth, forms)
- `dialog`, `sheet` (modals)
- `card`, `select` (dashboard)
- `dropdown-menu` (navegação)
- `toast`, `sonner`, `tooltip` (feedback)
- `separator`, `skeleton` (layout)

## 🔧 Configuração

1. **Instalar dependências:**

```bash
pnpm install:all
```

2. **Iniciar desenvolvimento:**

```bash
pnpm dev
```

3. **Acessar:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/api

## 🎨 Funcionalidades

- ✅ Sistema de login/autenticação
- ✅ Recuperação de senha
- ✅ Dashboard por setores
- ✅ Área administrativa (TI)
- ✅ Gestão de chamados
- ✅ Configurações do sistema
- ✅ Tema dark/light (Evoque branding)

## 📁 Limpeza Realizada

- ❌ Removidos 30+ componentes UI não utilizados
- ❌ Diretório `client/` antigo removido
- ❌ Diretório `server/` antigo removido
- ✅ Estrutura modular e organizada
- ✅ Separação clara frontend/backend
- ✅ Dependências otimizadas
