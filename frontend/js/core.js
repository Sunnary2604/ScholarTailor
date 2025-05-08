/**
 * ScholarTailor - 核心模块
 * 提供全局变量和应用的通用功能
 */

import { getFCoseLayoutOptions } from './graph.js';
import { initGraph, resetGraphViewport } from './graph.js';
import {
  updateDetailPanel,
  clearDetailPanel,
  setupAdminPanel,
  showStatusMessage,
  setupTagFiltering,
  setupTagClickHandlers,
  setupSearch,
  setupAddScholarPanel,
  setupFilterPanel
} from "./ui.js";
import { loadData, cacheScholars, reloadData } from './data.js';
import { API_BASE_URL } from './api.js';

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
  customRelationships: window.customRelationships
});

/**
 * 初始化应用程序
 * @returns {Promise<void>}
 */
export async function init() {
  try {
    // 显示加载状态
    const statusElement = document.getElementById('data-status');
    if (statusElement) {
      statusElement.textContent = '正在加载学者数据...';
      statusElement.style.display = 'block';
    }
    
    // 检查图谱容器是否存在
    const cyContainer = document.getElementById('cy');
    if (!cyContainer) {
      console.error('错误: 找不到图谱容器 (id="cy")');
      if (statusElement) {
        statusElement.textContent = '初始化失败: 找不到图谱容器';
        statusElement.style.display = 'block';
      }
      return; // 提前退出函数
    }
    
    try {
      // 从API获取数据
      const data = await loadData();
      
      // 初始化学者数据缓存
      cacheScholars(data);
      
      // 初始化图谱
      initGraph('cy', data);
      
      // 设置UI组件
      setupAdminPanel();
      setupAddScholarPanel();
      setupFilterPanel();
      setupSearch();
      setupTagFiltering();
      setupTagClickHandlers();
      
      // 页面加载完成后应用默认筛选条件，但考虑节点数量
      setTimeout(() => {
        if (window.cy) {
          const totalNodes = window.cy.nodes().length;
          // 如果节点数量少于20，设置最小连接数为1，否则保持原设置
          if (totalNodes < 20) {
            const minConnectionsSlider = document.getElementById('min-connections');
            const minConnectionsValue = document.getElementById('min-connections-value');
            if (minConnectionsSlider) {
              minConnectionsSlider.value = '1';
              if (minConnectionsValue) {
                minConnectionsValue.textContent = '1';
              }
            }
          }
          // 应用筛选
          if (typeof window.applyFilters === 'function') {
            window.applyFilters();
          }
        }
      }, 1000);
      
    } catch (dataError) {
      console.error('加载或处理数据时出错:', dataError);
      if (statusElement) {
        statusElement.textContent = '加载数据失败，请检查网络连接';
        statusElement.style.display = 'block';
      }
      throw dataError;
    }
    
    // 添加重新加载数据按钮
    const reloadBtn = document.getElementById('reload-data-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', async function() {
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
        
        await reloadData();
        
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新数据';
      });
    }
    
    // 重置视图按钮 - 工具栏
    const resetViewBtn = document.getElementById('reset-view-btn');
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', function() {
        resetGraphViewport();
      });
    }
    
    // 重新布局按钮
    const resetLayoutBtn = document.getElementById('reset-layout-btn');
    if (resetLayoutBtn) {
      resetLayoutBtn.addEventListener('click', function() {
        applyLayout('fcose');
      });
    }
    
    // 管理面板按钮
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
      adminBtn.addEventListener('click', function() {
        const adminModal = document.getElementById('admin-modal');
        if (adminModal) {
          adminModal.style.display = 'block';
        }
      });
    }
    
    // 筛选按钮
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
      filterBtn.addEventListener('click', function() {
        const filterPanel = document.getElementById('filter-panel');
        const filterOverlay = document.getElementById('filter-overlay');
        if (filterPanel) {
          filterPanel.classList.add('visible');
        }
        if (filterOverlay) {
          filterOverlay.classList.add('visible');
        }
      });
    }
    
    // 关闭筛选面板按钮
    const closeFilterPanel = document.getElementById('close-filter-panel');
    if (closeFilterPanel) {
      closeFilterPanel.addEventListener('click', function() {
        const filterPanel = document.getElementById('filter-panel');
        const filterOverlay = document.getElementById('filter-overlay');
        if (filterPanel) {
          filterPanel.classList.remove('visible');
        }
        if (filterOverlay) {
          filterOverlay.classList.remove('visible');
        }
      });
    }
    
    // 点击遮罩层关闭筛选面板
    const filterOverlay = document.getElementById('filter-overlay');
    if (filterOverlay) {
      filterOverlay.addEventListener('click', function() {
        const filterPanel = document.getElementById('filter-panel');
        if (filterPanel) {
          filterPanel.classList.remove('visible');
        }
        this.classList.remove('visible');
      });
    }
    
    // 搜索按钮
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        const query = document.getElementById('search-input').value.trim();
        if (query) {
          // 实现搜索逻辑
          console.log('搜索:', query);
        }
      });
    }
    
    // 确保关闭模态窗口的按钮能正常工作
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', function() {
        const adminModal = document.getElementById('admin-modal');
        if (adminModal) {
          adminModal.style.display = 'none';
        }
      });
    }
    
    // 关闭管理面板按钮
    const closeAdminBtn = document.getElementById('close-admin-btn');
    if (closeAdminBtn) {
      closeAdminBtn.addEventListener('click', function() {
        const adminModal = document.getElementById('admin-modal');
        if (adminModal) {
          adminModal.style.display = 'none';
        }
      });
    }
    
    // 隐藏加载状态
    if (statusElement) {
      statusElement.textContent = '数据加载完成';
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 2000);
    }
    
    console.log('应用程序初始化完成');
  } catch (error) {
    console.error('初始化应用程序时出错:', error);
    
    // 显示错误状态
    const statusElement = document.getElementById('data-status');
    if (statusElement) {
      statusElement.textContent = '初始化失败，请刷新页面重试';
      statusElement.style.display = 'block';
    }
    throw error; // 重新抛出错误，让调用者可以捕获并处理
  }
}

/**
 * 应用当前布局
 * @param {string} layoutName 布局名称，默认为fcose
 * @returns {Object} 布局实例
 */
export function applyLayout(layoutName = "fcose") {
  try {
    if (!window.cy) {
      console.error("无法应用布局：图谱实例未初始化");
      return null;
    }
    
    // 获取布局配置
    const layoutConfig = getFCoseLayoutOptions();
    
    // 配置动画
    layoutConfig.animate = true;
    layoutConfig.animationDuration = 800;
    layoutConfig.animationEasing = 'ease-in-out';
    
    console.log("应用布局:", layoutName);
    
    // 应用布局到可见元素
    const visibleElements = window.cy.elements().not('.hidden');
    const layout = visibleElements.layout(layoutConfig);
    
    // 启动布局
    layout.run();
    
    return layout;
  } catch (error) {
    console.error("应用布局时出错:", error);
    return null;
  }
}
 