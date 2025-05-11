/**
 * ScholarTailor - 应用核心模块
 * 处理应用程序的初始化和主要功能
 */

import { loadData, cacheScholars, reloadData } from "./dataManager.js";
import detailPanel from "./components/detailPanel.js";
import filterPanel from "./components/filterPanel.js";
import graphPanel from "./components/graphPanel.js";
import addPanel from "./components/addPanel.js";
import adminPanel from "./components/adminPanel.js";
import { showStatusMessage } from "./utils.js";

// 全局变量，添加到window对象上以便于全局访问
// 初始化为null或空值，避免未定义错误
window.cy = null; // Cytoscape实例
window.graphData = null; // 图谱数据
window.activeNodeId = null; // 当前活跃节点ID
window.scholars = {}; // 学者数据缓存
window.customRelationships = []; // 自定义关系缓存

// 导出全局变量引用 - 使用getter以确保始终获取最新值
export const getGlobals = () => ({
  cy: window.cy,
  graphData: window.graphData,
  activeNodeId: window.activeNodeId,
  scholars: window.scholars,
  customRelationships: window.customRelationships,
});

/**
 * 设置UI交互事件监听器
 * @private
 */
function _setupEventListeners() {
  // 添加重新加载数据按钮
  const reloadBtn = document.getElementById("reload-data-btn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", async function () {
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
      await reloadData();
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新数据';
    });
  }

  // 重置视图按钮 - 工具栏
  const resetViewBtn = document.getElementById("reset-view-btn");
  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", function () {
      graphPanel.resetView();
    });
  }

  // 重新布局按钮
  const resetLayoutBtn = document.getElementById("reset-layout-btn");
  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener("click", function () {
      graphPanel.applyLayout("fcose");
    });
  }

  // 搜索按钮
  const searchBtn = document.getElementById("search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", function () {
      const query = document.getElementById("search-input").value.trim();
      if (query) {
        // 实现搜索逻辑
        console.log("搜索:", query);
      }
    });
  }
}

/**
 * 初始化应用程序
 * @returns {Promise<void>}
 */
export async function init() {
  // 显示加载状态
  const statusElement = document.getElementById("data-status");
  if (statusElement) {
    statusElement.textContent = "正在加载学者数据...";
    statusElement.style.display = "block";
  }

  // 检查图谱容器是否存在
  const cyContainer = document.getElementById("cy");
  if (!cyContainer) {
    console.error('错误: 找不到图谱容器 (id="cy")');
    if (statusElement) {
      statusElement.textContent = "初始化失败: 找不到图谱容器";
      statusElement.style.display = "block";
    }
    return Promise.reject(new Error("找不到图谱容器"));
  }

  try {
    // 从API获取数据
    const data = await loadData();

    // 初始化学者数据缓存
    cacheScholars(data);

    // 初始化图谱
    graphPanel.init(data);

    // 设置UI组件
    filterPanel.init();
    detailPanel.init();

    // 设置UI交互事件
    _setupEventListeners();

    // 页面加载完成后应用默认筛选条件，但考虑节点数量
    setTimeout(() => {
      if (window.cy) {
        const totalNodes = window.cy.nodes().length;
        // 如果节点数量少于100，设置最小连接数为1，否则保持原设置
        if (totalNodes < 200) {
          const minConnectionsSlider =
            document.getElementById("min-connections");
          const minConnectionsValue = document.getElementById(
            "min-connections-value"
          );
          if (minConnectionsSlider) {
            minConnectionsSlider.value = "1";
            if (minConnectionsValue) {
              minConnectionsValue.textContent = "1";
            }
          }
        }
        // 应用筛选
        if (typeof filterPanel.applyFilters === "function") {
          filterPanel.applyFilters();
        }
      }
    }, 1000);

    // 隐藏加载状态
    if (statusElement) {
      statusElement.textContent = "数据加载完成";
      setTimeout(() => {
        statusElement.style.display = "none";
      }, 2000);
    }

    console.log("应用程序初始化完成");
    return Promise.resolve();
  } catch (error) {
    console.error("初始化应用程序时出错:", error);
    if (statusElement) {
      statusElement.textContent = "加载数据失败，请检查网络连接";
      statusElement.style.display = "block";
    }
    return Promise.reject(error);
  }
}
