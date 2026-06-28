# Sistema CGEx — Painel de Acesso

Painel web (instrutores, corregedoria e membros) da comunidade **CGEx** (Roblox/Discord).
Single Page Application estática, com backend no **Firebase Firestore**.

> Login via OAuth do Roblox + senha por instrutor, painel administrativo, material de
> apoio (tickets, omissão, revogação, exílio, logs, punições, etc.), busca, mural de
> notificações, auditoria e edição de conteúdo pelo próprio painel.

---

## 📁 Estrutura do projeto

```
.
├── index.html              # Marcação (HTML) do painel
├── css/
│   └── styles.css          # Todo o estilo do painel
├── js/
│   ├── app.js              # Núcleo: Firebase, auth, OAuth Roblox, admin, pastas
│   ├── seguranca.js        # Hash forte (PBKDF2) + login anônimo + níveis de admin
│   ├── busca.js            # Busca/filtro no Material de Apoio
│   ├── navegacao.js        # Breadcrumb + indicador de progresso
│   ├── notificacoes.js     # Mural de notificações (histórico)
│   ├── auditoria.js        # Log de auditoria + histórico de config
│   ├── admin-conteudo.js   # Edição/adição de conteúdo das pastas pelo admin
│   ├── admin-sessao.js     # Bloqueio após tentativas erradas + expiração de sessão
│   ├── banimentos.js       # Histórico de banimentos com motivo/evidência
│   ├── notif-agenda.js     # Agendamento de notificação urgente
│   ├── cargos-dnd.js       # Cargos por drag-and-drop (hierarquia visual)
│   ├── ia-historico.js     # Histórico de conversas da IA + contexto por pasta
│   └── a11y.js             # Acessibilidade (aria-labels, navegação por teclado)
├── firestore.rules         # Regras de segurança do Firestore
├── firebase.json           # Config do Firebase (rules + hosting opcional)
├── vercel.json             # Config de deploy na Vercel (headers de segurança)
├── SECURITY.md             # Modelo de segurança e passos obrigatórios no console
└── README.md
```

---

## 🚀 Deploy na Vercel

1. Suba este repositório no GitHub (ver abaixo).
2. Acesse <https://vercel.com> → **Add New… → Project** → importe o repositório.
3. **Framework Preset:** `Other` (é um site estático, sem build).
4. **Root Directory:** `.` (raiz). **Build Command:** deixe vazio. **Output Directory:** deixe vazio.
5. Clique em **Deploy**. Pronto — a Vercel publica os arquivos estáticos direto.

> O `vercel.json` já aplica cabeçalhos de segurança (`X-Content-Type-Options`,
> `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

### ⚠️ Passo obrigatório no Firebase (uma vez)

O painel agora usa **login anônimo do Firebase** e regras de segurança que exigem sessão.
Antes (ou logo após) o deploy:

1. **Console Firebase → Authentication → Sign-in method → Anonymous → Ativar.**
2. **Console Firebase → Authentication → Settings → Authorized domains** → adicione o
   domínio da Vercel (ex.: `script-instrutores.vercel.app`) e o domínio do GitHub Pages,
   se usar.
3. Publique as regras: `firebase deploy --only firestore:rules`
   (ou copie/cole o conteúdo de `firestore.rules` no Console → Firestore → Rules).

Sem o passo 1, o app não conseguirá ler/gravar dados. Detalhes em [SECURITY.md](SECURITY.md).

---

## 🐙 Publicar no GitHub

```bash
git init
git add .
git commit -m "Painel CGEx organizado, com segurança e novos recursos"
git branch -M main
git remote add origin https://github.com/titaniabrm/script-instrutores.git
git push -u origin main
```

---

## 🔐 Acesso de administrador

- Senha padrão inicial: `cgex2024` (troque imediatamente em **Admin → Segurança**).
- A senha agora é protegida com **PBKDF2 (SHA-256, 150k iterações + salt)**.
  Hashes antigos (SHA-256 simples) continuam funcionando e são migrados na próxima troca.
- **Níveis de admin** são definidos pelo cargo do usuário logado (`instrutorCargos`):
  - `Administrador Geral` / `Corregedor Geral` → acesso total.
  - `Chefe de Instrução` → conteúdo, avisos, notificações (sem segurança/banidos).
  - Demais cargos → somente leitura do painel admin.

---

## 🧩 Recursos

| Recurso | Onde |
|---|---|
| Busca/filtro no material | botão 🔍 no topo do Material de Apoio |
| Breadcrumb + progresso | topo de cada pasta / checklists |
| Mural de notificações | sino no painel + aba "Notificações" no admin |
| Auditoria de ações | aba "Auditoria" no admin |
| Histórico de config | aba "Histórico" no admin |
| Editar/adicionar conteúdo | aba "Conteúdo" no admin |
| Cargos por drag-and-drop | aba "Instrutores → Cargos dos Instrutores" |
| Histórico de banimentos com motivo | aba "Banidos" no admin |
| Agendar notificação urgente | aba "Notificação Urgente" no admin (campo "Agendar para") |
| Bloqueio após 3 tentativas erradas | tela de login do admin (5 min de espera) |
| Sessão de admin expira em 30 min | aviso aparece 2 min antes, com botão "Continuar" |
| Histórico de conversas da IA | botão 📜 na pasta "IA CGEx" |
| Perguntar à IA sobre uma pasta | botão 🤖 no topo das pastas de procedimento |
| Acessibilidade | skip link, navegação por teclado, aria-labels |

---

## 💻 Rodar localmente

Por ser estático, basta um servidor HTTP simples (o Firebase exige `http`, não `file://`):

```bash
npx serve .
# ou
python -m http.server 5500
```

Acesse <http://localhost:3000> (serve) ou <http://localhost:5500> (python).
Lembre de adicionar `localhost` nos **Authorized domains** do Firebase.
