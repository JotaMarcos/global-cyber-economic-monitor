/**
 * Regionalização adotada: a mesma da API de países do FIRST, com dois ajustes
 * para atender aos sete recortes do painel. O Caribe é agregado à América
 * Central e o Oriente Médio à Ásia.
 */
export const CONTINENT_IDS = [
  "SOUTH_AMERICA",
  "CENTRAL_AMERICA",
  "NORTH_AMERICA",
  "EUROPE",
  "ASIA",
  "OCEANIA",
  "AFRICA",
] as const;

export type ContinentId = (typeof CONTINENT_IDS)[number];

const COUNTRIES_BY_CONTINENT: Record<ContinentId, string> = {
  SOUTH_AMERICA: "AR BO BR CL CO EC FK GF GY PY PE SR UY VE",
  CENTRAL_AMERICA:
    "BZ CR SV GT HN MX NI PA AI AG AW BS BB BQ KY CU CW DM DO GD GP HT JM MQ MS PR BL KN LC MF VC SX TT TC VG VI",
  NORTH_AMERICA: "BM CA GL PM US",
  EUROPE:
    "AX AL AD AT BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH TR UA GB XK",
  ASIA: "AF AM AZ BD BT IO BN KH CN GE HK IN ID JP KZ KP KR KG LA MO MY MV MN MM NP PK PH SG LK TW TJ TH TL TM UZ VN BH IR IQ IL JO KW LB OM PS QA SA SY AE YE",
  OCEANIA:
    "AS AU CX CC CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV UM VU WF",
  AFRICA:
    "DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
};

const CONTINENT_BY_COUNTRY = new Map<string, ContinentId>(
  CONTINENT_IDS.flatMap((continent) =>
    COUNTRIES_BY_CONTINENT[continent]
      .split(" ")
      .map((code): [string, ContinentId] => [code, continent]),
  ),
);

/** Devolve `null` para código ausente ou fora da tabela (ex.: Antártida). */
export function continentOf(countryCode: string | null): ContinentId | null {
  return countryCode ? (CONTINENT_BY_COUNTRY.get(countryCode) ?? null) : null;
}

export function countriesOf(continent: ContinentId): string[] {
  return COUNTRIES_BY_CONTINENT[continent].split(" ");
}
