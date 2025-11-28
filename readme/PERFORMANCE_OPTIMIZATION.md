c# Otimizações de Performance - Métricas SLA

## 📊 Análise do Problema

O dashboard estava lento ao carregar métricas de SLA porque executava múltiplas queries pesadas sequencialmente.

### Gargalos Identificados

#### 1. **Problema N+1 em `get_sla_compliance_24h`**

- **Antes**: Para cada chamado ativo, fazia uma chamada a `SLACalculator.get_sla_status()`
- **Impacto**: 500 chamados = 500+ queries ao banco
- **Sintoma**: Página congelava por 10+ segundos

#### 2. **Problema N+1 em `get_sla_compliance_mes`**

- **Antes**: Chamava `get_sla_config_by_priority()` para cada chamado
- **Impacto**: Múltiplas queries desnecessárias
- **Sintoma**: SLA "Este mês" demorava muito

#### 3. **Execução Sequencial no Frontend**

- **Antes**: Carregava todas as métricas em uma única chamada
- **Impacto**: Frontend bloqueado esperando métricas SLA lentas
- **Sintoma**: Usuário via loading por tempo prolongado

## ✅ Soluções Implementadas

### 1. Cache em Memória com TTL

**Arquivo**: `backend/ti/services/metrics.py`

```pythonf
class MetricsCache:
    _cache = {}
    _ttl_seconds = 30  # Cache por 30 segundos

    @classmethod
    def get(cls, key):
        # Retorna valor se ainda está válido (menor que 30s)

    @classmethod
    def set(cls, key, value):
        # Armazena com timestamp
```

**Benefício**:

- ✅ Mesma requisição em < 1s (se em cache)
- ✅ Sem overhead de rede adicional
- ✅ TTL de 30s = dados sempre frescos

### 2. Eliminação de N+1 Queries

**Arquivo**: `backend/ti/services/metrics.py`

#### Antes (❌ 500+ queries):

```python
for chamado in chamados_ativos:
    sla_status = SLACalculator.get_sla_status(db, chamado)  # Query por chamado!
```

#### Depois (✅ 2 queries):

```python
# Query 1: Carrega TODAS as configs de SLA uma vez
sla_configs = {config.prioridade: config for config in db.query(...).all()}

# Query 2: Carrega todos os chamados uma vez
chamados_ativos = db.query(Chamado).filter(...).all()

# Itera sem mais queries
for chamado in chamados_ativos:
    sla_config = sla_configs.get(chamado.prioridade)  # Dicionário, não query!
```

**Resultado**:

- ❌ Antes: ~500 queries
- ✅ Depois: 2 queries

### 3. Carregamento em Duas Etapas (Frontend)

**Arquivo**: `frontend/src/pages/sectors/ti/admin/Overview.tsx`

#### Novo fluxo:

1. **Etapa 1 (Rápida - 100ms)**: Carrega métricas básicas
   - `GET /metrics/dashboard/basic` → Instantâneo
   - Mostra: Chamados hoje, Ativos, Comparação ontem
   - Usuário vê informações imediatamente

2. **Etapa 2 (Lenta - 5s com cache, 15s sem)**: Carrega SLA
   - `GET /metrics/dashboard/sla` → Com cache
   - Mostra: SLA%, Tempo de resposta, Gráficos
   - Enquanto isso, usuário já vê dados básicos

**Benefício**:

- ✅ Percepção de velocidade: "Algo está acontecendo"
- ✅ Usuário não fica esperando tela em branco
- ✅ Melhor UX mesmo com dados lentos

### 4. Índices de Banco de Dados

**Arquivo**: `backend/ti/scripts/create_performance_indices.py`

```sql
CREATE INDEX idx_chamado_status ON chamado(status);
CREATE INDEX idx_chamado_data_abertura ON chamado(data_abertura);
CREATE INDEX idx_chamado_prioridade ON chamado(prioridade);
CREATE INDEX idx_chamado_status_data ON chamado(status, data_abertura);
CREATE INDEX idx_historico_chamado_created ON historico_status(chamado_id, created_at);
```

**Executar**:

```bash
cd backend
python -m ti.scripts.create_performance_indices
```

## 📈 Resultados Esperados

| Métrica          | Antes  | Depois     | Melhoria          |
| ---------------- | ------ | ---------- | ----------------- |
| Primeira carga   | 15-20s | 100ms + 5s | **60-80%**        |
| Segunda carga    | 15-20s | <500ms     | **95%+**          |
| Queries ao banco | 500+   | 2-3        | **99%**           |
| Uso de CPU       | Alto   | Baixo      | **Significativo** |

## 🔍 Monitoramento

### Verificar se está funcionando:

1. **Abrir DevTools (F12)**
2. **Aba Network**
3. **Recarregar página**
4. Ver chamadas:
   - ✅ `/api/metrics/dashboard/basic` → ~50-100ms
   - ✅ `/api/metrics/dashboard/sla` → ~500-1000ms (cache) / 5-15s (sem cache)

### Logs de Performance:

```python
# No backend, verificar logs para confirmar cache:
print("Cache hit rate:")
print(f"- sla_compliance_24h: X requisições")
print(f"- sla_compliance_mes: Y requisições")
```

## ⚙️ Ajustes Futuros

### Se ainda estiver lento:

1. **Aumentar TTL do cache** → `_ttl_seconds = 60` (1 minuto)
2. **Usar Redis** → Substituir `MetricsCache` por Redis para cache distribuído
3. **Pré-calcular métricas** → Usar Celery/APScheduler para calcular em background

### Se quiser dados mais frescos:

1. **Reduzir TTL** → `_ttl_seconds = 10` (10 segundos)
2. **Usar WebSocket** → Atualizar métricas em tempo real

## 📝 Checklist de Implementação

- [x] Criar `MetricsCache` class
- [x] Otimizar `get_sla_compliance_24h` (eliminar N+1)
- [x] Otimizar `get_sla_compliance_mes` (eliminar N+1)
- [x] Separar endpoints: `/dashboard/basic` e `/dashboard/sla`
- [x] Atualizar frontend para carregar em etapas
- [x] Criar script de índices
- [ ] Executar script de índices no banco
- [ ] Testar em produção
- [ ] Monitorar performance

## 🚀 Para Produção

1. **Executar script de índices**:

   ```bash
   python backend/ti/scripts/create_performance_indices.py
   ```

2. **Testar antes de deploys**:

   ```bash
   # Abra DevTools e verifique tempos de carregamento
   # GET /api/metrics/dashboard/basic deve ser < 200ms
   # GET /api/metrics/dashboard/sla deve ser < 1s (com cache)
   ```

3. **Monitorar em produção**:
   - Observar tempo de resposta dos endpoints
   - Verificar CPU durante picos de uso
   - Ajustar TTL de cache conforme necessário
