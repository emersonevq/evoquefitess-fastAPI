# Sistema de SLA - Documentação de Implementação

## Visão Geral

Um sistema completo de SLA (Service Level Agreement) foi implementado no painel administrativo do setor TI. O sistema permite configurar níveis de SLA por prioridade, definir horários comerciais, e calcular automaticamente o status de SLA de cada chamado.

## Componentes Implementados

### 1. Modelos de Banco de Dados (Backend)

#### `SLAConfiguration`
- **Arquivo**: `backend/ti/models/sla_config.py`
- **Tabela**: `sla_configuration`
- Campos: prioridade, tempo_resposta_horas, tempo_resolucao_horas, descricao, ativo

#### `SLABusinessHours`
- **Arquivo**: `backend/ti/models/sla_config.py`
- **Tabela**: `sla_business_hours`
- Padrão Padrão: Segunda a sexta, 08:00 às 18:00

#### `HistoricoSLA`
- **Arquivo**: `backend/ti/models/sla_config.py`
- **Tabela**: `historico_sla`
- Rastreia todas as alterações de SLA para auditorias

### 2. Serviço de Cálculo de SLA (Backend)

#### `SLACalculator`
- **Arquivo**: `backend/ti/services/sla.py`
- Métodos principais:
  - `calculate_business_hours()`: Calcula horas de negócio
  - `get_sla_status()`: Obtém status atual de SLA
  - `record_sla_history()`: Registra alterações

### 3. API REST (Backend)

#### Endpoints de Configuração
- `GET /api/sla/config`: Lista configurações
- `POST /api/sla/config`: Cria nova configuração
- `PATCH /api/sla/config/{id}`: Atualiza
- `DELETE /api/sla/config/{id}`: Remove

#### Endpoints de Status
- `GET /api/sla/chamado/{id}/status`: Status de um chamado
- `GET /api/sla/historico/{id}`: Histórico de SLA

### 4. Interface Frontend

#### Página de Configurações de SLA
- **Arquivo**: `frontend/src/pages/sectors/ti/admin/configuracoes/SLAConfig.tsx`
- Criar, editar e deletar níveis de SLA
- Configurar horários comerciais

#### Hook de Integração
- **Arquivo**: `frontend/src/hooks/useSLAStatus.ts`
- Busca status de SLA do chamado
- Atualiza a cada 30 segundos

## Fluxo de Cálculo de SLA

### 1. Abertura de Chamado
- Data de abertura é registrada
- Status inicia como "Aberto"

### 2. Primeira Resposta
- `data_primeira_resposta` é calculada
- SLA de resposta é avaliado

### 3. Durante o Atendimento
- Status muda entre "Em andamento", "Em análise"
- Cada mudança gera registro em `HistoricoSLA`

### 4. Conclusão
- SLA de resolução final é calculado
- Histórico é registrado

## Cálculo de Horas de Negócio

O sistema calcula horas apenas durante horários comerciais configurados:

```
Segunda a Sexta: 08:00 - 18:00 (padrão)
Sábado e Domingo: Não contam
Fora do horário: Não conta
```

## Integração com Chamados

O sistema foi integrado com os endpoints de chamados:

### Ao atualizar status de chamado:
1. `PATCH /api/chamados/{id}/status` é chamado
2. Status é atualizado no banco
3. SLA é calculado
4. Histórico de SLA é registrado automaticamente

## Configuração Padrão

Se nenhuma configuração de SLA for criada, o sistema usa padrões:

```
Horários Comerciais:
- Segunda a Sexta: 08:00 - 18:00
- Sábado e Domingo: Não operacional

Sem configurações de prioridade:
- Chamados retornam status "sem_configuracao"
```

## Como Usar

### Para Administrador: Configurar SLA

1. Acessar: **Painel Administrativo → Configurações → Configurações de SLA**
2. Criar níveis de prioridade com seus limites de tempo
3. Configurar horários comerciais se diferentes do padrão
4. Salvar configurações

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
4. **Configuração Dinâmica**: Alterações de SLA afetam cálculos futuros
