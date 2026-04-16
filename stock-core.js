/* ========================================================================
 * 股票五行命盘分析引擎 — 三维立体分析
 * 依赖: bazi-engine.js (天干地支、四柱排盘、十神、用神等核心算法)
 * 维度一: 行业五行 × 上市日柱 → 股票本命元素
 * 维度二: 投资者八字 → 日主强弱、用神喜忌
 * 维度三: 流年流月天干 → 时空能量场
 * ======================================================================== */

var StockCore = (function (B) {
"use strict";

/* 从 Bazi 命名空间解构所有依赖 */
var STEMS = B.STEMS;
var BRANCHES = B.BRANCHES;
var STEM_ELEMENTS = B.STEM_ELEMENTS;
var BRANCH_ELEMENTS = B.BRANCH_ELEMENTS;
var ELEMENT_GENERATE = B.ELEMENT_GENERATE;
var ELEMENT_OVERCOME = B.ELEMENT_OVERCOME;
var ELEMENT_GENERATED_BY = B.ELEMENT_GENERATED_BY;
var ELEMENT_OVERCOME_BY = B.ELEMENT_OVERCOME_BY;
var STEM_YIN_YANG = B.STEM_YIN_YANG;
var NAYIN_ELEMENT_MAP = B.NAYIN_ELEMENT_MAP;
var BRANCH_HIDDEN_STEMS = B.BRANCH_HIDDEN_STEMS;
var safeMod = B.safeMod;
var getNayin = B.getNayin;
var getThreePillars = B.getThreePillars;
var getFourPillars = B.getFourPillars;
var getYearPillarByYear = B.getYearPillarByYear;
var getMonthStem = B.getMonthStem;
var calculateDayMasterStrength = B.calculateDayMasterStrength;
var determineUsefulGod = B.determineUsefulGod;
var getWeightedElementCounts = B.getWeightedElementCounts;
var getTenGod = B.getTenGod;
var getElementRelation = B.getElementRelation;

/* ===== 确定性伪随机引擎（Seeded PRNG） ===== */
/* 使用 mulberry32 算法，确保相同输入→相同输出，不再依赖 Math.random() */
var _rngState = 0;

function _mulberry32() {
  _rngState |= 0;
  _rngState = (_rngState + 0x6D2B79F5) | 0;
  var t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function _hashString(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

function _initRng(ticker, birthDateStr, birthHour) {
  var seed = _hashString((ticker || "") + "|" + (birthDateStr || "") + "|" + (birthHour || 0));
  _rngState = seed;
}

/* ===== 小工具 ===== */
function _variance(base, range) {
  return base + Math.floor(_mulberry32() * (range * 2 + 1)) - range;
}

function _clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ===== 时代景气度 =====
 * 反映当前时代的行业大势，与投资人八字交互
 * 用神/喜神匹配行业五行 → 全额景气度
 * 忌神匹配 → 大幅削减
 * 2024-2027: AI/半导体/云计算大周期 */
const ERA_SECTOR_BONUS = {
  "半导体": 30, "AI": 30, "GPU芯片": 30, "云计算": 25, "软件": 22,
  "互联网": 22, "科技": 22, "网络安全": 22, "大数据分析": 25,
  "电商": 18, "社交媒体": 18, "电商平台": 18,
  "电动车": 20, "光伏": 15, "新能源": 15,
  "杠杆ETF": 12, "单股杠杆": 12, "杠杆ETN": 12, "反向ETF": 8, "反向ETN": 8,
  "生物科技": 12, "医药": 8,
  "军工": 12, "航空航天": 10,
  "消费电子": 18, "IT服务": 15, "IT咨询": 15,
  "企业软件": 22, "云监控": 22, "数据库": 22, "协作软件": 20,
  "网络设备": 18, "通信设备": 15, "流媒体": 15,
  "游戏平台": 12, "出行平台": 12, "外卖平台": 12,
  "ETF": 5,
  /* 半导体/AI 重仓的国家和地区 ETF — 一篮子半导体敞口，分散风险更低，景气度略高于个股 */
  "韩国市场": 35, "台湾市场": 35, "日本市场": 28,
  "中国互联网": 22, "中国大盘": 12, "中国ETF": 12,
  "新兴市场": 10, "新兴市场ETF": 10,
};

/* 基础景气度（不带八字调节） */
function _getEraTrendBonusRaw(stock) {
  if (!stock) return 0;
  var sector = stock.sector || "";
  var industry = stock.industry || "";
  return ERA_SECTOR_BONUS[sector] || ERA_SECTOR_BONUS[industry] || 0;
}

/* 与投资人八字交互的景气度
 * usefulGod: { useGodElement, likeElements, dislikeElements }
 * stockEl: 股票的行业五行 */
function _getEraTrendBonus(stock, usefulGod) {
  var raw = _getEraTrendBonusRaw(stock);
  if (raw === 0) return 0;
  if (!usefulGod) return raw;

  var stockEl = (stock && stock.industryElement) || (stock && stock.element) || "";
  var like = usefulGod.likeElements || [];
  var dislike = usefulGod.dislikeElements || [];
  var useGod = usefulGod.useGodElement || "";

  /* 用神完全匹配 → 120% 加成 */
  if (stockEl === useGod) {
    return Math.round(raw * 1.2);
  }
  /* 喜神匹配 → 全额 */
  if (like.indexOf(stockEl) >= 0) {
    return raw;
  }
  /* 忌神匹配 → 60% */
  if (dislike.indexOf(stockEl) >= 0) {
    return Math.round(raw * 0.6);
  }
  /* 非喜非忌 → 70% */
  return Math.round(raw * 0.7);
}

const MONTH_NAMES = [
  "1月", "2月", "3月", "4月",
  "5月", "6月", "7月", "8月",
  "9月", "10月", "11月", "12月",
];

/* ===== 1. analyzeStockElement ===== */
function analyzeStockElement(stockInfo) {
  const industryElement = stockInfo.element;
  const ipoDate = new Date(stockInfo.ipoDate);
  const ipoPillars = getThreePillars(ipoDate);

  const dayPillar = ipoPillars[2];
  const ipoElement = STEM_ELEMENTS[dayPillar.stem];
  const ipoNayin = getNayin(dayPillar.stem, dayPillar.branch);

  let primaryElement, secondaryElement, elementRelation, elementDesc;

  const yearNayin = getNayin(ipoPillars[0].stem, ipoPillars[0].branch);
  const dayNayin = getNayin(dayPillar.stem, dayPillar.branch);
  const pillarInfo = `上市四柱：年柱${ipoPillars[0].stem}${ipoPillars[0].branch}（${yearNayin}）、月柱${ipoPillars[1].stem}${ipoPillars[1].branch}、日柱${dayPillar.stem}${dayPillar.branch}（${dayNayin}）`;

  if (industryElement === ipoElement) {
    primaryElement = industryElement;
    secondaryElement = null;
    elementRelation = "相同";
    elementDesc = `${pillarInfo}。行业五行属${industryElement}，日柱天干${dayPillar.stem}亦属${ipoElement}，内外五行一致，气场纯粹凝聚，该股${industryElement}属性极为突出。在${industryElement}气旺盛的流年中往往表现强劲，反之在克${industryElement}之年则波动加剧`;
  } else if (ELEMENT_GENERATE[ipoElement] === industryElement) {
    primaryElement = industryElement;
    secondaryElement = ipoElement;
    elementRelation = "相生";
    elementDesc = `${pillarInfo}。行业五行属${industryElement}，日柱天干${dayPillar.stem}属${ipoElement}，${ipoElement}生${industryElement}，先天命格与行业形成相生之局，内在能量流转顺畅。上市基因为行业发展提供源源不断的底层动力，属五行配置上佳的标的`;
  } else if (ELEMENT_GENERATE[industryElement] === ipoElement) {
    primaryElement = industryElement;
    secondaryElement = ipoElement;
    elementRelation = "相生";
    elementDesc = `${pillarInfo}。行业五行属${industryElement}，日柱天干${dayPillar.stem}属${ipoElement}，${industryElement}生${ipoElement}，行业五行泄气于上市日柱，存在能量外耗的趋势。这类股票可能出现行业景气但公司本身回报不及预期的现象，需关注基本面是否能匹配行业热度`;
  } else if (ELEMENT_OVERCOME[industryElement] === ipoElement) {
    primaryElement = industryElement;
    secondaryElement = ipoElement;
    elementRelation = "相克";
    elementDesc = `${pillarInfo}。行业五行属${industryElement}，日柱天干${dayPillar.stem}属${ipoElement}，${industryElement}克${ipoElement}，行业气场对上市命格形成压制。这类股票内部存在张力——行业趋势虽好，但公司自身可能面临战略转型或管理层调整的挑战，走势易出现分化`;
  } else if (ELEMENT_OVERCOME[ipoElement] === industryElement) {
    primaryElement = industryElement;
    secondaryElement = ipoElement;
    elementRelation = "相克";
    elementDesc = `${pillarInfo}。行业五行属${industryElement}，日柱天干${dayPillar.stem}属${ipoElement}，${ipoElement}克${industryElement}，上市命格反克行业五行，暗藏逆势基因。这种配置下，公司可能频繁经历与行业大势相左的独立行情，属于需要精选时机的标的`;
  } else {
    primaryElement = industryElement;
    secondaryElement = ipoElement;
    elementRelation = "中性";
    elementDesc = `${pillarInfo}。行业五行属${industryElement}，日柱天干${dayPillar.stem}属${ipoElement}，两者不构成直接生克关系，五行配置相对独立。这类股票走势更多受行业基本面和市场情绪驱动，命理层面的波动因子较弱`;
  }

  return {
    industryElement,
    ipoElement,
    primaryElement,
    secondaryElement,
    ipoPillars,
    ipoNayin,
    elementRelation,
    elementDesc,
  };
}

/* ===== 2. analyzeInvestor ===== */
function analyzeInvestor(birthDate, birthTime, gender) {
  const bd = new Date(birthDate);
  let pillars;

  if (birthTime !== undefined && birthTime !== null && birthTime !== "") {
    const hour = typeof birthTime === "number" ? birthTime : parseInt(birthTime, 10);
    const dateWithHour = new Date(bd.getFullYear(), bd.getMonth(), bd.getDate(), hour);
    pillars = getFourPillars(dateWithHour);
  } else {
    const threePillars = getThreePillars(bd);
    pillars = [threePillars[0], threePillars[1], threePillars[2], null];
  }

  const dayStem = pillars[2].stem;
  const dayElement = STEM_ELEMENTS[dayStem];
  const strength = calculateDayMasterStrength(pillars, dayStem);
  const usefulGod = determineUsefulGod(strength, dayStem);
  const weightedElements = getWeightedElementCounts(pillars);

  const financialProfile = _buildFinancialProfile(pillars, dayStem, strength);

  var birthDateStr = bd.getFullYear() + "-" + (bd.getMonth() + 1) + "-" + bd.getDate();

  return {
    pillars,
    dayStem,
    dayElement,
    strength,
    usefulGod,
    weightedElements,
    financialProfile,
    _birthDateStr: birthDateStr,
    _birthTime: birthTime,
  };
}

function _buildFinancialProfile(pillars, dayStem, strength) {
  const tenGods = {};
  const allStems = [];

  pillars.forEach((p, i) => {
    if (!p) return;
    if (i !== 2) allStems.push(p.stem);
    if (p.branch && BRANCH_HIDDEN_STEMS[p.branch]) {
      BRANCH_HIDDEN_STEMS[p.branch].forEach(h => allStems.push(h.stem));
    }
  });

  allStems.forEach(s => {
    const tg = getTenGod(dayStem, s);
    if (tg) tenGods[tg] = (tenGods[tg] || 0) + 1;
  });

  const parts = [];
  if (tenGods["正财"] || tenGods["偏财"]) {
    const totalWealth = (tenGods["正财"] || 0) + (tenGods["偏财"] || 0);
    if (totalWealth >= 3) parts.push("命中财星旺盛，天生具备聚财能力");
    else if (tenGods["偏财"]) parts.push("偏财透出，善于把握意外投资机会");
    else parts.push("正财为用，适合稳健投资策略");
  }
  if (tenGods["食神"] || tenGods["伤官"]) {
    parts.push("食伤泄秀，眼光独到，善于发现潜力标的");
  }
  if (tenGods["七杀"] || tenGods["正官"]) {
    parts.push("官杀混杂需有制化，投资宜设止损纪律");
  }
  if (tenGods["偏印"]) {
    parts.push("偏印主变，容易受消息面影响情绪波动");
  }

  if (parts.length === 0) {
    if (strength.isStrong) parts.push("日主偏强，财可任之，适合主动型投资");
    else parts.push("日主偏弱，宜保守理财，忌重仓激进");
  }

  return parts.join("；") + "。";
}

/* ===== 3. matchStockToInvestor ===== */
function matchStockToInvestor(stockElement, investorResult, stockInfo) {
  const { dayElement, strength, usefulGod } = investorResult;
  const stockEl = stockElement.primaryElement;
  const eraBonus = _getEraTrendBonus(stockInfo, usefulGod);

  let matchScore, matchLabel, relation, matchDesc;

  const strengthLabel = strength.label;
  const likeStr = usefulGod.likeElements.join("、");
  const dislikeStr = usefulGod.dislikeElements.join("、");

  if (stockEl === usefulGod.useGodElement) {
    matchScore = _variance(92, 3);
    matchLabel = "天赐良缘";
    relation = "喜用神";
    matchDesc = `该股五行属${stockEl}，恰好是您八字命局中最需要的用神五行。用神是平衡命局、趋吉避凶的关键力量，当投资标的的五行与用神一致时，意味着这笔投资在能量层面与您的命格高度共振。您的喜用五行为${likeStr}，此股正合其中之首——这是命理学上极为理想的人股配置，可以在该股所属板块上适当加大关注力度`;
  } else if (usefulGod.likeElements.includes(stockEl)) {
    matchScore = _variance(83, 5);
    matchLabel = "顺势而为";
    relation = "喜神";
    matchDesc = `该股五行属${stockEl}，位于您命局喜用五行（${likeStr}）的范畴内。虽非第一用神但同属喜用方向，投资此股在命理能量上有正面加持。建议在流年天干透出${stockEl}气的年份重点布局，顺势而为往往事半功倍`;
  } else if (stockEl === dayElement) {
    matchScore = _variance(74, 4);
    matchLabel = "比和同类";
    relation = "比和";
    matchDesc = `该股五行${stockEl}与您的日主同属${dayElement}，在命理中为"比肩"或"劫财"关系——即同类之气。比和意味着彼此不生不克，走势与您个人运势节奏较为同步。适合作为底仓配置，但不宜期望超额收益，因为同气之间缺乏"我克为财"的驱动力`;
  } else if (ELEMENT_GENERATED_BY[dayElement] === stockEl) {
    matchScore = _variance(70, 5);
    matchLabel = "贵人送财";
    relation = "生我";
    matchDesc = `该股五行${stockEl}生您的日主${dayElement}（${stockEl}生${dayElement}），在十神体系中属于"印星"关系——如同贵人扶持、长辈庇护。投资这类股票时，您往往能获得较好的信息差和判断力加成，持股心态也更为稳健。尤其在流年走印运时，此股可作为压舱石配置`;
  } else if (ELEMENT_OVERCOME[dayElement] === stockEl) {
    matchScore = _variance(65, 5);
    matchLabel = "我克为财";
    relation = "我克";
    matchDesc = `您的日主${dayElement}克制该股五行${stockEl}（${dayElement}克${stockEl}），命理中"我克者为财"——意味着您有掌控此股的潜力，但需要消耗精力和判断力。这类股票适合主动型投资者，需要花时间研究基本面、把握买卖时点。身强者操作此类标的如虎添翼，身弱者则可能力不从心`;
  } else if (usefulGod.dislikeElements.includes(stockEl)) {
    matchScore = _variance(48, 4);
    matchLabel = "命理偏弱";
    relation = "忌神";
    matchDesc = `该股五行属${stockEl}，在您命局的忌神五行范围内（忌${dislikeStr}）。命理层面存在一定阻力，操作时需格外注意仓位管理和止损纪律`;
  } else if (ELEMENT_OVERCOME_BY[dayElement] === stockEl) {
    matchScore = _variance(44, 4);
    matchLabel = "压力较大";
    relation = "克我";
    matchDesc = `该股五行${stockEl}克制您的日主${dayElement}（${stockEl}克${dayElement}），命理层面有一定压力。操作此类标的时心理承压较大，建议控制仓位、设好止损，顺势而为不逆势扛单`;
  } else {
    matchScore = _variance(55, 5);
    matchLabel = "中性观望";
    relation = "中性";
    matchDesc = `该股五行${stockEl}与您的日主${dayElement}之间不构成直接的强生克关系，命理层面的指向性不强。对于这类标的，五行匹配度的参考价值有限，建议更多依据基本面分析和流年运势变化来做判断，不必在命理维度上过度解读`;
  }

  if (strength.level >= 5 && relation === "我克") {
    matchScore += 5;
    matchDesc += "。您日主" + strengthLabel + "，担财能力充足——身强者驾驭偏财如同猛将挥刀，可以适当放大仓位、缩短持有周期，做波段收益";
  }
  if (strength.level <= 3 && relation === "生我") {
    matchScore += 5;
    matchDesc += "。您日主偏弱，正需要印星生扶——此股的「生我」属性恰好补益了命局短板，建议作为长线持仓的核心标的";
  }
  if (strength.level <= 3 && relation === "我克") {
    matchScore -= 5;
    matchDesc += "。但需注意：您日主" + strengthLabel + "，担财能力有限——身弱求财如同小马拉大车，建议将仓位控制在总资产的10%以内，且设好止损线";
  }

  if (eraBonus > 0) {
    matchDesc += "。当前处于" + (stockInfo ? stockInfo.sector || stockInfo.industry : stockEl) + "行业大景气周期，时代趋势加成+" + eraBonus;
  }

  matchScore = _clamp(matchScore, 0, 100);

  const investStyleAdvice = _getInvestStyleAdvice(strength);

  return {
    matchScore,
    matchLabel,
    relation,
    matchDesc,
    investStyleAdvice,
    eraBonus,
  };
}

function _getInvestStyleAdvice(strength) {
  switch (strength.level) {
    case 7: return "【从强格·激进型】从强格局的投资者精力极为旺盛，决断力强，适合趋势跟踪策略——追涨强势股、做动量交易。切忌逆势抄底，因为从强者顺势则昌、逆势则损。建议仓位可达八成，但必须设置严格的趋势破位止损。适合的标的：高Beta成长股、科技龙头、杠杆ETF";
    case 6: return "【强旺格·进取型】日主强旺意味着您有较强的风险承受能力和决策魄力，适合波段操作和中短线交易。可以关注业绩拐点股和行业轮动机会，仓位上限建议七成。注意不要因为过于自信而忽视止损纪律——强者之败往往在于刚愎";
    case 5: return "【偏强格·稳进型】偏强的命格介于进攻与防守之间，适合「六成底仓+四成机动」的配置策略。核心仓位配置蓝筹白马，机动部分可参与热点轮动。避免满仓操作和频繁换股，保持一定的现金比例是偏强格局投资者的最佳纪律";
    case 4: return "【均衡格·平衡型】身强身弱均衡是难得的中庸命格，投资策略宜「攻守兼备、分散配置」。建议按五行属性分散持仓——不同五行板块各配一定比例，让组合本身也达到五行平衡。牛市不贪、熊市不惧，均衡格局者的长期收益往往优于极端风格";
    case 3: return "【偏弱格·防守型】日主偏弱意味着投资中应以「守」字当先——优选高股息蓝筹、公用事业、消费龙头等防御性标的。仓位建议不超过五成，保留充足现金应对波动。特别适合定投策略和长期价值投资，避免杠杆和衍生品交易";
    case 2: return "【弱势格·保守型】日主偏弱的投资者在市场波动中心理承压较大，建议以「稳」字为核心。配置以债券ETF、高息股、货币基金为主，权益类仓位控制在三成以内。严禁追高杀跌和情绪化交易——弱势格局者最忌频繁操作，长线持有反而能获得不错的复利";
    case 1: return "【从弱格·顺势型】从弱格局意味着命主宜「弃己从人」、顺应大势。投资上建议跟随机构主力方向，选择被动型指数基金（如SPY、QQQ、VOO）为核心配置。避免独立研判个股，更不宜重仓单一标的。定投宽基指数是从弱格局投资者的最优解";
    default: return "建议综合分析个人命理特征后再制定投资策略";
  }
}

/* ===== 4. calculateYearlyFortune ===== */
function calculateYearlyFortune(stockPrimaryElement, investorDayElement, yearRange, stockInfo, usefulGod) {
  const results = [];
  const startYear = yearRange[0];
  const endYear = yearRange[1];
  const eraBonus = _getEraTrendBonus(stockInfo, usefulGod);

  for (let year = startYear; year <= endYear; year++) {
    const yp = getYearPillarByYear(year);
    const yearElement = STEM_ELEMENTS[yp.stem];
    const yearGanzhi = yp.stem + yp.branch;
    const nayin = getNayin(yp.stem, yp.branch);

    const stockScore = _scoreElementVsYear(stockPrimaryElement, yearElement);
    const matchScore = _scoreElementVsYear(investorDayElement, yearElement);
    const personalFinanceScore = _personalFinanceScore(investorDayElement, yearElement, stockPrimaryElement);
    const eraYearBonus = (year >= 2024 && year <= 2027) ? eraBonus : Math.round(eraBonus * 0.5);
    const combinedScore = _clamp(
      Math.round(stockScore * 0.35 + matchScore * 0.35 + personalFinanceScore * 0.15 + eraYearBonus * 0.75),
      0, 100
    );

    const stockLabel = stockScore >= 72 ? "利好" : stockScore >= 50 ? "平稳" : "利空";
    const matchLabel = combinedScore >= 70 ? "适合买入" : combinedScore >= 50 ? "谨慎观望" : "建议回避";

    const tenGodToStock = _safeTenGod(investorDayElement, yearElement);
    const desc = _buildYearlyDesc(year, yearGanzhi, yearElement, stockPrimaryElement, investorDayElement, stockScore, combinedScore, nayin);

    results.push({
      year,
      yearPillar: { stem: yp.stem, branch: yp.branch },
      yearElement,
      yearGanzhi,
      nayin,
      stockScore,
      matchScore,
      combinedScore,
      stockLabel,
      matchLabel,
      tenGodToStock,
      desc,
    });
  }

  return results;
}

function _scoreElementVsYear(element, yearElement) {
  if (ELEMENT_GENERATED_BY[element] === yearElement) return _variance(92, 4);
  if (element === yearElement) return _variance(78, 5);
  if (ELEMENT_OVERCOME[element] === yearElement) return _variance(70, 5);
  if (ELEMENT_GENERATE[element] === yearElement) return _variance(60, 5);
  if (ELEMENT_OVERCOME_BY[element] === yearElement) return _variance(50, 5);
  return _variance(60, 5);
}

function _personalFinanceScore(dayElement, yearElement, stockElement) {
  let score = 50;
  const yearRelToDay = getElementRelation(dayElement, yearElement);
  if (yearRelToDay.relation === "生我") score += 20;
  else if (yearRelToDay.relation === "比和") score += 10;
  else if (yearRelToDay.relation === "我克") score += 5;
  else if (yearRelToDay.relation === "我生") score -= 5;
  else if (yearRelToDay.relation === "克我") score -= 15;

  if (ELEMENT_GENERATE[yearElement] === stockElement) score += 10;
  else if (ELEMENT_OVERCOME[yearElement] === stockElement) score -= 10;

  return _clamp(_variance(score, 3), 0, 100);
}

function _safeTenGod(dayElement, targetElement) {
  const dayStemCandidates = STEMS.filter(s => STEM_ELEMENTS[s] === dayElement && STEM_YIN_YANG[s] === "阳");
  const targetStemCandidates = STEMS.filter(s => STEM_ELEMENTS[s] === targetElement && STEM_YIN_YANG[s] === "阳");
  if (dayStemCandidates.length && targetStemCandidates.length) {
    return getTenGod(dayStemCandidates[0], targetStemCandidates[0]);
  }
  return "";
}

function _buildYearlyDesc(year, ganzhi, yearEl, stockEl, dayEl, stockScore, combined, nayin) {
  const stockRel = getElementRelation(stockEl, yearEl);
  const dayRel = getElementRelation(dayEl, yearEl);

  let stockPart;
  if (stockRel.relation === "生我") {
    stockPart = `流年${yearEl}气生${stockEl}属板块（${yearEl}生${stockEl}），形成印星加持格局，大环境资金倾向流入${stockEl}属行业，板块整体受益`;
  } else if (stockRel.relation === "比和") {
    stockPart = `流年${yearEl}与${stockEl}属板块同气共振，板块热度维持高位，但同业竞争也会加剧，需精选龙头`;
  } else if (stockRel.relation === "我克") {
    stockPart = `${stockEl}克流年${yearEl}（我克为财），板块有主动获利的机会，但需要消耗更多基本面支撑`;
  } else if (stockRel.relation === "我生") {
    stockPart = `${stockEl}生流年${yearEl}（食伤泄气），板块利润可能被上下游吸收，估值承压，注意业绩不及预期的风险`;
  } else if (stockRel.relation === "克我") {
    stockPart = `流年${yearEl}克制${stockEl}属板块（${yearEl}克${stockEl}），行业面临政策或环境逆风，需防系统性回调`;
  } else {
    stockPart = `流年${yearEl}与${stockEl}属板块关系中性，板块走势更多取决于自身基本面`;
  }

  let dayPart;
  if (dayRel.relation === "生我") {
    dayPart = `对日主${dayEl}有生扶之力，个人财运亨通，判断力提升，是加仓的好时机`;
  } else if (dayRel.relation === "比和") {
    dayPart = `与日主${dayEl}同气，可借势而行，适合跟随市场主流方向`;
  } else if (dayRel.relation === "我克") {
    dayPart = `日主${dayEl}克流年${yearEl}，财星可期，但求财需主动出击，坐等无益`;
  } else if (dayRel.relation === "克我") {
    dayPart = `流年${yearEl}克制日主${dayEl}，投资压力增大，宜减仓保守，切忌加杠杆`;
  } else {
    dayPart = `日主${dayEl}泄气于流年${yearEl}，精力分散，建议减少交易频率，持币观望为主`;
  }

  return `${year}年${ganzhi}（${nayin}），${stockPart}。${dayPart}。`;
}

/* ===== 5. calculateMonthlyFortune ===== */
/* 按公历 1-12 月输出。公历月→农历月序映射：公历2月≈寅月(index 0)，公历1月≈丑月(index 11) */
function calculateMonthlyFortune(stockPrimaryElement, investorDayElement, year) {
  const results = [];
  const yp = getYearPillarByYear(year);
  /* 上一年的年柱（1月份属于上一年的丑月） */
  const prevYp = getYearPillarByYear(year - 1);

  for (let calMonth = 1; calMonth <= 12; calMonth++) {
    /* 公历月 → 农历月序(0=寅月...11=丑月)：偏移 = calMonth - 2，负数取模 */
    var lunarIdx = safeMod(calMonth - 2, 12);
    /* 1月属于上一年的丑月，需要用上一年的年干 */
    var effectiveYearStem = calMonth === 1 ? prevYp.stem : yp.stem;
    const monthStem = getMonthStem(effectiveYearStem, lunarIdx);
    const branchIndex = safeMod(2 + lunarIdx, 12);
    const monthBranch = BRANCHES[branchIndex];
    const monthElement = STEM_ELEMENTS[monthStem];

    const stockScore = _clamp(_scoreElementVsYear(stockPrimaryElement, monthElement), 0, 100);
    const matchScore = _clamp(_scoreElementVsYear(investorDayElement, monthElement), 0, 100);
    const combinedScore = _clamp(Math.round(stockScore * 0.5 + matchScore * 0.5), 0, 100);

    let label;
    if (combinedScore >= 70) label = "利好";
    else if (combinedScore >= 50) label = "平稳";
    else label = "利空";

    results.push({
      monthIndex: calMonth - 1,
      monthName: MONTH_NAMES[calMonth - 1],
      monthStem,
      monthBranch,
      monthElement,
      stockScore,
      matchScore,
      combinedScore,
      label,
    });
  }

  return results;
}

/* ===== 5b. analyzeCurrentEra — 流年大势宏观分析 ===== */
function analyzeCurrentEra() {
  var year = new Date().getFullYear();
  var yp = getYearPillarByYear(year);
  var stem = yp.stem;
  var branch = yp.branch;
  var stemEl = STEM_ELEMENTS[stem];
  var branchEl = BRANCH_ELEMENTS[branch];
  var nayin = getNayin(stem, branch);
  var nayinEl = NAYIN_ELEMENT_MAP[nayin] || stemEl;
  var yinYang = STEM_YIN_YANG[stem];

  /* 五行能量分布 */
  var elCount = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  elCount[stemEl] += 2;
  elCount[branchEl] += 2;
  elCount[nayinEl] += 1;
  /* 地支藏干 */
  if (BRANCH_HIDDEN_STEMS[branch]) {
    BRANCH_HIDDEN_STEMS[branch].forEach(function(h) {
      elCount[STEM_ELEMENTS[h.stem]] += h.weight / 100;
    });
  }

  /* 找主导五行 */
  var sorted = Object.entries(elCount).sort(function(a,b){ return b[1]-a[1]; });
  var dominant = sorted[0][0];
  var secondary = sorted[1][1] > 0 ? sorted[1][0] : null;
  var weakest = sorted[sorted.length - 1][0];

  /* 标题 */
  var title = year + "年 · " + stem + branch + "年 · " + nayin;

  /* 五行标签 */
  var badges = [];
  badges.push({ label: "天干 " + stem + "（" + stemEl + "·" + yinYang + "）", element: stemEl });
  badges.push({ label: "地支 " + branch + "（" + branchEl + "）", element: branchEl });
  badges.push({ label: "纳音 " + nayin + "（" + nayinEl + "）", element: nayinEl });

  /* 生成描述 */
  var desc = "";

  /* 第一部分：基础解读 */
  desc += year + "年干支" + stem + branch + "，天干" + stem + "属" + stemEl + "（" + yinYang + stemEl + "），地支" + branch + "属" + branchEl;
  if (stemEl === branchEl) {
    desc += "，天干地支同属" + stemEl + "，" + stemEl + "气极旺，是" + stemEl + "属行业的大年。";
  } else if (ELEMENT_GENERATE[stemEl] === branchEl) {
    desc += "，" + stemEl + "生" + branchEl + "，天干生地支，气势顺畅流通，整体市场环境偏积极。";
  } else if (ELEMENT_GENERATE[branchEl] === stemEl) {
    desc += "，" + branchEl + "生" + stemEl + "，地支生天干，底层力量托举表层趋势，基本面支撑较强。";
  } else if (ELEMENT_OVERCOME[stemEl] === branchEl) {
    desc += "，" + stemEl + "克" + branchEl + "，天干克地支，表层压制底层，市场可能出现政策主导行情。";
  } else if (ELEMENT_OVERCOME[branchEl] === stemEl) {
    desc += "，" + branchEl + "克" + stemEl + "，地支克天干，暗流涌动，需警惕突发事件冲击市场。";
  } else {
    desc += "，干支五行各异，市场能量较为分散，板块轮动频繁。";
  }

  desc += "纳音「" + nayin + "」属" + nayinEl + "，为全年增添了一层" + nayinEl + "的底色能量。";

  /* 第二部分：利好/不利行业 */
  desc += "\n\n";
  /* 被生的五行（dominant生的）受益 */
  var boosted = ELEMENT_GENERATE[dominant];
  var boosted2 = dominant;
  var suppressed = ELEMENT_OVERCOME[dominant];

  desc += "【利好方向】" + dominant + "气主导，" + dominant + "属行业（";
  desc += _getIndustriesByElement(dominant);
  desc += "）直接受益；" + boosted + "属行业（";
  desc += _getIndustriesByElement(boosted);
  desc += "）得" + dominant + "气相生，亦有上行动力。";

  if (secondary && secondary !== dominant) {
    desc += secondary + "属行业（" + _getIndustriesByElement(secondary) + "）作为次要能量也值得关注。";
  }

  desc += "\n\n【承压方向】" + suppressed + "属行业（";
  desc += _getIndustriesByElement(suppressed);
  desc += "）受" + dominant + "气克制，全年相对承压；";
  var drained = ELEMENT_GENERATE[dominant];
  var drainedBy = ELEMENT_GENERATED_BY[dominant];
  desc += weakest + "属行业能量最弱，缺乏流年加持，走势可能偏弱。";

  /* 第三部分：投资者建议 */
  desc += "\n\n【投资者提示】";
  desc += "命局用神为" + dominant + "或" + boosted + "的投资者今年运势较旺，适合积极布局；";
  desc += "用神为" + suppressed + "的投资者则需谨慎防守，控制仓位。";
  desc += "整体而言，" + year + "年" + stem + branch + "的能量格局";
  if (stemEl === branchEl) {
    desc += "极为集中，适合在" + dominant + "属赛道做深度聚焦，但也要警惕物极必反。";
  } else {
    desc += "偏向" + dominant + "与" + (secondary || boosted) + "，建议投资组合向这两个方向适度倾斜。";
  }

  return {
    year: year,
    title: title,
    stem: stem,
    branch: branch,
    stemElement: stemEl,
    branchElement: branchEl,
    nayin: nayin,
    nayinElement: nayinEl,
    dominant: dominant,
    badges: badges,
    desc: desc,
    elCount: elCount,
  };
}

function _getIndustriesByElement(el) {
  var map = {
    "木": "农业、林业、教育、出版、医药、环保",
    "火": "科技、AI、半导体、互联网、软件、电商、传媒",
    "土": "房地产、基建、矿业、农业加工、物流仓储",
    "金": "金融、银行、保险、汽车制造、军工、贵金属",
    "水": "航运、水务、旅游、餐饮、零售、娱乐"
  };
  return map[el] || el + "相关行业";
}

/* ===== 6. generateFullAnalysis ===== */
function generateFullAnalysis(stockInfo, birthDate, birthTime, gender) {
  /* 初始化确定性随机种子：相同的 ticker+生日+时辰 → 相同的推演结果 */
  var bd = new Date(birthDate);
  var birthDateStr = bd.getFullYear() + "-" + (bd.getMonth() + 1) + "-" + bd.getDate();
  _initRng(stockInfo.ticker || stockInfo.name, birthDateStr, birthTime);

  const stock = analyzeStockElement(stockInfo);
  const investor = analyzeInvestor(birthDate, birthTime, gender);
  const match = matchStockToInvestor(stock, investor, stockInfo);
  const yearlyFortune = calculateYearlyFortune(stock.primaryElement, investor.dayElement, [2024, 2036], stockInfo, investor.usefulGod);

  const currentYear = new Date().getFullYear();
  const monthlyFortune = calculateMonthlyFortune(stock.primaryElement, investor.dayElement, currentYear);

  /* 景气度归一化到0-100分（raw最高35） */
  var eraNorm = _clamp(Math.round((match.eraBonus || 0) * 100 / 35), 0, 100);

  const overallScore = _clamp(
    Math.round(
      match.matchScore * 0.33 +
      eraNorm * 0.20 +
      _avgCombined(yearlyFortune, currentYear) * 0.24 +
      _avgCombined(yearlyFortune) * 0.16 +
      _ipoQualityBonus(stock, investor) * 0.07
    ),
    0, 100
  );
  const overallLabel = _overallLabel(overallScore);
  const summary = _buildSummary(stockInfo, stock, investor, match, overallScore, overallLabel, yearlyFortune, monthlyFortune);

  const recommended = getRecommendedStocks(investor, 5);
  const era = analyzeCurrentEra();

  return {
    era,
    stock,
    investor,
    match,
    yearlyFortune,
    monthlyFortune,
    overallScore,
    overallLabel,
    summary,
    recommended,
  };
}

/* ===== IPO 命格质量因子 — 增加个股区分度 ===== */
function _ipoQualityBonus(stockAnalysis, investorResult) {
  var score = 50;
  var ipoPillars = stockAnalysis.ipoPillars;
  if (!ipoPillars || ipoPillars.length < 3) return score;

  var dayElement = investorResult.dayElement;
  var dayStem = investorResult.dayStem;
  var ipoDay = ipoPillars[2];
  var ipoMonth = ipoPillars[1];
  var ipoYear = ipoPillars[0];

  /* 1. IPO 日干与投资人日干的十神关系 (±15) */
  var tenGod = getTenGod(dayStem, ipoDay.stem);
  if (tenGod === "正财" || tenGod === "偏财") score += 15;
  else if (tenGod === "正印" || tenGod === "偏印") score += 12;
  else if (tenGod === "食神") score += 10;
  else if (tenGod === "比肩") score += 5;
  else if (tenGod === "劫财") score += 2;
  else if (tenGod === "伤官") score -= 3;
  else if (tenGod === "正官") score += 3;
  else if (tenGod === "七杀") score -= 8;

  /* 2. IPO 纳音五行与投资人日主的关系 (±10) */
  var ipoNayin = stockAnalysis.ipoNayin;
  if (ipoNayin) {
    var nayinEl = NAYIN_ELEMENT_MAP[ipoNayin];
    if (nayinEl) {
      var nayinRel = getElementRelation(dayElement, nayinEl);
      if (nayinRel.relation === "我克") score += 10;
      else if (nayinRel.relation === "生我") score += 8;
      else if (nayinRel.relation === "比和") score += 5;
      else if (nayinRel.relation === "我生") score -= 3;
      else if (nayinRel.relation === "克我") score -= 8;
    }
  }

  /* 3. IPO 月柱五行与行业五行的内在和谐度 (±8) */
  var monthEl = STEM_ELEMENTS[ipoMonth.stem];
  var industryEl = stockAnalysis.industryElement;
  if (monthEl === industryEl) score += 8;
  else if (ELEMENT_GENERATED_BY[industryEl] === monthEl) score += 6;
  else if (ELEMENT_OVERCOME_BY[industryEl] === monthEl) score -= 5;

  /* 4. IPO 年柱与当前流年的关系 (±8) */
  var currentYear = new Date().getFullYear();
  var curYp = getYearPillarByYear(currentYear);
  var yearEl = STEM_ELEMENTS[ipoYear.stem];
  var curYearEl = STEM_ELEMENTS[curYp.stem];
  var yearRel = getElementRelation(yearEl, curYearEl);
  if (yearRel.relation === "生我") score += 8;
  else if (yearRel.relation === "比和") score += 5;
  else if (yearRel.relation === "克我") score -= 5;

  return _clamp(score, 0, 100);
}

function _avgCombined(yearlyFortune, filterYear) {
  let arr = yearlyFortune;
  if (filterYear !== undefined) {
    arr = yearlyFortune.filter(y => y.year === filterYear);
  }
  if (arr.length === 0) return 50;
  return Math.round(arr.reduce((s, y) => s + y.combinedScore, 0) / arr.length);
}

function _overallLabel(score) {
  if (score >= 88) return "天命所归";
  if (score >= 75) return "顺势而为";
  if (score >= 60) return "中性观望";
  if (score >= 45) return "逆风谨慎";
  return "命理不合";
}

function _buildSummary(stockInfo, stock, investor, match, score, label, yearlyFortune, monthlyFortune) {
  const stockName = stockInfo.name || stockInfo.ticker || "该股";
  const ticker = stockInfo.ticker || "";
  const el = stock.primaryElement;
  const secEl = stock.secondaryElement;
  const dayEl = investor.dayElement;
  const dayStem = investor.dayStem;
  const rel = match.relation;
  const strengthLabel = investor.strength.label;
  const strengthLevel = investor.strength.level;
  const useGod = investor.usefulGod.useGodElement;
  const likeEls = investor.usefulGod.likeElements;
  const dislikeEls = investor.usefulGod.dislikeElements;
  const currentYear = new Date().getFullYear();

  var parts = [];

  /* ── 第一段：股票命盘概述 ── */
  var p1 = `【${ticker} ${stockName}·命盘解析】`;
  p1 += `该股行业五行属${el}`;
  if (secEl && secEl !== el) p1 += `，上市日柱带${secEl}气`;
  p1 += `，行业与上市命格${stock.elementRelation}`;
  if (stock.elementRelation === "相同") {
    p1 += `——内外五行一致，${el}属性极为纯粹，在${el}气旺盛的流年中爆发力强，但在克${el}之年波动也会加剧`;
  } else if (stock.elementRelation === "相生") {
    p1 += `——五行流通顺畅，内生动力充沛，属命理配置上佳的标的`;
  } else if (stock.elementRelation === "相克") {
    p1 += `——内部存在张力，走势容易出现分化，需精选时机介入`;
  } else {
    p1 += `——五行配置独立，走势更多取决于基本面和市场情绪`;
  }
  if (stock.ipoNayin) {
    p1 += `。上市日柱纳音「${stock.ipoNayin}」`;
    var nayinEl = NAYIN_ELEMENT_MAP[stock.ipoNayin];
    if (nayinEl === el) p1 += `，纳音五行与行业同属${el}，暗合加持`;
    else if (nayinEl) p1 += `，纳音属${nayinEl}，为命盘增添了一层${nayinEl}的底色`;
  }
  p1 += "。";
  parts.push(p1);

  /* ── 第二段：投资人命理画像 ── */
  var p2 = `【投资人命理画像】`;
  p2 += `阁下日主天干${dayStem}，五行属${dayEl}，身${strengthLabel}`;
  if (strengthLevel >= 6) {
    p2 += `，精力充沛、决断力强，属于能够驾驭高风险标的的命格`;
  } else if (strengthLevel >= 4) {
    p2 += `，攻守兼备，适合均衡配置策略`;
  } else {
    p2 += `，宜以稳健防守为主，忌重仓激进`;
  }
  p2 += `。命局用神为${useGod}，喜${likeEls.join("、")}，忌${dislikeEls.join("、")}`;
  p2 += "。" + investor.financialProfile;
  parts.push(p2);

  /* ── 第三段：人股匹配核心解读 ── */
  var p3 = `【人股匹配·${match.matchLabel}】`;
  if (rel === "喜用神") {
    p3 += `该股五行${el}恰好是您命局中最核心的用神五行——这是命理学上极为理想的配置！用神代表平衡命局的关键力量，当投资标的与用神共振时，往往能在决策和运势两个维度同时获得加持。人股缘分评分高达${match.matchScore}分，属于"天赐良缘"级别的匹配。`;
  } else if (rel === "喜神") {
    p3 += `该股五行${el}属于您命局的喜用范畴（喜${likeEls.join("、")}），虽非第一用神但方向正确。命理能量对该投资有正面加持，人股缘分评分${match.matchScore}分。建议在流年天干透出${el}气时重点布局，顺势而为。`;
  } else if (rel === "比和") {
    p3 += `该股五行${el}与您的日主同属${dayEl}，在命理中为"比肩"关系——同类之气，不生不克。走势节奏与您个人运势较为同步，人股缘分${match.matchScore}分，适合作为底仓配置，但超额收益有限。`;
  } else if (rel === "生我") {
    p3 += `该股五行${el}生您的日主${dayEl}，属于"印星"关系——如同贵人扶持。投资这类标的时判断力和信息获取都有加成，人股缘分${match.matchScore}分。尤其适合${strengthLevel <= 3 ? "您这种身弱需要生扶的命格，可作为长线核心持仓" : "在流年走印运时重点配置"}。`;
  } else if (rel === "我克") {
    p3 += `您的日主${dayEl}克制该股五行${el}，命理中"我克者为财"——有掌控此股的潜力，但需消耗精力和判断力。人股缘分${match.matchScore}分。${strengthLevel >= 5 ? "您身" + strengthLabel + "，担财能力充足，可以较积极地操作此类标的。" : strengthLevel <= 3 ? "但您身" + strengthLabel + "，担财能力有限，建议控制仓位在10%以内，且严设止损。" : "建议适度参与，做好研究功课后再出手。"}`;
  } else if (rel === "忌神") {
    p3 += `该股五行${el}落入您命局的忌神范围（忌${dislikeEls.join("、")}），人股缘分仅${match.matchScore}分。忌神代表命理中不利的力量，投资此类标的容易在关键节点判断失误。建议保持距离，即使基本面看好也要严控仓位。`;
  } else if (rel === "克我") {
    p3 += `该股五行${el}克制您的日主${dayEl}，属于"七杀"关系——外部压制力强，人股缘分仅${match.matchScore}分。投资此股时心理承压较大，容易经历被套→止损→割肉的循环。除非有特殊制化配置，否则不建议重仓。`;
  } else {
    p3 += `该股五行${el}与您日主${dayEl}不构成直接强生克关系，命理指向性不强，人股缘分${match.matchScore}分。建议更多依据基本面分析和流年变化来做判断。`;
  }
  parts.push(p3);

  /* ── 第四段：流年趋势研判 ── */
  if (yearlyFortune && yearlyFortune.length > 0) {
    var p4 = "【流年趋势研判】";
    var curYearData = yearlyFortune.find(function(y) { return y.year === currentYear; });
    var nextYearData = yearlyFortune.find(function(y) { return y.year === currentYear + 1; });

    if (curYearData) {
      var curYp = getYearPillarByYear(currentYear);
      var curYearEl = STEM_ELEMENTS[curYp.stem];
      p4 += `${currentYear}年${curYp.stem}${curYp.branch}年，流年天干属${curYearEl}`;

      if (ELEMENT_GENERATED_BY[el] === curYearEl) {
        p4 += `，${curYearEl}生${el}，大环境对${el}属板块形成有力支撑`;
      } else if (el === curYearEl) {
        p4 += `，与${el}属板块同气共振，行业热度维持`;
      } else if (ELEMENT_OVERCOME_BY[el] === curYearEl) {
        p4 += `，${curYearEl}克${el}，${el}属板块面临一定逆风`;
      } else if (ELEMENT_GENERATE[el] === curYearEl) {
        p4 += `，${el}生${curYearEl}（泄气），板块利润可能承压`;
      } else {
        p4 += `，与${el}属板块关系中性`;
      }

      p4 += `。该股今年综合运势评分${curYearData.combinedScore}分`;
      if (curYearData.combinedScore >= 70) p4 += "，整体偏利好";
      else if (curYearData.combinedScore >= 50) p4 += "，表现平稳";
      else p4 += "，需注意风险";
    }

    if (nextYearData) {
      var nextYp = getYearPillarByYear(currentYear + 1);
      p4 += `。展望${currentYear + 1}年${nextYp.stem}${nextYp.branch}，综合评分${nextYearData.combinedScore}分`;
      if (nextYearData.combinedScore > (curYearData ? curYearData.combinedScore : 50)) {
        p4 += "，运势有所提升";
      } else if (nextYearData.combinedScore < (curYearData ? curYearData.combinedScore : 50)) {
        p4 += "，运势有所回落";
      } else {
        p4 += "，运势持平";
      }
    }

    /* 找最佳和最差年份 */
    var sorted = yearlyFortune.slice().sort(function(a, b) { return b.combinedScore - a.combinedScore; });
    var best = sorted[0];
    var worst = sorted[sorted.length - 1];
    if (best && worst && best.year !== worst.year) {
      p4 += `。纵观${yearlyFortune[0].year}-${yearlyFortune[yearlyFortune.length - 1].year}年，最佳投资窗口在${best.year}年（${best.yearGanzhi}，综合${best.combinedScore}分），最需回避的是${worst.year}年（${worst.yearGanzhi}，综合${worst.combinedScore}分）`;
    }
    p4 += "。";
    parts.push(p4);
  }

  /* ── 第五段：近期月度提示 ── */
  if (monthlyFortune && monthlyFortune.length > 0) {
    var p5 = "【近期月度提示】";
    var goodMonths = monthlyFortune.filter(function(m) { return m.combinedScore >= 70; });
    var badMonths = monthlyFortune.filter(function(m) { return m.combinedScore < 50; });

    if (goodMonths.length > 0) {
      p5 += `${currentYear}年利好月份：` + goodMonths.map(function(m) { return m.monthName + "(" + m.combinedScore + "分)"; }).join("、");
    }
    if (badMonths.length > 0) {
      if (goodMonths.length > 0) p5 += "；";
      p5 += "需谨慎月份：" + badMonths.map(function(m) { return m.monthName + "(" + m.combinedScore + "分)"; }).join("、");
    }
    if (goodMonths.length === 0 && badMonths.length === 0) {
      p5 += `${currentYear}年各月运势较为均衡，无明显大起大落`;
    }
    p5 += "。";
    parts.push(p5);
  }

  /* ── 第六段：综合结论 ── */
  var p6 = `【综合结论】`;
  p6 += `综合三维评分体系——股票天时（行业五行×流年能量）、人股缘分（用神匹配×生克关系）、个人运势（日主强弱×流年对日主的影响）——${ticker} ${stockName}对您的综合匹配度为${score}分，命理判定等级「${label}」。`;

  if (score >= 88) {
    p6 += "这是极为难得的天命级匹配，各维度能量高度共振，可作为重点关注的核心标的。";
  } else if (score >= 75) {
    p6 += "整体配置良好，命理能量正向流通，顺势布局、把握节奏即可。";
  } else if (score >= 60) {
    p6 += "配置属中性偏上，建议结合基本面研究和流年窗口择机参与，不宜重仓。";
  } else if (score >= 45) {
    p6 += "命理层面存在一定逆风，若参与建议严控仓位、设好止损，以防守思维对待。";
  } else {
    p6 += "命理匹配度较低，各维度能量不协调，建议暂时回避此标的，将精力投入更匹配的方向。";
  }
  parts.push(p6);

  return parts.join("\n\n");
}

/* ===== 7. getRecommendedStocks ===== */
function getRecommendedStocks(investorResult, limit) {
  limit = limit || 5;
  const { dayElement, dayStem, usefulGod, strength, pillars, weightedElements } = investorResult;
  const currentYear = new Date().getFullYear();
  const yearPillar = getYearPillarByYear(currentYear);
  const yearStem = yearPillar.stem;
  const yearBranch = yearPillar.branch;
  const yearElement = STEM_ELEMENTS[yearStem];
  const yearBranchElement = BRANCH_ELEMENTS[yearBranch];
  const yearNayin = getNayin(yearStem, yearBranch);
  const yearNayinEl = NAYIN_ELEMENT_MAP[yearNayin] || yearElement;

  const sortedEls = Object.entries(weightedElements).sort(function(a,b){ return a[1]-b[1]; });
  const weakestEl = sortedEls[0][0];

  const scored = STOCK_DATABASE.filter(function (s) {
    return s && s.ticker && s.industryElement;
  }).map(function (stock) {
    const stockEl = stock.industryElement;
    var dims = [];
    var total = 0;

    // D1: 用神匹配 (0-30)
    var d1 = 0;
    if (stockEl === usefulGod.useGodElement) {
      d1 = 28 + _variance(0, 2);
      dims.push("用神直hit（" + stockEl + "=" + usefulGod.useGodElement + "）");
    } else if (usefulGod.likeElements.indexOf(stockEl) === 0) {
      d1 = 22 + _variance(0, 2);
      dims.push("喜神首位");
    } else if (usefulGod.likeElements.includes(stockEl)) {
      d1 = 16 + _variance(0, 2);
      dims.push("喜用五行");
    } else if (usefulGod.dislikeElements.includes(stockEl)) {
      d1 = -10;
    } else {
      d1 = 5;
    }
    total += d1;

    // D2: 生克关系 + 身强弱修正 (0-25)
    var d2 = 0;
    var rel = getElementRelation(dayElement, stockEl);
    if (rel.relation === "生我") {
      d2 = 20 + _variance(0, 2);
      if (strength.level <= 3) { d2 += 5; dims.push("弱主得印星生扶"); }
      else dims.push(stockEl + "生" + dayElement);
    } else if (rel.relation === "比和") {
      d2 = 14 + _variance(0, 2);
      dims.push("同气比和");
    } else if (rel.relation === "我克") {
      d2 = 10 + _variance(0, 2);
      if (strength.level >= 5) { d2 += 10; dims.push("身强担财·偏财可期"); }
      else if (strength.level <= 3) { d2 -= 5; dims.push("身弱难担财"); }
      else dims.push("我克为财");
    } else if (rel.relation === "我生") {
      d2 = 6;
      dims.push("泄气之象");
    } else if (rel.relation === "克我") {
      d2 = -5;
      if (strength.level <= 3) d2 -= 5;
    }
    total += d2;

    // D3: 流年天干共振 (0-20)
    var d3 = 0;
    var yearToStock = getElementRelation(yearElement, stockEl);
    if (yearToStock.relation === "生我" || ELEMENT_GENERATED_BY[stockEl] === yearElement) {
      d3 = 18 + _variance(0, 2);
      dims.push(currentYear + "年" + yearElement + "气生" + stockEl + "板块");
    } else if (yearToStock.relation === "比和") {
      d3 = 14 + _variance(0, 2);
      dims.push("流年" + yearElement + "与" + stockEl + "同气旺");
    } else if (yearToStock.relation === "我克") {
      d3 = 8;
    } else if (ELEMENT_OVERCOME_BY[stockEl] === yearElement) {
      d3 = -5;
    } else {
      d3 = 4;
    }
    total += d3;

    // D4: 流年地支 + 纳音暗合 (0-15)
    var d4 = 0;
    if (yearBranchElement === stockEl) {
      d4 += 8;
      dims.push("年支" + yearBranch + "(" + yearBranchElement + ")暗助");
    }
    if (yearNayinEl === stockEl) {
      d4 += 7;
      dims.push("纳音" + yearNayin + "(" + yearNayinEl + ")共鸣");
    }
    total += d4;

    // D5: 命局补缺 (0-10)
    var d5 = 0;
    if (stockEl === weakestEl && !usefulGod.dislikeElements.includes(stockEl)) {
      d5 = 8 + _variance(0, 2);
      dims.push("补命局最弱之" + weakestEl);
    }
    total += d5;

    /* 将景气度也纳入初筛评估（受投资人八字调节） */
    var eraB = _getEraTrendBonus(stock, usefulGod);
    total += Math.round(eraB * 0.3);

    if (total < 20) return null;

    var score = _clamp(Math.round(total * 1.1 + 10), 50, 99);

    var reasonParts = dims.slice(0, 3);
    var reason = reasonParts.join(" | ");

    return {
      ticker: stock.ticker,
      element: stockEl,
      score: score,
      reason: reason,
      _total: total,
    };
  }).filter(Boolean);

  scored.sort(function (a, b) { return b._total - a._total; });

  /* 初筛取 TOP 30（扩大范围，确保不遗漏真实高分标的） */
  var PREFETCH = Math.max(limit * 6, 30);
  var seen = {};
  var candidates = [];
  for (var i = 0; i < scored.length && candidates.length < PREFETCH; i++) {
    var tk = scored[i].ticker;
    if (!seen[tk]) {
      seen[tk] = true;
      candidates.push(scored[i]);
    }
  }

  /* 对所有候选重新计算真实 overallScore（与 generateFullAnalysis 完全同口径） */
  candidates.forEach(function (item) {
    var stockObj = STOCK_DATABASE.find(function(s) { return s.ticker === item.ticker; });
    if (!stockObj) return;
    var stockInfo = Object.assign({}, stockObj, { element: stockObj.industryElement });
    /* 用与 generateFullAnalysis 相同的 seed 重新初始化 RNG */
    _initRng(stockInfo.ticker || stockInfo.name, investorResult._birthDateStr || "", investorResult._birthTime || 0);
    var stockAnalysis = analyzeStockElement(stockInfo);
    var matchResult = matchStockToInvestor(stockAnalysis, investorResult, stockInfo);
    var yearlyFortune = calculateYearlyFortune(stockAnalysis.primaryElement, dayElement, [2024, 2036], stockInfo, usefulGod);
    var monthlyFortune = calculateMonthlyFortune(stockAnalysis.primaryElement, dayElement, currentYear);
    var eraNorm = _clamp(Math.round((matchResult.eraBonus || 0) * 100 / 35), 0, 100);
    var realScore = _clamp(
      Math.round(
        matchResult.matchScore * 0.33 +
        eraNorm * 0.20 +
        _avgCombined(yearlyFortune, currentYear) * 0.24 +
        _avgCombined(yearlyFortune) * 0.16 +
        _ipoQualityBonus(stockAnalysis, investorResult) * 0.07
      ),
      0, 100
    );
    item.score = realScore;
  });

  /* 按真实分数重新排序，取 TOP N */
  candidates.sort(function (a, b) { return b.score - a.score; });
  return candidates.slice(0, limit);
}

/* ===== 暴露公共 API ===== */
return {
  generateFullAnalysis: generateFullAnalysis,
  analyzeCurrentEra: analyzeCurrentEra,
};

})(Bazi);
