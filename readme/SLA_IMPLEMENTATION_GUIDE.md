# 🎯 Sistema de SLA Robusto - Guia de Implementação

Este documento descreve a implementação completa do sistema de cálculo de SLA com cache automático e recalculação periódica.

## 📋 Visão Geral

O sistema foi projetado para:

- ✅ Calcular SLA baseado em **horário comercial** configurable
- ✅ Descontar tempo quando chamado está **"Em análise"** (pausa SLA)
- ✅ Considerar **feriados** e **fins de semana**
- ✅ Recalcular automaticamente **diariamente às 00:00**
- ✅ Fornecer **métricas agregadas** (tempo médio de resposta/resolução)
- ✅ Usar **cache robusto** para performance

## 🏗️ Arquitetura

### Componentes Principais

#### 1. **Cálculo de SLA** (`backend/ti/services/sla.py`)

- Calcula horas de negócio considerando horário comercial
- Desconta períodos em "Em análise"
- Suporta feriados

```python
# Exemplo de uso
from ti.services.sla import SLACalculator

# Calcula tempo de resposta
tempo_horas = SLACalculator.calculate_business_hours(
    start=chamado.data_abertura,
    end=chamado.data_primeira_resposta,
    db=db_session
)

# Calcula tempo de resolução (descontando "Em análise")
tempo_resolucao = SLACalculator.calculate_business_hours_excluding_paused(
    chamado_id=chamado.id,
    start=chamado.data_abertura,
    end=chamado.data_conclusao,
    db=db_session
)

# Obtém status geral do SLA
sla_status = SLACalculator.get_sla_status(db_session, chamado)
```

#### 2. **Agendador Automático** (`backend/ti/services/sla_scheduler.py`)

- Roda em thread separada
- Executa recalculação automaticamente **todos os dias às 00:00** (horário de Brasília)
- Pré-aquece o cache com métricas principais
- Inicializado automaticamente na startup da aplicação

```python
# Inicializado em backend/main.py
from ti.services.sla_scheduler import init_scheduler

init_scheduler()  # Inicia o scheduler automático
```

#### 3. **Script de Recalculação** (`backend/ti/scripts/recalculate_sla_complete.py`)

- Recalcula SLA de **todos** os chamados existentes
- Calcula estatísticas agregadas (tempo médio, compliance)
- Pode ser executado manualmente quando necessário

```bash
# Executar manualmente
python -m ti.scripts.recalculate_sla_complete

# Ou via API (gatilho manual)
POST /api/sla/scheduler/recalcular-agora
```

#### 4. **Sistema de Cache** (`backend/ti/services/sla_cache.py`)

- Cache em memória com TTL
- Cache em banco de dados para persistência
- Invalidação inteligente de caches relacionados

#### 5. **Status de SLA** (`backend/ti/services/sla_status.py`)

Estados mutuamente exclusivos:

| Estado             | Descrição                                |
| ------------------ | ---------------------------------------- |
| **CUMPRIDO**       | Chamado fechado dentro do SLA            |
| **VIOLADO**        | Chamado fechado fora do SLA              |
| **DENTRO_PRAZO**   | Aberto, tempo < 80% do limite            |
| **PROXIMO_VENCER** | Aberto, tempo 80-100% do limite          |
| **VENCIDO_ATIVO**  | Aberto, tempo > 100% do limite           |
| **PAUSADO**        | Em status "Aguardando" (não conta tempo) |
| **SEM_SLA**        | Sem configuração de SLA                  |

## 🔧 Configuração

### 1. Configurar Horários Comerciais

Via UI em `/admin/configuracoes/sla`:

- Abra a seção "Horários Comerciais"
- Clique em "Adicionar Horário" para cada dia da semana
- Configure o intervalo de horário (ex: 08:00 - 18:00)
- Salve as alterações

Via API:

```bash
# Listar horários configurados
GET /api/sla/business-hours

# Criar novo horário
POST /api/sla/business-hours
{
  "dia_semana": 0,  // 0=segunda, 1=terça, ..., 6=domingo
  "hora_inicio": "08:00",
  "hora_fim": "18:00",
  "ativo": true
}

# Editar horário
PATCH /api/sla/business-hours/{id}
{
  "hora_inicio": "08:30",
  "hora_fim": "18:30",
  "ativo": true
}

# Deletar horário
DELETE /api/sla/business-hours/{id}
```

### 2. Configurar Feriados

Via UI em `/admin/configuracoes/sla`:

- Abra a seção "Feriados"
- Clique em "Adicionar Feriado"
- Configure data, nome e descrição

Via API:

```bash
# Listar feriados
GET /api/sla/feriados

# Criar feriado
POST /api/sla/feriados
{
  "data": "2024-12-25",
  "nome": "Natal",
  "descricao": "Feriado nacional",
  "ativo": true
}

# Editar feriado
PATCH /api/sla/feriados/{id}
{
  "nome": "Natal",
  "descricao": "Feriado nacional",
  "ativo": true
}

# Deletar feriado
DELETE /api/sla/feriados/{id}
```

### 3. Configurar Níveis de SLA

Via UI em `/admin/configuracoes/sla`:

- Abra a seção "Níveis de SLA e Prioridades"
- Clique em "Adicionar SLA"
- Configure prioridade, tempo de resposta, tempo de resolução

Via API:

```bash
# Listar configurações
GET /api/sla/config

# Criar configuração
POST /api/sla/config
{
  "prioridade": "Crítico",
  "tempo_resposta_horas": 1.0,
  "tempo_resolucao_horas": 4.0,
  "descricao": "Crítico - afeta múltiplos usuários",
  "ativo": true
}

# Editar configuração
PATCH /api/sla/config/{id}
{
  "tempo_resposta_horas": 1.5,
  "tempo_resolucao_horas": 5.0,
  "ativo": true
}

# Deletar configuração
DELETE /api/sla/config/{id}
```

## 📊 APIs de Métricas

### 1. Obter Tempo Médio de Resposta

```bash
GET /api/sla/metrics/tempo-medio-resposta

Resposta:
{
  "tempo_medio_resposta_24h": "2.5h",
  "tempo_medio_resposta_mes": "3.2h"
}
```

### 2. Obter Tempo Médio de Resolução

```bash
GET /api/sla/metrics/tempo-medio-resolucao

Resposta:
{
  "tempo_medio_resolucao_24h": 8.45,
  "tempo_medio_resolucao_mes": 12.30,
  "chamados_24h": 15,
  "chamados_mes": 127
}
```

### 3. Obter Status de SLA de um Chamado

```bash
GET /api/sla/chamado/{chamado_id}/status

Resposta:
{
  "chamado_id": 123,
  "status_chamado": "Em andamento",
  "resposta_metric": {
    "tempo_decorrido_horas": 2.5,
    "tempo_limite_horas": 4.0,
    "percentual_consumido": 62.5,
    "status": "dentro_prazo"
  },
  "resolucao_metric": {
    "tempo_decorrido_horas": 5.0,
    "tempo_limite_horas": 24.0,
    "percentual_consumido": 20.8,
    "status": "dentro_prazo"
  },
  "status_geral": "dentro_prazo"
}
```

### 4. Recalcular SLA Manualmente

```bash
POST /api/sla/scheduler/recalcular-agora

Resposta:
{
  "ok": true,
  "recalculados": 157,
  "com_erro": 0,
  "tempo_medio_resposta_horas": 2.45,
  "tempo_medio_resolucao_horas": 8.67
}
```

### 5. Invalidar Cache

```bash
# Invalidar cache de um chamado específico
POST /api/sla/cache/invalidate-chamado/{chamado_id}

# Invalidar TODOS os caches de SLA
POST /api/sla/cache/invalidate-all

# Pré-aquecer cache (precompute principais métricas)
POST /api/sla/cache/warmup

# Obter estatísticas de cache
GET /api/sla/cache/stats

# Limpar caches expirados
POST /api/sla/cache/cleanup
```

## 🔄 Fluxo de Operação

### Situação 1: Chamado Aberto Durante Horário Comercial

```
2024-01-15 09:00 → Chamado aberto (segunda-feira, 09:00)
                   ✅ Começa a contar SLA

2024-01-15 17:00 → Fim do expediente
                   ⏸️  Pausa o contagem

2024-01-16 08:00 → Início do expediente
                   ✅ Retoma contagem
```

### Situação 2: Chamado Pausa em "Em Análise"

```
2024-01-15 10:00 → Status muda para "Em análise"
                   ⏸️  Pausa contagem de SLA

2024-01-16 11:00 → Status muda para "Em andamento"
                   ✅ Retoma contagem (descontar 24h)
```

### Situação 3: Recalculação Automática

```
Diariamente às 00:00 (horário Brasil):
1. Scheduler ativa
2. Recalcula SLA de TODOS os chamados
3. Atualiza cache de métricas
4. Registra logs da execução
5. Próxima execução no dia seguinte
```

## 🧪 Testes e Validação

### Executar Validação do Sistema

```bash
python backend/ti/scripts/validate_sla_system.py
```

Output esperado:

```
✓ Tabela 'sla_configuration' existe e está acessível
✓ Tabela 'sla_business_hours' existe e está acessível
✓ Tabela 'metrics_cache_db' existe e está acessível
✓ Tabela 'historico_sla' existe e está acessível
✓ Tabela 'chamado' existe e está acessível
✓ Sistema de SLA válido com 4 configurações
✓ Cache set executado
✓ Cache get retornou valor correto
✓ Cache invalidation funcionou corretamente
✓ Cache stats: 0 em memória, 0 no BD
...
✓ TODOS OS TESTES PASSARAM! Sistema de SLA está pronto para produção.
```

### Executar Sincronização Inicial

```bash
python backend/ti/scripts/sync_chamados_sla.py
```

Output esperado:

```
🔄 Iniciando sincronização de chamados com SLA...
========================================================================

📋 Etapa 1: Verificando e criando configurações de SLA padrão...
   ✅ Configurações de SLA criadas: 4
   ✅ Horários comerciais criados: 5

📊 Etapa 2: Sincronizando chamados com histórico de SLA...
   ✅ Sincronização concluída!
   Total de chamados: 250
   Sincronizados: 245
   Já sincronizados: 5
   Sem configuração de SLA: 0
   Erros: 0
```

### Executar Recalculação Completa

```bash
python backend/ti/scripts/recalculate_sla_complete.py
```

Output esperado:

```
================================================================================
RECALCULANDO SLA DE TODOS OS CHAMADOS
================================================================================

📊 Total de chamados para recalcular: 250
⚙️  Configurações de SLA encontradas: 4
⏳ Processando: 10/250...
⏳ Processando: 20/250...
...
⏳ Processando: 250/250...

================================================================================
📈 ESTATÍSTICAS DE RECALCULAÇÃO
================================================================================
✅ Total de chamados: 250
✅ Recalculados: 250
❌ Com erro: 0

⏱️  Tempo médio de resposta: 3.45h
⏱️  Tempo médio de resolução: 12.67h

📊 Chamados dentro do SLA (resposta): 220
📊 Chamados dentro do SLA (resolução): 198
================================================================================
```

## 📝 Logs e Monitoramento

O scheduler registra logs em `~/.python_logs/` ou via stdout:

```
INFO: SLA Scheduler iniciado
INFO: 🔄 Iniciando recalculação automática de SLA em 2024-01-15 00:00:00
INFO: ✅ Recalculação de SLA concluída: 250 recalculados, 0 com erro. Tempo médio de resposta: 3.45h, Tempo médio de resolução: 12.67h
INFO: ✅ Cache aquecido com métricas principais
```

## 🐛 Troubleshooting

### Problema: SLA não está sendo calculado

**Solução:**

1. Verifique se há configuração de SLA para a prioridade do chamado
2. Execute `/api/sla/validate/all` para validar configurações
3. Verifique se horários comerciais estão configurados
4. Chame `/api/sla/scheduler/recalcular-agora` para forçar recalculação

### Problema: Cache não está sendo atualizado

**Solução:**

1. Verifique logs do scheduler
2. Limpe o cache: `POST /api/sla/cache/cleanup`
3. Pré-aqueça o cache: `POST /api/sla/cache/warmup`
4. Valide o sistema: `python validate_sla_system.py`

### Problema: Tempo médio de resposta está errado

**Solução:**

1. Verifique se `data_primeira_resposta` está preenchido nos chamados
2. Verifique se horários comerciais incluem todos os dias necessários
3. Verifique se feriados estão configurados corretamente
4. Execute recalculação: `POST /api/sla/scheduler/recalcular-agora`

## 📚 Referência de Schemas

### SLAConfiguration

```typescript
{
  id: number;
  prioridade: string; // "Crítico", "Alto", "Normal", "Baixo"
  tempo_resposta_horas: number; // 1.0, 2.0, 4.0, 8.0
  tempo_resolucao_horas: number; // 4.0, 8.0, 24.0, 48.0
  descricao: string | null;
  ativo: boolean;
  criado_em: datetime;
  atualizado_em: datetime;
}
```

### SLABusinessHours

```typescript
{
  id: number;
  dia_semana: number; // 0=segunda, 1=terça, ..., 6=domingo
  hora_inicio: string; // "08:00"
  hora_fim: string; // "18:00"
  ativo: boolean;
  criado_em: datetime;
  atualizado_em: datetime;
}
```

### SLAFeriado

```typescript
{
  id: number;
  data: string; // "2024-12-25"
  nome: string; // "Natal"
  descricao: string | null;
  ativo: boolean;
  criado_em: datetime;
  atualizado_em: datetime;
}
```

## 🎓 Melhores Práticas

1. **Sempre configure horários comerciais** antes de usar SLA
2. **Configure feriados** no início do ano para precisão
3. **Use prioridades padronizadas**: Crítico, Alto, Normal, Baixo
4. **Verifique métricas regularmente** via painel administrativo
5. **Teste em staging** antes de modificar configurações em produção
6. **Monitore logs** do scheduler para detectar problemas
7. **Recalcule periodicamente** em caso de mudanças de prioridade

## 📞 Suporte

Para problemas ou dúvidas:

1. Verifique os logs do scheduler
2. Execute `validate_sla_system.py` para diagnóstico
3. Consulte a seção Troubleshooting acima
4. Abra issue no repositório com logs e contexto
