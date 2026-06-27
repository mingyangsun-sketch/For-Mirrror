// 历史记录页
const MEAL_LABEL = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
const FB = {
  like: { text: "喜欢", cls: "fb-like" },
  ok: { text: "一般", cls: "fb-ok" },
  no: { text: "不要", cls: "fb-no" },
};

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({ name: "meal", data: { type: "history", limit: 50 } })
      .then(({ result }) => {
        const list = ((result && result.data) || []).map((r) => ({
          ...r,
          mealLabel: MEAL_LABEL[r.mealType] || r.mealType,
          fbText: (FB[r.feedback] || {}).text || "",
          fbCls: (FB[r.feedback] || {}).cls || "",
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },
});
