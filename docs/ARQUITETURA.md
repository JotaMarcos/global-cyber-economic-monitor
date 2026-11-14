# Arquitetura e Decisões de Projeto

Este documento registra as decisões estruturais do sistema, o problema que cada uma resolve e a referência que a fundamenta.

## 1. Visão de contexto

```
 Fontes públicas                Gateway (Node)                         Dashboard (React)
┌───────────────────┐   HTTPS  ┌──────────────────────────────┐  SSE  ┌──────────────────────┐
│ Ransomware.live   │ ───────► │ adaptadores + validação      │ ────► │ estado observável    │
│ CISA KEV          │          │ monitor por fonte            │       │ domínio (filtros,    │
│ NIST NVD          │          │  (circuit breaker, timeout,  │       │  agregações,         │
│ SANS ISC          │          │   último conjunto válido)    │       │  estimativa)         │
│ abuse.ch Feodo    │          │ serviço de agregação         │       │ componentes          │
│ Spamhaus DROP     │          │ servidor HTTP + SSE          │       │                      │
│ FIRST Teams       │          │                              │       │                      │
└───────────────────┘          └──────────────┬───────────────┘       └──────────┬───────────┘
                                              └────── contrato versionado ───────┘
                                                 src/contract (esquemas Zod)
```

## 2. Domain-Driven Design

### 2.1 Contextos delimitados

| Contexto                 | Local          | Responsabilidade                                           |
| ------------------------ | -------------- | ---------------------------------------------------------- |
| Ingestão de inteligência | `src/gateway`  | Coletar, validar e normalizar dados de fontes heterogêneas |
| Análise e apresentação   | `src/web`      | Recortar, agregar, estimar e exibir                        |
| Contrato publicado       | `src/contract` | Linguagem compartilhada entre os dois contextos            |

Os dois contextos não se importam mutuamente. A relação entre eles segue o padrão _Published Language_ (Evans, 2003, cap. 14): ambos dependem apenas do contrato. Cada adaptador de fonte atua como _Anticorruption Layer_, impedindo que o formato de uma API externa alcance o restante do sistema.

### 2.2 Linguagem ubíqua

| Termo                | Significado no sistema                                                            |
| -------------------- | --------------------------------------------------------------------------------- |
| Incidente            | Organização divulgada publicamente como vítima por um grupo de ransomware         |
| Grupo de ameaça      | Autor declarado da divulgação                                                     |
| Fonte                | Serviço externo consultado periodicamente                                         |
| Leitura              | Resultado de uma coleta: dados aceitos, quantidade válida e quantidade rejeitada  |
| Retrato (_snapshot_) | Estado consolidado de todas as fontes em um instante                              |
| Equipe de resposta   | Membro do FIRST (CSIRT, SOC, PSIRT ou ISAC)                                       |
| Prejuízo estimado    | Incidentes multiplicados pelo custo de referência. Nunca representa perda apurada |
| Custo de referência  | Parâmetro de estimativa, com citação da origem                                    |
| Rede sequestrada     | Bloco de endereços ou sistema autônomo listado pelo Spamhaus (DROP e ASN-DROP)    |
| Recorte              | Subconjunto definido pelos filtros de continente, país, setor e busca             |
| Divisão territorial  | Estados e municípios oficiais (IBGE). Referência para filtro, nunca para dados    |
| Recorte subnacional  | Estado ou município selecionado. Os indicadores permanecem no nível do país       |

### 2.3 Regras de domínio

As regras residem em funções puras, sem dependência de framework: `buildOverview`, `estimateLossUsd`, `continentOf`, `withContinent`, `withCountry`, `withState` e a busca de texto completo (`src/web/domain`).

### 2.4 Busca de texto completo

A busca por organização, grupo de ameaça, setor, país ou equipe usa um índice invertido em memória (`src/web/domain/full-text-search.ts`):

1. **Análise léxica.** Documentos e consultas passam pelo mesmo tratamento: minúsculas, remoção de acentos, separação em termos e descarte de palavras vazias em português e inglês.
2. **Índice invertido.** Cada termo aponta para os documentos em que ocorre, com frequência ponderada pelo peso do campo (nome 3, grupo 2, demais 1). O índice é montado uma vez por conjunto de dados recebido; cada tecla apenas o consulta.
3. **Consulta.** Todos os termos precisam ocorrer (semântica E). Cada termo casa por igualdade ou por prefixo, localizado por busca binária no vocabulário ordenado. Trechos entre aspas exigem a frase exata.
4. **Relevância.** Os resultados são ordenados pela função BM25 (Robertson e Zaragoza, 2009), com correspondência por prefixo valendo menos que a exata.

Rótulos legíveis (nome do setor em português, nome do país) são indexados junto com os códigos, de modo que "saúde" e "brasil" encontram registros que a fonte classifica como "Healthcare" e "BR".

## 3. Clean Architecture

Em cada contexto, as dependências de código apontam para dentro (Martin, 2017, cap. 22).

| Módulo                   | Pode depender de                                      |
| ------------------------ | ----------------------------------------------------- |
| `shared`, `contract`     | nenhum                                                |
| `gateway/application`    | `contract`, `shared`                                  |
| `gateway/infrastructure` | `gateway/application`, `contract`, `shared`           |
| `gateway/main`           | todos os módulos do gateway                           |
| `web/domain`             | `contract`, `shared`                                  |
| `web/application`        | `web/domain`, `contract`, `shared`                    |
| `web/infrastructure`     | `web/application`, `web/domain`, `contract`, `shared` |
| `web/presentation`       | `web/application`, `web/domain`, `contract`, `shared` |
| `web/main`               | todos os módulos do dashboard                         |

A regra é verificada por `no-restricted-imports` no ESLint e pelo teste `tests/architecture/layer-boundaries.test.ts`.

## 4. Princípios SOLID

| Princípio | Aplicação                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| SRP       | Adaptador traduz, `SourceMonitor` cuida de resiliência e saúde, `ThreatIntelService` agrega, o servidor HTTP apenas expõe.               |
| OCP       | Uma nova fonte é uma nova implementação de `ThreatSource<T>` registrada na raiz de composição. Nenhuma classe existente é alterada.      |
| LSP       | Os dublês de teste substituem as implementações reais sem alterar o comportamento esperado pelos consumidores.                           |
| ISP       | Portas pequenas (`Clock`, `Scheduler`, `HttpClient`, `CircuitBreaker`). A interface recebe `ReadonlyObservable`, sem métodos de escrita. |
| DIP       | Camadas internas declaram as portas. A apresentação declara `DashboardDependencies` e a raiz de composição o satisfaz.                   |

## 5. Separação do Singleton

A forma clássica do padrão Singleton (Gamma et al., 1994), com `getInstance()` estático, atribui à classe o controle do próprio ciclo de vida e introduz estado global. Neste projeto as responsabilidades são separadas:

1. As classes são comuns: recebem dependências pelo construtor e não possuem estado estático.
2. A unicidade é uma política de tempo de vida aplicada pelo contêiner (`src/shared/di/container.ts`).
3. Cada processo tem uma raiz de composição (`src/gateway/main` e `src/web/main`), único ponto que conhece as classes concretas (Seemann e van Deursen, 2019, cap. 4).

Uma exceção deliberada: o circuit breaker não é singleton. Cada fonte recebe a própria instância, para que a falha de uma agência não interrompa a coleta das demais.

## 6. Observable

O estado é mantido em `ObservableState<T>`, implementação do padrão Observer.

- **No gateway**, cada `SourceMonitor` publica o estado da fonte. O serviço de agregação observa os monitores e republica o retrato. O servidor HTTP observa o retrato e o transmite aos clientes conectados.
- **No dashboard**, o caso de uso de monitoramento publica o retrato recebido e os componentes se inscrevem por `useSyncExternalStore`.

O fluxo é reativo de ponta a ponta: uma nova coleta em qualquer fonte chega à tela sem consulta periódica por parte do navegador.

## 7. Resiliência

| Mecanismo                 | Implementação         | Efeito                                                                   |
| ------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Circuit breaker por fonte | `TimedCircuitBreaker` | Suspende a coleta após 3 falhas e testa a recuperação após 60 s          |
| Tempo limite por fonte    | `SourceMonitor`       | Aborta coletas lentas (20 a 45 s, conforme a fonte)                      |
| Último conjunto válido    | `SourceMonitor`       | Em falha, os dados anteriores continuam servidos, sinalizados como cache |
| Limite de taxa de entrada | `ClientRateLimiter`   | Token bucket por cliente (60 de capacidade, 10 por segundo)              |
| Limite de conexões SSE    | `createGatewayServer` | Recusa novas conexões acima de 200, com `Retry-After`                    |

Referências: Nygard (2018, cap. 5) para circuit breaker e tempo limite; Tanenbaum e Wetherall (2011) para token bucket.

## 8. Validação de dados

Todo dado é tratado como não confiável ao cruzar uma fronteira.

| Fronteira               | Tratamento                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Fonte externa → gateway | Esquema Zod por registro. Registro inválido é descartado e contabilizado; os demais seguem.           |
| Envelope da resposta    | Formato inesperado é tratado como falha da fonte, com preservação do último conjunto válido.          |
| Formato por linha       | Listas em JSON delimitado por linha (Spamhaus) são lidas como texto; a linha de metadados é ignorada. |
| Texto externo           | `cleanText` remove caracteres de controle e delimitadores de marcação e limita o tamanho.             |
| Endereços e URLs        | IPs validados por formato. URLs aceitas apenas com esquema `http` ou `https`.                         |
| Gateway → dashboard     | O dashboard valida cada mensagem contra o contrato. Mensagem inválida é descartada e contabilizada.   |

As contagens de registros válidos e rejeitados por fonte são exibidas no painel "Integrações e qualidade dos dados". A proteção primária contra XSS é o escape de texto realizado pelo React, reforçado por uma política CSP restritiva enviada pelo gateway.

## 9. Estratégia de testes e garantia de qualidade

| Nível               | Escopo                                                                                      | Dublês                                          |
| ------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Unitário            | Regras de domínio, casos de uso, resiliência, configuração                                  | Relógio, agendador e portas em memória          |
| Contrato            | Cada adaptador processa uma amostra real da respectiva API e produz saída válida            | Apenas a rede, substituída pela amostra gravada |
| Integração          | Gateway montado pela raiz de composição real; servidor HTTP em porta efêmera, incluindo SSE | Rede externa                                    |
| Interface           | Painel completo com o grafo real do dashboard, consultado por papel e rótulo acessível      | Apenas o feed do gateway                        |
| Arquitetura         | Regra de dependência, isolamento entre contextos, ausência de frameworks no núcleo          | Nenhum                                          |
| Verificação ao vivo | `npm run verify:sources` consulta as fontes reais e relata rejeições                        | Nenhum                                          |

As amostras em `tests/fixtures` foram obtidas das APIs reais e reduzidas. Os endereços de sites de vazamento foram substituídos por valor neutro.

O pipeline de integração contínua executa verificação de tipos, lint, formatação, testes com limiar de cobertura e build a cada push.

**Limitações conhecidas.** Não há teste de ponta a ponta automatizado em navegador no repositório; a verificação em navegador foi feita manualmente durante o desenvolvimento. Os testes de contrato detectam mudanças de formato apenas quando as amostras são regravadas ou quando `verify:sources` é executado.

## 10. Referências

- EVANS, E. _Domain-Driven Design: Tackling Complexity in the Heart of Software_. Addison-Wesley, 2003.
- GAMMA, E.; HELM, R.; JOHNSON, R.; VLISSIDES, J. _Design Patterns: Elements of Reusable Object-Oriented Software_. Addison-Wesley, 1994.
- MARTIN, R. C. _Clean Code: A Handbook of Agile Software Craftsmanship_. Prentice Hall, 2008.
- MARTIN, R. C. _Clean Architecture: A Craftsman's Guide to Software Structure and Design_. Prentice Hall, 2017.
- NYGARD, M. T. _Release It! Design and Deploy Production-Ready Software_. 2. ed. Pragmatic Bookshelf, 2018.
- ROBERTSON, S.; ZARAGOZA, H. The Probabilistic Relevance Framework: BM25 and Beyond. _Foundations and Trends in Information Retrieval_, v. 3, n. 4, p. 333-389, 2009.
- SEEMANN, M.; VAN DEURSEN, S. _Dependency Injection Principles, Practices, and Patterns_. Manning, 2019.
- TANENBAUM, A. S.; WETHERALL, D. J. _Computer Networks_. 5. ed. Pearson, 2011.
