# 🔧 Correção: Erro ao Atualizar Status de Chamados

## Problema Identificado

O erro 500 ao atualizar o status de um chamado para "Em análise" ou "Em andamento" foi causado por uma **incompatibilidade entre o schema do banco de dados e o código ORM (Object-Relational Mapping)**.

### O que causou?

Havia 3 definições diferentes da tabela `historico_status`:

1. **Código antigo (`azure_schema.sql`)**: Esperava colunas `status_anterior`, `status_novo`, `data_mudanca`, `motivo`
2. **Código ORM (`historico_status.py`)**: Esperava colunas `status`, `data_inicio`, `data_fim`, `descricao`, `created_at`, `updated_at`
3. **Banco de dados do usuário**: Possuía as colunas do código ORM (estrutura nova)

Quando o código tentava inserir um registro na tabela, havia um erro porque as colunas não correspondiam.

---

## ✅ Soluções Aplicadas

### 1. Atualização dos Scripts de Schema

**Arquivo: `backend/scripts/ensure_schema.py`**

- Atualizado com as colunas corretas esperadas pelo ORM

**Arquivo: `backend/scripts/azure_schema.sql`**

- Atualizado para criar a tabela com a estrutura correta para novas instalações

### 2. Scripts de Migração Adicionados

**Arquivo: `backend/ti/scripts/migrate_historico_status.py`**

- Executa automaticamente na inicialização do backend
- Detecta se a tabela tem estrutura antiga e migra automaticamente
- Preserva dados históricos ao migrar

**Arquivo: `backend/ti/scripts/check_historico_status.py`**

- Script de diagnóstico para verificar a estrutura da tabela
- Identifica problemas e sugere soluções

### 3. Integração Automática

**Arquivo: `backend/main.py`**

- Adicionada chamada automática da migração na inicialização
- Garante que o banco está sempre com a estrutura correta

---

## 🚀 Como Aplicar a Correção

### Opção 1: Reiniciar o Backend (Recomendado - Automático)

Simplesmente reinicie o backend:

```bash
# Interrompa o backend (Ctrl+C)
# Depois reinicie:
python backend/main.py
```

A migração executará automaticamente e você verá uma mensagem como:

```
✅ Migração historico_status executada com sucesso
```

### Opção 2: Rodar Manualmente o Diagnóstico

Para verificar se há problemas na tabela:

```bash
cd backend
python -m ti.scripts.check_historico_status
```

### Opção 3: Executar Migração Manualmente

Se preferir rodar a migração diretamente:

```bash
cd backend
python -m ti.scripts.migrate_historico_status
```

---

## 🧪 Teste a Correção

1. Acesse o painel administrativo
2. Vá até **"Gerenciar Chamados"**
3. Tente alterar o status de um chamado para **"Em análise"** ou **"Em andamento"**
4. O status deve ser alterado com sucesso (sem erro 500)
5. O histórico deve registrar a mudança de status

---

## 📋 Detalhes Técnicos da Migração

Se sua tabela teve a estrutura migrada, os dados antigos foram preservados:

```sql
-- Estrutura ANTIGA era:
- status_anterior VARCHAR(20)
- status_novo VARCHAR(20)
- data_mudanca DATETIME
- motivo TEXT

-- Estrutura NOVA é:
- status VARCHAR(50)
- data_inicio DATETIME
- data_fim DATETIME (para rastrear quando saiu do status)
- descricao TEXT (combina status_anterior + status_novo + motivo)
- created_at DATETIME
- updated_at DATETIME
```

Os dados foram convertidos automaticamente:

- `status_novo` → `status`
- `data_mudanca` → `data_inicio`
- `status_anterior + '→' + status_novo + motivo` → `descricao`

---

## 🐛 Se o Erro Persistir

Se após reiniciar o backend o erro ainda ocorrer:

1. **Verifique os logs do backend** para mensagens de migração
2. **Execute o diagnóstico**:
   ```bash
   python backend/ti/scripts/check_historico_status.py
   ```
3. **Verifique a conexão com o banco de dados**:
   ```bash
   python backend/ti/scripts/test_db_connection.py
   ```

---

## 📞 Próximas Etapas

- ✅ Reinicie o backend
- ✅ Teste a atualização de status
- ✅ Verifique se o histórico está sendo registrado corretamente

Se tudo funcionar, você pode remover o arquivo `HISTORICO_STATUS_FIX.md` ou mantê-lo para referência futura.
