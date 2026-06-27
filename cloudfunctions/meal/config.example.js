// 复制本文件为 config.js 并填入真实 Key（config.js 已被 .gitignore，不会进仓库）
module.exports = {
  // 地图服务商：amap=高德(1万次/天) | tencent=腾讯(200次/天)
  MAP_PROVIDER: "amap",

  // 高德 Web 服务 Key（lbs.amap.com，个人支付宝实名即可）
  AMAP_KEY: "your_amap_web_service_key",

  // 腾讯位置服务 Key（备用，MAP_PROVIDER=tencent 时才用）
  TENCENT_LBS_KEY: "your_tencent_lbs_key",

  // 和风天气（dev.qweather.com）
  QWEATHER_HOST: "https://devapi.qweather.com",
  QWEATHER_KEY: "your_qweather_key",

  // 智谱 AI（bigmodel.cn）
  ZHIPU_KEY: "your_zhipu_key",
  ZHIPU_MODEL: "glm-4-flashx",

  // 推荐参数
  SEARCH_RADIUS: 2000,
  CANDIDATE_SIZE: 20,
  RESULT_SIZE: 8,
  RECENT_LOOKBACK: 15,
  POI_CACHE_TTL_HOURS: 6,
};
