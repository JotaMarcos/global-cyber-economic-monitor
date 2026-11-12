# Global Cyber & Economic Real-Time Monitor

Dashboard de observabilidade em tempo real que cruza indicadores económicos multi-setoriais (Primário, Secundário, Terciário e ONGs) com feeds reais de Threat Intelligence OSINT (**SANS ISC / DShield**, **Abuse.ch Feodo Tracker** e **CISA KEV**).

## Arquitetura de Resiliência & Segurança
- **Edge Shield & Rate Limiting:** Implementação de *Token Bucket* para mitigação de rajadas DDoS e sanitização estrita anti-XSS/SQLi.
- **Alta Disponibilidade:** Padrão *Circuit Breaker* aliado a cache SWR (*Stale-While-Revalidate*) e buffers circulares em memória.
- **Drill-Down Geoespacial:** Filtragem dinâmica por Visão Global, Países, Estados e Municípios.
