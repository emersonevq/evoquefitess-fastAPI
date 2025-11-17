# Sistema de SLA - Documentação de Implementação

## Visão Geral

Um sistema completo de SLA (Service Level Agreement) foi implementado no painel administrativo do setor TI. O sistema permite configurar níveis de SLA por prioridade, definir horários comerciais, e calcular automaticamente o status de SLA de cada chamado.

## Componentes Implementados

### 1. Modelos de Banco de Dados (Backend)

#### `SLAConfiguration`

- **Arquivo**: `backend/ti/models/sla_config.py`
- **Tabela**: `sla_configuration`
- **Campos**:
  - `id`: Identificador único
  - `prioridade`: Nível de prioridade (ex: Crítico, Alto, Normal, Baixo)
  - `tempo_resposta_horas`: Tempo máximo para primeira resposta (em horas)
  - `tempo_resolucao_horas`: Tempo máximo para resolução (em horas)
  - `descricao`: Descrição da configuração
  - `ativo`: Status da configuração
  - `criado_em`, `atualizado_em`: Timestamps

#### `SLABusinessHours`

- **Arquivo**: `backend/ti/models/sla_config.py`
- **Tabela**: `sla_business_hours`
- **Campos**:
  - `id`: Identificador único
  - `dia_semana`: Dia da semana (0-4: segunda a sexta)
  - `hora_inicio`: Hora de início (HH:MM)
  - `hora_fim`: Hora de término (HH:MM)
  - `ativo`: Status
  - `criado_em`, `atualizado_em`: Timestamps

**Padrão Padrão**: Segunda a sexta, 08:00 às 18:00

#### `HistoricoSLA`

- **Arquivo**: `backend/ti/models/sla_config.py`
- **Tabela**: `historico_sla`
- **Campos**:
  - Rastreia todas as alterações de SLA para auditorias
  - `acao`: Tipo de ação (status_atualizado, etc)
  - `status_anterior`, `status_novo`: Transição de status
  - `tempo_resolucao_horas`: Tempo de resolução calculado
  - `limite_sla_horas`: Limite SLA aplicável
  - `status_sla`: Status do SLA (ok, vencido, etc)

### 2. Serviço de Cálculo de SLA (Backend)

#### `SLACalculator`

- **Arquivo**: `backend/ti/services/sla.py`
- **Responsabilidades**:
  - Calcular horas de negócio (excluindo fins de semana e fora do horário comercial)
  - Determinar status de SLA (ok, vencido, em_andamento, congelado)
  - Registrar histórico de SLA

**Métodos principais**:

1. `calculate_business_hours(start, end, db)`: Calcula horas de negócio entre duas datas
   - Exclui fins de semana (sábado e domingo)
   - Exclui horas fora do horário comercial
   - Retorna o total em horas

2. `get_sla_status(db, chamado)`: Obtém o status atual de SLA de um chamado
   - Calcula tempo de resposta e resolução
   - Compara com limites configurados
   - Retorna dicionário com métricas detalhadas

3. `record_sla_history(...)`: Registra alterações de SLA para auditoria

### 3. API REST (Backend)

#### Endpoints de Configuração

- **Prefixo**: `/api/sla`

**GET /config**: Lista todas as configurações de SLA

```
Resposta: Array[SLAConfiguration]
```

**POST /config**: Cria nova configuração de SLA

```json
{
  "prioridade": "Crítico",
  "tempo_resposta_horas": 1,
  "tempo_resolucao_horas": 4,
  "descricao": "Chamados críticos",
  "ativo": true
}
```

**PATCH /config/{config_id}**: Atualiza configuração

```json
{
  "tempo_resposta_horas": 2,
  "tempo_resolucao_horas": 8
}
```

**DELETE /config/{config_id}**: Remove configuração

#### Endpoints de Horários Comerciais

**GET /business-hours**: Lista horários comerciais

```
Resposta: Array[SLABusinessHours]
```

**POST /business-hours**: Adiciona novo horário

```json
{
  "dia_semana": 0,
  "hora_inicio": "08:00",
  "hora_fim": "18:00",
  "ativo": true
}
```

**PATCH /business-hours/{id}**: Atualiza horário

**DELETE /business-hours/{id}**: Remove horário

#### Endpoints de Status

**GET /chamado/{chamado_id}/status**: Obtém status de SLA de um chamado

```json
{
  "chamado_id": 1,
  "prioridade": "Normal",
  "status": "Em andamento",
  "tempo_resposta_horas": 1.5,
  "tempo_resposta_status": "ok",
  "tempo_resolucao_horas": 3.2,
  "tempo_resolucao_status": "em_andamento",
  ...
}
```

**GET /historico/{chamado_id}**: Lista histórico de SLA

```
Resposta: Array[HistoricoSLA]
```

### 4. Interface Frontend

#### Página de Configurações de SLA

- **Arquivo**: `frontend/src/pages/sectors/ti/admin/configuracoes/SLAConfig.tsx`
- **Localização**: Configurações → Configurações de SLA
- **Funcionalidades**:
  - Criar, editar e deletar níveis de SLA
  - Configurar horários comerciais por dia da semana
  - Interface intuitiva com diálogos modais

#### Componente de Exibição de Status

- **Arquivo**: `frontend/src/components/sla/SLAStatusBadge.tsx`
- **Componentes**:
  - `SLAStatusBadge`: Exibe status de SLA individual
  - `SLAStatusOverview`: Visão geral de resposta e resolução

**Statuses**:

- `ok`: Dentro do limite de SLA (verde)
- `vencido`: Excedeu o limite (vermelho)
- `em_andamento`: Ainda em progresso, dentro do limite (âmbar)
- `congelado`: Status "Em análise", tempo parado (azul)
- `sem_configuracao`: Sem SLA configurado (cinza)

#### Hook de Integração

- **Arquivo**: `frontend/src/hooks/useSLAStatus.ts`
- **Função**: `useSLAStatus(chamadoId)`
- **Comportamento**:
  - Busca status de SLA do chamado
  - Atualiza a cada 30 segundos
  - Integração com React Query

## Fluxo de Cálculo de SLA

### 1. Abertura de Chamado

- Data de abertura é registrada
- Status inicia como "Aberto"

### 2. Primeira Resposta

- Quando status muda de "Aberto" para outro status
- `data_primeira_resposta` é calculada
- SLA de resposta é avaliado

### 3. Durante o Atendimento

- Status muda entre "Em andamento", "Em análise", etc
- Cada mudança gera registro em `HistoricoSLA`
- Para status "Em análise": SLA é congelado (não conta tempo)

### 4. Conclusão

- Quando status muda para "Concluído" ou "Cancelado"
- SLA de resolução final é calculado
- Histórico é registrado

## Cálculo de Horas de Negócio

O sistema calcula horas apenas durante horários comerciais configurados:

```
Segunda a Sexta: 08:00 - 18:00 (padrão)
Sábado e Domingo: Não contam
Fora do horário: Não conta
```

**Exemplo**:

- Chamado aberto: Sexta 17:00
- Primeira resposta: Segunda 08:30
- Horas contabilizadas:
  - Sexta: 17:00 - 18:00 = 1 hora
  - Segunda: 08:00 - 08:30 = 0.5 hora
  - **Total: 1.5 horas**

## Integração com Chamados

O sistema foi integrado com os endpoints de chamados:

### Ao atualizar status de chamado:

1. `PATCH /api/chamados/{id}/status` é chamado
2. Status é atualizado no banco
3. SLA é calculado
4. Histórico de SLA é registrado automaticamente

### Dados registrados:

- Status anterior e novo
- Tempo de resolução
- Limite de SLA aplicável
- Status de SLA (ok/vencido)

## Configuração Padrão

Se nenhuma configuração de SLA for criada, o sistema usa padrões:

```
Horários Comerciais:
- Segunda a Sexta: 08:00 - 18:00
- Sábado e Domingo: Não operacional

Sem configurações de prioridade:
- Chamados retornam status "sem_configuracao"
- Tempo de resposta/resolução pode ser visualizado, mas não há comparação com limite
```

## Como Usar

### Para Administrador: Configurar SLA

1. Acessar: **Painel Administrativo → Configurações → Configurações de SLA**
2. Criar níveis de prioridade com seus limites de tempo
3. Configurar horários comerciais se diferentes do padrão (segunda a sexta, 08:00-18:00)
4. Salvar configurações

### Para Operador: Visualizar SLA

(A ser integrado em página de detalhes de chamado)

```tsx
import { useSLAStatus } from "@/hooks/useSLAStatus";
import { SLAStatusOverview } from "@/components/sla/SLAStatusBadge";

function ChamadoDetail({ chamadoId }) {
  const { data: slaStatus } = useSLAStatus(chamadoId);

  if (!slaStatus) return <div>Carregando...</div>;

  return (
    <SLAStatusOverview
      chamadoId={slaStatus.chamado_id}
      prioridade={slaStatus.prioridade}
      statusResposta={slaStatus.tempo_resposta_status}
      statusResolucao={slaStatus.tempo_resolucao_status}
      tempoRepostagem={slaStatus.tempo_resposta_horas}
      tempoResolucao={slaStatus.tempo_resolucao_horas}
      limiteResposta={slaStatus.tempo_resposta_limite_horas}
      limiteResolucao={slaStatus.tempo_resolucao_limite_horas}
    />
  );
}
```

## Estrutura de Pastas

```
backend/
├── ti/
│   ├── models/
│   │   └── sla_config.py (modelos)
│   ├── schemas/
│   │   └── sla.py (schemas Pydantic)
│   ├── services/
│   │   └── sla.py (lógica de cálculo)
│   └── api/
│       └── sla.py (endpoints)

frontend/
├── src/
│   ├── hooks/
│   │   └── useSLAStatus.ts (hook)
│   └── components/
│       └── sla/
│           └── SLAStatusBadge.tsx (componentes)
```

## Próximas Melhorias Sugeridas

1. **Dashboard de Métricas**: Visualizar % de SLAs cumpridos/vencidos
2. **Relatórios**: Exportar relatórios de SLA por período
3. **Alertas**: Notificar quando SLA está próximo de vencer
4. **Automação**: Escalar chamados automaticamente quando vencer SLA
5. **Integração de Email**: Enviar atualizações de SLA por email
6. **Gráficos Temporais**: Visualizar evolução do SLA ao longo do tempo

## Testes

### Teste de Cálculo de Horas de Negócio

```python
from datetime import datetime
from ti.services.sla import SLACalculator

# Sexta 17:00 até Segunda 09:00 = 2 horas
start = datetime(2024, 1, 12, 17, 0)  # Sexta
end = datetime(2024, 1, 15, 9, 0)     # Segunda
horas = SLACalculator.calculate_business_hours(start, end)
# Resultado: ~2.0 horas
```

### Teste de API

```bash
# Criar SLA
curl -X POST http://localhost:8000/api/sla/config \
  -H "Content-Type: application/json" \
  -d '{
    "prioridade": "Crítico",
    "tempo_resposta_horas": 1,
    "tempo_resolucao_horas": 4
  }'

# Obter status de chamado
curl http://localhost:8000/api/sla/chamado/1/status
```

## Notas Importantes

1. **Timezone**: O sistema usa `now_brazil_naive()` para todas as datas
2. **Desconto de Tempo**: Status "Em análise" congela o contador
3. **Histórico**: Todos os cambios são registrados para auditoria
4. **Configuração Dinâmica**: Alterações de SLA afetam cálculos futuros, não retroativos
