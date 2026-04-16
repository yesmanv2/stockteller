/* ========================================================================
 * 牛古推演神算 - UI 交互与渲染
 * 依赖: bazi-engine.js, stock-data.js, stock-core.js
 * ======================================================================== */

(function () {
  "use strict";

  /* ===== 工具 ===== */
  function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ===== 状态 ===== */
  let selectedStock = null;

  /* ===== DOM 引用 ===== */
  const canvas = document.getElementById("cyber-particles");
  const form = document.getElementById("fortune-form");
  const stockInput = document.getElementById("stock-input");
  const stockDropdown = document.getElementById("stock-dropdown");
  const selectedStockEl = document.getElementById("selected-stock");
  const genderSelect = document.getElementById("gender");
  const birthDateInput = document.getElementById("birth-date");
  const birthTimeInput = document.getElementById("birth-time");
  const fillDemoBtn = document.getElementById("fill-demo");
  const emptyState = document.getElementById("empty-state");
  const resultContent = document.getElementById("result-content");

  stockInput.required = false;

  /* ===== 1. 赛博粒子背景 ===== */
  function initParticles() {
    const ctx = canvas.getContext("2d");
    let w, h;
    const particles = [];
    const MAX = 60;
    const CONNECT_DIST = 120;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < MAX; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        color: Math.random() > 0.5 ? "rgba(0,255,255," : "rgba(180,120,255,",
      });
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + "0.6)";
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (0.15 * (1 - dist / CONNECT_DIST)).toFixed(3);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.color + alpha + ")";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ===== 2. 股票搜索自动完成 ===== */
  function filterStocks(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    return STOCK_DATABASE.filter(function (s) {
      return (
        s.ticker.toLowerCase().includes(q) ||
        s.name.includes(query.trim()) ||
        (s.nameEn && s.nameEn.toLowerCase().includes(q))
      );
    }).slice(0, 8);
  }

  function showDropdown(stocks) {
    if (stocks.length === 0) {
      stockDropdown.classList.add("hidden");
      return;
    }
    stockDropdown.innerHTML = stocks
      .map(
        function (s) {
          return '<div class="stock-option" data-ticker="' + s.ticker + '">' + s.ticker + "</div>";
        }
      )
      .join("");
    stockDropdown.classList.remove("hidden");
  }

  stockInput.addEventListener("input", function () {
    var results = filterStocks(stockInput.value);
    showDropdown(results);
  });

  stockDropdown.addEventListener("click", function (e) {
    var option = e.target.closest(".stock-option");
    if (!option) return;
    var ticker = option.dataset.ticker;
    var stock = STOCK_DATABASE.find(function (s) { return s.ticker === ticker; });
    if (stock) selectStock(stock);
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".stock-search-wrapper")) {
      stockDropdown.classList.add("hidden");
    }
  });

  /* ===== 4. 股票选择展示 ===== */
  function selectStock(stock) {
    selectedStock = stock;
    stockInput.value = "";
    stockDropdown.classList.add("hidden");
    selectedStockEl.classList.remove("hidden");
    selectedStockEl.innerHTML =
      '<div class="stock-chip">' +
      '<span class="chip-ticker">' + stock.ticker + "</span>" +
      '<button class="chip-close" type="button">&times;</button>' +
      "</div>";
    selectedStockEl.querySelector(".chip-close").addEventListener("click", deselectStock);
  }

  function deselectStock() {
    selectedStock = null;
    selectedStockEl.classList.add("hidden");
    selectedStockEl.innerHTML = "";
  }

  /* ===== 5. 示例填充 ===== */
  fillDemoBtn.addEventListener("click", function () {
    var nvda = STOCK_DATABASE.find(function (s) { return s.ticker === "NVDA"; }) || STOCK_DATABASE[0];
    selectStock(nvda);
    genderSelect.value = "male";
    birthDateInput.value = "1990-06-15";
    birthTimeInput.value = "10:30";
  });

  /* ===== 6. 表单提交 ===== */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!selectedStock) {
      alert("请先选择一只股票");
      return;
    }
    if (!birthDateInput.value) {
      alert("请填写出生日期");
      return;
    }

    var birthDate = new Date(birthDateInput.value);
    var timeParts = birthTimeInput.value ? birthTimeInput.value.split(":") : null;
    var birthHour = timeParts ? parseInt(timeParts[0], 10) : null;
    var gender = genderSelect.value;

    var stockInfo = Object.assign({}, selectedStock, { element: selectedStock.industryElement });
    var analysis = StockCore.generateFullAnalysis(stockInfo, birthDate, birthHour, gender);

    emptyState.classList.add("hidden");
    resultContent.classList.remove("hidden");
    renderResult(analysis, stockInfo);
    resultContent.scrollIntoView({ behavior: "smooth" });
  });

  /* ===== 7. 渲染结果 ===== */
  var PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"];

  function animateGauge(arc, targetValue) {
    var current = 0;
    function step() {
      current += (targetValue - current) * 0.08;
      if (Math.abs(current - targetValue) < 0.5) current = targetValue;
      arc.setAttribute("stroke-dasharray", Math.round(current) + " 251");
      if (current !== targetValue) requestAnimationFrame(step);
    }
    step();
  }

  function renderResult(a, stockInfo) {
    /* (0) 流年大势 */
    if (a.era) {
      document.getElementById("era-title").textContent = a.era.title;
      document.getElementById("era-element-badges").innerHTML = a.era.badges.map(function (b) {
        return '<span class="era-badge el-' + escapeHTML(b.element) + '">' + escapeHTML(b.label) + '</span>';
      }).join("");
      document.getElementById("era-desc").innerHTML = a.era.desc.split("\n\n").map(function (para) {
        return "<p>" + escapeHTML(para) + "</p>";
      }).join("");
    }

    /* (a) Gauge / Match Dashboard */
    var gaugeScore = document.getElementById("gauge-score");
    var gaugeLabel = document.getElementById("gauge-label");
    var gaugeArc = document.getElementById("gauge-arc");
    var subScores = document.getElementById("sub-scores");
    var matchSummary = document.getElementById("match-summary");
    var matchTitle = document.getElementById("match-title");

    gaugeScore.textContent = a.overallScore;
    gaugeLabel.textContent = a.overallLabel;

    var targetDash = Math.round(251 * a.overallScore / 100);
    gaugeArc.setAttribute("stroke-dasharray", "0 251");
    requestAnimationFrame(function () {
      animateGauge(gaugeArc, targetDash);
    });

    matchTitle.textContent = stockInfo.ticker + " 综合匹配评分";

    var currentYear = new Date().getFullYear();
    var currentYearData = a.yearlyFortune.find(function (y) { return y.year === currentYear; });
    var stockTimingScore = currentYearData ? currentYearData.stockScore : 50;
    var personalScore = currentYearData ? currentYearData.matchScore : 50;
    var matchScoreVal = a.match.matchScore;

    var subItems = [
      { label: "股票天时", score: stockTimingScore, color: "#ff9b6f" },
      { label: "人股缘分", score: matchScoreVal, color: "#d8e4ff" },
      { label: "个人运势", score: personalScore, color: "#7fd9ff" },
    ];
    subScores.innerHTML = subItems
      .map(function (item) {
        return (
          '<div class="sub-score-item">' +
          '<div class="sub-score-header">' +
          '<span class="sub-score-label">' + item.label + "</span>" +
          '<span class="sub-score-num">' + item.score + "</span>" +
          "</div>" +
          '<div class="sub-score-track">' +
          '<div class="sub-score-fill" style="width:' + item.score + "%;background:" + item.color + '"></div>' +
          "</div></div>"
        );
      })
      .join("");

    var summaryParagraphs = a.summary.split("\n\n");
    matchSummary.textContent = summaryParagraphs[summaryParagraphs.length - 1];

    /* (b) 股票命盘 */
    document.getElementById("stock-title").textContent =
      stockInfo.ticker + " · 五行属" + a.stock.primaryElement;

    var stockPillarsEl = document.getElementById("stock-pillars");
    stockPillarsEl.innerHTML = a.stock.ipoPillars
      .map(function (p, i) { return renderPillarCard(p, PILLAR_LABELS[i]); })
      .join("");

    var stockWeighted = Bazi.getWeightedElementCounts(a.stock.ipoPillars);
    renderElementBar("stock-element-bar", stockWeighted);

    var stockDescText = a.stock.elementDesc;
    if (a.stock.ipoNayin) stockDescText += "。纳音「" + a.stock.ipoNayin + "」";
    document.getElementById("stock-desc").textContent = stockDescText;

    /* (c) 投资人命盘 */
    document.getElementById("investor-title").textContent =
      "投资人命盘 · 日主" + a.investor.dayStem + a.investor.dayElement;

    var investorPillarsEl = document.getElementById("investor-pillars");
    investorPillarsEl.innerHTML = a.investor.pillars
      .map(function (p, i) { return p ? renderPillarCard(p, PILLAR_LABELS[i]) : ""; })
      .join("");

    renderElementBar("investor-element-bar", a.investor.weightedElements);

    var profileEl = document.getElementById("investor-profile");
    var cards = [
      { title: "身强弱", value: a.investor.strength.label },
      { title: "用神", value: a.investor.usefulGod.useGodElement },
      { title: "投资特质", value: a.investor.financialProfile },
    ];
    profileEl.innerHTML = cards
      .map(function (c) {
        return (
          '<div class="profile-card">' +
          '<div class="profile-card-title">' + escapeHTML(c.title) + "</div>" +
          '<div class="profile-card-value">' + escapeHTML(c.value) + "</div>" +
          "</div>"
        );
      })
      .join("");

    /* (d) 人股关系 */
    document.getElementById("relation-title").textContent =
      a.match.matchLabel + " · " + a.match.relation;
    document.getElementById("relation-desc").textContent = a.match.matchDesc;
    document.getElementById("invest-advice").textContent = a.match.investStyleAdvice;

    /* (e) 流年运势 Timeline */
    var yearlyTimeline = document.getElementById("yearly-timeline");
    yearlyTimeline.innerHTML = a.yearlyFortune
      .map(function (y) {
        var scoreClass =
          y.combinedScore >= 70 ? "year-good" : y.combinedScore < 50 ? "year-bad" : "year-neutral";
        return (
          '<div class="year-card ' + scoreClass + '">' +
          '<div class="year-num">' + y.year + "</div>" +
          '<div class="year-ganzhi">' + escapeHTML(y.yearGanzhi) + "</div>" +
          '<div class="year-scores">' +
          '<div class="score-bar stock-bar" style="width:' + y.stockScore + '%"></div>' +
          '<div class="score-bar match-bar" style="width:' + y.matchScore + '%"></div>' +
          "</div>" +
          '<div class="year-score">' + y.combinedScore + "</div>" +
          '<div class="year-label">' + escapeHTML(y.matchLabel) + "</div>" +
          '<div class="year-desc">' + escapeHTML(y.desc) + "</div>" +
          "</div>"
        );
      })
      .join("");

    /* (g) 命理推荐牛股 */
    var recIntro = document.getElementById("rec-intro");
    var recGrid = document.getElementById("rec-grid");
    var recTitle = document.getElementById("rec-title");

    if (a.recommended && a.recommended.length > 0) {
      var yp = Bazi.getYearPillarByYear(currentYear);
      recTitle.textContent = "命理精选 TOP 5";
      recIntro.textContent = "综合用神喜忌、身强弱投资风格、" + currentYear + "年" + yp.stem + yp.branch +
        "流年天干地支共振、纳音暗合、命局五行补缺五个维度，从" +
        STOCK_DATABASE.length + "只标的中筛选：";

      recGrid.innerHTML = a.recommended.map(function (r) {
        var labelClass = r.score >= 85 ? "rec-label-good" : "rec-label-ok";
        var labelText = r.score >= 90 ? "天赐良缘" : r.score >= 80 ? "高度匹配" : r.score >= 70 ? "值得关注" : "潜力标的";
        return (
          '<div class="rec-card rec-clickable" data-ticker="' + escapeHTML(r.ticker) + '">' +
            '<div class="rec-card-head">' +
              '<span class="rec-ticker">' + escapeHTML(r.ticker) + '</span>' +
              '<span class="rec-el-badge el-' + escapeHTML(r.element) + '">' + escapeHTML(r.element) + '</span>' +
            '</div>' +
            '<div class="rec-score-row">' +
              '<span class="rec-score-num">' + r.score + '</span>' +
              '<div class="rec-score-bar-track"><div class="rec-score-bar-fill" style="width:' + r.score + '%"></div></div>' +
              '<span class="rec-label ' + labelClass + '">' + labelText + '</span>' +
            '</div>' +
            '<div class="rec-reason">' + escapeHTML(r.reason) + '</div>' +
            '<div class="rec-click-hint">点击查看详细推演 →</div>' +
          '</div>'
        );
      }).join("");

      recGrid.querySelectorAll(".rec-clickable").forEach(function (card) {
        card.addEventListener("click", function () {
          var ticker = card.dataset.ticker;
          var stock = STOCK_DATABASE.find(function (s) { return s.ticker === ticker; });
          if (stock) {
            selectStock(stock);
            form.dispatchEvent(new Event("submit", { cancelable: true }));
          }
        });
      });
    }

    /* (h) Final Summary — 多段落完整点评 */
    var finalEl = document.getElementById("final-summary");
    finalEl.innerHTML = a.summary.split("\n\n").map(function (para) {
      return "<p>" + escapeHTML(para) + "</p>";
    }).join("");
  }

  function renderPillarCard(pillar, label) {
    var stemEl = Bazi.STEM_ELEMENTS[pillar.stem];
    var branchEl = Bazi.BRANCH_ELEMENTS[pillar.branch];
    return (
      '<div class="pillar-card" data-element="' + stemEl + '">' +
      '<div class="pillar-label">' + label + "</div>" +
      '<div class="pillar-stem" style="color:' + Bazi.ELEMENT_STYLES[stemEl][0] + '">' + pillar.stem + "</div>" +
      '<div class="pillar-branch" style="color:' + Bazi.ELEMENT_STYLES[branchEl][0] + '">' + pillar.branch + "</div>" +
      '<div class="pillar-element">' + stemEl + "</div>" +
      "</div>"
    );
  }

  /* ===== 8. 五行能量条 ===== */
  function renderElementBar(containerId, weightedCounts) {
    var container = document.getElementById(containerId);
    var elements = ["木", "火", "土", "金", "水"];
    var maxVal = Math.max.apply(
      null,
      elements.map(function (el) { return weightedCounts[el] || 0; }).concat([1])
    );

    container.innerHTML = elements
      .map(function (el) {
        var value = weightedCounts[el] || 0;
        var pct = (value / maxVal) * 100;
        var color0 = Bazi.ELEMENT_STYLES[el][0];
        var color1 = Bazi.ELEMENT_STYLES[el][1];
        return (
          '<div class="el-row">' +
          '<span class="el-label" style="color:' + color0 + '">' + el + "</span>" +
          '<div class="el-track"><div class="el-fill" style="width:' + pct + "%;background:linear-gradient(90deg," + color0 + "," + color1 + ')"></div></div>' +
          '<span class="el-val">' + value.toFixed(1) + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  /* ===== 初始化 ===== */
  initParticles();
})();
