/**
 * ScholarTailor - 主应用程序入口
 */

import { initGraph, resetGraphViewport } from './js/graph.js';
import { setupAdminPanel, setupTagFiltering, setupTagClickHandlers, setupSearch } from './js/ui.js';
import { loadData, cacheScholars, reloadData } from './js/data.js';

/**
 * 初始化应用程序
 */
async function initApp() {
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
      const cyInstance = initGraph('cy', data);
      if (!cyInstance) {
        throw new Error('初始化图谱失败');
      }
      
      // 设置UI组件
      setupAdminPanel();
      setupTagFiltering();
      setupTagClickHandlers();
      setupSearch();
      
      // 添加重新加载数据按钮
      const reloadBtn = document.getElementById('reload-data-btn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', async function() {
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
          
          try {
            await reloadData();
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新数据';
          } catch (error) {
            console.error('刷新数据失败:', error);
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新数据';
            if (statusElement) {
              statusElement.textContent = '刷新数据失败';
              statusElement.style.display = 'block';
              setTimeout(() => {
                statusElement.style.display = 'none';
              }, 3000);
            }
          }
        });
      }
      
      // 全局视图按钮
      const graphViewBtn = document.getElementById('graph-view-btn');
      if (graphViewBtn) {
        graphViewBtn.addEventListener('click', function() {
          resetGraphViewport();
          this.classList.add('hidden');
          if (window.cy) {
            window.cy.nodes().removeClass('highlighted faded');
          }
        });
      }
      
      // 重置视图按钮
      const resetViewBtn = document.getElementById('reset-view-btn');
      if (resetViewBtn) {
        resetViewBtn.addEventListener('click', function() {
          resetGraphViewport();
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
    } catch (dataError) {
      console.error('加载或处理数据时出错:', dataError);
      if (statusElement) {
        statusElement.textContent = '数据加载失败，请检查网络连接';
        statusElement.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('初始化应用程序时出错:', error);
    
    // 显示错误状态
    const statusElement = document.getElementById('data-status');
    if (statusElement) {
      statusElement.textContent = '数据加载失败，请尝试刷新页面';
      statusElement.style.display = 'block';
    }
  }
}

// 在DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);
