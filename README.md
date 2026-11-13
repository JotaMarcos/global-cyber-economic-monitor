# Global Cyber & Economic Real-Time Monitor

Dashboard de observabilidade em tempo real que cruza indicadores econômicos multissetoriais (setores primário, secundário, terciário e terceiro setor) com Threat Intelligence OSINT.

## 1. Funcionalidades

| Recurso                | Descrição                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Feed OSINT             | Consulta periódica (30 s) à API pública do SANS ISC / DShield (`infocon` e `topips`), com sanitização de todo conteúdo externo. |
| Base curada            | Registros de referência (SANS ISC, Abuse.ch Feodo Tracker, CISA KEV) exibidos até a primeira sincronização e em caso de falha.  |
| Circuit Breaker        | Interrompe as consultas após 3 falhas consecutivas e libera uma requisição de teste depois de 15 s.                             |
| Cache SWR              | Último feed válido persistido em `localStorage` e reutilizado quando a origem está indisponível.                                |
| Rate limiting          | Token bucket (capacidade 90, reposição de 30 tokens/s) aplicado ao tráfego simulado.                                            |
| Simulação de DDoS      | Rajada sintética de 950 req/s para demonstrar o descarte por rate limiting e o bloqueio de cargas XSS.                          |
| Drill-down geoespacial | Filtros encadeados por país, estado e município, além de setor econômico e busca textual.                                       |
| Séries temporais       | Janela deslizante de 24 pontos, com consumo de memória constante.                                                               |

Os dados de organizações, volumes e contagens de ataques são ilustrativos. A telemetria de tráfego é simulada no cliente.

## 2. Arquitetura

O projeto segue a Clean Architecture: as dependências de código apontam sempre para as camadas internas.

```
src/
├── shared/          Observable (padrão Observer), sem dependências
├── domain/          Entidades e regras de negócio puras
├── application/     Casos de uso, portas (interfaces) e estado observável
├── infrastructure/  Adaptadores: HTTP, Web Storage, relógio, resiliência, dados
├── presentation/    Componentes React, hooks e contrato de dependências da UI
└── main/            Raiz de composição e contêiner de injeção de dependências
```

| Camada           | Pode depender de                  |
| ---------------- | --------------------------------- |
| `shared`         | nenhuma                           |
| `domain`         | `shared`                          |
| `application`    | `domain`, `shared`                |
| `infrastructure` | `application`, `domain`, `shared` |
| `presentation`   | `application`, `domain`, `shared` |
| `main`           | todas                             |

A regra é verificada de duas formas: `no-restricted-imports` no ESLint e o teste `tests/architecture/layer-boundaries.test.ts`.

As decisões de projeto e sua fundamentação estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## 3. Execução

Requisito: Node.js 20 ou superior.

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # verificação de tipos e build de produção
npm run preview    # serve o build gerado
```

## 4. Qualidade

| Comando                 | Finalidade                                                |
| ----------------------- | --------------------------------------------------------- |
| `npm run typecheck`     | Verificação estática com TypeScript em modo estrito       |
| `npm run lint`          | ESLint, incluindo as fronteiras entre camadas             |
| `npm run format:check`  | Conferência de formatação com Prettier                    |
| `npm test`              | Testes unitários, de integração e de arquitetura (Vitest) |
| `npm run test:coverage` | Testes com cobertura (limiar mínimo de 85% de linhas)     |
| `npm run check`         | Executa todas as verificações acima e o build             |

## 5. Stack

React 19, TypeScript, Vite, Tailwind CSS, Recharts, Vitest e Testing Library.
