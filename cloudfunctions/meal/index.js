// 三餐推荐云函数入口
// type: 'recommend' | 'feedback' | 'history'
const cloud = require("wx-server-sdk");
const https = require("https");
const zlib = require("zlib");
const CONFIG = require("./config.js");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const COLL_LOG = "meals_log"; // 吃过记录
const COLL_PROFILE = "profile"; // AI 口味画像缓存
const COLL_CACHE = "poi_cache"; // 周边餐厅缓存（地点+关键词）

// ---------- 通用 HTTPS 请求（自动解 gzip/deflate，和风天气需要） ----------
function httpRequest(urlStr, { method = "GET", headers = {}, body = null, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const bodyBuf = body ? Buffer.from(body, "utf8") : null;
    const baseHeaders = { "Accept-Encoding": "gzip, deflate", ...headers };
    // 显式带 Content-Length（按字节，中文 prompt 才不会算错），否则 Node 走 chunked，
    // 部分网关（如智谱）会一直等待 body 不返回，导致超时。
    if (bodyBuf) baseHeaders["Content-Length"] = bodyBuf.length;
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: baseHeaders,
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        let buf = Buffer.concat(chunks);
        const enc = (res.headers["content-encoding"] || "").toLowerCase();
        try {
          if (enc.includes("gzip")) buf = zlib.gunzipSync(buf);
          else if (enc.includes("deflate")) buf = zlib.inflateSync(buf);
        } catch (e) {
          /* 原样返回 */
        }
        resolve({ statusCode: res.statusCode, text: buf.toString("utf8") });
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("请求超时")));
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// ---------- 时段工具 ----------
const MEAL_LABEL = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };

// 每餐按「时间松紧」分档的关键词池：早中晚特色分明，急→快餐、松→讲究
const MEAL_KEYWORDS = {
  breakfast: {
    quick: ["包子", "豆浆油条", "煎饼", "三明治", "便利店", "早餐店"],
    normal: ["早餐", "粥", "肠粉", "面馆", "早点", "馄饨"],
    nice: ["茶餐厅", "早午餐", "brunch"],
  },
  lunch: {
    quick: ["快餐", "盖浇饭", "麻辣烫", "米线", "沙县小吃", "便当", "面馆"],
    normal: ["家常菜", "炒菜", "黄焖鸡", "饺子", "简餐", "盖饭"],
    nice: ["特色餐厅", "小炒", "菜馆", "烤鱼", "餐厅"],
  },
  dinner: {
    quick: ["快餐", "面馆", "盖浇饭", "麻辣烫", "米线"],
    normal: ["小炒", "炒菜", "家常菜", "烤鱼", "黄焖鸡"],
    nice: ["火锅", "烧烤", "川菜", "日料", "粤菜", "餐厅", "小龙虾", "烤肉"],
  },
};

// 口味标签 → 额外补充的搜索关键词（让口味真的影响候选，而不只是排序）
// 与前端的辣度/荤素/汤水 token 对齐
const TASTE_KEYWORDS = {
  重辣: ["川菜", "湘菜", "麻辣烫", "火锅"],
  微辣: ["小炒", "家常菜", "黄焖鸡"],
  不辣: ["清淡", "广式", "江浙菜", "蒸菜"],
  吃肉: ["烤肉", "烧烤", "牛肉", "炖肉"],
  清爽: ["沙拉", "轻食", "蒸菜", "凉菜"],
  汤水: ["汤", "砂锅", "面馆", "米线", "粉"],
};
// 「特别想吃」的搜索关键词由前端传入（event.cravingKeywords），更灵活、好扩展

// 按时间松紧挑选要用的档位
function tiersByUrgency(urgency) {
  if (urgency === "rush") return ["quick", "quick", "normal"]; // 偏快餐
  if (urgency === "relaxed") return ["nice", "nice", "normal"]; // 偏讲究
  return ["normal", "quick", "nice"]; // 正常：均衡
}

// 每次推荐用几个关键词去搜（越多越丰富，但 API 调用也越多）
const KEYWORDS_PER_QUERY = 3;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayStr() {
  // 用东八区日期
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// ---------- 1) 周边餐厅：高德 / 腾讯 + 缓存 ----------
function roundCoord(n) {
  return Math.round(n * 1000) / 1000; // ~110m 网格，便于缓存命中
}

// 高德 v5 周边搜索
async function amapSearch(latitude, longitude, keyword) {
  const base =
    `https://restapi.amap.com/v5/place/around?key=${CONFIG.AMAP_KEY}` +
    `&location=${longitude.toFixed(6)},${latitude.toFixed(6)}` +
    `&keywords=${encodeURIComponent(keyword)}` +
    `&radius=${CONFIG.SEARCH_RADIUS}&page_size=15&page_num=1`;

  async function call(showFields) {
    const { text } = await httpRequest(`${base}&show_fields=${showFields}`);
    return JSON.parse(text);
  }

  // 先试带 photos；若高德不支持(无权限/报错)，退回不带 photos，保证搜索不挂
  let json;
  try {
    json = await call("business,photos");
    if (!json || json.status !== "1") json = await call("business");
  } catch (e) {
    json = await call("business");
  }
  if (!json || json.status !== "1") {
    throw new Error(`高德错误 ${json && json.infocode}: ${json && json.info}`);
  }
  return (json.pois || []).map((p) => {
    const loc = (p.location || "").split(",");
    const raw = Array.isArray(p.photos) && p.photos[0] && p.photos[0].url ? p.photos[0].url : "";
    const thumb = raw ? raw.replace(/^http:\/\//, "https://") : "";
    return {
      id: String(p.id),
      name: p.name,
      category: typeof p.type === "string" ? p.type.split(";").pop() : "",
      address: typeof p.address === "string" ? p.address : "",
      tel: (p.business && p.business.tel) || "",
      distance: p.distance != null ? Math.round(Number(p.distance)) : null,
      location: loc.length === 2 ? { lng: Number(loc[0]), lat: Number(loc[1]) } : null,
      thumb,
      matchedBy: keyword,
    };
  });
}

// 腾讯周边搜索（备用）
async function tencentSearch(latitude, longitude, keyword) {
  const boundary = `nearby(${latitude},${longitude},${CONFIG.SEARCH_RADIUS},1)`;
  const url =
    `https://apis.map.qq.com/ws/place/v1/search?keyword=${encodeURIComponent(keyword)}` +
    `&boundary=${encodeURIComponent(boundary)}` +
    `&page_size=15&orderby=_distance` +
    `&key=${CONFIG.TENCENT_LBS_KEY}`;
  const { text } = await httpRequest(url);
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error("腾讯位置服务返回非 JSON：" + text.slice(0, 120));
  }
  if (json.status !== 0) {
    throw new Error(`腾讯位置服务错误 ${json.status}: ${json.message}`);
  }
  return (json.data || []).map((p) => ({
    id: String(p.id),
    name: p.title,
    category: p.category || "",
    address: p.address || "",
    tel: p.tel || "",
    distance: typeof p._distance === "number" ? Math.round(p._distance) : null,
    location: p.location || null,
    matchedBy: keyword,
  }));
}

// 带缓存的关键词搜索：同地点同关键词 TTL 内不再调地图 API
async function searchByKeyword(latitude, longitude, keyword) {
  const provider = CONFIG.MAP_PROVIDER === "tencent" ? "tencent" : "amap";
  const cacheKey = `${provider}:${roundCoord(latitude)},${roundCoord(longitude)}:${keyword}`;
  const ttl = (CONFIG.POI_CACHE_TTL_HOURS || 6) * 3600 * 1000;

  // 读缓存
  let existingId = null;
  try {
    const cached = await db.collection(COLL_CACHE).where({ key: cacheKey }).limit(1).get();
    const doc = cached.data && cached.data[0];
    if (doc) {
      existingId = doc._id;
      if (Date.now() - doc.ts < ttl) return doc.pois || [];
    }
  } catch (e) {
    /* 集合不存在等，忽略，走实搜 */
  }

  // 实搜
  const pois =
    provider === "tencent"
      ? await tencentSearch(latitude, longitude, keyword)
      : await amapSearch(latitude, longitude, keyword);

  // 写缓存
  try {
    if (existingId) {
      await db.collection(COLL_CACHE).doc(existingId).update({ data: { pois, ts: Date.now() } });
    } else {
      await db.collection(COLL_CACHE).add({ data: { key: cacheKey, pois, ts: Date.now() } });
    }
  } catch (e) {
    /* 写缓存失败不影响返回 */
  }
  return pois;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchRestaurants(latitude, longitude, mealType, tastes, urgency, cravingKeywords) {
  let keywords;
  if (cravingKeywords && cravingKeywords.length) {
    // 硬锁：只搜「想吃什么」的关键词，候选全是它
    keywords = shuffle([...cravingKeywords]).slice(0, KEYWORDS_PER_QUERY + 1);
  } else {
    const mealPool = MEAL_KEYWORDS[mealType] || MEAL_KEYWORDS.lunch;
    // 收集口味词（有搜索意义的辣度/荤素/汤水 → 真实品类词）
    const tasteWords = [];
    (tastes || []).forEach((t) => {
      const arr = TASTE_KEYWORDS[t];
      if (arr) {
        tasteWords.push(pickOne(arr));
        if (arr.length > 1) tasteWords.push(pickOne(arr)); // 每个口味多取一个，加大权重
      }
    });
    if (tasteWords.length) {
      // 选了口味 → 口味词主导，只补 1 个菜池词保证广度
      const poolWord = pickOne(mealPool[tiersByUrgency(urgency)[0]] || mealPool.normal || []);
      keywords = shuffle([...new Set(tasteWords)]).slice(0, KEYWORDS_PER_QUERY);
      if (poolWord) keywords.push(poolWord);
    } else {
      // 没选口味 → 按时间松紧从菜池各档抽词
      keywords = tiersByUrgency(urgency)
        .map((tier) => pickOne(mealPool[tier] || mealPool.normal || []))
        .filter(Boolean);
      keywords = shuffle([...new Set(keywords)]).slice(0, KEYWORDS_PER_QUERY + 1);
    }
  }

  const results = await Promise.all(
    keywords.map((kw) => searchByKeyword(latitude, longitude, kw).catch(() => []))
  );
  // 合并去重
  const map = {};
  results.flat().forEach((r) => {
    if (!map[r.id]) map[r.id] = r;
  });
  const merged = Object.values(map);
  // 洗牌后截断，喂给 AI 的池子每次都不一样
  return { restaurants: shuffle(merged).slice(0, CONFIG.CANDIDATE_SIZE), keywords };
}

// ---------- 2) 和风天气：当前实况 ----------
async function fetchWeather(latitude, longitude) {
  try {
    const host = CONFIG.QWEATHER_HOST.replace(/\/$/, "");
    // 和风的 location 是「经度,纬度」
    const url = `${host}/v7/weather/now?location=${longitude.toFixed(4)},${latitude.toFixed(4)}&key=${CONFIG.QWEATHER_KEY}`;
    const { text } = await httpRequest(url);
    const json = JSON.parse(text);
    if (json.code !== "200" || !json.now) return null;
    return {
      text: json.now.text, // 天气状况，如「小雨」
      temp: Number(json.now.temp), // 温度℃
      feelsLike: Number(json.now.feelsLike),
      windDir: json.now.windDir,
      humidity: json.now.humidity,
    };
  } catch (e) {
    // 天气拿不到不影响推荐，降级为空
    return null;
  }
}

// ---------- 3) 智谱 GLM：综合打分排序 ----------
function buildPrompt({ mealType, weather, restaurants, recent, profile, tastes, urgency, craving }) {
  const weatherLine = weather
    ? `${weather.text}，${weather.temp}℃，体感${weather.feelsLike}℃`
    : "天气未知";
  const recentLines = recent.length
    ? recent
        .map(
          (r) =>
            `- ${r.date} ${MEAL_LABEL[r.mealType] || ""} ${r.restaurant?.name || ""}（${
              { like: "喜欢", ok: "一般", no: "不喜欢" }[r.feedback] || "未评价"
            }）${r.note ? "：" + r.note : ""}`
        )
        .join("\n")
    : "（暂无历史）";
  const candLines = restaurants
    .map(
      (r, i) =>
        `${i + 1}. id=${r.id} | ${r.name} | 分类:${r.category} | 距离:${
          r.distance != null ? r.distance + "米" : "未知"
        }`
    )
    .join("\n");

  const mealVibe = {
    breakfast: "早餐要快、轻、暖：粥/包子/豆浆/肠粉/面这类，别推重口或只做正餐的店。",
    lunch: "午餐要顶饱、出餐快、能扛一下午：快餐/盖饭/面/家常菜这类。",
    dinner: "晚餐可以更丰盛、有氛围、适合慢慢吃：火锅/烧烤/小炒/正经餐厅这类。",
  }[mealType] || "";

  const urgencyLine = {
    rush: "⏱ 很赶时间：强烈优先出餐快、能打包速食的快餐/小吃，排除需要久等或正式堂食的店。",
    normal: "⏱ 时间正常：正常吃即可，快慢均衡。",
    relaxed: "⏱ 不赶时间：可以推荐更讲究、适合坐下来慢慢吃、稍微吃好点的店。",
  }[urgency || "normal"];

  const tasteLine =
    tastes && tastes.length ? `这一餐想吃：${tastes.join("、")}` : "这一餐口味：不限，随便";
  const cravingLine = craving
    ? `\n【特别想吃】用户此刻特别想吃「${craving}」，下面候选都是这一品类，请正常按距离/口碑/天气挑出最合适的几家即可，不要推荐其它品类。`
    : "";

  return `你是用户的私人吃饭推荐助手，帮他决定这一餐去哪家店。请只从给出的候选餐厅里挑选并排序，结合本餐意向、餐次、天气、用户长期口味与最近吃过的店。

【这一餐】${MEAL_LABEL[mealType] || mealType}
【这一餐的特点】${mealVibe}
【本餐时间松紧】${urgencyLine}
【本餐口味意向】${tasteLine}${cravingLine}
【当前天气】${weatherLine}
【用户长期口味画像】${profile?.summary || "暂无，需从历史推断"}
【最近吃过（请明显降权，避免连续重复同店/同类）】
${recentLines}

【附近候选餐厅】
${candLines}

排序原则（按重要性）：
1. 最优先满足【本餐时间松紧】和【本餐口味意向】——这是用户此刻的明确需求；
2. 强烈贴合这一餐的特点（早/午/晚要有明显区别）；
3. 贴合天气（冷天/雨天更倾向热食、就近、汤汤水水；热天可清爽）；
4. 贴合用户长期口味，避开他不喜欢的；
5. 最近刚吃过的同店或同类排到很后面甚至不选；
6. 适当制造惊喜，不要每次都是最近最大的那几家。

请严格输出 JSON（不要任何多余文字、不要 markdown 代码块），格式：
{"list":[{"id":"候选里的id","reason":"一句话推荐理由(20字内，点出为什么适合此刻的需求)","score":0-100的整数}]}
最多返回 ${CONFIG.RESULT_SIZE} 家，按推荐度从高到低。只能用候选里出现过的 id。`;
}

function extractJson(content) {
  if (!content) return null;
  // 去掉可能的 ```json ``` 包裹
  let s = content.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

async function rankOnce(ctx) {
  const prompt = buildPrompt(ctx);
  const body = JSON.stringify({
    model: CONFIG.ZHIPU_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8, // 高一点更有变化、更有惊喜
    response_format: { type: "json_object" }, // 让模型直接吐 JSON，更快更稳
  });
  const { text } = await httpRequest(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.ZHIPU_KEY}`,
      },
      body,
      timeout: 14000, // 单次最多等 14s
    }
  );
  let resp;
  try {
    resp = JSON.parse(text);
  } catch (e) {
    throw new Error("GLM 返回非 JSON: " + text.slice(0, 200));
  }
  if (resp.error) {
    throw new Error("GLM 接口报错: " + JSON.stringify(resp.error));
  }
  const content = resp.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("GLM 无 content: " + JSON.stringify(resp).slice(0, 200));
  }
  const parsed = extractJson(content);
  if (!parsed || !Array.isArray(parsed.list)) {
    throw new Error("GLM 内容无法解析成 JSON: " + content.slice(0, 200));
  }
  return parsed.list;
}

// 免费档不稳定：失败自动重试，最多 2 次
async function rankWithAI(ctx) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await rankOnce(ctx);
    } catch (e) {
      lastErr = e;
      console.error(`GLM 第 ${attempt} 次失败:`, e.message);
    }
  }
  throw lastErr;
}

async function recommend(event) {
  const { latitude, longitude, mealType } = event;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { success: false, errMsg: "缺少定位信息" };
  }
  const meal = MEAL_LABEL[mealType] ? mealType : "lunch";
  const tastes = Array.isArray(event.tastes) ? event.tastes.slice(0, 4) : [];
  const urgency = ["rush", "normal", "relaxed"].includes(event.urgency) ? event.urgency : "normal";
  const craving = typeof event.craving === "string" && event.craving ? event.craving.slice(0, 20) : null;
  const cravingKeywords =
    craving && Array.isArray(event.cravingKeywords)
      ? event.cravingKeywords.filter((x) => typeof x === "string" && x).slice(0, 8)
      : [];
  const { OPENID } = cloud.getWXContext();

  // 并行拉：餐厅 + 天气；同时查历史与画像
  const [searchRes, weather, recentRes, profileRes] = await Promise.all([
    fetchRestaurants(latitude, longitude, meal, tastes, urgency, cravingKeywords),
    fetchWeather(latitude, longitude),
    db
      .collection(COLL_LOG)
      .where({ _openid: OPENID })
      .orderBy("createdAt", "desc")
      .limit(CONFIG.RECENT_LOOKBACK)
      .get()
      .catch(() => ({ data: [] })),
    db
      .collection(COLL_PROFILE)
      .where({ _openid: OPENID })
      .limit(1)
      .get()
      .catch(() => ({ data: [] })),
  ]);
  const restaurants = searchRes.restaurants;
  const usedKeywords = searchRes.keywords;

  if (!restaurants.length) {
    return {
      success: true,
      data: { list: [], weather, mealType: meal, note: "附近没找到餐厅", debug: { keywords: usedKeywords, candidates: 0 } },
    };
  }

  const byId = {};
  restaurants.forEach((r) => (byId[r.id] = r));

  let ranked = null;
  let aiOk = false;
  let aiError = null;
  try {
    ranked = await rankWithAI({
      mealType: meal,
      weather,
      restaurants,
      recent: recentRes.data || [],
      profile: (profileRes.data || [])[0] || null,
      tastes,
      urgency,
      craving,
    });
    aiOk = !!ranked;
  } catch (e) {
    ranked = null;
    aiError = e.message || String(e);
    console.error("AI 排序失败:", aiError);
  }

  let list;
  if (ranked) {
    // 用 AI 的排序，合并回完整餐厅信息；过滤掉编造的 id
    list = ranked
      .map((r) => (byId[r.id] ? { ...byId[r.id], reason: r.reason, score: r.score } : null))
      .filter(Boolean)
      .slice(0, CONFIG.RESULT_SIZE);
  }
  if (!list || !list.length) {
    // 降级：AI 不可用时，从（已洗牌的）候选池里直接取，保证每次也不一样
    list = restaurants
      .slice(0, CONFIG.RESULT_SIZE)
      .map((r) => ({ ...r, reason: r.matchedBy ? r.matchedBy + "推荐" : "附近的选择", score: null }));
    aiOk = false;
  }

  return {
    success: true,
    data: {
      list,
      weather,
      mealType: meal,
      aiRanked: aiOk,
      aiError,
      debug: { keywords: usedKeywords, candidates: restaurants.length },
    },
  };
}

// ---------- feedback：写入吃过记录 ----------
async function feedback(event) {
  const { restaurant, mealType, fb, note, weather } = event;
  if (!restaurant || !restaurant.id) return { success: false, errMsg: "缺少餐厅信息" };
  const res = await db.collection(COLL_LOG).add({
    data: {
      date: todayStr(),
      mealType: MEAL_LABEL[mealType] ? mealType : "lunch",
      restaurant: {
        id: String(restaurant.id),
        name: restaurant.name,
        category: restaurant.category || "",
      },
      feedback: ["like", "ok", "no"].includes(fb) ? fb : "ok",
      note: (note || "").slice(0, 100),
      weather: weather || null,
      createdAt: db.serverDate(),
    },
  });
  return { success: true, data: { _id: res._id } };
}

// ---------- history：最近吃过记录 ----------
async function history(event) {
  const { OPENID } = cloud.getWXContext();
  const limit = Math.min(event.limit || 30, 50);
  const res = await db
    .collection(COLL_LOG)
    .where({ _openid: OPENID })
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()
    .catch(() => ({ data: [] }));
  return { success: true, data: res.data || [] };
}

exports.main = async (event) => {
  try {
    switch (event.type) {
      case "recommend":
        return await recommend(event);
      case "feedback":
        return await feedback(event);
      case "history":
        return await history(event);
      default:
        return { success: false, errMsg: "未知 type: " + event.type };
    }
  } catch (e) {
    console.error(e);
    return { success: false, errMsg: e.message || String(e) };
  }
};
