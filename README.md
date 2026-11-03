# Doses — Gestão e Acompanhamento de Medicamentos (PWA)

O **Doses** é um aplicativo web progressivo (Progressive Web App — PWA) desenvolvido com **React**, **TypeScript** e **Vite**, projetado para auxiliar pessoas a organizarem seus próprios medicamentos ou acompanharem a administração de medicamentos de terceiros (familiares, idosos sob cuidados e animais de estimação).

> **Aviso importante:** O Doses é exclusivamente uma ferramenta de organização e acompanhamento de prescrições já existentes. Ele não realiza recomendações médicas, cálculos automáticos de dosagem nem alterações de prescrições.

---

## 1. Tecnologias Utilizadas

- **React 19** (`react`, `react-dom`) — Construção declarativa e componentizada da interface.
- **TypeScript 5.7** (`typescript`) — Tipagem estática rigorosa.
- **Vite 6** (`vite`, `@vitejs/plugin-react`) — Servidor de desenvolvimento rápido e empacotamento otimizado para produção.
- **Vite Plugin PWA** (`vite-plugin-pwa` / Workbox) — Geração automática do `manifest.webmanifest`, Service Worker (`sw.js`), precache de assets essenciais e cache em tempo de execução para fontes.
- **CSS Moderno (`@layer`, Custom Properties, Mobile-First)** — Arquitetura em camadas com tokens de cores e tipografia oficiais (**Urbanist** e **Open Sans**).

---

## 2. Estrutura de Diretórios Atual

```text
Doses/
├── public/
│   ├── apple-touch-icon.png         # Ícone para instalação no iOS (180x180)
│   ├── favicon.svg                  # Ícone vetorial da marca Doses
│   └── icons/
│       ├── icon-192x192.png         # Ícone PWA padrão (192x192)
│       ├── icon-512x512.png         # Ícone PWA de alta resolução (512x512)
│       └── maskable-icon-512x512.png# Ícone adaptável (maskable) para Android
├── src/
│   ├── assets/
│   │   └── icons.tsx                # Ícones base SVG (Logotipo Doses e utilitários)
│   ├── components/                  # Diretório preparado para componentes reutilizáveis reais
│   ├── data/                        # Diretório preparado para esquemas ou sementes de dados
│   ├── hooks/
│   │   └── usePWAStatus.ts          # Hook para status online/offline e prompt de instalação PWA
│   ├── pages/                       # Diretório preparado para as páginas definitivas
│   ├── services/
│   │   └── notificationService.ts   # Serviço de plataforma para Web Notifications e diagnóstico iOS/PWA
│   ├── styles/
│   │   └── global.css               # Camadas CSS (@layer), tokens de cores e tipografia oficial
│   ├── types/
│   │   └── index.ts                 # Contratos de domínio (Profile, Medication, DoseLog, AppSettings)
│   ├── utils/
│   │   └── dateUtils.ts             # Funções utilitárias puras de manipulação e formatação de datas
│   ├── App.tsx                      # Ponto de entrada com tela inicial limpa de identificação do Doses
│   ├── main.tsx                     # Ponto de entrada React e registro do Service Worker
│   └── vite-env.d.ts                # Declarações de tipos Vite e PWA
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 3. Como Executar o Projeto Localmente

```bash
# Executar em desenvolvimento
npm run dev

# Gerar build de produção
npm run build

# Pré-visualizar build de produção com Service Worker ativo
npm run preview
```
