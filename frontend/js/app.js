/**
 * ScholarTailor - 应用入口
 * 负责初始化所有组件和模块
 */

// 引入组件和模块
import { init } from "./core.js";
import detailPanel from "./components/detailPanel.js";
import filterPanel from "./components/filterPanel.js";
import addPanel from "./components/addPanel.js";
import searchPanel from "./components/searchPanel.js";
import adminPanel from "./components/adminPanel.js";
import graphPanel from "./components/graphPanel.js";
import helpPanel from "./components/helpPanel.js";
import * as dataManager from "./dataManager.js";
import { showStatusMessage } from "./utils.js";
import { reloadData } from "./dataManager.js";

// 等待DOM加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  // 初始化应用核心
  init()
    .then(() => {
      // 初始化组件
      detailPanel.init();
      filterPanel.init();
      graphPanel.init();
      addPanel.init();
      searchPanel.init();
      adminPanel.init();
      helpPanel.init(); // 初始化帮助面板

      // 初始化数据管理器
      dataManager.init({
        scholars: window.scholars || {},
      });
    })
    .catch((error) => {
      console.error("初始化失败:", error);
      showStatusMessage("系统初始化失败，请刷新页面重试", "error");
    });
});

// 添加重新加载数据按钮
const reloadBtn = document.getElementById("reload-data-btn");
if (reloadBtn) {
  reloadBtn.addEventListener("click", async function () {
    // 设置按钮为加载状态
    const originalText = this.innerHTML;
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';

    try {
      await reloadData();
      showStatusMessage("数据已成功刷新", "success");
    } catch (error) {
      console.error("刷新数据失败:", error);
      showStatusMessage("刷新数据失败", "error");
    } finally {
      // 恢复按钮状态
      this.disabled = false;
      this.innerHTML = originalText;
    }
  });
}
