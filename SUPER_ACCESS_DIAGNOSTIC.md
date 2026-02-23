# 🔍 Guia de Diagnóstico: Menu de Super Usuário Não Aparece

## ⚠️ Problema

Sua conta está configurada como super no `.env`, mas o menu de super usuário não está aparecendo.

## 📋 Passo 1: Verifique o Email da Sua Conta

1. **Abra seu navegador**
2. **Pressione F12** para abrir o DevTools
3. **Vá para a aba "Console"** (pode estar em inglês)
4. **Você verá uma mensagem tipo:**
   ```
   [SuperAccess Debug] {
     isSuper: false,
     email: "seu.email@exemplo.com",
     allowedEmails: ["app.jmr@gmail.com", "todojean@gmail.com"],
     reason: "✗ Email \"seu.email@exemplo.com\" NÃO está na lista..."
   }
   ```

## 🔧 Passo 2: Identifique o Problema

### Cenário A: Email diferente do esperado

Se o email mostrado é diferente de `app.jmr@gmail.com` ou `todojean@gmail.com`:

**Solução**: Atualize o `.env` com o email correto:

```dotenv
VITE_OWNER_SUPER_EMAIL=seu.email.correto@exemplo.com
VITE_OWNER_SUPER_EMAILS=app.jmr@gmail.com,todojean@gmail.com,seu.email.correto@exemplo.com
```

### Cenário B: Email bate, mas ainda não funciona

Se o email está na lista (`allowedEmails`), mas `isSuper: false`:

**Causa possível**: Variável de ambiente não foi recarregada

**Solução 1**: Recarregue a página (Ctrl+R ou F5)

**Solução 2**: Reinicie o dev server:

```bash
# 1. Pare o servidor (Ctrl+C no terminal)
# 2. Execute novamente:
npm run dev
```

**Solução 3**: Limpe o cache:

```bash
# No DevTools do navegador:
1. DevTools > Settings (⚙️)
2. Network > Marque "Disable cache (while DevTools is open)"
3. Recarregue a página (Ctrl+Shift+R)
```

### Cenário C: Email não está na lista

Se o seu email não aparece em `allowedEmails`:

**Causa**: Você está logado com um email diferente do configurado no `.env`

**Soluções**:

1. **Faça logout e login novamente com o email correto**

   - Vá para `/logout`
   - Logo, entre com `app.jmr@gmail.com` ou outro email na lista

2. **Ou atualize o `.env`** com o email da sua conta

## 📝 Arquivo .env Atual

Seu arquivo `.env` está assim:

```dotenv
VITE_OWNER_SUPER_EMAIL=app.jmr@gmail.com
VITE_OWNER_SUPER_EMAILS=app.jmr@gmail.com,todojean@gmail.com
```

**Emails configurados como super**:

- ✅ app.jmr@gmail.com
- ✅ todojean@gmail.com

## ✅ Como Saber que Funcionou

Quando tudo estiver correto, você verá:

1. **No console**:

   ```
   [SuperAccess Debug] {
     isSuper: true,  // ← Isso deve ser TRUE
     email: "app.jmr@gmail.com",
     reason: "✓ Email \"app.jmr@gmail.com\" está na lista..."
   }
   ```

2. **Na interface**:
   - Aparecerá um botão de toggle (liga/desliga) super no header
   - O header mudará de cor
   - Aparecerá uma terceira linha de menu com botões amarelos
   - No drawer (menu), aparecerão opções de "Sistema", "Branding", "Usuários"

## 🔄 Se o Problema Persistir

1. **Verifique o email do Supabase**:

   - Abra a conta Supabase
   - Vá para Authentication > Users
   - Verifique qual email está cadastrado

2. **Confirme a sintaxe do `.env`**:

   - Sem espaços desnecessários
   - Emails separados por vírgula (`,`)

3. **Tente fazer logout e login novamente**:
   - Às vezes o cache interfere
   - `/logout` → recarregue (F5) → `/` → faça login

## 📞 Informações para Debug Avançado

Se o problema continuar, capture esta informação:

1. Abra o console (F12)
2. Cole e execute:

   ```javascript
   // Veja o objeto completo do usuário
   const currUser = JSON.parse(
     localStorage.getItem('sb-auth-user') ||
       localStorage.getItem('sb-user') ||
       '{}',
   );
   console.log('Usuário Atual:', currUser);
   console.log('Email do Usuário:', currUser.email);
   ```

3. Forneça o output acima para análise

## 🎯 Próximas Ações

Depois que o menu de super aparecer:

1. ✅ Clique no toggle para entrar em modo "SUPER" (verá na cor amarela)
2. ✅ Vá para `/super/culture-sync` para importar as culturas
3. ✅ Configure o sistema conforme necessário

---

**Última atualização**: Fevereiro 22, 2026
**Status**: Debug function implementada ✅
