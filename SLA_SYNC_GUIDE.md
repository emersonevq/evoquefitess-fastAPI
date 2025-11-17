# 📋 Guia de Sincronização e Recálculo de SLA

## 🎯 Objetivo

Este documento explica como sincronizar chamados existentes com a tabela de SLA e mantê-la sempre atualizada com os cálculos mais recentes.

---

## 🔄 Fluxo de Sincronização

### 1️⃣ **Sincronização Inicial** (Executada uma única vez)

Quando você criar as primeiras configurações de SLA, precisa sincronizar todos os chamados existentes:

#### Via Interface (Recomendado)

1. Acesse: **Painel Administrativo → Configurações → Sincronizar SLA**
2. Clique em "**Sincronizar Todos os Chamados**"
3. Aguarde a conclusão
4. Verifique os resultados

#### Via API (Linha de comando)

```bash
curl -X POST http://localhost:8000/api/sla/sync/todos-chamados
```

**O que acontece:**

- ✅ Verifica cada chamado existente
- ✅ Cria histórico inicial de SLA (se não existir)
- ✅ Calcula métricas de tempo decorrido
- ✅ Avalia status SLA (ok/vencido/etc)
- ✅ Registra em `historico_sla` para auditoria

**Resultado esperado:**

```json
{
  "total_chamados": 150,
  "sincronizados": 145,
  "atualizados": 5,
  "erros": 0
}
```

---

### 2️⃣ **Sincronização Automática** (Contínua)

Após a sincronização inicial, **cada mudança de chamado** é sincronizada automaticamente:

#### Quando um chamado é criado:

```python
# Em /api/chamados (POST)
ch = service_criar(db, payload)
_sincronizar_sla(db, ch)  # ← Automático!
```

#### Quando o status de um chamado é atualizado:

```python
# Em /api/chamados/{id}/status (PATCH)
ch.status = novo
_sincronizar_sla(db, ch, status_anterior=prev)  # ← Automático!
```

**Dados registrados:**

- ID do chamado
- Status anterior e novo
- Tempo de resposta (horas)
- Tempo de resolução (horas)
- Status de SLA (ok/vencido/congelado)

---

### 3️⃣ **Recálculo ao Acessar Painel** (Automático)

Sempre que o painel administrativo é acessado, os SLAs são **recalculados automaticamente**:

#### Como funciona:

```typescript
// Em AdminLayout.tsx
const { isLoading: isSyncingData } = useSLASync();

useEffect(() => {
  // Recalcula todos os SLAs ao carregar o painel
  console.log("SLAs recalculados");
}, [isSyncingData]);
```

#### O que recalcula:

- Tempo decorrido desde abertura até agora
- Comparação com limites de SLA configurados
- Status atual (ok/vencido/em_andamento/congelado)
- Impacto de mudanças recentes nas configurações de SLA

---

### 4️⃣ **Recálculo Manual** (Sob demanda)

Use quando alterar as configurações de SLA e quiser atualizar imediatamente:

#### Via Interface

1. Acesse: **Painel Administrativo → Configurações → Sincronizar SLA**
2. Clique em "**Recalcular SLAs**"
3. Aguarde a conclusão

#### Via API

```bash
curl -X POST http://localhost:8000/api/sla/recalcular/painel
```

**Resultado esperado:**

```json
{
  "total_recalculados": 150,
  "em_dia": 120,
  "vencidos": 15,
  "em_andamento": 10,
  "congelados": 5,
  "erros": 0
}
```

---

## 📊 Estrutura de Dados

### Tabela `chamado`

Contém os chamados originais com informações básicas:

```sql
- id, codigo, protocolo
- status (Aberto, Em andamento, Em análise, Concluído, Cancelado)
- data_abertura, data_primeira_resposta, data_conclusao
- prioridade
```

### Tabela `historico_sla`

Registra todas as alterações de SLA para auditoria:

```sql
- id, chamado_id, usuario_id
- acao (sincronizacao, status_atualizado, recalculo_painel)
- status_anterior, status_novo
- tempo_resolucao_horas, limite_sla_horas
- status_sla (ok, vencido, em_andamento, congelado)
- criado_em
```

---

## 🔀 Cenários de Sincronização

### Cenário 1: Novo Chamado é Aberto

```
1. POST /api/chamados → Chamado criado com status "Aberto"
2. _sincronizar_sla() → Registra em historico_sla
3. status_sla = "em_andamento" (não há resposta ainda)
```

### Cenário 2: Status do Chamado é Alterado

```
1. PATCH /api/chamados/123/status → Status muda para "Em andamento"
2. data_primeira_resposta = agora
3. _sincronizar_sla() → Registra com novo status
4. status_sla = "ok" ou "vencido" (compara com limite de resposta)
```

### Cenário 3: Chamado é Concluído

```
1. PATCH /api/chamados/123/status → Status muda para "Concluído"
2. data_conclusao = agora
3. _sincronizar_sla() → Calcula tempo total
4. tempo_resolucao_horas = horas entre abertura e conclusão
5. status_sla = "ok" ou "vencido" (compara com limite de resolução)
```

### Cenário 4: Mudança na Configuração de SLA

```
1. Edita tempo_resposta_horas de 2 para 4 horas
2. Clica "Recalcular SLAs"
3. POST /api/sla/recalcular/painel
4. Todos os chamados são reavaliados com novo limite
5. Alguns podem mudar de "vencido" para "ok"
```

---

## 🔧 Função de Sincronização

### Código da função auxiliar:

```python
def _sincronizar_sla(db: Session, chamado: Chamado, status_anterior: str | None = None) -> None:
    """
    Sincroniza um chamado com a tabela de histórico de SLA.
    Deve ser chamada sempre que um chamado é criado ou atualizado.
    """
    try:
        # Calcula status de SLA atual
        sla_status = SLACalculator.get_sla_status(db, chamado)

        # Procura por histórico existente
        existing = db.query(HistoricoSLA).filter(
            HistoricoSLA.chamado_id == chamado.id
        ).order_by(HistoricoSLA.criado_em.desc()).first()

        if existing:
            # Atualiza o último histórico com novos cálculos
            existing.tempo_resolucao_horas = sla_status.get("tempo_resolucao_horas")
            existing.status_sla = sla_status.get("tempo_resolucao_status")
            db.add(existing)
        else:
            # Cria novo histórico
            historico = HistoricoSLA(
                chamado_id=chamado.id,
                acao="criacao" if not status_anterior else "atualizacao",
                status_anterior=status_anterior,
                status_novo=chamado.status,
                tempo_resolucao_horas=sla_status.get("tempo_resolucao_horas"),
                limite_sla_horas=sla_status.get("tempo_resolucao_limite_horas"),
                status_sla=sla_status.get("tempo_resolucao_status"),
                criado_em=chamado.data_abertura or now_brazil_naive(),
            )
            db.add(historico)

        db.commit()
    except Exception as e:
        db.rollback()
        pass
```

---

## ⚙️ Endpoints de Sincronização

### 1. Sincronizar Todos os Chamados

```
POST /api/sla/sync/todos-chamados
```

**Resposta:**

```json
{
  "total_chamados": 150,
  "sincronizados": 145,
  "atualizados": 5,
  "erros": 0
}
```

### 2. Recalcular SLAs

```
POST /api/sla/recalcular/painel
```

**Resposta:**

```json
{
  "total_recalculados": 150,
  "em_dia": 120,
  "vencidos": 15,
  "em_andamento": 10,
  "congelados": 5,
  "erros": 0
}
```

### 3. Obter Status de SLA de um Chamado

```
GET /api/sla/chamado/{chamado_id}/status
```

**Resposta:**

```json
{
  "chamado_id": 1,
  "prioridade": "Normal",
  "status": "Em andamento",
  "tempo_resposta_horas": 1.5,
  "tempo_resposta_status": "ok",
  "tempo_resolucao_horas": 3.2,
  "tempo_resolucao_status": "em_andamento",
  "tempo_resposta_limite_horas": 2,
  "tempo_resolucao_limite_horas": 8
}
```

---

## 📋 Checklist de Implementação

- [x] Criar tabelas de SLA (SLAConfiguration, SLABusinessHours, HistoricoSLA)
- [x] Criar serviço de cálculo de SLA (SLACalculator)
- [x] Criar endpoints de CRUD para configurações
- [x] Implementar sincronização automática ao criar chamado
- [x] Implementar sincronização automática ao atualizar chamado
- [x] Criar endpoint de sincronização em massa
- [x] Criar endpoint de recálculo
- [x] Criar página de configurações de SLA
- [x] Criar página de sincronização
- [x] Adicionar recálculo automático ao acessar painel
- [x] Criar componente de exibição de status SLA
- [x] Criar hook de sincronização (useSLASync)

---

## 🚀 Próximos Passos

1. **Integrar SLA na página de detalhes de chamado**
   - Mostrar status de resposta e resolução
   - Alertas visuais quando SLA está próximo de vencer

2. **Dashboard de métricas**
   - % de SLAs cumpridos por período
   - Gráficos de evolução

3. **Alertas e notificações**
   - Email quando SLA está para vencer
   - Escalação automática

4. **Relatórios**
   - Exportar histórico de SLA
   - Análise de performance por equipe

---

## 🔍 Troubleshooting

### Problema: "Sincronização diz que atualizou 0 chamados"

**Solução:** Verifique se há chamados no banco. Execute:

```bash
curl http://localhost:8000/api/chamados
```

### Problema: "Erro ao sincronizar: Tabela não existe"

**Solução:** As tabelas são criadas automaticamente. Se o erro persistir:

```python
# No backend, execute:
from backend.ti.models.sla_config import SLAConfiguration, HistoricoSLA
from core.db import engine
SLAConfiguration.__table__.create(engine, checkfirst=True)
HistoricoSLA.__table__.create(engine, checkfirst=True)
```

### Problema: "SLA mostrado no painel não corresponde à realidade"

**Solução:** Clique em "Recalcular SLAs" na página de sincronização

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:

- `SLA_IMPLEMENTATION.md` - Documentação técnica completa
- `/api/sla` - Endpoints disponíveis
- `useSLASync.ts` - Hook de sincronização frontend
