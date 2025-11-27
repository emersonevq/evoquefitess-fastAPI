# 📊 Documento Completo do Sistema de SLA (Service Level Agreement)

## 📋 Índice

1. [O que é SLA?](#o-que-é-sla)
2. [Como Funciona](#como-funciona)
3. [Tabelas Utilizadas](#tabelas-utilizadas)
4. [Forma de Cálculo](#forma-de-cálculo)
5. [Exemplos Práticos](#exemplos-práticos)
6. [Possíveis Problemas e Soluções](#possíveis-problemas-e-soluções)
7. [Fluxo de Dados](#fluxo-de-dados)

---

## O que é SLA?

**SLA (Service Level Agreement)** é um acordo de nível de serviço que define quanto tempo máximo você tem para:

1. **Responder ao cliente** (primeira resposta)
2. **Resolver o problema** (resolução completa)

Cada nível de prioridade tem limites diferentes.

### Exemplo do mundo real:

```
Prioridade Crítica:
- Servidor fora do ar → você tem 1 hora para responder
- Você tem 4 horas para resolver

Prioridade Normal:
- Dúvida sobre relatório → você tem 8 horas para responder
- Você tem 48 horas para resolver
```

---

## Como Funciona

### 📌 Os 3 Estados do SLA

```
┌─────────────────────────────────────────────────────┐
│                  CHAMADO ABERTO                     │
├─────────────────────────────────────────────────────┤
│ Status: "Aberto"                                    │
│ SLA Status: ⚪ OK (dentro do limite)                 │
│ Tempo decorrido: 0h                                 │
│ Limite de resposta: 4h (prioridade Alta)            │
└──────────────────────────────────��──────────────────┘
                       ↓
           [Passam 3 horas de espera]
                       ↓
┌─────────────────────────────────────────────────────┐
│                  EM RISCO 🟡                         │
├─────────────────────────────────────────────────────┤
│ Status: "Aberto"                                    │
│ SLA Status: 🟡 ATENÇÃO (80% do limite)              │
│ Tempo decorrido: 3.2h                               │
│ Limite: 4h → Atenção em 3.2h (80%)                 │
│ → AVISO: Responda em breve!                         │
└─────────────────────────────────────────────────────┘
                       ↓
        [Passam mais 1.5 horas sem resposta]
                       ↓
┌─────────────────────────────────────────────────────┐
│                  VENCIDO ❌                          │
├─────────────────────────────────────────────────────┤
│ Status: "Aberto"                                    │
│ SLA Status: ❌ VENCIDO (ultrapassou o limite)       │
│ Tempo decorrido: 4.7h                               │
│ Limite: 4h → VENCEU! (0.7h de atraso)              │
│ → CRÍTICO: Deve responder AGORA!                    │
└─────────────────────────────────────────────────────┘
```

### 📊 Estados Possíveis

| Estado      | Cor         | Significado                | O que fazer             |
| ----------- | ----------- | -------------------------- | ----------------------- |
| **OK**      | 🟢 Verde    | Dentro do limite (0-80%)   | Continuar normalmente   |
| **ATENÇÃO** | 🟡 Amarelo  | Perto do limite (80-100%)  | Preparar para responder |
| **VENCIDO** | 🔴 Vermelho | Ultrapassou limite (>100%) | RESPONDER IMEDIATAMENTE |

---

## Tabelas Utilizadas

### 1️⃣ Tabela `chamado` (JÁ EXISTE!)

Armazena os chamados. As colunas importantes para SLA são:

```
chamado
├── id (INT)                           ← ID único do chamado
├── prioridade (VARCHAR)               ← [Crítica, Urgente, Alta, Normal]
├── data_abertura (DATETIME)           ← Quando foi aberto
├── data_primeira_resposta (DATETIME)  ← Quando recebeu primeira resposta
├── data_conclusao (DATETIME)          ← Quando foi concluído
├── status (VARCHAR)                   ← [Aberto, Em Atendimento, Concluído...]
├── sla_em_risco (BOOLEAN)             ← Flag: SLA está em risco? (80%+)
└── sla_vencido (BOOLEAN)              ← Flag: SLA venceu? (>100%)
```

**Importante:** Essas colunas JÁ EXISTEM no seu banco!

---

### 2️⃣ Tabela `sla_configuration` (NOVA - criada pelo script)

Define quanto tempo você tem para cada prioridade:

```
sla_configuration
├── id (INT)
├── prioridade (VARCHAR) UNIQUE        ← [Crítica, Urgente, Alta, Normal]
├── tempo_resposta_horas (FLOAT)       ← Horas para primeira resposta
├── tempo_resolucao_horas (FLOAT)      ← Horas para resolver
├── descricao (TEXT)                   ← Descrição da prioridade
├── ativo (BOOLEAN)                    ← Está em uso?
├── criado_em (DATETIME)
└── atualizado_em (DATETIME)
```

**Dados padrão inseridos automaticamente:**

| prioridade | tempo_resposta_horas | tempo_resolucao_horas |
| ---------- | -------------------- | --------------------- |
| Crítica    | 1                    | 4                     |
| Urgente    | 2                    | 8                     |
| Alta       | 4                    | 24                    |
| Normal     | 8                    | 48                    |

---

### 3️⃣ Tabela `sla_business_hours` (NOVA)

Define o horário comercial (quando o tempo de SLA "conta"):

```
sla_business_hours
├── id (INT)
├── dia_semana (INT)      ← 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex
├── hora_inicio (VARCHAR) ← "08:00"
├── hora_fim (VARCHAR)    ← "18:00"
└── ativo (BOOLEAN)
```

**Dados padrão:** Seg-Sex 08:00-18:00 (fins de semana e foras de horário NÃO CONTAM)

---

### 4️⃣ Tabela `historico_sla` (NOVA)

Registra cada mudança de SLA (para auditoria):

```
historico_sla
├── id (INT)
├── chamado_id (INT)           ← Qual chamado
├── usuario_id (INT)           ← Quem fez a mudança
├── acao (VARCHAR)             ← Tipo de ação
├── status_anterior (VARCHAR)  ← Status anterior
├── status_novo (VARCHAR)      ← Status novo
├── tempo_resolucao_horas (FLOAT) ← Tempo até agora
├── limite_sla_horas (FLOAT)   ← Qual é o limite
├── status_sla (VARCHAR)       ← ok/atencao/vencido
└── criado_em (DATETIME)
```

---

## Forma de Cálculo

### ⏱️ Cálculo em Business Hours (Horário Comercial)

O tempo SLA **NÃO conta durante**:

- ❌ Fins de semana (Sábado e Domingo)
- ❌ Fora do horário comercial (antes das 08:00 ou depois das 18:00)

**Exemplo:**

```
Chamado aberto: Sexta-feira 17:00 (quarta de trabalho)
Resposta: Segunda-feira 09:00 (manhã)

Tempo SLA = ?

Contagem:
- Sexta 17:00 até 18:00 = 1h
- Sábado = não conta ❌
- Domingo = não conta ❌
- Segunda 08:00 até 09:00 = 1h
- Total: 2h ✅
```

### 📐 Fórmula de Cálculo

```
TEMPO_DECORRIDO = Soma de minutos durante horário comercial
                  entre data_abertura e data_primeira_resposta

LIMITE_SLA = tempo_resposta_horas da sla_configuration

STATUS_SLA = ?

    Se TEMPO_DECORRIDO ≤ LIMITE_SLA:
        STATUS = "ok" ✅

    Se LIMITE_SLA * 0.8 < TEMPO_DECORRIDO < LIMITE_SLA:
        STATUS = "atencao" 🟡 (80%+)

    Se TEMPO_DECORRIDO > LIMITE_SLA:
        STATUS = "vencido" ❌ (ultrapassou)
```

### Exemplo Prático Passo a Passo

```
CHAMADO #123
├── prioridade = "Alta"
├── data_abertura = 2024-01-10 10:00
├── data_primeira_resposta = 2024-01-10 13:30
└── horário comercial = 08:00-18:00

PASSO 1: Buscar limite
┌─────────────────────────────────────────┐
│ SELECT tempo_resposta_horas              │
│ FROM sla_configuration                   │
│ WHERE prioridade = 'Alta'                │
│ → Resultado: 4 horas ✅                  │
└─────────────────────────────────────────┘

PASSO 2: Calcular tempo decorrido
┌─────────────────────────────────────────┐
│ De 10:00 até 13:30 = 3h 30m              │
│ (tudo dentro do horário comercial ✅)    │
└─────────────────────────────────────────┘

PASSO 3: Comparar
┌─────────────────────────────────────────┐
│ TEMPO: 3.5h                              │
│ LIMITE: 4h                               │
│ 80% DO LIMITE: 4 * 0.8 = 3.2h            │
│                                          │
│ 3.2h < 3.5h < 4h ?                       │
│ SIM! → STATUS = "atencao" 🟡             │
│ (Atenção: 87.5% do limite!)              │
└─────────────────────────────────────────┘
```

---

## Exemplos Práticos

### Exemplo 1: Resposta Dentro do Prazo ✅

```
Chamado #100 - Prioridade: Urgente (2h de limite)

Aberto:    Segunda 09:00
Respondido: Segunda 10:30

Tempo: 1h 30min
Limite: 2h
Status: OK ✅ (75% do limite)

Flags: sla_em_risco = FALSE, sla_vencido = FALSE
```

### Exemplo 2: Atenção - Perto de Vencer 🟡

```
Chamado #101 - Prioridade: Normal (8h de limite)

Aberto:     Quarta 09:00
Agora:      Quarta 16:30 (sem resposta ainda)

Tempo decorrido: 7h 30min
Limite: 8h
Percentual: 93.75% do limite

Status: ATENÇÃO 🟡 (>80% e <100%)

Flags: sla_em_risco = TRUE, sla_vencido = FALSE
Ação necessária: RESPONDER LOGO!
```

### Exemplo 3: Vencido ❌

```
Chamado #102 - Prioridade: Crítica (1h de limite)

Aberto:     Segunda 09:00
Respondido: Segunda 11:15 (atraso!)

Tempo: 2h 15min
Limite: 1h
Status: VENCIDO ❌ (225% do limite)

Flags: sla_em_risco = FALSE, sla_vencido = TRUE
Ação: CRÍTICO! Registrar violação no histórico
```

### Exemplo 4: Fim de Semana Não Conta

```
Chamado #103 - Prioridade: Alta (4h de limite)

Aberto:     Sexta 17:00
Respondido: Segunda 09:00 (próxima semana)

Timeline:
├─ Sexta 17:00-18:00 = 1h (comercial) ✅
├─ Sábado = NÃO CONTA ❌ (fim de semana)
├─ Domingo = NÃO CONTA ❌ (fim de semana)
└─ Segunda 08:00-09:00 = 1h (comercial) ✅

Tempo TOTAL: 2h (não 40h!)
Limite: 4h
Status: OK ✅ (50% do limite)

Flags: sla_em_risco = FALSE, sla_vencido = FALSE
```

---

## Possíveis Problemas e Soluções

### ⚠️ Problema 1: Data de Primeira Resposta Nula

**O que é?**
Se `data_primeira_resposta` nunca foi preenchida, o sistema não consegue calcular.

**Por que acontece?**
O trigger SQL que preenche `data_primeira_resposta` pode não ter sido criado ou ativado.

**Solução:**

1. Execute o script `create_sla_tables.sql` (já contém o trigger)
2. O trigger preencherá automaticamente quando status mudar para "Em Atendimento"

```sql
-- Trigger automático (criado pelo script):
CREATE TRIGGER tr_set_primeira_resposta
BEFORE UPDATE ON chamado
FOR EACH ROW
BEGIN
    IF NEW.data_primeira_resposta IS NULL
       AND OLD.status = 'Aberto'
       AND NEW.status IN ('Em Atendimento', 'Em análise')
    THEN
        SET NEW.data_primeira_resposta = NOW();
    END IF;
END;
```

---

### ⚠️ Problema 2: Configuração de SLA Faltando

**O que é?**
Se não houver registro em `sla_configuration` para a prioridade do chamado.

**Por que acontece?**
Chamado tem prioridade "Custom" que não existe na tabela.

**Solução:**
O código tem valores **DEFAULT**. Se não encontrar, usa:

```
Crítica → 1h resposta, 4h resolução
Urgente → 2h resposta, 8h resolução
Alta → 4h resposta, 24h resolução
Normal → 8h resposta, 48h resolução (padrão)
```

---

### ⚠️ Problema 3: Horário Comercial Errado

**O que é?**
Se o horário comercial não está configurado corretamente.

**Solução:**
Editar na tabela `sla_business_hours`:

```sql
-- Ver horários atuais
SELECT * FROM sla_business_hours;

-- Mudar para 07:00-19:00
UPDATE sla_business_hours
SET hora_inicio = '07:00', hora_fim = '19:00'
WHERE dia_semana = 0; -- Segunda
```

---

### ⚠️ Problema 4: Chamados Antigos Sem data_primeira_resposta

**O que é?**
Chamados antigos (antes do trigger) não têm `data_primeira_resposta`.

**Por que acontece?**
O trigger só funciona para mudanças **futuras**, não preenche dados antigos.

**Solução - Migração de Dados:**

```sql
-- Preencher data_primeira_resposta baseado em historico_status
UPDATE chamado c
SET data_primeira_resposta = (
    SELECT MIN(data_inicio)
    FROM historico_status hs
    WHERE hs.chamado_id = c.id
    AND hs.status IN ('Em Atendimento', 'Em análise', 'Em andamento')
)
WHERE c.data_primeira_resposta IS NULL
AND c.status NOT IN ('Aberto', 'Cancelado');

-- Verificar quantos foram atualizados
SELECT COUNT(*) FROM chamado
WHERE data_primeira_resposta IS NOT NULL;
```

---

### ⚠️ Problema 5: Performance - Muitos Cálculos

**O que é?**
Calcular SLA para 100 mil chamados é lento.

**Solução:**
Use as stored procedures do script:

```sql
-- Recalcular todos os chamados (otimizado)
CALL sp_recalcular_sla_todos_chamados();

-- Atualizar apenas um
CALL sp_atualizar_flags_sla(123); -- ID do chamado
```

---

## Fluxo de Dados

### 📊 Diagrama Completo

```
┌──────────────────────────────────────────────────────────┐
│           CHAMADO É ABERTO/ATUALIZADO                    │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│   TRIGGER SQL (tr_set_primeira_resposta)                 │
│   Preenche: data_primeira_resposta = NOW()               │
└──────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────���────────────────────────────────┐
│   CÓDIGO PYTHON - SLACalculator.get_sla_status()         │
│                                                          │
│   1. Busca SLAConfiguration por prioridade               │
│   2. Calcula TEMPO_DECORRIDO (business hours)            │
│   3. Compara com LIMITE_SLA                              │
│   4. Determina STATUS (ok/atencao/vencido)               │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│   ATUALIZA TABELA CHAMADO                                │
│                                                          │
│   UPDATE chamado SET                                     │
│   sla_em_risco = ?,                                      │
│   sla_vencido = ?                                        │
│   WHERE id = ?                                           │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│   REGISTRA NO HISTÓRICO (historico_sla)                  │
│                                                          │
│   Ação: "recalculo_painel"                               │
│   Status anterior/novo                                   │
│   Tempo de resolução                                     │
│   Status SLA resultante                                  │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│   DASHBOARD/API MOSTRA RESULTADO                         │
│                                                          │
│   "SLA em Risco: 15 chamados" 🟡                          │
│   "SLA Vencido: 3 chamados" ❌                            │
│   "Tempo médio resposta: 2h 30m"                          │
└──────────────────────────────────────────────────────────┘
```

---

## Resumo Executivo

| Aspecto                    | Detalhe                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| **Tabelas usadas**         | `chamado`, `sla_configuration`, `sla_business_hours`, `historico_sla` |
| **Fonte de dados**         | Já existem, nenhuma mudança estrutural necessária                     |
| **Como calcula**           | Compara tempo_decorrido (business hours) com tempo_limite             |
| **Atualização automática** | Via trigger SQL (date_primeira_resposta) + procedures                 |
| **Estados possíveis**      | 🟢 OK, 🟡 ATENÇÃO (80%+), 🔴 VENCIDO (>100%)                          |
| **Horário comercial**      | Seg-Sex 08:00-18:00 (configurável)                                    |
| **Problemas esperados**    | Dados antigos sem data_primeira_resposta (solução: script SQL)        |
| **Performance**            | Otimizado com índices e stored procedures                             |

---

## Próximos Passos

1. ✅ Executar script `create_sla_tables.sql`
2. ✅ Migrar dados antigos (preencher `data_primeira_resposta`)
3. ⏳ Criar dashboard visual com gráficos de SLA
4. ⏳ Implementar alertas (email/Slack quando vencer)
5. ⏳ Job scheduler para recalcular diariamente

---

**Documento criado em:** 2024
**Versão:** 1.0
**Status:** Completo e Testado ✅
