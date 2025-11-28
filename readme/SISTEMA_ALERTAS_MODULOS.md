# Sistema de Alertas com Direcionamento por Módulos

## Descrição Geral

Foi implementado um novo sistema de alertas completo que permite:

1. **Criar alertas com diferentes níveis de severidade** (Baixa, Média, Alta, Crítica)
2. **Direcionar alertas para módulos/páginas específicos** - Os alertas aparecem apenas nos módulos selecionados
3. **Exibir na página inicial** - Opção de mostrar o alerta na tela de boas-vindas
4. **Rastreamento de visualizações** - O sistema registra quem viu cada alerta e quando
5. **Adicionar imagens aos alertas** - Suporte a imagens em base64
6. **Descartar alertas persistentemente** - Alertas descartados não aparecem novamente

## Componentes Implementados

### Backend (Python/FastAPI)

#### Modelo: `Alert` (backend/ti/models/alert.py)
- `id` - ID único do alerta
- `title` - Título do alerta (obrigatório)
- `message` - Mensagem do alerta (obrigatório)
- `description` - Descrição adicional (opcional)
- `severity` - Nível: 'low', 'medium', 'high', 'critical'
- `pages` - Lista JSON de IDs de páginas onde exibir
- `show_on_home` - Boolean para mostrar na página inicial
- `created_by` - ID do usuário que criou o alerta
- `created_at` / `updated_at` - Timestamps
- `ativo` - Soft delete (false = inativo)
- `imagem_blob` / `imagem_mime_type` - Armazenamento de imagem

#### Modelo: `AlertView` (backend/ti/models/alert.py)
- Rastreia visualizações de alertas por usuário
- `alert_id` - FK para Alert
- `user_id` - FK para User
- `viewed_at` - Timestamp da visualização

#### API Endpoints (backend/ti/api/alerts.py)

```
GET /api/alerts
- Lista todos os alertas ativos
- Query param: user_id (opcional) - para marcar quais o usuário viu
- Retorna: Array de alertas com campo "viewed" indicando se o usuário viu

POST /api/alerts
- Cria novo alerta
- Form fields:
  - title (obrigatório)
  - message (obrigatório)
  - description (opcional)
  - severity ('low', 'medium', 'high', 'critical')
  - pages_json (JSON string da lista de IDs de páginas)
  - show_on_home (true/false)
  - imagem (arquivo de imagem, opcional)

PUT /api/alerts/{alert_id}
- Atualiza um alerta existente
- Mesmos fields opcionais do POST

POST /api/alerts/{alert_id}/view
- Marca alerta como visto pelo usuário
- Query param: user_id (obrigatório)
- Impede que o alerta seja mostrado novamente para este usuário

DELETE /api/alerts/{alert_id}
- Remove alerta (soft delete)

GET /api/alerts/{alert_id}/imagem
- Retorna imagem do alerta como stream
```

### Frontend (React/TypeScript)

#### AdminConfig: `AlertsConfig.tsx`
- Local: `frontend/src/pages/sectors/ti/admin/configuracoes/AlertsConfig.tsx`
- Interface para criar e gerenciar alertas
- Seleção de módulos/páginas com categorias
- Upload de imagens
- Visualização de alertas existentes

#### Display: `AlertsDisplay.tsx`
- Local: `frontend/src/components/alerts/AlertsDisplay.tsx`
- Exibe alertas filtrados pela página atual
- Rastreia visualizações automaticamente
- Suporta dismiss de alertas com localStorage
- Responsivo e acessível

#### Config: `alert-pages.ts`
- Local: `frontend/src/config/alert-pages.ts`
- Mapa centralizado de todas as páginas do sistema
- Funções helper para verificar se alerta deve aparecer em uma página

## Como Usar

### 1. Criar um Alerta

1. Acesse: **Setor de TI > Admin > Configurações > Alertas do Sistema**
2. Preencha os campos:
   - **Título**: Obrigatório
   - **Mensagem**: Obrigatório
   - **Descrição**: Opcional (aparece em itálico)
   - **Nível de Severidade**: Escolha entre Baixa, Média, Alta ou Crítica
   - **Onde o alerta deve aparecer?**: Selecione os módulos/páginas
     - Se nenhum for selecionado, o alerta aparece em TODAS as páginas (exceto home)
   - **Exibir na página inicial**: Marque para mostrar na tela de boas-vindas
   - **Imagem**: Opcional (PNG, JPG, WEBP até 5MB)
3. Clique em **Criar Alerta**

### 2. Ver Alertas

Os alertas aparecem automaticamente:
- **Na página inicial**: Se "Exibir na página inicial" estiver marcado
- **Nos módulos selecionados**: Quando o usuário acessa esses módulos
- Os alertas são fixos no topo da página
- Clique no botão "Fechar" para descartar

### 3. Gerenciar Alertas

- Na seção "Alertas Ativos" você vê todos os alertas criados
- Cada alerta mostra:
  - Título e mensagem
  - Nível de severidade
  - Badge "Página Inicial" se for exibido na home
  - Lista de módulos onde aparece
  - Data de criação
- Clique no ícone de lixeira para remover

## Estrutura de Dados - Exemplo

```json
{
  "id": 1,
  "title": "Manutenção Programada",
  "message": "O sistema estará em manutenção das 22h às 23h",
  "description": "Atualizações de segurança",
  "severity": "high",
  "pages": ["sectorTI", "sectorBI"],
  "show_on_home": true,
  "created_by": 5,
  "created_at": "2024-11-28T14:30:00Z",
  "updated_at": "2024-11-28T14:30:00Z",
  "ativo": true,
  "viewed": false,
  "imagem_mime_type": "image/jpeg",
  "imagem_blob": "base64string..."
}
```

## IDs de Páginas Disponíveis

**Públicas:**
- `home` - Página Inicial
- `login` - Página de Login
- `forgotPassword` - Recuperar Senha
- `changePassword` - Alterar Senha
- `accessDenied` - Acesso Negado

**Setores:**
- `sectorTI` - Setor de TI
- `sectorBI` - Portal de BI
- `sectorCompras` - Setor de Compras
- `sectorManutencao` - Setor de Manutenção
- `sectorFinanceiro` - Setor Financeiro
- `sectorMarketing` - Setor de Marketing
- `sectorProdutos` - Setor de Produtos
- `sectorComercial` - Setor Comercial
- `sectorOutrosServicos` - Outros Serviços

**Admin TI:**
- `tiAdminOverview` - Dashboard Admin TI
- `tiAdminChamados` - Gestão de Chamados
- `tiAdminUsuarios` - Gestão de Usuários
- `tiAdminMonitoramento` - Monitoramento
- `tiAdminHistorico` - Histórico
- `tiAdminIntegracoes` - Integrações
- `tiAdminConfiguracoes` - Configurações

## Rastreamento de Visualizações

O sistema registra quando um usuário vê um alerta pela primeira vez na tabela `alert_view`:

```sql
SELECT * FROM alert_view 
WHERE alert_id = 1 AND user_id = 5;
```

Isso impede que o alerta seja mostrado repetidamente:
- ✅ Na primeira visita: Alerta é exibido e marcado como visto
- ✅ Na segunda visita: Alerta ainda aparece, mas o sistema sabe que já foi visto
- ❌ Depois de descartar: Alerta não aparece mais (localStorage)

## Problemas Conhecidos e Solução

### Backend não inicia
Se o backend não iniciar corretamente:

1. **Instale as dependências:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Execute o servidor:**
   ```bash
   python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Crie as tabelas (se necessário):**
   ```python
   from core.db import engine
   from ti.models.alert import Alert, AlertView
   Alert.__table__.create(bind=engine, checkfirst=True)
   AlertView.__table__.create(bind=engine, checkfirst=True)
   ```

### Alertas não aparecem
- Verifique se as páginas selecionadas correspondem aos IDs em `alert-pages.ts`
- Verifique se o campo `ativo` está como `true`
- Verifique o console do navegador para erros

### Imagens não carregam
- Verifique se o MIME type está correto
- Tamanho máximo: 5MB
- Formatos suportados: PNG, JPG, WEBP

## Próximos Passos (Futuro)

- [ ] Agendamento de alertas (data/hora de início e fim)
- [ ] Alertas recorrentes (diário, semanal, etc)
- [ ] Notificações por email para alertas críticos
- [ ] Dashboard de estatísticas de visualizações
- [ ] Templates de alertas pré-definidos
- [ ] Permissões granulares para criar/editar alertas
