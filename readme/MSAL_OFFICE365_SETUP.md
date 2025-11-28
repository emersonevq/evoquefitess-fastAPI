# Integração MSAL + Microsoft Office 365

## Status: ✅ Implementado

A autenticação da aplicação foi integrada com MSAL (Microsoft Authentication Library) para usar Office 365 / Microsoft Entra ID como provedor de identidade.

---

## 📋 O que foi implementado

### Frontend

- ✅ Instalação da biblioteca `@azure/msal-browser` e `@azure/msal-react`
- ✅ Configuração MSAL em `src/lib/msal-config.ts`
- ✅ Atualização do `auth-context.tsx` para usar MSAL
- ✅ Nova função de login com Microsoft
- ✅ Arquivo `.env` com credenciais MSAL
- ✅ JWT decoding para extrair email

### Backend

- ✅ Novo endpoint `/api/usuarios/msal-login` para validar usuários
- ✅ Suporte para JWT do MSAL
- ✅ Validação de email no banco de dados

---

## 🔐 Credenciais MSAL

As credenciais devem ser configuradas no Azure Portal:

### Configuração Azure

```
Tenant ID: 9f45f492-87a3-4214-862d-4c0d080aa136
Client ID: {seu-client-id-aqui}
Application: intranetevoquegraph
```

---

## 🚀 Fluxo de Autenticação

### 1. Usuário acessa a aplicação

- URL: `https://portalevoque.com` (ou `http://localhost:5173` para dev)
- Vê tela de login com botão "Entrar com Microsoft"

### 2. Clica em "Entrar com Microsoft"

- Frontend abre popup do MSAL
- MSAL redireciona para Microsoft login

### 3. Usuário faz login com email corporativo

- Email: `usuario@academiaevoque.com.br`
- Senha: Credenciais da conta Microsoft Office 365

### 4. Microsoft retorna para a aplicação

- MSAL obtém JWT access token
- JWT contém email do usuário

### 5. Frontend extrai email do JWT

- Decodifica o JWT (sem verificação, confia no MSAL)
- Extrai o email do campo `email` ou `preferred_username`

### 6. Envia para backend validar

- POST `/api/usuarios/msal-login` com email

### 7. Backend valida email no banco

- Se email existe no banco:
  - ✅ Login bem-sucedido
  - Retorna dados do usuário
  - Usuário é redirecionado para dashboard
- Se email NÃO existe:
  - ❌ Erro 403 - Acesso Negado
  - Mensagem: "Email não encontrado no sistema"

---

## 📝 Variáveis de Ambiente

### Frontend (.env ou .env.local)

```env
# MSAL Configuration for Office 365
VITE_MSAL_CLIENT_ID=seu-client-id-aqui
VITE_MSAL_TENANT_ID=9f45f492-87a3-4214-862d-4c0d080aa136
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_API_URL=http://localhost:8000
```

---

## 🔧 Como testar

### 1. Ambiente de Desenvolvimento

```bash
# Frontend
cd frontend
npm run dev

# Backend
cd backend
python main.py
```

### 2. Acessar a aplicação

- URL: `http://localhost:5173`
- Clique em "Entrar com Microsoft"
- Use credenciais de email corporativo Office 365
- Após login com sucesso, você será redirecionado para o dashboard

### 3. Para produção

- Atualize `VITE_MSAL_REDIRECT_URI` para `https://portalevoque.com`
- Configure a URL de redirect no Azure Portal
- Certifique-se que as permissões foram concedidas no Azure AD

---

## 📚 Endpoints

### POST `/api/usuarios/msal-login`

**Descrição**: Valida email do token MSAL e faz login do usuário

**Headers**:

```
Authorization: Bearer {access_token_jwt}
Content-Type: application/json
```

**Body**:

```json
{
  "email": "usuario@academiaevoque.com.br",
  "name": "Nome do Usuário"
}
```

**Response (200 OK)**:

```json
{
  "id": 123,
  "nome": "João",
  "sobrenome": "Silva",
  "usuario": "joao.silva",
  "email": "joao.silva@academiaevoque.com.br",
  "nivel_acesso": "user",
  "setores": ["ti", "compras"],
  "bi_subcategories": null,
  "alterar_senha_primeiro_acesso": false
}
```

**Response (403 Forbidden)**:

```json
{
  "detail": "Usuário com email 'xxx@xxx.com' não encontrado no sistema. Contate o administrador."
}
```

---

## 🛠️ Manutenção

### Adicionar novo usuário

1. Crie o usuário normalmente no banco de dados com o mesmo email da conta Office 365
2. Certifique-se que a conta Microsoft Office 365 existe no Azure AD
3. Usuário poderá fazer login com "Entrar com Microsoft"

### Remover acesso

1. Bloqueie o usuário via admin panel (defina `bloqueado = true`)
2. Ou delete o usuário do banco de dados
3. Próximo login será rejeitado

### Alterar Client ID

1. Se precisar alterar o Client ID, atualize:
   - `VITE_MSAL_CLIENT_ID` no `.env`
   - Azure Portal: Registros de Aplicativo → intranetevoquegraph

---

## ⚠️ Observações Importantes

1. **Email único**: O email do usuário no banco deve ser o mesmo da conta Microsoft
2. **Bloqueio de usuário**: Usuários bloqueados não conseguem fazer login
3. **Permissões Azure**: Certifique-se que o "Grant admin consent" foi feito
4. **Token expiração**: Tokens MSAL expiram naturalmente, MSAL cuida da renovação automática
5. **MSAL caching**: Tokens são armazenados em localStorage para sessões persistentes

---

## 🔗 Referências

- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure AD Authentication](https://docs.microsoft.com/en-us/azure/active-directory/fundamentals/auth-overview)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)

---

## 📞 Suporte

Para problemas com autenticação:

1. Verifique se o email está registrado no banco
2. Verifique se o usuário não está bloqueado
3. Confirme as credenciais MSAL em `frontend/.env`
4. Verifique se o "Grant admin consent" foi feito no Azure AD
5. Verifique os logs do navegador (F12) e do backend

---

**Última atualização**: Dezembro 2024
