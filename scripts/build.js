#!/usr/bin/env node
/**
 * build.js — 自动为静态资源注入版本戳（cache-bust）
 * 用法: node scripts/build.js
 */
const fs = require("fs");
const path = require("path");

const HTML_FILE = path.join(__dirname, "..", "index.html");
const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

let html = fs.readFileSync(HTML_FILE, "utf8");

// 替换所有 ?t=XXXXXX 或 ?v=XXXXXX 为新时间戳
html = html.replace(/\?t=\d+/g, "?t=" + timestamp);

fs.writeFileSync(HTML_FILE, html, "utf8");
console.log("✅ Cache-bust updated to t=" + timestamp);
