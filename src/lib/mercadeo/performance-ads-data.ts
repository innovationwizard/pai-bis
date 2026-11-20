/** Extracted from Performance-Report-Puerta-Abierta.xlsx, sheet "Performance - Data Base PA", Fecha 2026-01-01 through 2026-07-31. The sheet's last day is 2026-08-04. */
export type PerformanceAdsAccount = {
  name: string;
  alcance: number;
  impresiones: number;
  leads: number;
  spendUsd: number;
  frecuencia: number | null;
  cpl: number | null;
};

export type PerformanceAdsReport = {
  desde: string;
  hasta: string;
  loadedThrough: string;
  alcance: number;
  impresiones: number;
  leads: number;
  spendUsd: number;
  accounts: PerformanceAdsAccount[];
  weekdays: { name: string; leads: number }[];
  days: { date: string; cpl: number | null }[];
  months: { label: string; spendUsd: number }[];
  campaigns: { account: string; name: string; leads: number }[];
};

export const performanceAds: PerformanceAdsReport = {
  "desde": "2026-01-01",
  "hasta": "2026-07-31",
  "loadedThrough": "2026-08-04",
  "alcance": 22082106,
  "impresiones": 28026414,
  "leads": 24360,
  "spendUsd": 81665.83,
  "accounts": [
    {
      "name": "Bosque Las Tapias",
      "alcance": 8640094,
      "impresiones": 10604756,
      "leads": 7144,
      "spendUsd": 25931.58,
      "frecuencia": 1.25,
      "cpl": 5.17
    },
    {
      "name": "Boulevard5",
      "alcance": 6384967,
      "impresiones": 8366028,
      "leads": 4627,
      "spendUsd": 30269.53,
      "frecuencia": 1.32,
      "cpl": 7.44
    },
    {
      "name": "Benestare",
      "alcance": 5476986,
      "impresiones": 7117271,
      "leads": 11823,
      "spendUsd": 18232.6,
      "frecuencia": 1.29,
      "cpl": 2.56
    },
    {
      "name": "Santa Elena",
      "alcance": 1474537,
      "impresiones": 1820849,
      "leads": 715,
      "spendUsd": 6911.44,
      "frecuencia": 1.25,
      "cpl": 10.36
    },
    {
      "name": "Puerta Abierta",
      "alcance": 105522,
      "impresiones": 117510,
      "leads": 51,
      "spendUsd": 320.68,
      "frecuencia": 1.15,
      "cpl": 1.55
    }
  ],
  "weekdays": [
    {
      "name": "domingo",
      "leads": 3924
    },
    {
      "name": "martes",
      "leads": 3518
    },
    {
      "name": "sábado",
      "leads": 3511
    },
    {
      "name": "lunes",
      "leads": 3469
    },
    {
      "name": "jueves",
      "leads": 3356
    },
    {
      "name": "miércoles",
      "leads": 3310
    },
    {
      "name": "viernes",
      "leads": 3272
    }
  ],
  "days": [
    {
      "date": "2026-01-01",
      "cpl": 4.25
    },
    {
      "date": "2026-01-02",
      "cpl": 2.49
    },
    {
      "date": "2026-01-03",
      "cpl": 3.96
    },
    {
      "date": "2026-01-04",
      "cpl": 1.99
    },
    {
      "date": "2026-01-05",
      "cpl": 3.06
    },
    {
      "date": "2026-01-06",
      "cpl": 2.74
    },
    {
      "date": "2026-01-07",
      "cpl": 3.59
    },
    {
      "date": "2026-01-08",
      "cpl": 2.99
    },
    {
      "date": "2026-01-09",
      "cpl": 4.54
    },
    {
      "date": "2026-01-10",
      "cpl": 4.13
    },
    {
      "date": "2026-01-11",
      "cpl": 3.32
    },
    {
      "date": "2026-01-12",
      "cpl": 5.03
    },
    {
      "date": "2026-01-13",
      "cpl": 2.77
    },
    {
      "date": "2026-01-14",
      "cpl": 5.18
    },
    {
      "date": "2026-01-15",
      "cpl": 3.07
    },
    {
      "date": "2026-01-16",
      "cpl": 3.83
    },
    {
      "date": "2026-01-17",
      "cpl": 3.76
    },
    {
      "date": "2026-01-18",
      "cpl": 3.72
    },
    {
      "date": "2026-01-19",
      "cpl": 3.43
    },
    {
      "date": "2026-01-20",
      "cpl": 5.74
    },
    {
      "date": "2026-01-21",
      "cpl": 5.86
    },
    {
      "date": "2026-01-22",
      "cpl": 3.89
    },
    {
      "date": "2026-01-23",
      "cpl": 3.31
    },
    {
      "date": "2026-01-24",
      "cpl": 3.31
    },
    {
      "date": "2026-01-25",
      "cpl": 3.95
    },
    {
      "date": "2026-01-26",
      "cpl": 2.65
    },
    {
      "date": "2026-01-27",
      "cpl": 3.81
    },
    {
      "date": "2026-01-28",
      "cpl": 4.09
    },
    {
      "date": "2026-01-29",
      "cpl": 5.9
    },
    {
      "date": "2026-01-30",
      "cpl": 4.1
    },
    {
      "date": "2026-01-31",
      "cpl": 3.5
    },
    {
      "date": "2026-02-01",
      "cpl": 4.53
    },
    {
      "date": "2026-02-02",
      "cpl": 4.08
    },
    {
      "date": "2026-02-03",
      "cpl": 3.88
    },
    {
      "date": "2026-02-04",
      "cpl": 5.43
    },
    {
      "date": "2026-02-05",
      "cpl": 5.77
    },
    {
      "date": "2026-02-06",
      "cpl": 7.2
    },
    {
      "date": "2026-02-07",
      "cpl": 4.59
    },
    {
      "date": "2026-02-08",
      "cpl": 4.45
    },
    {
      "date": "2026-02-09",
      "cpl": 6.06
    },
    {
      "date": "2026-02-10",
      "cpl": 4.35
    },
    {
      "date": "2026-02-11",
      "cpl": 4
    },
    {
      "date": "2026-02-12",
      "cpl": 7.04
    },
    {
      "date": "2026-02-13",
      "cpl": 4.08
    },
    {
      "date": "2026-02-14",
      "cpl": 4.58
    },
    {
      "date": "2026-02-15",
      "cpl": 3.84
    },
    {
      "date": "2026-02-16",
      "cpl": 3.35
    },
    {
      "date": "2026-02-17",
      "cpl": 6.08
    },
    {
      "date": "2026-02-18",
      "cpl": 6.81
    },
    {
      "date": "2026-02-19",
      "cpl": 6.69
    },
    {
      "date": "2026-02-20",
      "cpl": 8.37
    },
    {
      "date": "2026-02-21",
      "cpl": 3.82
    },
    {
      "date": "2026-02-22",
      "cpl": 5.08
    },
    {
      "date": "2026-02-23",
      "cpl": 6.11
    },
    {
      "date": "2026-02-24",
      "cpl": 5.79
    },
    {
      "date": "2026-02-25",
      "cpl": 5.14
    },
    {
      "date": "2026-02-26",
      "cpl": 6.24
    },
    {
      "date": "2026-02-27",
      "cpl": 5.04
    },
    {
      "date": "2026-02-28",
      "cpl": 4.17
    },
    {
      "date": "2026-03-01",
      "cpl": 5.35
    },
    {
      "date": "2026-03-02",
      "cpl": 6.29
    },
    {
      "date": "2026-03-03",
      "cpl": 5.56
    },
    {
      "date": "2026-03-04",
      "cpl": 5.9
    },
    {
      "date": "2026-03-05",
      "cpl": 6.42
    },
    {
      "date": "2026-03-06",
      "cpl": 7.7
    },
    {
      "date": "2026-03-07",
      "cpl": 3.93
    },
    {
      "date": "2026-03-08",
      "cpl": 5.74
    },
    {
      "date": "2026-03-09",
      "cpl": 7.71
    },
    {
      "date": "2026-03-10",
      "cpl": 5.22
    },
    {
      "date": "2026-03-11",
      "cpl": 5.61
    },
    {
      "date": "2026-03-12",
      "cpl": 4.56
    },
    {
      "date": "2026-03-13",
      "cpl": 7.68
    },
    {
      "date": "2026-03-14",
      "cpl": 7.2
    },
    {
      "date": "2026-03-15",
      "cpl": 6.19
    },
    {
      "date": "2026-03-16",
      "cpl": 6.44
    },
    {
      "date": "2026-03-17",
      "cpl": 7.88
    },
    {
      "date": "2026-03-18",
      "cpl": 5.94
    },
    {
      "date": "2026-03-19",
      "cpl": 5.48
    },
    {
      "date": "2026-03-20",
      "cpl": 5.64
    },
    {
      "date": "2026-03-21",
      "cpl": 5.08
    },
    {
      "date": "2026-03-22",
      "cpl": 8.59
    },
    {
      "date": "2026-03-23",
      "cpl": 4.94
    },
    {
      "date": "2026-03-24",
      "cpl": 4.69
    },
    {
      "date": "2026-03-25",
      "cpl": 5.02
    },
    {
      "date": "2026-03-26",
      "cpl": 7.03
    },
    {
      "date": "2026-03-27",
      "cpl": 5.67
    },
    {
      "date": "2026-03-28",
      "cpl": 6.19
    },
    {
      "date": "2026-03-29",
      "cpl": 3.82
    },
    {
      "date": "2026-03-30",
      "cpl": 4.88
    },
    {
      "date": "2026-03-31",
      "cpl": 7.12
    },
    {
      "date": "2026-04-01",
      "cpl": 5.89
    },
    {
      "date": "2026-04-02",
      "cpl": 5.47
    },
    {
      "date": "2026-04-03",
      "cpl": 7.03
    },
    {
      "date": "2026-04-04",
      "cpl": 4.7
    },
    {
      "date": "2026-04-05",
      "cpl": 4.47
    },
    {
      "date": "2026-04-06",
      "cpl": 7.05
    },
    {
      "date": "2026-04-07",
      "cpl": 4.59
    },
    {
      "date": "2026-04-08",
      "cpl": 8.54
    },
    {
      "date": "2026-04-09",
      "cpl": 5.12
    },
    {
      "date": "2026-04-10",
      "cpl": 8.49
    },
    {
      "date": "2026-04-11",
      "cpl": 5.9
    },
    {
      "date": "2026-04-12",
      "cpl": 7.55
    },
    {
      "date": "2026-04-13",
      "cpl": 7.94
    },
    {
      "date": "2026-04-14",
      "cpl": 6.52
    },
    {
      "date": "2026-04-15",
      "cpl": 5.91
    },
    {
      "date": "2026-04-16",
      "cpl": 7.43
    },
    {
      "date": "2026-04-17",
      "cpl": 7.48
    },
    {
      "date": "2026-04-18",
      "cpl": 7.29
    },
    {
      "date": "2026-04-19",
      "cpl": 8.34
    },
    {
      "date": "2026-04-20",
      "cpl": 5.54
    },
    {
      "date": "2026-04-21",
      "cpl": 6.75
    },
    {
      "date": "2026-04-22",
      "cpl": 6.99
    },
    {
      "date": "2026-04-23",
      "cpl": 8.83
    },
    {
      "date": "2026-04-24",
      "cpl": 7.62
    },
    {
      "date": "2026-04-25",
      "cpl": 6.59
    },
    {
      "date": "2026-04-26",
      "cpl": 11.1
    },
    {
      "date": "2026-04-27",
      "cpl": 9.94
    },
    {
      "date": "2026-04-28",
      "cpl": 7.1
    },
    {
      "date": "2026-04-29",
      "cpl": 6.85
    },
    {
      "date": "2026-04-30",
      "cpl": 4.66
    },
    {
      "date": "2026-05-01",
      "cpl": 8.87
    },
    {
      "date": "2026-05-02",
      "cpl": 5.03
    },
    {
      "date": "2026-05-03",
      "cpl": 5.53
    },
    {
      "date": "2026-05-04",
      "cpl": 5.83
    },
    {
      "date": "2026-05-05",
      "cpl": 7.72
    },
    {
      "date": "2026-05-06",
      "cpl": 6.98
    },
    {
      "date": "2026-05-07",
      "cpl": 8.6
    },
    {
      "date": "2026-05-08",
      "cpl": 6.39
    },
    {
      "date": "2026-05-09",
      "cpl": 4.47
    },
    {
      "date": "2026-05-10",
      "cpl": 7.8
    },
    {
      "date": "2026-05-11",
      "cpl": 9.31
    },
    {
      "date": "2026-05-12",
      "cpl": 6.73
    },
    {
      "date": "2026-05-13",
      "cpl": 7.22
    },
    {
      "date": "2026-05-14",
      "cpl": 7.66
    },
    {
      "date": "2026-05-15",
      "cpl": 6.21
    },
    {
      "date": "2026-05-16",
      "cpl": 6.54
    },
    {
      "date": "2026-05-17",
      "cpl": 6.28
    },
    {
      "date": "2026-05-18",
      "cpl": 7.15
    },
    {
      "date": "2026-05-19",
      "cpl": 7.61
    },
    {
      "date": "2026-05-20",
      "cpl": 6.15
    },
    {
      "date": "2026-05-21",
      "cpl": 7.35
    },
    {
      "date": "2026-05-22",
      "cpl": 5.24
    },
    {
      "date": "2026-05-23",
      "cpl": 5.94
    },
    {
      "date": "2026-05-24",
      "cpl": 5.75
    },
    {
      "date": "2026-05-25",
      "cpl": 6.69
    },
    {
      "date": "2026-05-26",
      "cpl": 6.96
    },
    {
      "date": "2026-05-27",
      "cpl": 4.11
    },
    {
      "date": "2026-05-28",
      "cpl": 6.21
    },
    {
      "date": "2026-05-29",
      "cpl": 5.3
    },
    {
      "date": "2026-05-30",
      "cpl": 5.84
    },
    {
      "date": "2026-05-31",
      "cpl": 5.84
    },
    {
      "date": "2026-06-01",
      "cpl": 5.07
    },
    {
      "date": "2026-06-02",
      "cpl": 3.37
    },
    {
      "date": "2026-06-03",
      "cpl": 4.8
    },
    {
      "date": "2026-06-04",
      "cpl": 4.72
    },
    {
      "date": "2026-06-05",
      "cpl": 6.17
    },
    {
      "date": "2026-06-06",
      "cpl": 6.39
    },
    {
      "date": "2026-06-07",
      "cpl": 4.59
    },
    {
      "date": "2026-06-08",
      "cpl": 3.93
    },
    {
      "date": "2026-06-09",
      "cpl": 4.59
    },
    {
      "date": "2026-06-10",
      "cpl": 4.33
    },
    {
      "date": "2026-06-11",
      "cpl": 5.11
    },
    {
      "date": "2026-06-12",
      "cpl": 5.18
    },
    {
      "date": "2026-06-13",
      "cpl": 5.48
    },
    {
      "date": "2026-06-14",
      "cpl": 7.41
    },
    {
      "date": "2026-06-15",
      "cpl": 4.61
    },
    {
      "date": "2026-06-16",
      "cpl": 5.61
    },
    {
      "date": "2026-06-17",
      "cpl": 6
    },
    {
      "date": "2026-06-18",
      "cpl": 5.34
    },
    {
      "date": "2026-06-19",
      "cpl": 6.08
    },
    {
      "date": "2026-06-20",
      "cpl": 4.42
    },
    {
      "date": "2026-06-21",
      "cpl": 5.12
    },
    {
      "date": "2026-06-22",
      "cpl": 6.62
    },
    {
      "date": "2026-06-23",
      "cpl": 3.82
    },
    {
      "date": "2026-06-24",
      "cpl": 8.27
    },
    {
      "date": "2026-06-25",
      "cpl": 9.12
    },
    {
      "date": "2026-06-26",
      "cpl": 5.74
    },
    {
      "date": "2026-06-27",
      "cpl": 7.27
    },
    {
      "date": "2026-06-28",
      "cpl": 7.46
    },
    {
      "date": "2026-06-29",
      "cpl": 5.58
    },
    {
      "date": "2026-06-30",
      "cpl": 3.67
    },
    {
      "date": "2026-07-01",
      "cpl": 4.39
    },
    {
      "date": "2026-07-02",
      "cpl": 3.75
    },
    {
      "date": "2026-07-03",
      "cpl": 5.33
    },
    {
      "date": "2026-07-04",
      "cpl": 4.08
    },
    {
      "date": "2026-07-05",
      "cpl": 6.42
    },
    {
      "date": "2026-07-06",
      "cpl": 6.88
    },
    {
      "date": "2026-07-07",
      "cpl": 4.12
    },
    {
      "date": "2026-07-08",
      "cpl": 4.76
    },
    {
      "date": "2026-07-09",
      "cpl": 5.03
    },
    {
      "date": "2026-07-10",
      "cpl": 3.64
    },
    {
      "date": "2026-07-11",
      "cpl": 4.5
    },
    {
      "date": "2026-07-12",
      "cpl": 6.82
    },
    {
      "date": "2026-07-13",
      "cpl": 4.35
    },
    {
      "date": "2026-07-14",
      "cpl": 6.27
    },
    {
      "date": "2026-07-15",
      "cpl": 6.46
    },
    {
      "date": "2026-07-16",
      "cpl": 5.55
    },
    {
      "date": "2026-07-17",
      "cpl": 5.53
    },
    {
      "date": "2026-07-18",
      "cpl": 6.28
    },
    {
      "date": "2026-07-19",
      "cpl": 6.1
    },
    {
      "date": "2026-07-20",
      "cpl": 6.88
    },
    {
      "date": "2026-07-21",
      "cpl": 4.37
    },
    {
      "date": "2026-07-22",
      "cpl": 3.94
    },
    {
      "date": "2026-07-23",
      "cpl": 4.95
    },
    {
      "date": "2026-07-24",
      "cpl": 7.56
    },
    {
      "date": "2026-07-25",
      "cpl": 4.87
    },
    {
      "date": "2026-07-26",
      "cpl": 4.1
    },
    {
      "date": "2026-07-27",
      "cpl": 5.65
    },
    {
      "date": "2026-07-28",
      "cpl": 4.83
    },
    {
      "date": "2026-07-29",
      "cpl": 4.81
    },
    {
      "date": "2026-07-30",
      "cpl": 4.09
    },
    {
      "date": "2026-07-31",
      "cpl": 5.58
    }
  ],
  "months": [
    {
      "label": "enero",
      "spendUsd": 11204.37
    },
    {
      "label": "febrero",
      "spendUsd": 10544.76
    },
    {
      "label": "marzo",
      "spendUsd": 11294.01
    },
    {
      "label": "abril",
      "spendUsd": 13159.3
    },
    {
      "label": "mayo",
      "spendUsd": 13488.59
    },
    {
      "label": "junio",
      "spendUsd": 10853.83
    },
    {
      "label": "julio",
      "spendUsd": 11120.97
    }
  ],
  "campaigns": [
    {
      "account": "Benestare",
      "name": "cons_guat__kpa_LeadGenerationPA_fb_lds_cpl_AO",
      "leads": 9541
    },
    {
      "account": "Bosque Las Tapias",
      "name": "cons_guat__kpa_LeadGenerationBLT_fb_lds_cpl_AO",
      "leads": 4197
    },
    {
      "account": "Boulevard5",
      "name": "cons_guat__kpa_LeadGenerationBoulevard5_fb_lds_cpl_AO",
      "leads": 2355
    },
    {
      "account": "Bosque Las Tapias",
      "name": "cons_guat__kpa_LeadsBackUpBLT_fb_lds_cpa_17noval30nov",
      "leads": 2082
    },
    {
      "account": "Benestare",
      "name": "cons_guat__kpa_LeadsSitioWebBNT_fb_lds_cpa_AO",
      "leads": 1609
    },
    {
      "account": "Boulevard5",
      "name": "cons_guat__kpa_WebsiteLeadsBLVD5_fb_lds_cpa_AO",
      "leads": 1446
    },
    {
      "account": "Bosque Las Tapias",
      "name": "cons_guat__kpa_WebsiteLeadsBLT_fb_lds_cpa_AO",
      "leads": 849
    },
    {
      "account": "Boulevard5",
      "name": "cons_guat__kpa_LeadsBackUpB5_fb_lds_cpa_17noval30nov",
      "leads": 819
    },
    {
      "account": "Benestare",
      "name": "cons_guat__kpa_LeadsVolumenBNT_ga_lds_cpl_AO",
      "leads": 621
    },
    {
      "account": "Santa Elena",
      "name": "cons_guat__kpa_LeadsGeneratorSTEL_fb_lds_cpa_AO",
      "leads": 206
    },
    {
      "account": "Santa Elena",
      "name": "cons_guat__kpa_QualityLeadsGEO_fb_lds_cpl_AO",
      "leads": 190
    },
    {
      "account": "Santa Elena",
      "name": "cons_guat__kpa_LeadsWebsiteSTEL_fb_lds_cpa_AO",
      "leads": 171
    },
    {
      "account": "Santa Elena",
      "name": "cons_guat__kpa_TOPLeadsSTEL_fb_lds_cpa_AO",
      "leads": 143
    },
    {
      "account": "Puerta Abierta",
      "name": "cons_guat__kpa_LeadsTerrenosPAI_fb_lds_cpl_AO",
      "leads": 51
    },
    {
      "account": "Benestare",
      "name": "cons_guat__kpa_WhatsappLeadsBNT_fb_lds_cpa_AO",
      "leads": 49
    },
    {
      "account": "Bosque Las Tapias",
      "name": "cons_guat__kpa_WhatsappLeadsBLT_fb_lds_cpa_AO",
      "leads": 16
    },
    {
      "account": "Boulevard5",
      "name": "cons_guat__kpa_WhatsappLeadsBLVD5_fb_lds_cpa_AO",
      "leads": 7
    },
    {
      "account": "Santa Elena",
      "name": "cons_guat__kpa_WebsiteTrafficSTEL_fb_lds_cpa_06febal28feb",
      "leads": 5
    },
    {
      "account": "Benestare",
      "name": "cons_guat__kpa_IGProfileViewsBNT_fb_traf_cpc_AO",
      "leads": 3
    }
  ]
};
