# ⚽ Pelada — Gestor de Jogos de Futebol

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)

> App completo para organizar peladas entre amigos — da fila de chegada ao hall da fama.

Organize jogos de futebol entre amigos com **mais de 20 telas**: fila por chegada, sorteio de
times equilibrados, artilharia, votação de destaques, controle de mensalidade e caixa,
cronômetro de partida, mapa do local, clima e estatísticas por temporada.

🔗 **Demo ao vivo:** _em breve_ (após o deploy, cole o link aqui)

<!--
📸 DICA (Tomás): adicione um print ou GIF do app aqui — é o que mais chama recrutador.
   Coloque a imagem numa pasta "docs" (ex: docs/screenshot.png) e descomente a linha abaixo.
-->
<!-- ![Tela do Pelada](docs/screenshot.png) -->

---

## 🚀 Como hospedar no Firebase (passo a passo)

### 1. Pré-requisitos
- Node.js 18+ instalado
- Conta no [Firebase Console](https://console.firebase.google.com)

### 2. Criar o projeto no Firebase
1. No console, **Adicionar projeto** → dê um nome.
2. Menu **Criação > Authentication** → aba **Sign-in method** → ative **Google**.
3. Menu **Criação > Firestore Database** → **Criar banco** → modo de produção
   (as regras já vêm no arquivo `firestore.rules`).

### 3. Pegar as credenciais
Em **Configurações do projeto ⚙ > Seus apps > Web (</>)**, registre um app.
Copie o objeto `firebaseConfig` e cole em **`src/lib/firebase.js`**.

### 4. Instalar e testar local
```bash
npm install
npm run dev          # abre em http://localhost:5173
```

### 5. Instalar a CLI e fazer login
```bash
npm install -g firebase-tools
firebase login
```

### 6. Conectar a pasta ao seu projeto
```bash
firebase use --add        # escolha o projeto criado no passo 2
```
(Isso gera o `.firebaserc`. Os arquivos `firebase.json` e `firestore.rules` já estão prontos.)

### 7. Build + deploy
```bash
npm run build
firebase deploy --only hosting,firestore:rules
```
Ao final, a CLI mostra a URL pública (algo como `https://SEU-PROJETO.web.app`). 🎉

> Atualizações futuras: repita `npm run build && firebase deploy --only hosting`.

---

## 🧱 Primeira configuração de dados

Não é mais preciso criar documentos na mão. O fluxo é todo pela interface:

1. Entre no app com **Google**.
2. Na tela de seleção, escolha **Criar pelada**, informe o nome e confirme —
   você vira o presidente e recebe um **código** para compartilhar.
3. A galera entra com **Entrar numa pelada** (busca por nome ou pelo código)
   e clica em **Pedir para entrar**.
4. Você, como presidente, aprova cada um na aba **Elenco**.

> Cada pelada tem um código próprio (ex: `K7P2QX`). Quem tiver o código ou o
> nome encontra a pelada na busca.

---

## 💸 Por que isso quase não gera custo

O Firestore cobra por **documento lido**. O app foi desenhado para ler pouco:

- **Estado do jogo do dia** (fila + presença + times) vive em **1 documento**
  (`sessoes/{id}`). Um único listener traz tudo em tempo real.
- **Artilharia e nº de jogos** ficam **agregados no doc de cada jogador**,
  atualizados por `increment()` no momento do gol/partida — o ranking nunca
  varre a coleção de eventos.
- **Votação** usa **1 documento de contadores** (`votacao/_resumo`), não 1 doc por voto.
- Históricos usam leitura única (`getDoc`), e listeners só rodam na tela ativa.

Resultado: uma pelada típica fica **muito** abaixo da cota gratuita (Spark).

---

## 📁 Estrutura

```
src/
  lib/
    firebase.js   → credenciais e init
    data.js       → TODAS as leituras/escritas (camada única)
    sorteio.js    → times equilibrados por nível + rodízio
    clima.js      → Open-Meteo (sem API key) + link de rota
  context/
    AuthContext.jsx → login Google + papéis (presidente/admin/jogador)
  components/
    Jogo.jsx       → fila, presença, sorteio, gols, resultado
    Jogadores.jsx  → aprovação, níveis, mensalidade
    Stats.jsx      → artilharia, mais jogos
    Votacao.jsx    → melhor / pior / gol mais bonito
    Local.jsx      → clima e rota
    Cronometro.jsx → cronômetro da partida
  App.jsx          → navegação por abas
```

---

## 🗺️ Roadmap (por prioridade × dificuldade)

**Fase 1 — MVP (já implementado)**
cadastro+aprovação · fila por chegada · confirmação de presença ·
sorteio de times · saída de jogador · perdedor pro fim da fila

**Fase 2 — dia de jogo (já implementado)**
cronômetro · artilharia · goleiro fixo/rotativo · níveis configuráveis

**Fase 3 — comunidade (já implementado)**
mensalidade · mais jogos · local+rota+clima · votação

**Fase 4 — engajamento (já implementado)**
- Temporada/ranking acumulado (gol 2pts · vitória 3 · presença 1) com campeão
- Prêmios automáticos do mês: 🥇 Artilheiro · 🧤 Muralha · 🏃 Presença · 🤡 Pereba
- Card estilo FIFA com "overall" e compartilhamento no WhatsApp
- Convocação/lembrete de presença via WhatsApp (sem custo, sem plano pago)
- Caixa financeiro (entradas x saídas, saldo do mês)
- Freguesia (saldo de confrontos contra cada adversário)

> Nota sobre push real: notificação push nativa exige Cloud Functions +
> plano Blaze (pago). Para manter tudo no plano gratuito, o lembrete usa
> link do WhatsApp (`wa.me`). Se um dia migrar pro Blaze, dá pra trocar por
> push de verdade com FCM.
```
