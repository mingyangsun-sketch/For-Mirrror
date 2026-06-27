// 推荐页
const MEALS = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
];
// 口味轴：辣度为主轴(单选)、荤素(单选)、汤水(开关)，没选「想吃」时才用
const SPICE_OPTIONS = [
  { key: "不辣", label: "🚫 不辣" },
  { key: "微辣", label: "🌶 微辣" },
  { key: "重辣", label: "🔥 能吃辣" },
];
const MEAT_OPTIONS = [
  { key: "吃肉", label: "🍖 吃肉" },
  { key: "清爽", label: "🥗 清爽" },
];

// 想吃什么(品类)。品类 = 载体；味道交给「菜系/变体名 + AI 的菜系知识」判断，不再硬绑口味标签。
// ai: 传给大模型的品类描述；variants: 中性载体的二级选择(自带味道描述)
const CRAVING_OPTIONS = [
  { key: "快餐", label: "🍚 米饭快餐", ai: "米饭快餐(盖浇饭/牛肉饭/猪脚饭这类盖饭，出餐快)", keywords: ["盖浇饭", "牛肉饭", "猪脚饭", "黄焖鸡米饭", "卤肉饭", "排骨饭", "烧腊饭", "盖饭"] },
  {
    key: "粉面",
    label: "🍜 粉面",
    variants: [
      { key: "汤", label: "汤粉/汤面", desc: "汤鲜", ai: "汤粉汤面(汤底鲜美，如牛肉面/桂林米粉/浇头面/肠粉)", keywords: ["牛肉面", "兰州拉面", "桂林米粉", "米粉", "汤粉", "米线", "砂锅米线", "馄饨", "汤面", "浇头面", "肠粉"] },
      { key: "拌", label: "拌粉/炒粉", desc: "干拌/炒", ai: "拌粉炒粉炒面(干拌或炒)", keywords: ["拌粉", "拌面", "炒粉", "炒面", "干炒牛河", "热干面", "江西炒粉"] },
    ],
  },
  { key: "粥汤", label: "🥣 粥 / 汤 / 炖", ai: "粥、汤、炖品(温和鲜美、暖胃)", keywords: ["瓦罐汤", "砂锅粥", "粥", "煲汤", "炖汤", "老火汤", "砂锅", "炖菜"] },
  {
    key: "火锅",
    label: "🍲 火锅烫煮",
    variants: [
      { key: "红汤", label: "红汤辣锅", desc: "麻辣", ai: "红汤麻辣火锅", keywords: ["重庆火锅", "麻辣火锅", "牛油火锅", "川味火锅"] },
      { key: "清汤", label: "清汤养生", desc: "鲜汤", ai: "清汤养生火锅(椰子鸡/猪肚鸡/老鸭汤/豆米火锅这类)", keywords: ["椰子鸡", "猪肚鸡", "菌汤火锅", "老鸭汤", "豆米火锅", "番茄火锅", "清汤火锅"] },
      { key: "烫煮", label: "麻辣烫/串串", desc: "自选烫煮", ai: "麻辣烫/串串/冒菜(自选、可麻辣可清汤)", keywords: ["麻辣烫", "串串香", "冒菜", "钵钵鸡", "麻辣香锅"] },
    ],
  },
  { key: "烧烤", label: "🍗 烧烤炸物", ai: "烧烤、炸物(重口、适合慢慢吃)", keywords: ["烧烤", "烤串", "烤肉", "炸鸡", "韩式炸鸡", "鸡排", "夜市烧烤"] },
  { key: "轻食", label: "🥗 轻食", ai: "轻食沙拉(清爽、健康)", keywords: ["沙拉", "轻食", "三明治", "卷饼", "便利店", "健康餐"] },
  { key: "甜品", label: "🍰 甜品糖水", ai: "甜品、糖水、蛋糕糕点(当下午茶或饭后甜点)", keywords: ["甜品", "糖水", "蛋糕", "烘焙", "面包", "糕点", "港式甜品", "双皮奶"] },
  {
    key: "菜系",
    label: "🗺 地方菜系",
    variants: [
      { key: "川菜", label: "川菜", desc: "麻辣", ai: "川菜(麻辣鲜香)", keywords: ["川菜", "水煮鱼", "回锅肉", "川菜馆"] },
      { key: "湘菜", label: "湘菜", desc: "香辣", ai: "湘菜(香辣浓郁)", keywords: ["湘菜", "辣椒炒肉", "剁椒鱼头", "湖南菜"] },
      { key: "赣菜", label: "赣菜", desc: "鲜辣", ai: "赣菜江西菜(鲜辣咸鲜)", keywords: ["赣菜", "江西菜", "瓦罐汤", "江西小炒", "南昌菜"] },
      { key: "粤菜", label: "粤菜", desc: "清鲜", ai: "粤菜(清淡鲜香)", keywords: ["粤菜", "茶餐厅", "煲仔饭", "烧腊", "广东菜"] },
      { key: "江浙", label: "江浙菜", desc: "偏甜清淡", ai: "江浙本帮菜(偏甜、清淡鲜美)", keywords: ["本帮菜", "杭帮菜", "江浙菜", "淮扬菜", "小笼包"] },
      { key: "西北", label: "西北菜", desc: "面食牛羊", ai: "西北菜(面食、牛羊肉)", keywords: ["兰州拉面", "西北菜", "新疆菜", "大盘鸡", "羊肉泡馍"] },
    ],
  },
  {
    key: "异国",
    label: "🌏 异国风味",
    variants: [
      { key: "日料", label: "日料", desc: "寿司/丼饭", ai: "日本料理(寿司/丼饭/居酒屋)", keywords: ["日料", "寿司", "日本料理", "居酒屋", "丼饭"] },
      { key: "韩餐", label: "韩餐", desc: "烤肉/部队锅", ai: "韩国料理(韩式烤肉/部队锅/拌饭)", keywords: ["韩国料理", "韩式烤肉", "部队锅", "石锅拌饭", "韩餐"] },
      { key: "泰越", label: "泰国/东南亚", desc: "酸辣", ai: "泰国及东南亚菜(冬阴功/酸辣)", keywords: ["泰国菜", "冬阴功", "东南亚菜", "越南菜", "泰式"] },
      { key: "西餐", label: "西餐", desc: "牛排/意面", ai: "西餐(牛排/意面/披萨)", keywords: ["西餐", "牛排", "意大利面", "披萨", "汉堡"] },
    ],
  },
  {
    key: "江西",
    label: "🏠 江西家乡",
    ai: "江西家乡菜(赣菜，鲜辣咸鲜；招牌瓦罐汤、南昌拌粉、炒粉、江西小炒、烧鸡公)",
    keywords: ["瓦罐汤", "瓦罐煨汤", "南昌拌粉", "拌粉", "江西米粉", "炒粉", "汤粉", "江西小炒", "赣菜", "烧鸡公", "南昌菜"],
  },
];
const URGENCY_OPTIONS = [
  { key: "rush", label: "🏃 很赶", desc: "快餐速战" },
  { key: "normal", label: "😌 正常", desc: "随便吃吃" },
  { key: "relaxed", label: "🍃 不赶", desc: "吃点好的" },
];
const FB_TEXT = { like: "喜欢", ok: "一般", no: "不要" };
// 按钮文案按餐次变化（英文 + 图标）
const BTN_LABEL = {
  breakfast: "🥐  What for Breakfast",
  lunch: "🍜  What for Lunch",
  dinner: "🍲  What for Dinner",
};

function mealByHour(h) {
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  return "dinner";
}

Page({
  data: {
    heroImg: "",
    btnLabel: "",
    spiceOptions: SPICE_OPTIONS,
    meatOptions: MEAT_OPTIONS,
    cravingOptions: CRAVING_OPTIONS,
    urgencyOptions: URGENCY_OPTIONS,
    mealType: "lunch",
    mealLabel: "午餐",
    greeting: "",
    // 本餐意向
    spice: "", // 辣度(主轴，单选)
    meat: "", // 荤素(单选)
    soup: false, // 想喝汤(开关)
    craving: "", // 想吃品类(key)，单选；非空时硬锁该品类
    cravingVariant: "", // 中性品类的二级选择(汤/拌、红汤/清汤、川/湘…)
    cravingVariants: [], // 当前 craving 的二级选项，供 WXML 渲染
    urgency: "normal",
    // 面板折叠 + 摘要
    panelCollapsed: false,
    summaryText: "",
    // 结果
    weather: null,
    list: [],
    loading: false,
    hasResult: false,
    errMsg: "",
    aiRanked: false,
    aiError: "",
    debugText: "",
    location: null,
  },

  onLoad() {
    const h = new Date().getHours();
    const mealType = mealByHour(h);
    const greeting = h < 10 ? "早上好" : h < 15 ? "中午好" : "晚上好";
    const mealLabel = MEALS.find((m) => m.key === mealType).label;
    this.setData({
      mealType,
      mealLabel,
      greeting,
      heroImg: `/images/hero-${mealType}.jpg`,
      btnLabel: BTN_LABEL[mealType],
    });
    // 后台先把定位拿好，点推荐时就不用等
    this.ensureLocation();
  },

  // 辣度(单选，再点取消)
  onSelectSpice(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ spice: this.data.spice === key ? "" : key });
  },

  // 荤素(单选，再点取消)
  onSelectMeat(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ meat: this.data.meat === key ? "" : key });
  },

  // 想喝汤(开关)
  onToggleSoup() {
    this.setData({ soup: !this.data.soup });
  },

  // 想吃品类(单选切换)；中性品类弹出二级选择
  onToggleCraving(e) {
    const key = e.currentTarget.dataset.key;
    if (this.data.craving === key) {
      this.setData({ craving: "", cravingVariant: "", cravingVariants: [] }); // 再点取消
      return;
    }
    const c = CRAVING_OPTIONS.find((x) => x.key === key);
    this.setData({ craving: key, cravingVariant: "", cravingVariants: c.variants || [] });
  },

  // 中性品类的二级选择(汤/拌、红汤/清汤、川/湘…)单选
  onSelectVariant(e) {
    const vkey = e.currentTarget.dataset.key;
    this.setData({ cravingVariant: this.data.cravingVariant === vkey ? "" : vkey });
  },

  // 选时间松紧
  onSelectUrgency(e) {
    this.setData({ urgency: e.currentTarget.dataset.key });
  },

  // 点「给我推荐」
  onSubmit() {
    if (this.data.location) this.callRecommend();
    else this.ensureLocation(true);
  },

  onRefresh() {
    if (this.data.location) this.callRecommend();
    else this.ensureLocation(true);
  },

  // 拿定位（thenRecommend=true 时拿到后立即推荐）
  ensureLocation(thenRecommend) {
    if (thenRecommend) this.setData({ loading: true, errMsg: "" });
    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        this.setData({ location: { latitude: res.latitude, longitude: res.longitude } });
        if (thenRecommend) this.callRecommend();
      },
      fail: () => {
        this.setData({
          loading: false,
          errMsg: "需要定位权限才能推荐附近的店",
        });
      },
    });
  },

  openSetting() {
    wx.openSetting({
      success: (res) => {
        if (res.authSetting["scope.userLocation"]) this.ensureLocation(true);
      },
    });
  },

  // 把 craving + variant 解析成 { craving名(给AI), keywords }
  resolveCraving() {
    const c = CRAVING_OPTIONS.find((x) => x.key === this.data.craving);
    if (!c) return { craving: "", keywords: [] };
    if (c.variants) {
      const v = c.variants.find((x) => x.key === this.data.cravingVariant);
      if (v) return { craving: v.ai || v.label, keywords: v.keywords };
      // 没选二级 → 都行：合并全部关键词
      return { craving: c.ai || c.key, keywords: c.variants.reduce((a, x) => a.concat(x.keywords), []) };
    }
    return { craving: c.ai || c.key, keywords: c.keywords };
  },

  // 折叠后顶部那行摘要：餐次 · 想吃 · 时间
  buildSummary() {
    const parts = [this.data.mealLabel];
    const c = CRAVING_OPTIONS.find((x) => x.key === this.data.craving);
    if (c) {
      let s = c.label;
      if (c.variants) {
        const v = c.variants.find((x) => x.key === this.data.cravingVariant);
        if (v) s += "·" + v.label;
      }
      parts.push(s);
    } else {
      parts.push("不挑");
    }
    const u = URGENCY_OPTIONS.find((x) => x.key === this.data.urgency);
    if (u) parts.push(u.label);
    return parts.join("  ·  ");
  },

  // 点摘要条「重新选」→ 展开面板
  onEditIntent() {
    this.setData({
      panelCollapsed: false,
      list: [],
      errMsg: "",
      aiError: "",
      debugText: "",
      weather: null,
    });
  },

  callRecommend() {
    const { location, mealType, urgency } = this.data;
    if (!location) return;
    const intent = this.resolveCraving();
    // 口味轴暂时撤掉：选了想吃→交给品类/菜系名+AI判断；没选→不带口味标签
    const tastes = [];
    this.setData({
      loading: true,
      errMsg: "",
      list: [],
      hasResult: true,
      panelCollapsed: true, // 推荐后收起面板，结果直接顶上来
      summaryText: this.buildSummary(),
    });
    wx.cloud
      .callFunction({
        name: "meal",
        data: {
          type: "recommend",
          latitude: location.latitude,
          longitude: location.longitude,
          mealType,
          tastes,
          urgency,
          craving: intent.craving, // 给 AI 看的品类名（如「火锅·重庆辣锅」「江西家乡菜」）
          cravingKeywords: intent.keywords, // 硬锁搜索词
        },
      })
      .then(({ result }) => {
        if (!result || !result.success) {
          this.setData({ loading: false, errMsg: (result && result.errMsg) || "推荐失败" });
          return;
        }
        const d = result.data;
        if (d.aiError) console.error("AI 未生效原因:", d.aiError);
        if (d.debug) console.log("搜索词:", d.debug.keywords, "候选数:", d.debug.candidates);
        this.setData({
          loading: false,
          list: (d.list || []).map((r) => ({ ...r, fed: null })),
          weather: d.weather,
          aiRanked: d.aiRanked,
          aiError: d.aiError || "",
          debugText: d.debug ? `搜索词：${(d.debug.keywords || []).join("、")} ｜ 候选 ${d.debug.candidates} 家` : "",
          errMsg: d.list && d.list.length ? "" : "附近没找到合适的餐厅",
        });
      })
      .catch((e) => {
        console.error("callFunction recommend 失败:", e);
        this.setData({ loading: false, errMsg: this.friendlyErr(e) });
      });
  },

  friendlyErr(e) {
    const msg = (e && (e.errMsg || e.message)) || JSON.stringify(e);
    if (msg.includes("FunctionName")) return "请先上传部署 meal 云函数";
    if (msg.includes("Environment not found")) return "请在 app.js 填写正确的云环境 ID";
    // 调试期：直接把真实错误显示出来
    return "报错：" + msg;
  },

  // 反馈：喜欢/一般/不要
  onFeedback(e) {
    const { index, fb } = e.currentTarget.dataset;
    const item = this.data.list[index];
    if (!item) return;
    wx.cloud
      .callFunction({
        name: "meal",
        data: {
          type: "feedback",
          restaurant: { id: item.id, name: item.name, category: item.category },
          mealType: this.data.mealType,
          fb,
          weather: this.data.weather,
        },
      })
      .then(() => {
        this.setData({ [`list[${index}].fed`]: fb });
        wx.showToast({ title: `已记录：${FB_TEXT[fb]}`, icon: "none" });
      })
      .catch(() => wx.showToast({ title: "记录失败", icon: "none" }));
  },

  // 打开地图导航
  openMap(e) {
    const item = this.data.list[e.currentTarget.dataset.index];
    if (!item || !item.location) return;
    wx.openLocation({
      latitude: item.location.lat,
      longitude: item.location.lng,
      name: item.name,
      address: item.address || "",
    });
  },
});
