# Decisões de Arquitetura

Este documento registra as decisões estruturais do projeto, o problema que cada uma resolve e a referência que a fundamenta.

## 1. Clean Architecture e regra de dependência

**Contexto.** A versão inicial concentrava dados, regras de negócio, acesso à rede, temporizadores e interface em um único componente React de 1.424 linhas. Nenhuma regra podia ser testada sem renderizar a tela.

**Decisão.** Separação em camadas concêntricas, com dependências de código apontando apenas para dentro (Martin, 2017, cap. 22).

| Camada           | Responsabilidade                                                            | Exemplos                                             |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| `domain`         | Regras que existiriam mesmo sem software: filtragem, agregação, sanitização | `filterOrganizations`, `computeKpis`, `sanitizeText` |
| `application`    | Orquestração de um objetivo do usuário e definição das portas               | `SyncOsintFeedsUseCase`, `OsintFeedGateway`          |
| `infrastructure` | Detalhes substituíveis que implementam as portas                            | `SansIscOsintGateway`, `WebStorageThreatLogCache`    |
| `presentation`   | Renderização e captura de eventos                                           | `DashboardPage`, `useObservable`                     |
| `main`           | Montagem do grafo de objetos                                                | `createContainer`                                    |

**Consequência.** Domínio e aplicação não importam React nem APIs do navegador. Essa propriedade é verificada por teste automatizado.

## 2. Princípios SOLID

| Princípio | Aplicação no código                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRP       | Cada caso de uso tem um único motivo de mudança. A inspeção de tráfego e o registro de telemetria, antes no mesmo temporizador, são casos de uso distintos. |
| OCP       | Um novo feed OSINT é adicionado com outra implementação de `OsintFeedGateway`, sem alterar o caso de uso.                                                   |
| LSP       | Os dublês de teste (`FakeClock`, `StubGateway`) substituem as implementações reais sem alterar o comportamento esperado pelos consumidores.                 |
| ISP       | Portas pequenas e específicas (`Clock`, `RandomSource`, `RateLimiter`). A UI recebe `ReadonlyObservable`, sem acesso aos métodos de escrita.                |
| DIP       | Casos de uso dependem de interfaces declaradas na própria camada de aplicação. A apresentação declara `DashboardDependencies` e a camada `main` o satisfaz. |

Referência: Martin (2017, parte III).

## 3. Separação do Singleton

**Contexto.** O painel exige instância única de alguns objetos: o rate limiter, o circuit breaker e os estados observáveis precisam ser compartilhados por todos os consumidores. A forma clássica do padrão Singleton (Gamma et al., 1994), com construtor privado e método estático `getInstance()`, atribui duas responsabilidades à mesma classe: a regra que ela implementa e o controle do próprio ciclo de vida. O resultado é estado global oculto, acoplamento direto dos consumidores à classe concreta e testes que interferem uns nos outros.

**Decisão.** Separar as duas responsabilidades.

1. As classes são comuns: recebem dependências pelo construtor e não possuem estado estático.
2. A unicidade é uma política de tempo de vida aplicada externamente pelo contêiner (`src/main/container.ts`), por meio de `registerSingleton`.
3. O grafo é montado em um único ponto, a raiz de composição (`src/main/composition-root.ts`), conforme Seemann e van Deursen (2019, cap. 4).

**Consequência.** Cada contêiner mantém o próprio conjunto de instâncias. Os testes criam um contêiner por caso e substituem apenas as bordas (rede, relógio, aleatoriedade), exercitando o restante do grafo real.

## 4. Estado com Observable

**Contexto.** O estado do painel é alterado por fontes independentes da interface: polling de rede a cada 30 s e um temporizador de telemetria a cada 2,2 s.

**Decisão.** O estado reside em `ObservableState<T>` (`src/shared/observable/observable.ts`), implementação do padrão Observer (Gamma et al., 1994). Os casos de uso publicam valores e a interface se inscreve por meio do hook `useObservable`, construído sobre `useSyncExternalStore`, a API do React destinada a fontes externas de estado.

**Consequência.** Os casos de uso não conhecem o React. Cada componente é renderizado apenas quando o observável que ele consome emite: a atualização da série temporal não provoca nova renderização da tabela de organizações. Optou-se por implementação própria, com cerca de 40 linhas, em vez de uma biblioteca reativa completa, pois apenas inscrição e retenção do último valor são necessárias.

## 5. Padrões de resiliência

| Padrão           | Implementação              | Referência                                        |
| ---------------- | -------------------------- | ------------------------------------------------- |
| Circuit Breaker  | `TimedCircuitBreaker`      | Nygard (2018, cap. 5)                             |
| Token Bucket     | `TokenBucketRateLimiter`   | Tanenbaum e Wetherall (2011)                      |
| Cache de reserva | `WebStorageThreatLogCache` | RFC 5861 (stale-while-revalidate, stale-if-error) |

Ambos os componentes temporais recebem a porta `Clock`, o que permite testar expiração e reposição de forma determinística, sem espera real.

## 6. Tratamento de dados não confiáveis

Todo dado que cruza uma fronteira de confiança é validado antes do uso.

| Origem                   | Tratamento                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Resposta da API SANS ISC | O gateway traduz o JSON para `AttackerRecord` com campos `unknown`; o domínio sanitiza IP, porta e texto. |
| `localStorage`           | Cada registro reidratado passa pelo type guard `isThreatLog`; registros adulterados são descartados.      |
| Entrada de busca         | Sanitizada e limitada a 60 caracteres antes da comparação.                                                |

A sanitização é uma defesa adicional. A proteção primária contra XSS é o escape automático de texto realizado pelo React na renderização.

## 7. Estratégia de testes

| Nível       | Escopo                                                                | Dublês                                   |
| ----------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Unitário    | Funções de domínio, casos de uso, adaptadores                         | Portas substituídas por fakes em memória |
| Integração  | `DashboardPage` com o grafo real montado pela raiz de composição      | Apenas rede, relógio, agendador e acaso  |
| Arquitetura | Regra de dependência entre camadas e ausência de frameworks no núcleo | Nenhum                                   |

Os testes de interface consultam a tela por papel e rótulo acessível, como faria um usuário, e não por detalhes de implementação.

## 8. Referências

- GAMMA, E.; HELM, R.; JOHNSON, R.; VLISSIDES, J. _Design Patterns: Elements of Reusable Object-Oriented Software_. Addison-Wesley, 1994.
- MARTIN, R. C. _Clean Code: A Handbook of Agile Software Craftsmanship_. Prentice Hall, 2008.
- MARTIN, R. C. _Clean Architecture: A Craftsman's Guide to Software Structure and Design_. Prentice Hall, 2017.
- NOTTINGHAM, M. _RFC 5861: HTTP Cache-Control Extensions for Stale Content_. IETF, 2010.
- NYGARD, M. T. _Release It! Design and Deploy Production-Ready Software_. 2. ed. Pragmatic Bookshelf, 2018.
- SEEMANN, M.; VAN DEURSEN, S. _Dependency Injection Principles, Practices, and Patterns_. Manning, 2019.
- TANENBAUM, A. S.; WETHERALL, D. J. _Computer Networks_. 5. ed. Pearson, 2011.
