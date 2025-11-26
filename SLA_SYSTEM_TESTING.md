# Sistema de SLA Robusto - Guia de Testes e Validação

## 📋 Resumo das Mudanças Implementadas

### 1. **Cache Persistente em Banco de Dados**

- ✅ Novo `SLACacheManager` com persistência em `metrics_cache_db`
- ✅ TTL inteligente por tipo de métrica (5min, 15min, 2min)
- ✅ Cache em memória para performance + banco de dados para persistência
- ✅ Limpeza automática de cache expirado

### 2. **Invalidação Inteligente de Cache**

- ✅ Quando chamado é criado/alterado, cache relevante é automaticamente invalidado
- ✅ Endpoints para invalidação seletiva (`/sla/cache/invalidate-chamado/{id}`)
- ✅ Endpoints para invalidação geral (`/sla/cache/invalidate-all`)

### 3. **Pré-Aquecimento de Cache**

- ✅ Endpoint `/sla/cache/warmup` calcula todas as métricas ao abrir painel
- ✅ Hook frontend `useAutoRecalculateSLA` dispara warmup automaticamente
- ✅ Timing otimizado com paralelização de queries

### 4. **Cálculos de SLA Corrigidos**

- ✅ Sem problema N+1 (bulk loading de históricos)
- ✅ Dedução correta de tempo em "Em análise"
- ✅ Horas de negócio corretamente calculadas
- ✅ Cache aplicado em múltiplos níveis

### 5. **Validação Robusta**

- ✅ `SLAValidator` com validação de configurações
- ✅ Endpoints `/sla/validate/*` para debug
- ✅ Detecção de configurações inválidas

---

## 🧪 Teste Rápido (5 minutos)

### 1. Verificar Banco de Dados

```bash
# No MySQL/MariaDB, verificar se tabela existe:
SELECT * FROM metrics_cache_db LIMIT 5;

# Verificar se tabelas de SLA existem:
SHOW TABLES LIKE 'sla_%';
SHOW TABLES LIKE '%historico_sla%';
```

### 2. Testar Endpoints de Cache

```bash
# Pré-aquecer cache
curl -X POST http://localhost:8000/api/sla/cache/warmup

# Verificar stats do cache
curl http://localhost:8000/api/sla/cache/stats

# Invalidar todos caches
curl -X POST http://localhost:8000/api/sla/cache/invalidate-all

# Limpar cache expirado
curl -X POST http://localhost:8000/api/sla/cache/cleanup
```

### 3. Testar Validação

```bash
# Validar todas configurações de SLA
curl http://localhost:8000/api/sla/validate/all

# Validar um chamado específico
curl http://localhost:8000/api/sla/validate/chamado/1
```

### 4. Testar Frontend

1. Abrir painel administrativo (`/setor/ti/admin`)
2. Verificar no console que hook `useAutoRecalculateSLA` é chamado
3. Observar que métricas carregam mais rapidamente (com cache)
4. Criar/editar um chamado
5. Observar que cache é invalidado automaticamente

---

## 🔍 Teste Completo de Cenários

### Cenário 1: Primeiro Acesso ao Painel

**Esperado:** Cache é pré-aquecido, todas métricas calculadas

```
1. Abrir painel administrativo
2. No console browser, ver logs:
   - "[SLA] Painel administrativo aberto, iniciando cache warmup..."
   - "[CACHE] Warmup concluído: 7 métricas em XXXms"
3. Métricas aparecem na dashboard
```

**Validar com:**

```bash
# Stats deve mostrar entradas no banco
curl http://localhost:8000/api/sla/cache/stats
# Resposta esperada:
# {
#   "memory_entries": 7,
#   "database_entries": 7,
#   "expired_in_db": 0
# }
```

### Cenário 2: Criar Novo Chamado

**Esperado:** Cache é invalidado para SLA/métricas

```
1. Na página de chamados, criar novo chamado
2. Submeter formulário
3. No console backend, ver logs:
   - "[SLA SYNC] Sincronizando SLA do chamado..."
   - "[CACHE] Cache do chamado #X invalidado"
```

**Validar com:**

```bash
# Stats deve mostrar entradas removidas
curl http://localhost:8000/api/sla/cache/stats
# Entradas em memória devem ser < 7 agora (foram limpas)
```

### Cenário 3: Mudar Status de Chamado

**Esperado:** Cache é invalidado, métricas recalculadas

```
1. Abrir um chamado existente
2. Mudar status (ex: Aberto → Em Atendimento)
3. Submeter
4. Dashboard se atualiza automaticamente
5. No console: "[CACHE] Cache do chamado #X invalidado"
```

**Validar com:**

```bash
# Histórico de SLA foi criado/atualizado
curl http://localhost:8000/api/sla/historico/1
```

### Cenário 4: Modificar Configuração de SLA

**Esperado:** TODOS os caches são invalidados

```
1. Ir para Configurações → SLA
2. Modificar tempo de resposta/resolução de uma prioridade
3. Salvar
4. Todos os caches devem ser invalidados
5. Dashboard recalcula automaticamente
```

**Validar com:**

```bash
# Verificar que stats mostra 0 entradas em memória
curl http://localhost:8000/api/sla/cache/stats
# {
#   "memory_entries": 0,
#   "database_entries": 0,
#   "expired_in_db": 0
# }
```

---

## 📊 Teste de Performance

### Teste 1: Warmup Performance

```bash
# Cronometrar quanto tempo demora pré-aquecer cache
time curl -X POST http://localhost:8000/api/sla/cache/warmup

# Esperado: < 2 segundos para todas 7 métricas
```

### Teste 2: Acesso com Cache Quente

```bash
# Primeira requisição (sem cache)
time curl http://localhost:8000/api/metrics/dashboard

# Segunda requisição (com cache)
time curl http://localhost:8000/api/metrics/dashboard

# Esperado: Segunda deve ser ~10x mais rápida
```

### Teste 3: Sem Problema N+1

Verificar logs do database:

- Ao calcular SLA compliance: máximo 3-4 queries (não centenas)
- Bulk loading de históricos em 1 query em vez de 1 por chamado

---

## ✅ Checklist de Validação Completa

Executar antes de considerar "concluído":

- [ ] Tabela `metrics_cache_db` existe no banco
- [ ] Todos endpoints de cache retornam HTTP 200
- [ ] Warmup calcula em < 2 segundos
- [ ] Cache persiste em banco de dados
- [ ] Cache é invalidado ao criar/editar chamado
- [ ] Cache é invalidado ao alterar configurações de SLA
- [ ] Dashboard carrega mais rapidamente que antes
- [ ] `useAutoRecalculateSLA` dispara automaticamente
- [ ] Validação de SLA retorna configurações corretas
- [ ] Sem problemas N+1 em logs do database
- [ ] Cálculos de SLA coincidem com expected (dentro 5%)

---

## 🐛 Debugging

### Verificar Logs de Cache

```python
# No servidor Python, adicionar prints:
print("[CACHE] Operação...", key, cached_value)

# No browser console JavaScript:
console.log("[CACHE] ...", stats)
```

### Validar Cálculos de SLA

```bash
# Validar um chamado específico
curl http://localhost:8000/api/sla/validate/chamado/123

# Retorna:
# {
#   "chamado_id": 123,
#   "prioridade": "alta",
#   "status": "Em Atendimento",
#   "config_existe": true,
#   "datas": {...},
#   "datas_validas": true,
#   "datas_warnings": [],
#   "historicos_count": 5
# }
```

### Inspecionar Cache

```bash
# Ver que está armazenado em cache
curl http://localhost:8000/api/sla/cache/stats

# Ver configurações de SLA validadas
curl http://localhost:8000/api/sla/validate/all
```

---

## 📝 Notas Importantes

### Timing de Cache

- **sla_compliance_24h**: 5 minutos
- **sla_compliance_mes**: 15 minutos
- **sla_distribution**: 15 minutos
- **tempo_resposta_24h**: 5 minutos
- **tempo_resposta_mes**: 15 minutos
- **chamado_sla_status**: 2 minutos (sensível)
- **metrics_basic**: 2 minutos

### Quando Modificar TTLs

Aumentar se:

- Dashboard carrega muito devagar (aumento de TTL)
- Dados estão muito antigos (diminuir TTL)

Arquivo: `backend/ti/services/sla_cache.py` linha ~26

```python
CACHE_TTL = {
    "sla_compliance_24h": 5 * 60,  # ← Modificar aqui (em segundos)
    ...
}
```

### Como Forçar Recálcular

```bash
# Força recalcular TODOS os chamados
curl -X POST http://localhost:8000/api/sla/recalcular/painel

# Limpa cache expirado
curl -X POST http://localhost:8000/api/sla/cache/cleanup
```

---

## 🚀 Deploying

Após testes, em produção:

1. Rodar migrações para criar tabela `metrics_cache_db` se ainda não existe
2. Executar warmup inicial:
   ```bash
   curl -X POST https://seu-site.com/api/sla/cache/warmup
   ```
3. Configurar job agendado para limpeza de cache (recomendado: a cada hora)
4. Monitorar performance com `curl http://seu-site.com/api/sla/cache/stats`

---

## 📞 Suporte

Se algo não funcionar:

1. Verificar logs backend: `print()` statements
2. Verificar logs frontend: Chrome DevTools Console
3. Validar configurações: `/sla/validate/all`
4. Validar chamado: `/sla/validate/chamado/{id}`
5. Limpar cache: `POST /sla/cache/cleanup`
6. Recalcular: `POST /sla/recalcular/painel`
