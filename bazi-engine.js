/* ========================================================================
 * 八字核心引擎 - 精简版
 * 从"古法推演神算"项目提取，用于股票五行命盘分析
 * 基于《渊海子平》《三命通会》《子平真诠》《滴天髓》《穷通宝鉴》
 * ======================================================================== */

var Bazi = (function () {
"use strict";

/* ===== 基础常量 ===== */
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ELEMENTS = ["木", "火", "土", "金", "水"];

const STEM_ELEMENTS = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

const BRANCH_ELEMENTS = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};

const ELEMENT_STYLES = {
  木: ["#75e0a7", "#2f9d63"],
  火: ["#ff9b6f", "#ff5d5d"],
  土: ["#f4c978", "#bc8d42"],
  金: ["#d8e4ff", "#89a6ff"],
  水: ["#7fd9ff", "#3f84ff"],
};

const ELEMENT_GENERATE = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const ELEMENT_OVERCOME = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };
const ELEMENT_GENERATED_BY = { 木: "水", 火: "木", 土: "火", 金: "土", 水: "金" };
const ELEMENT_OVERCOME_BY = { 木: "金", 火: "水", 土: "木", 金: "火", 水: "土" };

const STEM_YIN_YANG = {
  甲: "阳", 乙: "阴", 丙: "阳", 丁: "阴", 戊: "阳",
  己: "阴", 庚: "阳", 辛: "阴", 壬: "阳", 癸: "阴",
};

/* ===== 纳音五行 ===== */
const NAYIN_TABLE = [
  "海中金", "海中金", "炉中火", "炉中火", "大林木", "大林木",
  "路旁土", "路旁土", "剑锋金", "剑锋金", "山头火", "山头火",
  "涧下水", "涧下水", "城头土", "城头土", "白蜡金", "白蜡金",
  "杨柳木", "杨柳木", "泉中水", "泉中水", "屋上土", "屋上土",
  "霹雳火", "霹雳火", "松柏木", "松柏木", "长流水", "长流水",
  "砂石金", "砂石金", "山下火", "山下火", "平地木", "平地木",
  "壁上土", "壁上土", "金箔金", "金箔金", "覆灯火", "覆灯火",
  "天河水", "天河水", "大驿土", "大驿土", "钗钏金", "钗钏金",
  "桑柘木", "桑柘木", "大溪水", "大溪水", "沙中土", "沙中土",
  "天上火", "天上火", "石榴木", "石榴木", "大海水", "大海水",
];

const NAYIN_ELEMENT_MAP = {
  海中金: "金", 炉中火: "火", 大林木: "木", 路旁土: "土", 剑锋金: "金",
  山头火: "火", 涧下水: "水", 城头土: "土", 白蜡金: "金", 杨柳木: "木",
  泉中水: "水", 屋上土: "土", 霹雳火: "火", 松柏木: "木", 长流水: "水",
  砂石金: "金", 山下火: "火", 平地木: "木", 壁上土: "土", 金箔金: "金",
  覆灯火: "火", 天河水: "水", 大驿土: "土", 钗钏金: "金", 桑柘木: "木",
  大溪水: "水", 沙中土: "土", 天上火: "火", 石榴木: "木", 大海水: "水",
};

/* ===== 地支藏干系统 ===== */
const BRANCH_HIDDEN_STEMS = {
  子: [{ stem: "癸", weight: 100 }],
  丑: [{ stem: "己", weight: 60 }, { stem: "癸", weight: 30 }, { stem: "辛", weight: 10 }],
  寅: [{ stem: "甲", weight: 60 }, { stem: "丙", weight: 30 }, { stem: "戊", weight: 10 }],
  卯: [{ stem: "乙", weight: 100 }],
  辰: [{ stem: "戊", weight: 60 }, { stem: "乙", weight: 30 }, { stem: "癸", weight: 10 }],
  巳: [{ stem: "丙", weight: 60 }, { stem: "庚", weight: 30 }, { stem: "戊", weight: 10 }],
  午: [{ stem: "丁", weight: 70 }, { stem: "己", weight: 30 }],
  未: [{ stem: "己", weight: 60 }, { stem: "丁", weight: 30 }, { stem: "乙", weight: 10 }],
  申: [{ stem: "庚", weight: 60 }, { stem: "壬", weight: 30 }, { stem: "戊", weight: 10 }],
  酉: [{ stem: "辛", weight: 100 }],
  戌: [{ stem: "戊", weight: 60 }, { stem: "辛", weight: 30 }, { stem: "丁", weight: 10 }],
  亥: [{ stem: "壬", weight: 70 }, { stem: "甲", weight: 30 }],
};

/* ===== 精确节气日期表 ===== */
const SOLAR_TERMS = {
  1970:[204,306,405,506,606,707,808,908,1009,1108,1208,106],
  1971:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  1972:[205,306,405,505,605,707,807,907,1008,1107,1207,106],
  1973:[204,306,405,506,606,707,808,908,1009,1108,1208,106],
  1974:[204,306,405,506,606,708,808,908,1009,1108,1207,106],
  1975:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  1976:[205,306,405,505,606,707,807,907,1008,1108,1207,106],
  1977:[204,306,405,506,606,707,808,908,1009,1108,1208,106],
  1978:[204,306,405,506,606,708,808,908,1009,1108,1207,106],
  1979:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  1980:[205,305,404,505,605,707,807,907,1008,1107,1207,106],
  1981:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  1982:[204,306,405,506,606,708,808,908,1009,1108,1207,106],
  1983:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  1984:[205,305,404,505,605,707,807,907,1008,1107,1207,106],
  1985:[204,306,405,506,606,707,808,908,1008,1108,1207,106],
  1986:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  1987:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  1988:[205,305,404,505,605,707,807,907,1008,1107,1207,106],
  1989:[204,306,405,506,606,707,808,908,1008,1108,1207,106],
  1990:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  1991:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  1992:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  1993:[204,305,405,505,606,707,808,908,1008,1108,1207,106],
  1994:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  1995:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  1996:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  1997:[204,305,405,505,606,707,807,908,1008,1108,1207,106],
  1998:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  1999:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  2000:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  2001:[204,305,405,505,606,707,807,908,1008,1107,1207,106],
  2002:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2003:[204,306,405,506,606,708,808,908,1009,1108,1208,106],
  2004:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  2005:[204,305,405,505,606,707,807,908,1008,1107,1207,106],
  2006:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2007:[204,306,405,506,606,707,808,908,1009,1108,1208,106],
  2008:[204,305,404,505,605,707,807,907,1008,1107,1207,105],
  2009:[204,305,405,505,606,707,807,908,1008,1107,1207,106],
  2010:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2011:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2012:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  2013:[204,305,404,505,605,707,807,907,1008,1107,1207,105],
  2014:[204,306,405,506,606,707,808,908,1008,1108,1207,106],
  2015:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2016:[204,305,404,505,605,707,807,907,1008,1107,1207,105],
  2017:[203,305,404,505,605,707,807,907,1008,1107,1207,105],
  2018:[204,306,405,506,606,707,807,908,1008,1107,1207,106],
  2019:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2020:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  2021:[203,305,404,505,605,707,807,907,1008,1107,1207,105],
  2022:[204,305,405,505,606,707,807,908,1008,1107,1207,106],
  2023:[204,306,405,506,606,707,808,908,1008,1108,1207,106],
  2024:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  2025:[203,305,404,505,605,707,807,907,1008,1107,1207,105],
  2026:[204,305,405,505,606,707,807,908,1008,1107,1207,106],
  2027:[204,306,405,506,606,707,808,908,1008,1108,1207,106],
  2028:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  2029:[203,305,404,505,605,707,807,907,1008,1107,1207,105],
  2030:[204,305,405,505,606,707,807,908,1008,1107,1207,106],
  2031:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2032:[204,305,404,505,605,707,807,907,1008,1107,1207,106],
  2033:[203,305,404,505,605,707,807,907,1008,1107,1207,105],
  2034:[204,305,405,505,606,707,807,908,1008,1107,1207,106],
  2035:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2036:[204,305,404,505,605,707,807,907,1008,1107,1207,105],
  2037:[203,305,404,505,605,707,807,907,1008,1107,1207,105],
  2038:[204,306,405,505,606,707,807,908,1008,1107,1207,106],
  2039:[204,306,405,506,606,707,808,908,1009,1108,1207,106],
  2040:[204,305,404,505,605,707,807,907,1008,1107,1207,105],
};

/* ===== 工具函数 ===== */
function safeMod(value, base) {
  return ((value % base) + base) % base;
}

function buildPillar(stem, branch) {
  return { stem, branch, stemElement: STEM_ELEMENTS[stem], branchElement: BRANCH_ELEMENTS[branch] };
}

function getGanzhiIndex(stem, branch) {
  const sIdx = STEMS.indexOf(stem);
  const bIdx = BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i++) {
    if (i % 10 === sIdx && i % 12 === bIdx) return i;
  }
  return 0;
}

function getNayin(stem, branch) {
  const idx = getGanzhiIndex(stem, branch);
  return NAYIN_TABLE[idx] || "";
}

function getHourBranchIndex(hour) {
  if (hour === 23 || hour === 0) return 0;
  return Math.floor((hour + 1) / 2) % 12;
}

/* ===== 节气月份偏移 ===== */
function getSolarMonthOffset(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const key = m * 100 + d;
  const terms = SOLAR_TERMS[y];
  if (terms) {
    if (key < terms[0]) {
      const prevTerms = SOLAR_TERMS[y - 1];
      if (prevTerms) {
        if (key >= prevTerms[11]) return 11;
        if (key >= (prevTerms[10] || 1207)) return 10;
      }
      return 11;
    }
    for (let i = 10; i >= 0; i--) {
      if (key >= terms[i]) return i;
    }
    return 0;
  }
  if (key >= 204 && key < 306) return 0;
  if (key >= 306 && key < 405) return 1;
  if (key >= 405 && key < 506) return 2;
  if (key >= 506 && key < 606) return 3;
  if (key >= 606 && key < 707) return 4;
  if (key >= 707 && key < 808) return 5;
  if (key >= 808 && key < 908) return 6;
  if (key >= 908 && key < 1009) return 7;
  if (key >= 1009 && key < 1108) return 8;
  if (key >= 1108 && key < 1207) return 9;
  if (key >= 1207 || key < 106) return 10;
  return 11;
}

function getLiChunDate(year) {
  const terms = SOLAR_TERMS[year];
  if (terms) {
    const lc = terms[0];
    return new Date(year, Math.floor(lc / 100) - 1, lc % 100);
  }
  return new Date(year, 1, 4);
}

/* ===== 四柱排盘 ===== */
function getYearPillar(date) {
  const liChun = getLiChunDate(date.getFullYear());
  const adjustedYear = date < liChun ? date.getFullYear() - 1 : date.getFullYear();
  const stemIdx = safeMod(adjustedYear - 4, 10);
  const branchIdx = safeMod(adjustedYear - 4, 12);
  return buildPillar(STEMS[stemIdx], BRANCHES[branchIdx]);
}

function getYearPillarByYear(year) {
  const stemIdx = safeMod(year - 4, 10);
  const branchIdx = safeMod(year - 4, 12);
  return buildPillar(STEMS[stemIdx], BRANCHES[branchIdx]);
}

function getMonthStartStem(yearStem) {
  const map = {
    甲: "丙", 己: "丙", 乙: "戊", 庚: "戊", 丙: "庚",
    辛: "庚", 丁: "壬", 壬: "壬", 戊: "甲", 癸: "甲",
  };
  return map[yearStem];
}

function getMonthStem(yearStem, monthIndex) {
  const firstStemIndex = STEMS.indexOf(getMonthStartStem(yearStem));
  return STEMS[safeMod(firstStemIndex + monthIndex, 10)];
}

function getMonthPillar(date, yearStem) {
  const monthOffset = getSolarMonthOffset(date);
  const firstStemIndex = STEMS.indexOf(getMonthStartStem(yearStem));
  const stemIndex = safeMod(firstStemIndex + monthOffset, 10);
  const branchIndex = safeMod(2 + monthOffset, 12);
  return buildPillar(STEMS[stemIndex], BRANCHES[branchIndex]);
}

function getDayPillar(date) {
  const BASE_INDEX = 54;
  const baseDate = Date.UTC(2000, 0, 1);
  const targetDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((targetDate - baseDate) / 86400000);
  const index = safeMod(BASE_INDEX + diffDays, 60);
  return buildPillar(STEMS[index % 10], BRANCHES[index % 12]);
}

function getHourPillar(date, dayStem) {
  const branchIndex = getHourBranchIndex(date.getHours());
  const startStemIndexMap = {
    甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4,
    辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8,
  };
  const stemIndex = safeMod(startStemIndexMap[dayStem] + branchIndex, 10);
  return buildPillar(STEMS[stemIndex], BRANCHES[branchIndex]);
}

function getHourPillarByHour(hour, dayStem) {
  const branchIndex = getHourBranchIndex(hour);
  const startStemIndexMap = {
    甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4,
    辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8,
  };
  const stemIndex = safeMod(startStemIndexMap[dayStem] + branchIndex, 10);
  return buildPillar(STEMS[stemIndex], BRANCHES[branchIndex]);
}

function getFourPillars(date) {
  const yearPillar = getYearPillar(date);
  const monthPillar = getMonthPillar(date, yearPillar.stem);
  const dayPillar = getDayPillar(date);
  const hourPillar = getHourPillar(date, dayPillar.stem);
  return [yearPillar, monthPillar, dayPillar, hourPillar];
}

function getThreePillars(date) {
  const yearPillar = getYearPillar(date);
  const monthPillar = getMonthPillar(date, yearPillar.stem);
  const dayPillar = getDayPillar(date);
  return [yearPillar, monthPillar, dayPillar];
}

/* ===== 十神 ===== */
function getTenGod(dayStem, otherStem) {
  const dayEl = STEM_ELEMENTS[dayStem];
  const otherEl = STEM_ELEMENTS[otherStem];
  const dayYY = STEM_YIN_YANG[dayStem];
  const otherYY = STEM_YIN_YANG[otherStem];
  const same = dayYY === otherYY;
  if (dayEl === otherEl) return same ? "比肩" : "劫财";
  if (ELEMENT_GENERATE[dayEl] === otherEl) return same ? "食神" : "伤官";
  if (ELEMENT_OVERCOME[dayEl] === otherEl) return same ? "偏财" : "正财";
  if (ELEMENT_OVERCOME_BY[dayEl] === otherEl) return same ? "七杀" : "正官";
  if (ELEMENT_GENERATED_BY[dayEl] === otherEl) return same ? "偏印" : "正印";
  return "";
}

const TEN_GOD_MEANINGS = {
  比肩: { icon: "🤝", brief: "同类相助" },
  劫财: { icon: "⚔️", brief: "争夺竞争" },
  食神: { icon: "🎨", brief: "才华表达" },
  伤官: { icon: "💡", brief: "创新突破" },
  偏财: { icon: "💰", brief: "意外之财" },
  正财: { icon: "🏦", brief: "稳定收入" },
  七杀: { icon: "🗡️", brief: "权威压力" },
  正官: { icon: "👔", brief: "规矩地位" },
  偏印: { icon: "📚", brief: "偏门学问" },
  正印: { icon: "🎓", brief: "学历庇护" },
};

/* ===== 身强身弱 ===== */
function calculateDayMasterStrength(pillars, dayStem) {
  const dayEl = STEM_ELEMENTS[dayStem];
  let helpScore = 0, drainScore = 0;
  const positions = [
    { stem: pillars[0].stem, branch: pillars[0].branch, stemW: 8, branchW: 4 },
    { stem: pillars[1].stem, branch: pillars[1].branch, stemW: 12, branchW: 40 },
    { stem: null, branch: pillars[2].branch, stemW: 0, branchW: 12 },
    { stem: pillars[3] ? pillars[3].stem : null, branch: pillars[3] ? pillars[3].branch : null, stemW: 12, branchW: 12 },
  ];
  positions.forEach(({ stem, branch, stemW, branchW }) => {
    if (stem) {
      const el = STEM_ELEMENTS[stem];
      if (el === dayEl || ELEMENT_GENERATED_BY[dayEl] === el) helpScore += stemW;
      else drainScore += stemW;
    }
    if (branch && BRANCH_HIDDEN_STEMS[branch]) {
      BRANCH_HIDDEN_STEMS[branch].forEach(({ stem: h, weight: w }) => {
        const ratio = w / 100;
        const el = STEM_ELEMENTS[h];
        if (el === dayEl || ELEMENT_GENERATED_BY[dayEl] === el) helpScore += branchW * ratio;
        else drainScore += branchW * ratio;
      });
    }
  });
  const total = helpScore + drainScore;
  const score = total > 0 ? Math.round((helpScore / total) * 100) : 50;
  let level, label;
  if (score >= 85) { level = 7; label = "从强"; }
  else if (score >= 70) { level = 6; label = "强"; }
  else if (score >= 58) { level = 5; label = "偏强"; }
  else if (score >= 42) { level = 4; label = "均衡"; }
  else if (score >= 30) { level = 3; label = "偏弱"; }
  else if (score >= 15) { level = 2; label = "弱"; }
  else { level = 1; label = "从弱"; }

  const hiddens = BRANCH_HIDDEN_STEMS[pillars[1].branch];
  const mainEl = STEM_ELEMENTS[hiddens[0].stem];
  let monthStatus;
  if (mainEl === dayEl) monthStatus = "得令·旺";
  else if (ELEMENT_GENERATED_BY[dayEl] === mainEl) monthStatus = "得令·相";
  else if (ELEMENT_GENERATE[dayEl] === mainEl) monthStatus = "失令·休";
  else if (ELEMENT_OVERCOME[dayEl] === mainEl) monthStatus = "失令·囚";
  else if (ELEMENT_OVERCOME_BY[dayEl] === mainEl) monthStatus = "失令·死";
  else monthStatus = "平";

  return { helpScore: Math.round(helpScore), drainScore: Math.round(drainScore), strengthScore: score, level, label, isStrong: score >= 50, monthStatus };
}

/* ===== 用神取法 ===== */
function determineUsefulGod(strengthResult, dayStem) {
  const dayEl = STEM_ELEMENTS[dayStem];
  const { level, label } = strengthResult;
  const likeElements = [], dislikeElements = [];
  let useGodElement;

  if (level >= 6) {
    useGodElement = ELEMENT_GENERATE[dayEl];
    likeElements.push(ELEMENT_GENERATE[dayEl], ELEMENT_OVERCOME[dayEl], ELEMENT_OVERCOME_BY[dayEl]);
    dislikeElements.push(dayEl, ELEMENT_GENERATED_BY[dayEl]);
  } else if (level === 5) {
    useGodElement = ELEMENT_OVERCOME[dayEl];
    likeElements.push(ELEMENT_GENERATE[dayEl], ELEMENT_OVERCOME[dayEl], ELEMENT_OVERCOME_BY[dayEl]);
    dislikeElements.push(dayEl, ELEMENT_GENERATED_BY[dayEl]);
  } else if (level === 4) {
    useGodElement = ELEMENT_GENERATE[dayEl];
    likeElements.push(ELEMENT_GENERATE[dayEl], ELEMENT_GENERATED_BY[dayEl]);
    dislikeElements.push(ELEMENT_OVERCOME_BY[dayEl]);
  } else if (level === 3) {
    useGodElement = ELEMENT_GENERATED_BY[dayEl];
    likeElements.push(ELEMENT_GENERATED_BY[dayEl], dayEl);
    dislikeElements.push(ELEMENT_OVERCOME_BY[dayEl], ELEMENT_OVERCOME[dayEl], ELEMENT_GENERATE[dayEl]);
  } else if (level === 1) {
    useGodElement = ELEMENT_OVERCOME_BY[dayEl];
    likeElements.push(ELEMENT_OVERCOME_BY[dayEl], ELEMENT_OVERCOME[dayEl], ELEMENT_GENERATE[dayEl]);
    dislikeElements.push(dayEl, ELEMENT_GENERATED_BY[dayEl]);
  } else {
    useGodElement = ELEMENT_GENERATED_BY[dayEl];
    likeElements.push(ELEMENT_GENERATED_BY[dayEl], dayEl);
    dislikeElements.push(ELEMENT_OVERCOME_BY[dayEl], ELEMENT_OVERCOME[dayEl], ELEMENT_GENERATE[dayEl]);
  }

  return { useGodElement, likeElements: [...new Set(likeElements)], dislikeElements: [...new Set(dislikeElements)], label };
}

/* ===== 五行加权计数 ===== */
function getWeightedElementCounts(pillars) {
  const c = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const pos = [
    { stem: pillars[0].stem, branch: pillars[0].branch, sW: 8, bW: 4 },
    { stem: pillars[1].stem, branch: pillars[1].branch, sW: 12, bW: 40 },
    { stem: pillars[2].stem, branch: pillars[2].branch, sW: 0, bW: 12 },
  ];
  if (pillars[3]) {
    pos.push({ stem: pillars[3].stem, branch: pillars[3].branch, sW: 12, bW: 12 });
  }
  pos.forEach(({ stem, branch, sW, bW }) => {
    if (stem && sW > 0) c[STEM_ELEMENTS[stem]] += sW;
    if (branch && BRANCH_HIDDEN_STEMS[branch]) {
      BRANCH_HIDDEN_STEMS[branch].forEach(({ stem: h, weight: w }) => {
        c[STEM_ELEMENTS[h]] += bW * (w / 100);
      });
    }
  });
  return c;
}

/* ===== 五行关系判定 ===== */
function getElementRelation(myElement, targetElement) {
  if (myElement === targetElement) return { relation: "比和", desc: "同类相助" };
  if (ELEMENT_GENERATE[myElement] === targetElement) return { relation: "我生", desc: "泄气外耗" };
  if (ELEMENT_GENERATED_BY[myElement] === targetElement) return { relation: "生我", desc: "得助得力" };
  if (ELEMENT_OVERCOME[myElement] === targetElement) return { relation: "我克", desc: "我克为财" };
  if (ELEMENT_OVERCOME_BY[myElement] === targetElement) return { relation: "克我", desc: "受克受压" };
  return { relation: "未知", desc: "" };
}

/* ===== 暴露公共 API ===== */
return {
  STEMS: STEMS,
  BRANCHES: BRANCHES,
  ELEMENTS: ELEMENTS,
  STEM_ELEMENTS: STEM_ELEMENTS,
  BRANCH_ELEMENTS: BRANCH_ELEMENTS,
  ELEMENT_STYLES: ELEMENT_STYLES,
  ELEMENT_GENERATE: ELEMENT_GENERATE,
  ELEMENT_OVERCOME: ELEMENT_OVERCOME,
  ELEMENT_GENERATED_BY: ELEMENT_GENERATED_BY,
  ELEMENT_OVERCOME_BY: ELEMENT_OVERCOME_BY,
  STEM_YIN_YANG: STEM_YIN_YANG,
  NAYIN_ELEMENT_MAP: NAYIN_ELEMENT_MAP,
  BRANCH_HIDDEN_STEMS: BRANCH_HIDDEN_STEMS,
  TEN_GOD_MEANINGS: TEN_GOD_MEANINGS,
  safeMod: safeMod,
  getNayin: getNayin,
  getThreePillars: getThreePillars,
  getFourPillars: getFourPillars,
  getYearPillarByYear: getYearPillarByYear,
  getMonthStem: getMonthStem,
  calculateDayMasterStrength: calculateDayMasterStrength,
  determineUsefulGod: determineUsefulGod,
  getWeightedElementCounts: getWeightedElementCounts,
  getTenGod: getTenGod,
  getElementRelation: getElementRelation,
};

})();
