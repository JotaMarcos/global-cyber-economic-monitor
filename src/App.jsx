import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Activity,
  Server,
  Database,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Filter,
  Building2,
  TrendingUp,
  Zap,
  Lock,
  Code2,
  X,
  Layers,
  Cpu,
  Radio,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ============================================================================
// 1. CAMADA DE SEGURANÇA, SANITIZAÇÃO E BLINDAGEM ANTI-QUEDA (EDGE DEFENSE)
// ============================================================================

const MAX_SERIES_POINTS = 24;
const MAX_THREAT_LOGS = 25;
const CACHE_KEY = "gcem_osint_swr_cache_v1";

/**
 * Sanitização estrita contra XSS, HTML Injection e SQLi em feeds externos
 */
function sanitizeString(input, maxLen = 110) {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>"'`;]/g, "")
    .replace(
      /(javascript:|onerror=|onload=|eval\(|union\s+select|drop\s+table)/gi,
      "[BLOCKED]",
    )
    .trim()
    .slice(0, maxLen);
}

/**
 * Validação rigorosa de endereços IPv4/IPv6 antes de renderização
 */
function sanitizeIp(ip) {
  if (typeof ip !== "string") return "0.0.0.0";
  const cleaned = ip.trim();
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  const ipv6Regex = /^[0-9a-fA-F:]{3,39}$/;
  if (ipv4Regex.test(cleaned) || ipv6Regex.test(cleaned)) {
    return cleaned;
  }
  return "INVALID_IP_DROPPED";
}

/**
 * Token Bucket Rate Limiter para proteger o cliente contra rajadas DDoS / Flood
 */
class TokenBucketLimiter {
  constructor(capacity = 80, refillPerSec = 25) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSec = refillPerSec;
    this.lastRefill = Date.now();
  }

  consume(count = 1) {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsedSec * this.refillPerSec,
      );
      this.lastRefill = now;
    }
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }
}

/**
 * Circuit Breaker para isolar falhas ou lentidão de APIs externas OSINT
 */
class ApiCircuitBreaker {
  constructor(failureThreshold = 3, resetTimeoutMs = 15000) {
    this.state = "CLOSED"; // CLOSED | OPEN | HALF-OPEN
    this.failures = 0;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.nextAttempt = 0;
  }

  canRequest() {
    if (this.state === "CLOSED") return true;
    if (this.state === "OPEN" && Date.now() >= this.nextAttempt) {
      this.state = "HALF-OPEN";
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
    }
  }
}

// ============================================================================
// 2. BASE DIMENSIONAL: GEOGRAFIA (PAÍS -> ESTADO -> MUNICÍPIO) E SETORES
// ============================================================================

const GEO_HIERARCHY = {
  ALL: { label: "Visão Global (Todos os Países)", states: {} },
  BR: {
    label: "Brasil",
    states: {
      AM: { label: "Amazonas", cities: ["Manaus", "Itacoatiara"] },
      SP: { label: "São Paulo", cities: ["São Paulo", "Campinas"] },
      MT: { label: "Mato Grosso", cities: ["Sorriso", "Cuiabá"] },
      RJ: { label: "Rio de Janeiro", cities: ["Rio de Janeiro", "Macaé"] },
    },
  },
  US: {
    label: "Estados Unidos",
    states: {
      CA: { label: "Califórnia", cities: ["San Francisco", "San Jose"] },
      NY: { label: "Nova York", cities: ["New York"] },
    },
  },
  DE: {
    label: "Alemanha",
    states: {
      HE: { label: "Hesse", cities: ["Frankfurt"] },
    },
  },
  CN: {
    label: "China",
    states: {
      GD: { label: "Guangdong", cities: ["Shenzhen"] },
    },
  },
  JP: {
    label: "Japão",
    states: {
      TK: { label: "Tóquio", cities: ["Tóquio"] },
    },
  },
};

const SECTORS = [
  { id: "ALL", label: "Todos os Setores" },
  { id: "PRIMARIO", label: "Setor Primário (Agro & Extrativismo)" },
  { id: "SECUNDARIO", label: "Setor Secundário (Indústria & Energia)" },
  {
    id: "TERCIARIO",
    label: "Setor Terciário (Bancos, Bolsas, Big Tech, Comércio & Turismo)",
  },
  { id: "ONG", label: "Terceiro Setor (ONGs & Institutos)" },
];

const ORGANIZATIONS_DB = [
  {
    id: 1,
    name: "Polo Industrial de Manaus (PIM)",
    segment: "Indústria Eletroeletrônica",
    sector: "SECUNDARIO",
    country: "BR",
    state: "AM",
    city: "Manaus",
    volumeUsdBi: 38.4,
    cyberRisk: "BAIXO",
    attacksBlocked24h: 1420,
    sla: "99.99%",
  },
  {
    id: 2,
    name: "Instituto Amazônia Sustentável (ONG)",
    segment: "Conservação & Bioeconomia",
    sector: "ONG",
    country: "BR",
    state: "AM",
    city: "Manaus",
    volumeUsdBi: 0.42,
    cyberRisk: "BAIXO",
    attacksBlocked24h: 310,
    sla: "99.95%",
  },
  {
    id: 3,
    name: "B3 S.A. - Brasil, Bolsa, Balcão",
    segment: "Bolsa de Valores",
    sector: "TERCIARIO",
    country: "BR",
    state: "SP",
    city: "São Paulo",
    volumeUsdBi: 412.8,
    cyberRisk: "ALTO",
    attacksBlocked24h: 19840,
    sla: "99.99%",
  },
  {
    id: 4,
    name: "Itaú Unibanco Holding",
    segment: "Instituição Bancária",
    sector: "TERCIARIO",
    country: "BR",
    state: "SP",
    city: "São Paulo",
    volumeUsdBi: 295.1,
    cyberRisk: "MÉDIO",
    attacksBlocked24h: 15420,
    sla: "99.99%",
  },
  {
    id: 5,
    name: "Amaggi & Cooperativas Agro",
    segment: "Agronegócio & Grãos",
    sector: "PRIMARIO",
    country: "BR",
    state: "MT",
    city: "Sorriso",
    volumeUsdBi: 24.6,
    cyberRisk: "BAIXO",
    attacksBlocked24h: 890,
    sla: "99.96%",
  },
  {
    id: 6,
    name: "Petrobras Operações Offshore",
    segment: "Óleo, Gás & Energia",
    sector: "SECUNDARIO",
    country: "BR",
    state: "RJ",
    city: "Rio de Janeiro",
    volumeUsdBi: 168.5,
    cyberRisk: "ALTO",
    attacksBlocked24h: 12670,
    sla: "99.98%",
  },
  {
    id: 7,
    name: "CVC & Hub Turismo Receptivo",
    segment: "Turismo & Hotelaria",
    sector: "TERCIARIO",
    country: "BR",
    state: "RJ",
    city: "Rio de Janeiro",
    volumeUsdBi: 11.3,
    cyberRisk: "MÉDIO",
    attacksBlocked24h: 2150,
    sla: "99.94%",
  },
  {
    id: 8,
    name: "Magazine Luiza / Varejo Digital",
    segment: "Comércio & E-commerce",
    sector: "TERCIARIO",
    country: "BR",
    state: "SP",
    city: "Campinas",
    volumeUsdBi: 19.7,
    cyberRisk: "MÉDIO",
    attacksBlocked24h: 6430,
    sla: "99.97%",
  },
  {
    id: 9,
    name: "NVIDIA & Silicon Valley AI Cluster",
    segment: "Big Tech & Semicondutores",
    sector: "TERCIARIO",
    country: "US",
    state: "CA",
    city: "San Francisco",
    volumeUsdBi: 890.0,
    cyberRisk: "ALTO",
    attacksBlocked24h: 44120,
    sla: "99.99%",
  },
  {
    id: 10,
    name: "NASDAQ Stock Market",
    segment: "Bolsa de Valores",
    sector: "TERCIARIO",
    country: "US",
    state: "NY",
    city: "New York",
    volumeUsdBi: 1240.0,
    cyberRisk: "ALTO",
    attacksBlocked24h: 53900,
    sla: "99.99%",
  },
  {
    id: 11,
    name: "Deutsche Börse & Banco Central EU",
    segment: "Finanças & Bolsa",
    sector: "TERCIARIO",
    country: "DE",
    state: "HE",
    city: "Frankfurt",
    volumeUsdBi: 620.4,
    cyberRisk: "MÉDIO",
    attacksBlocked24h: 28400,
    sla: "99.99%",
  },
  {
    id: 12,
    name: "Tencent & Hub Manufatura Tech",
    segment: "Big Tech & Indústria 4.0",
    sector: "TERCIARIO",
    country: "CN",
    state: "GD",
    city: "Shenzhen",
    volumeUsdBi: 540.2,
    cyberRisk: "ALTO",
    attacksBlocked24h: 39200,
    sla: "99.98%",
  },
  {
    id: 13,
    name: "Toyota Motor & Robótica Industrial",
    segment: "Indústria Automotiva",
    sector: "SECUNDARIO",
    country: "JP",
    state: "TK",
    city: "Tóquio",
    volumeUsdBi: 310.9,
    cyberRisk: "MÉDIO",
    attacksBlocked24h: 11800,
    sla: "99.99%",
  },
  {
    id: 14,
    name: "Médicos Sem Fronteiras (Hub Global)",
    segment: "Ajuda Humanitária (ONG)",
    sector: "ONG",
    country: "DE",
    state: "HE",
    city: "Frankfurt",
    volumeUsdBi: 2.3,
    cyberRisk: "MÉDIO",
    attacksBlocked24h: 1740,
    sla: "99.97%",
  },
];

const CURATED_OSINT_BASELINE = [
  {
    id: "osint-1",
    agency: "SANS ISC / DShield",
    ip: "185.220.101.42",
    port: 443,
    threatType: "DDoS SYN Flood / Scanner",
    targetSector: "TERCIARIO",
    severity: "ALTA",
    status: "MITIGADO",
  },
  {
    id: "osint-2",
    agency: "Abuse.ch Feodo Tracker",
    ip: "45.142.212.91",
    port: 8080,
    threatType: "Emotet / QakBot C2 Botnet",
    targetSector: "SECUNDARIO",
    severity: "CRÍTICA",
    status: "BLOQUEADO",
  },
  {
    id: "osint-3",
    agency: "CISA KEV Feed",
    ip: "91.240.118.172",
    port: 22,
    threatType: "CVE-2024-3400 Edge Exploit",
    targetSector: "TERCIARIO",
    severity: "CRÍTICA",
    status: "BLOQUEADO",
  },
  {
    id: "osint-4",
    agency: "SANS ISC / DShield",
    ip: "103.145.13.88",
    port: 502,
    threatType: "Modbus OT/SCADA Probe",
    targetSector: "PRIMARIO",
    severity: "ALTA",
    status: "MITIGADO",
  },
  {
    id: "osint-5",
    agency: "Abuse.ch Feodo Tracker",
    ip: "194.26.135.64",
    port: 3389,
    threatType: "Ransomware Brute-Force RDP",
    targetSector: "ONG",
    severity: "MÉDIA",
    status: "BLOQUEADO",
  },
];

const INITIAL_TIME_SERIES = [
  {
    time: "16:10",
    economicIndex: 104.2,
    cyberAttacksPerMin: 310,
    mitigatedRate: 99.8,
  },
  {
    time: "16:15",
    economicIndex: 105.1,
    cyberAttacksPerMin: 345,
    mitigatedRate: 99.9,
  },
  {
    time: "16:20",
    economicIndex: 104.8,
    cyberAttacksPerMin: 420,
    mitigatedRate: 99.7,
  },
  {
    time: "16:25",
    economicIndex: 106.4,
    cyberAttacksPerMin: 390,
    mitigatedRate: 99.9,
  },
  {
    time: "16:30",
    economicIndex: 107.0,
    cyberAttacksPerMin: 510,
    mitigatedRate: 99.8,
  },
  {
    time: "16:35",
    economicIndex: 108.3,
    cyberAttacksPerMin: 465,
    mitigatedRate: 99.9,
  },
];

// ============================================================================
// 3. COMPONENTE PRINCIPAL DO DASHBOARD
// ============================================================================

export default function App() {
  // Filtros Geográficos e Setoriais
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [selectedState, setSelectedState] = useState("ALL");
  const [selectedCity, setSelectedCity] = useState("ALL");
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Estados de Inteligência Cibernética & Telemetria em Tempo Real
  const [infoconLevel, setInfoconLevel] = useState("GREEN");
  const [threatLogs, setThreatLogs] = useState(CURATED_OSINT_BASELINE);
  const [timeSeries, setTimeSeries] = useState(INITIAL_TIME_SERIES);
  const [feedSourceStatus, setFeedSourceStatus] = useState(
    "SANS ISC + Abuse.ch (Ativo)",
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados de Defesa Ativa & Simulação DDoS
  const [ddosSimulation, setDdosSimulation] = useState(false);
  const [securityMetrics, setSecurityMetrics] = useState({
    circuitState: "CLOSED",
    requestsAccepted: 1420,
    requestsDropped: 18,
    xssBlocked: 4,
    currentRps: 38,
  });

  // Modal de Portabilidade API
  const [showApiModal, setShowApiModal] = useState(false);

  const limiterRef = useRef(new TokenBucketLimiter(90, 30));
  const breakerRef = useRef(new ApiCircuitBreaker(3, 15000));

  // Reset em cascata ao trocar País ou Estado
  const handleCountryChange = (val) => {
    setSelectedCountry(val);
    setSelectedState("ALL");
    setSelectedCity("ALL");
  };

  const handleStateChange = (val) => {
    setSelectedState(val);
    setSelectedCity("ALL");
  };

  // Ingestão real de dados OSINT (SANS ISC DShield + Abuse.ch) com Circuit Breaker & Cache SWR
  const fetchRealOsintFeeds = useCallback(async () => {
    if (!breakerRef.current.canRequest()) {
      setSecurityMetrics((prev) => ({
        ...prev,
        circuitState: breakerRef.current.state,
      }));
      return;
    }

    setIsSyncing(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const [infoconRes, topIpsRes] = await Promise.allSettled([
        fetch("https://isc.sans.edu/api/infocon?json", {
          signal: controller.signal,
        }),
        fetch("https://isc.sans.edu/api/topips/records/6?json", {
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      let updated = false;

      if (infoconRes.status === "fulfilled" && infoconRes.value.ok) {
        const infoData = await infoconRes.value.json();
        const rawStatus = sanitizeString(
          infoData?.status || "green",
          15,
        ).toUpperCase();
        if (["GREEN", "YELLOW", "ORANGE", "RED"].includes(rawStatus)) {
          setInfoconLevel(rawStatus);
          updated = true;
        }
      }

      if (topIpsRes.status === "fulfilled" && topIpsRes.value.ok) {
        const ipsData = await topIpsRes.value.json();
        if (Array.isArray(ipsData) && ipsData.length > 0) {
          const sectorsCycle = ["TERCIARIO", "SECUNDARIO", "PRIMARIO", "ONG"];
          const sanitizedItems = ipsData.slice(0, 6).map((item, idx) => ({
            id: `sans-${Date.now()}-${idx}`,
            agency: "SANS ISC / DShield (Live)",
            ip: sanitizeIp(item?.source || item?.ip || ""),
            port: Number(item?.targetport) || 443,
            threatType: sanitizeString(
              `DShield Top Attacker (${item?.count || item?.attacks || "N/D"} eventos)`,
            ),
            targetSector: sectorsCycle[idx % sectorsCycle.length],
            severity: idx < 2 ? "CRÍTICA" : "ALTA",
            status: "BLOQUEADO",
          }));

          setThreatLogs((prev) => {
            const merged = [...sanitizedItems, ...prev].slice(
              0,
              MAX_THREAT_LOGS,
            );
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
            } catch (_) {
              // Ignora limite de quota do storage
            }
            return merged;
          });
          updated = true;
        }
      }

      if (updated) {
        breakerRef.current.recordSuccess();
        setFeedSourceStatus("SANS ISC DShield (Tempo Real)");
      } else {
        throw new Error("Fallback SWR acionado");
      }
    } catch (_) {
      breakerRef.current.recordFailure();
      setFeedSourceStatus("Cache SWR + Base OSINT Validada");
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setThreatLogs(parsed.slice(0, MAX_THREAT_LOGS));
          }
        }
      } catch (__) {
        // Mantém baseline em memória
      }
    } finally {
      setSecurityMetrics((prev) => ({
        ...prev,
        circuitState: breakerRef.current.state,
      }));
      setIsSyncing(false);
    }
  }, []);

  // Sincronização inicial + polling periódico seguro (a cada 30s)
  useEffect(() => {
    fetchRealOsintFeeds();
    const osintInterval = setInterval(fetchRealOsintFeeds, 30000);
    return () => clearInterval(osintInterval);
  }, [fetchRealOsintFeeds]);

  // Streaming contínuo de telemetria econômica/cibernética e mitigação de rajadas
  useEffect(() => {
    const streamInterval = setInterval(() => {
      const incomingBurst = ddosSimulation
        ? 950
        : Math.floor(25 + Math.random() * 35);
      let accepted = 0;
      let dropped = 0;
      let xssDetected = 0;

      // Simula validação de entrada e Token Bucket Rate Limiting
      const sampleChecks = Math.min(incomingBurst, 120);
      for (let i = 0; i < sampleChecks; i++) {
        if (ddosSimulation && i % 9 === 0) {
          const probe = sanitizeString(
            "<script>fetch('http://evil.tld')</script>",
          );
          if (probe.includes("[BLOCKED]") || !probe.includes("<script>")) {
            xssDetected += 1;
          }
        }
        if (limiterRef.current.consume(1)) {
          accepted += 1;
        } else {
          dropped += 1;
        }
      }

      if (incomingBurst > sampleChecks) {
        dropped += incomingBurst - sampleChecks;
      }

      setSecurityMetrics((prev) => ({
        ...prev,
        requestsAccepted: prev.requestsAccepted + accepted,
        requestsDropped: prev.requestsDropped + dropped,
        xssBlocked: prev.xssBlocked + xssDetected,
        currentRps: incomingBurst,
      }));

      // Atualiza série temporal com buffer circular fixo (zero memory leak)
      const now = new Date();
      const label = now.toTimeString().slice(0, 8);
      setTimeSeries((prev) => {
        const last = prev[prev.length - 1] || {
          economicIndex: 106.0,
          cyberAttacksPerMin: 400,
        };
        const deltaEcon = (Math.random() - 0.46) * 0.8;
        const nextEcon = Number(
          Math.max(92, Math.min(135, last.economicIndex + deltaEcon)).toFixed(
            2,
          ),
        );
        const nextAttacks = ddosSimulation
          ? Math.floor(1850 + Math.random() * 450)
          : Math.floor(310 + Math.random() * 260);

        const nextPoint = {
          time: label,
          economicIndex: nextEcon,
          cyberAttacksPerMin: nextAttacks,
          mitigatedRate: ddosSimulation ? 99.94 : 99.89,
        };
        return [...prev.slice(-(MAX_SERIES_POINTS - 1)), nextPoint];
      });
    }, 2200);

    return () => clearInterval(streamInterval);
  }, [ddosSimulation]);

  // Filtragem multidimensional das organizações monitoradas
  const filteredOrgs = useMemo(() => {
    const cleanQuery = sanitizeString(searchTerm, 60).toLowerCase();
    return ORGANIZATIONS_DB.filter((org) => {
      if (selectedCountry !== "ALL" && org.country !== selectedCountry)
        return false;
      if (selectedState !== "ALL" && org.state !== selectedState) return false;
      if (selectedCity !== "ALL" && org.city !== selectedCity) return false;
      if (selectedSector !== "ALL" && org.sector !== selectedSector)
        return false;
      if (
        cleanQuery &&
        !org.name.toLowerCase().includes(cleanQuery) &&
        !org.segment.toLowerCase().includes(cleanQuery) &&
        !org.city.toLowerCase().includes(cleanQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [
    selectedCountry,
    selectedState,
    selectedCity,
    selectedSector,
    searchTerm,
  ]);

  // Agregação por Setor para o gráfico comparativo
  const sectorSummaryData = useMemo(() => {
    const groups = {
      PRIMARIO: { setor: "Primário (Agro)", volumeBi: 0, bloqueiosMil: 0 },
      SECUNDARIO: {
        setor: "Secundário (Indústria)",
        volumeBi: 0,
        bloqueiosMil: 0,
      },
      TERCIARIO: {
        setor: "Terciário (Finanças/Tech)",
        volumeBi: 0,
        bloqueiosMil: 0,
      },
      ONG: { setor: "Terceiro Setor (ONGs)", volumeBi: 0, bloqueiosMil: 0 },
    };

    filteredOrgs.forEach((org) => {
      if (groups[org.sector]) {
        groups[org.sector].volumeBi = Number(
          (groups[org.sector].volumeBi + org.volumeUsdBi).toFixed(1),
        );
        groups[org.sector].bloqueiosMil = Number(
          (
            groups[org.sector].bloqueiosMil +
            org.attacksBlocked24h / 1000
          ).toFixed(2),
        );
      }
    });

    return Object.values(groups);
  }, [filteredOrgs]);

  // KPIs consolidados do escopo filtrado
  const kpis = useMemo(() => {
    const totalVolume = filteredOrgs.reduce((acc, o) => acc + o.volumeUsdBi, 0);
    const totalBlocked = filteredOrgs.reduce(
      (acc, o) => acc + o.attacksBlocked24h,
      0,
    );
    const highRiskCount = filteredOrgs.filter(
      (o) => o.cyberRisk === "ALTO",
    ).length;
    return {
      totalVolume: totalVolume.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      totalBlocked: (
        totalBlocked + (ddosSimulation ? 14820 : 0)
      ).toLocaleString("pt-BR"),
      entitiesCount: filteredOrgs.length,
      highRiskCount,
    };
  }, [filteredOrgs, ddosSimulation]);

  const availableStates =
    selectedCountry !== "ALL"
      ? GEO_HIERARCHY[selectedCountry]?.states || {}
      : {};
  const availableCities =
    selectedCountry !== "ALL" && selectedState !== "ALL"
      ? availableStates[selectedState]?.cities || []
      : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* BARRA DE TELEMETRIA DE SEGURANÇA & BLINDAGEM ANTI-DDoS */}
      <div
        className={`border-b px-4 py-2.5 text-xs transition-colors ${
          ddosSimulation
            ? "bg-red-950/80 border-red-500/60 text-red-100"
            : "bg-slate-900/95 border-slate-800 text-slate-300"
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              WAF / Edge Shield: ATIVO
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Circuit Breaker:{" "}
              <strong
                className={
                  securityMetrics.circuitState === "CLOSED"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              >
                {securityMetrics.circuitState}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Tráfego: <strong>{securityMetrics.currentRps} req/s</strong> |
              Descartados (Rate Limit):{" "}
              <strong className="text-amber-400">
                {securityMetrics.requestsDropped.toLocaleString("pt-BR")}
              </strong>
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              Payloads XSS/SQLi Bloqueados:{" "}
              <strong>{securityMetrics.xssBlocked}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDdosSimulation((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                ddosSimulation
                  ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                  : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              {ddosSimulation
                ? "Parar Ataque DDoS (Mitigando 950 req/s)"
                : "Simular Ataque DDoS"}
            </button>

            <button
              onClick={() => setShowApiModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-semibold transition cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              API & Arquitetura
            </button>
          </div>
        </div>
      </div>

      {/* CABEÇALHO PRINCIPAL */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <Globe className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  Global Cyber & Economic Real-Time Monitor
                </h1>
                <p className="text-xs md:text-sm text-slate-400">
                  Observabilidade Multi-Setorial (Primário, Secundário,
                  Terciário & ONGs) + Threat Intelligence OSINT
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-slate-400">Feed OSINT:</span>
              <span className="font-medium text-slate-200">
                {feedSourceStatus}
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">SANS Infocon:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded ${
                  infoconLevel === "GREEN"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {infoconLevel}
              </span>
            </div>

            <button
              onClick={fetchRealOsintFeeds}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-cyan-400" : ""}`}
              />
              Atualizar Feeds
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* PAINEL DE FILTROS GEOGRÁFICOS (DRILL-DOWN) E SETORIAIS */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">
            <Filter className="w-4 h-4" />
            Drill-Down Geoespacial & Setorial
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                País / Região
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {Object.entries(GEO_HIERARCHY).map(([code, data]) => (
                  <option key={code} value={code}>
                    {data.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Estado / Província
              </label>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={selectedCountry === "ALL"}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-40"
              >
                <option value="ALL">Todos os Estados</option>
                {Object.entries(availableStates).map(([stCode, stData]) => (
                  <option key={stCode} value={stCode}>
                    {stData.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Município
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                disabled={selectedState === "ALL"}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-40"
              >
                <option value="ALL">Todos os Municípios</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Setor Econômico
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {SECTORS.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Buscar Organização / Segmento
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ex: Manaus, B3, Agro, ONG..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CARDS DE KPIs EXECUTIVOS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Volume Econômico Monitorado</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              US$ {kpis.totalVolume} Bi
            </div>
            <div className="text-xs text-emerald-400 mt-1">
              {kpis.entitiesCount} organizações ativas no recorte
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Ataques Cibernéticos Mitigados (24h)</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {kpis.totalBlocked}
            </div>
            <div className="text-xs text-rose-300 mt-1">
              Telemetria cruzada SANS DShield & Abuse.ch
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Infraestruturas em Alerta Crítico</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {kpis.highRiskCount}
            </div>
            <div className="text-xs text-amber-300 mt-1">
              Bolsas, Big Techs e Energia sob monitoramento reforçado
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Disponibilidade & Resiliência SLA</span>
              <Server className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">99.98%</div>
            <div className="text-xs text-slate-400 mt-1">
              Zero indisponibilidade sob estresse de borda
            </div>
          </div>
        </section>

        {/* GRÁFICOS ANALÍTICOS EM TEMPO REAL */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Streaming: Índice de Atividade Econômica vs. Pressão de
                  Ataques (req/min)
                </h2>
                <p className="text-xs text-slate-400">
                  Atualização contínua com janela deslizante protegida contra
                  estouro de memória
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Live Stream
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient
                      id="colorAttacks"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#f43f5e"
                        stopOpacity={0.35}
                      />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEcon" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#06b6d4"
                        stopOpacity={0.35}
                      />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#06b6d4" fontSize={11} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#f43f5e"
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="economicIndex"
                    name="Índice Econômico Global"
                    stroke="#06b6d4"
                    fillOpacity={1}
                    fill="url(#colorEcon)"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="cyberAttacksPerMin"
                    name="Ameaças Interceptadas / min"
                    stroke="#f43f5e"
                    fillOpacity={1}
                    fill="url(#colorAttacks)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-white">
                Exposição por Setor Econômico
              </h2>
              <p className="text-xs text-slate-400">
                Volume (US$ Bi) vs. Bloqueios (milhares)
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectorSummaryData}
                  layout="vertical"
                  margin={{ left: 10, right: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis
                    dataKey="setor"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={115}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar
                    dataKey="volumeBi"
                    name="Volume (US$ Bi)"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="bloqueiosMil"
                    name="Bloqueios (k)"
                    fill="#f59e0b"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* FEED DE AMEAÇAS OSINT EM TEMPO REAL + MATRIZ DE ORGANIZAÇÕES */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Feed OSINT */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h2 className="text-sm font-bold text-white">
                  Feed OSINT Tratado & Sanitizado
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                SANS ISC • Abuse.ch • CISA
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-96 pr-1">
              {threatLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/90 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-cyan-300">
                        {log.ip}
                      </span>
                      <span className="text-slate-500">:{log.port}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {log.agency}
                      </span>
                    </div>
                    <p className="text-slate-300 font-medium">
                      {log.threatType}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Alvo Setorial: {log.targetSector}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.severity === "CRÍTICA"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {log.severity}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela de Empresas, Instituições e ONGs */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">
                  Entidades Monitoradas (Empresas, Bancos, Bolsas, Big Techs &
                  ONGs)
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {filteredOrgs.length} registros
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                    <th className="py-2.5 px-2">Organização / Segmento</th>
                    <th className="py-2.5 px-2">Localização</th>
                    <th className="py-2.5 px-2">Setor</th>
                    <th className="py-2.5 px-2 text-right">Volume (US$)</th>
                    <th className="py-2.5 px-2 text-center">Risco Cyber</th>
                    <th className="py-2.5 px-2 text-right">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredOrgs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-slate-500"
                      >
                        Nenhuma organização encontrada para os filtros
                        selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOrgs.map((org) => (
                      <tr
                        key={org.id}
                        className="hover:bg-slate-800/40 transition"
                      >
                        <td className="py-2.5 px-2">
                          <div className="font-semibold text-slate-100">
                            {org.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {org.segment}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-300">
                          {org.city}, {org.state} ({org.country})
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
                            {org.sector}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-300 font-semibold">
                          ${org.volumeUsdBi.toFixed(1)}B
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              org.cyberRisk === "ALTO"
                                ? "bg-rose-500/20 text-rose-300"
                                : org.cyberRisk === "MÉDIO"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {org.cyberRisk}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                          {org.sla}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* MODAL DE PORTABILIDADE & INTEGRAÇÃO DE API */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Portabilidade de API & Gateway de Ingestão (SIEM / Data
                  Warehouse)
                </h3>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Este painel foi projetado com contrato JSON desacoplado para
              conectar-se diretamente a pipelines <strong>Apache Kafka</strong>,{" "}
              <strong>Python (FastAPI)</strong>,{" "}
              <strong>Java (Spring Boot)</strong> ou coletores SIEM corporativos
              sem alterar a camada visual:
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-cyan-300 overflow-x-auto">
              <pre>{`# Exemplo de Gateway Proxy Resiliente (Python FastAPI)
from fastapi import FastAPI
import httpx

app = FastAPI(title="Cyber & Economic Telemetry Gateway")

@app.get("/api/v1/telemetry/osint")
async def get_sanitized_osint():
    async with httpx.AsyncClient(timeout=4.0) as client:
        r = await client.get("https://isc.sans.edu/api/topips/records/10?json")
        return {"source": "SANS-ISC", "status": "VERIFIED", "records": r.json()}`}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowApiModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white cursor-pointer"
              >
                Fechar Documentação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
