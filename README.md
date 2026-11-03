# Doses — Gestão e Acompanhamento de Medicamentos (PWA)

O **Doses** é um aplicativo web progressivo (Progressive Web App — PWA) desenvolvido com **React**, **TypeScript** e **Vite**, projetado para auxiliar pessoas a organizarem seus próprios medicamentos ou acompanharem a administração de medicamentos de terceiros (familiares, idosos sob cuidados e animais de estimação).

> **Aviso importante:** O Doses é exclusivamente uma ferramenta de organização e acompanhamento de prescrições já existentes. Ele não realiza recomendações médicas, cálculos automáticos de dosagem nem alterações de prescrições.

---

## 1. Tecnologias Utilizadas

- **React 19** (`react`, `react-dom`) — Construção declarativa e componentizada da interface.
- **TypeScript 5.7** (`typescript`) — Tipagem estática rigorosa em todas as camadas de domínio, serviços e componentes.
- **Vite 6** (`vite`, `@vitejs/plugin-react`) — Servidor de desenvolvimento rápido e empacotamento otimizado para produção.
- **React Router 7** (`react-router-dom`) — Roteamento SPA entre as 5 telas principais com suporte offline via `navigateFallback`.
- **Vite Plugin PWA** (`vite-plugin-pwa` / Workbox) — Geração automática do `manifest.webmanifest`, Service Worker (`sw.js`), precache de assets essenciais e cache em tempo de execução para fontes.
- **CSS Moderno (`@layer`, Custom Properties, Mobile-First)** — Arquitetura em camadas sem dependências pesadas de UI, aplicando a paleta de cores oficial e as fontes **Urbanist** e **Open Sans**.
- **JSON + LocalStorage Envelope (`SyncEnvelope`)** — Persistência local imediata preparada para futura sincronização com APIs externas.

---

## 2. Arquitetura de Diretórios

```text
Doses/
├── public/
│   ├── apple-touch-icon.png         # Ícone para instalação na Tela de Início do iOS (180x180)
│   ├── favicon.svg                  # Ícone vetorial da marca Doses
│   └── icons/
│       ├── icon-192x192.png         # Ícone PWA padrão (192x192)
│       ├── icon-512x512.png         # Ícone PWA de alta resolução (512x512)
│       └── maskable-icon-512x512.png# Ícone adaptável (maskable) para Android
├── src/
│   ├── assets/
│   │   └── icons.tsx                # Ícones SVG acessíveis e reutilizáveis
│   ├── components/
│   │   ├── AppLayout.tsx            # Estrutura responsiva (Sidebar Desktop + Bottom Nav Mobile)
│   │   └── DoseCard.tsx             # Cartão reutilizável de dose programada/administrada
│   ├── data/
│   │   └── initialData.json         # Dados iniciais estruturados em JSON (Perfis, Medicamentos, Doses)
│   ├── hooks/
│   │   ├── useDosesData.tsx         # Contexto e hook de estado de domínio + persistência
│   │   └── usePWAStatus.ts          # Hook para status online/offline e prompt de instalação PWA
│   ├── pages/
│   │   ├── DashboardPage.tsx        # 1. Visão geral do dia, próximos horários e pendências
│   │   ├── MedicationsPage.tsx      # 2. Listagem, busca e cadastro de medicamentos
│   │   ├── ProfilesPage.tsx         # 3. Gerenciamento de perfis (pessoas e pets)
│   │   ├── HistoryPage.tsx          # 4. Histórico tabular acessível de administrações
│   │   └── SettingsPage.tsx         # 5. Preferências, diagnóstico de notificações e backup JSON
│   ├── services/
│   │   ├── notificationService.ts   # Integração com Web Notifications API e diagnóstico iOS/PWA
│   │   └── storageService.ts        # Persistência JSON local com envelope de versão e sync futuro
│   ├── styles/
│   │   └── global.css               # Identidade visual, tokens CSS e responsividade
│   ├── types/
│   │   └── index.ts                 # Contratos e interfaces TypeScript do domínio
│   ├── utils/
│   │   └── dateUtils.ts             # Funções auxiliares de formatação de datas e turnos
│   ├── App.tsx                      # Configuração de rotas e provedores
│   ├── main.tsx                     # Ponto de entrada e registro do Service Worker
│   └── vite-env.d.ts                # Declarações de tipos Vite e PWA
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 3. Como Executar o Projeto Localmente

### Pré-requisitos
- **Node.js** 18+ (recomendado Node 20 ou 22)
- **npm** 9+

### Passo a passo

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   A aplicação ficará disponível em `http://localhost:5173`.

3. Para gerar a versão otimizada de produção e validar o PWA:
   ```bash
   npm run build
   npm run preview
   ```
   O servidor de preview abrirá em `http://localhost:4173` com o Service Worker de produção (`dist/sw.js`) e o manifesto (`dist/manifest.webmanifest`) ativos.

---

## 4. Como Testar a Instalação do PWA e o Modo Offline

### No Desktop (Google Chrome / Microsoft Edge)
1. Execute `npm run build && npm run preview` e acesse o endereço exibido no terminal.
2. Na barra de endereços do navegador (canto direito), clique no ícone **"Instalar Doses"** (ou utilize o botão **"Instalar aplicativo"** disponível na barra lateral/tela de Ajustes).
3. Para testar o funcionamento offline:
   - Abra o **Chrome DevTools** (`F12` ou `Cmd+Option+I`).
   - Acesse a aba **Application > Service Workers** e marque a caixa **Offline** (ou vá até a aba **Network** e mude de *No throttling* para *Offline*).
   - Recarregue a página (`Cmd+R` / `F5`) e navegue entre **Início**, **Medicamentos**, **Perfis**, **Histórico** e **Ajustes**. A aplicação continuará funcionando integralmente e exibirá o indicador **Modo Offline**.

### No Android (Chrome)
1. Acesse a URL da aplicação pelo Chrome no Android.
2. Toque no menu de três pontos (canto superior direito) e selecione **"Instalar aplicativo"** ou **"Adicionar à tela inicial"**.
3. O aplicativo será instalado com ícone próprio e abrirá em tela cheia (`display: standalone`), sem a barra de endereços do navegador.

### No iOS / iPadOS (Safari)
1. Abra a aplicação no **Safari** do iPhone ou iPad.
2. Toque no botão **Compartilhar** (ícone de quadrado com seta para cima na barra inferior).
3. Role as opções e toque em **"Adicionar à Tela de Início"** (*Add to Home Screen*).
4. Confirme tocando em **Adicionar**. O aplicativo abrirá de forma independente a partir da Tela de Início e, no iOS 16.4+, passará a suportar permissões da Web Notifications API quando aberto a partir do ícone instalado.
