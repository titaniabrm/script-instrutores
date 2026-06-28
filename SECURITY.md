# Modelo de Segurança — Painel CGEx

Este documento descreve o que foi feito, o que ainda depende de você (console
Firebase) e os riscos residuais. Leia antes de publicar.

---

## ✅ O que já foi implementado no código

1. **Login anônimo do Firebase (`signInAnonymously`)**
   O app abre uma sessão autenticada (anônima) ao carregar. Isso permite que as
   regras do Firestore exijam `request.auth != null`, bloqueando acesso totalmente
   anônimo via REST usando apenas a `apiKey`.

2. **Regras do Firestore (`firestore.rules`)**
   - Todo acesso exige sessão autenticada.
   - `auditoria/` e `config_historico/` são **append-only** (não podem ser
     editados nem apagados pelo cliente).
   - `senhas_instrutores/` valida o formato do documento e proíbe exclusão.
   - `config/main` limita o número de campos por gravação.
   - Tudo o que não está explicitamente liberado é **negado**.

3. **Senha de admin com PBKDF2**
   A senha do administrador deixou de ser um SHA-256 simples e passou a usar
   **PBKDF2-SHA256 com 150.000 iterações + salt aleatório**, o que torna ataque
   de força bruta/rainbow table muito mais caro. Hashes antigos continuam
   aceitos e são migrados automaticamente na próxima troca de senha.

4. **Níveis de acesso de admin**
   O que cada administrador pode editar depende do cargo do usuário logado
   (mapa `instrutorCargos`). Botões/abas sensíveis ficam ocultos para quem não
   tem permissão.

5. **Auditoria**
   Ações relevantes (login admin, troca de senha, banimento, alteração de
   config, edição de conteúdo) ficam registradas na coleção `auditoria/`.

6. **Cabeçalhos HTTP de segurança** (via `vercel.json`):
   `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
   `Permissions-Policy`.

---

## ⚠️ Passos OBRIGATÓRIOS no Console Firebase (uma vez)

1. **Authentication → Sign-in method → Anonymous → Ativar.**
   (Sem isso o app não lê/grava nada, pois as regras exigem sessão.)

2. **Firestore → Rules** → cole o conteúdo de `firestore.rules` e publique
   (ou rode `firebase deploy --only firestore:rules`).

3. **Authentication → Settings → Authorized domains** → adicione os domínios
   onde o painel vai rodar (Vercel, GitHub Pages, localhost para testes).

---

## 🔒 Hardening recomendado (opcional, mais forte)

### a) Firebase App Check
Ativa verificação de que as requisições vêm do seu app real (reCAPTCHA/Play
Integrity), reduzindo abuso via apiKey. Console → App Check → registre o app web.

### b) Cloud Function como proxy de escrita (proteção forte de verdade)
Sem backend, as regras **não conseguem provar** que quem grava é admin — só que
está autenticado (mesmo anônimo). A forma realmente segura é negar escrita
direta do cliente nas coleções sensíveis e fazer toda gravação passar por uma
Cloud Function que valida a senha de admin no servidor:

```js
// functions/index.js (requer plano Blaze)
exports.salvarConfig = functions.https.onCall(async (data, context) => {
  // valide data.senha contra um hash guardado em local NÃO legível pelo cliente
  // e só então grave em config/main com o Admin SDK
});
```
E nas regras: `match /config/main { allow write: if false; }` (só o Admin SDK grava).

### c) Content-Security-Policy
Para endurecer contra XSS, adicione em `vercel.json` (teste antes — o app usa
estilos/handlers inline e Firebase/Fonts via CDN):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.googletagmanager.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com;
```

---

## ℹ️ Sobre a `apiKey` exposta no HTML

É **normal e esperado** que a `apiKey` do Firebase fique visível no código de um
app web — ela apenas identifica o projeto, não é um segredo. A segurança real
vem das **Regras do Firestore + Authentication + App Check**, não de esconder a
chave.

---

## 🚨 Riscos residuais (seja honesto com a equipe)

- Sem a Cloud Function (item b), um usuário autenticado tecnicamente capacitado
  ainda pode gravar em coleções liberadas para escrita autenticada. A mitigação
  atual reduz o dano (validação de formato, append-only nos logs), mas não
  elimina. Para dados críticos, implemente o item (b).
- A verificação da senha de admin acontece no cliente. É adequada para controle
  de acesso à UI, não para proteger segredos de alto valor.
