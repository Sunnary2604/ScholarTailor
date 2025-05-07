/**
 * ScholarTailor - 数据模块
 * 处理数据加载和处理相关的功能
 */

import { fetchScholarData, addScholar, fetchScholarDetails } from './api.js';
import { showAdminStatus } from './ui.js';
import { getGlobals } from './core.js';

/**
 * 缓存学者数据
 * @param {Object} data - 图谱数据
 */
export function cacheScholars(data) {
  if (!data || !data.nodes) return;

  // 清空现有缓存
  for (const key in window.scholars) {
    delete window.scholars[key];
  }
  window.customRelationships.length = 0;

  // 首先处理主要学者(primary)
  for (const node of data.nodes) {
    // 检查节点类型，同时考虑原始group属性和data.group
    const isPrimary = node.group === "primary";
    
    if (node.data && isPrimary) {
      // 确保tags字段存在
      if (!node.data.tags) {
        node.data.tags = [];
      }
      // 从custom_fields.tags中恢复标签数据
      else if (node.data.custom_fields && node.data.custom_fields.tags) {
        const tagStr = node.data.custom_fields.tags;
        if (tagStr && typeof tagStr === "string") {
          node.data.tags = tagStr
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
        }
      }

      // 添加到缓存，指定为主要学者
      node.data.is_secondary = false;
      // 确保nodeType属性存在
      node.data.nodeType = "primary";
      window.scholars[node.id] = node.data;
    }
  }

  // 再处理次要学者(secondary)，只添加不存在的学者
  for (const node of data.nodes) {
    // 检查节点类型，同时考虑原始group属性和data.group
    const isSecondary = node.group === "secondary";
    
    if (node.data && isSecondary && !window.scholars[node.id]) {
      // 确保tags字段存在
      if (!node.data.tags) {
        node.data.tags = [];
      }

      // 确保设置为关联学者
      node.data.is_secondary = true;
      // 确保nodeType属性存在
      node.data.nodeType = "secondary";
      window.scholars[node.id] = node.data;
    }
  }

  // 找出并缓存自定义关系
  if (data.edges) {
    data.edges.filter(
      (edge) => edge.label !== "coauthor" || (edge.data && edge.data.is_custom)
    ).forEach(edge => window.customRelationships.push(edge));
  }

  console.log(`已缓存 ${Object.keys(window.scholars).length} 位学者数据`);
}

/**
 * 加载数据
 * @returns {Promise<Object>} 加载的数据
 */
export async function loadData() {
  try {
    return await fetchScholarData();
  } catch (error) {
    console.error("加载数据失败:", error);
    throw error;
  }
}

/**
 * 加载管理面板数据
 */
export function loadAdminPanelData() {
  // 更新学者统计
  const primaryCount = Object.values(window.scholars).filter(s => !s.is_secondary).length;
  const secondaryCount = Object.values(window.scholars).filter(s => s.is_secondary).length;
  
  // 更新UI显示
  const statsElement = document.getElementById('scholar-stats');
  if (statsElement) {
    statsElement.textContent = `主要学者: ${primaryCount} | 关联学者: ${secondaryCount}`;
  }
}

/**
 * 切换孤立节点显示
 * @param {boolean} show - 是否显示孤立节点
 */
export function toggleIsolatedNodes(show) {
  const nodes = window.cy.nodes();
  nodes.forEach(node => {
    const isIsolated = node.degree() === 0;
    if (isIsolated) {
      if (show) {
        node.removeClass('hidden');
      } else {
        node.addClass('hidden');
      }
    }
  });
}

/**
 * 更改布局
 * @param {string} layoutName - 布局名称
 * @returns {Object} 布局实例
 */
export function changeLayout(layoutName) {
  const layout = window.cy.layout({
    name: layoutName,
    fit: true,
    padding: 30,
    animate: true,
    animationDuration: 500
  });
  layout.run();
  return layout;
}

/**
 * 重新加载数据
 * @returns {Promise<boolean>} 是否重新加载成功
 */
export async function reloadData() {
  try {
    // 显示加载状态
    const statusElement = document.getElementById('data-status');
    if (statusElement) {
      statusElement.textContent = '正在加载数据...';
      statusElement.style.display = 'block';
    }
    
    // 从API获取最新网络数据
    const newData = await loadData();

    // 更新缓存
    cacheScholars(newData);

    // 更新管理面板数据
    loadAdminPanelData();

    // 检查图谱实例是否存在
    if (!window.cy) {
      console.error("图谱实例不存在，无法重新加载数据");
      if (statusElement) {
        statusElement.textContent = '图谱未初始化，无法加载数据';
        statusElement.style.display = 'block';
      }
      return false;
    }

    // 检查孤立节点开关状态
    const isolatedToggle = document.getElementById("toggle-isolated");
    const shouldShowIsolatedNodes = isolatedToggle ? isolatedToggle.checked : false;
    
    // 重建图谱，根据孤立节点开关状态决定是否预筛选孤立节点
    window.cy.elements().remove();
    if (!shouldShowIsolatedNodes) {
      // 如果不显示孤立节点，使用预过滤的元素
      const filteredElements = filterIsolatedNodes(getGraphElements(newData));
      window.cy.add(filteredElements);
    } else {
      // 显示所有节点
      window.cy.add(getGraphElements(newData));
    }

    // 获取当前布局类型 - 使用默认值'fcose'，不再依赖可能不存在的layout-select元素
    const layoutName = 'fcose';
    
    // 应用布局
    try {
      const layoutResult = changeLayout(layoutName);
      
      // 布局完成后确保孤立节点状态一致
      if (layoutResult && layoutResult.one) {
        layoutResult.one('layoutstop', function() {
          const currentToggleState = isolatedToggle ? isolatedToggle.checked : false;
          if (currentToggleState !== shouldShowIsolatedNodes) {
            toggleIsolatedNodes(currentToggleState);
          }
          // 显示加载完成状态
          if (statusElement) {
            statusElement.textContent = '数据加载完成';
            setTimeout(() => {
              statusElement.style.display = 'none';
            }, 2000);
          }
        });
      } else {
        // 如果布局没有回调，直接更新状态
        if (statusElement) {
          statusElement.textContent = '数据加载完成';
          setTimeout(() => {
            statusElement.style.display = 'none';
          }, 2000);
        }
      }
    } catch (layoutError) {
      console.error("应用布局失败:", layoutError);
      // 即使布局失败，也返回true表示数据已加载
      if (statusElement) {
        statusElement.textContent = '数据已加载，但布局应用失败';
        setTimeout(() => {
          statusElement.style.display = 'none';
        }, 3000);
      }
    }
    
    return true;
  } catch (error) {
    console.error("重新加载数据失败:", error);
    showAdminStatus("重新加载数据失败: " + error.message, "error");
    
    // 显示错误状态
    const statusElement = document.getElementById('data-status');
    if (statusElement) {
      statusElement.textContent = '数据加载失败';
      statusElement.style.display = 'block';
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
    
    return false;
  }
}

/**
 * 添加新学者
 * @param {Object} scholarData - 学者数据
 * @returns {Promise<boolean>} 是否成功添加
 */
export async function addNewScholar(scholarData) {
  try {
    const result = await addScholar(scholarData);
    if (result.success) {
      showAdminStatus("成功添加新学者", "success");
      return true;
    } else {
      showAdminStatus("添加学者失败: " + result.message, "error");
      return false;
    }
  } catch (error) {
    console.error("添加新学者失败:", error);
    showAdminStatus("添加新学者失败: " + error.message, "error");
    return false;
  }
}

/**
 * 获取图谱元素并预筛选
 * @param {Object} data - 图谱数据
 * @param {boolean} preFilter - 是否预筛选(默认为true)
 * @returns {Array} 图谱元素
 */
export function getGraphElements(data, preFilter = true) {
  if (!data) return [];
  
  console.time('生成图谱元素');
  
  // 预先计算节点连接数量，用于后续处理和预筛选
  const nodeConnections = {};
  if (data.edges) {
    for (const edge of data.edges) {
      if (!nodeConnections[edge.source]) nodeConnections[edge.source] = 0;
      if (!nodeConnections[edge.target]) nodeConnections[edge.target] = 0;
      nodeConnections[edge.source]++;
      nodeConnections[edge.target]++;
    }
  }
  
  // 第一步：创建全部元素
  const elements = [];
  const maxBatchSize = 1000; // 元素批处理最大数量
  
  // 批量处理节点
  if (data.nodes) {
    const nodeBatches = [];
    let currentBatch = [];
    
    for (const node of data.nodes) {
      // 如果需要预筛选，检查该节点是否要保留
      if (preFilter) {
        const isSecondary = node.group === "secondary";
        const connections = nodeConnections[node.id] || 0;
        
        // 如果是次要节点且只有一个连接，则跳过
        if (isSecondary && connections <= 1) {
          continue;
        }
      }
      
      // 确保使用name作为label，如果没有name则使用id
      const nodeLabel = node.name || node.data?.name || node.id || '未命名';
      
      currentBatch.push({
        data: {
          id: node.id,
          label: nodeLabel,
          nodeType: node.group || 'primary', // 保留原始类型为nodeType
          ...node.data
        },
        group: 'nodes'
      });
      
      // 达到批处理数量时，添加到最终元素列表
      if (currentBatch.length >= maxBatchSize) {
        nodeBatches.push(currentBatch);
        currentBatch = [];
      }
    }
    
    // 添加最后一批节点
    if (currentBatch.length > 0) {
      nodeBatches.push(currentBatch);
    }
    
    // 将所有批次添加到元素列表
    nodeBatches.forEach(batch => {
      elements.push(...batch);
    });
  }
  
  // 批量处理边 - 新增边重复检测
  if (data.edges) {
    const edgeBatches = [];
    let currentBatch = [];
    
    // 创建一个集合来跟踪已处理的边连接
    const processedEdges = new Set();
    
    for (const edge of data.edges) {
      // 如果需要预筛选，检查边的源节点和目标节点是否都保留
      if (preFilter) {
        const sourceNodeConnection = nodeConnections[edge.source] || 0;
        const targetNodeConnection = nodeConnections[edge.target] || 0;
        
        // 检查边的两端节点是否在筛选后的节点列表中
        const sourceIsSecondary = data.nodes.find(n => n.id === edge.source)?.group === "secondary";
        const targetIsSecondary = data.nodes.find(n => n.id === edge.target)?.group === "secondary";
        
        // 如果边的一端是次要节点且只有一个连接，则跳过
        if ((sourceIsSecondary && sourceNodeConnection <= 1) || 
            (targetIsSecondary && targetNodeConnection <= 1)) {
          continue;
        }
      }
      
      // 创建边的唯一标识
      // 按字母排序节点ID确保相同两个节点之间的边始终使用相同的标识
      const nodesPair = [edge.source, edge.target].sort().join('-');
      
      // 检查这条边是否已经处理过
      if (processedEdges.has(nodesPair)) {
        continue; // 跳过已处理的边
      }
      
      // 将这条边标记为已处理
      processedEdges.add(nodesPair);
      
      // 确定边的方向
      // 可以根据需要修改这个逻辑，例如根据节点类型或连接数决定方向
      let source = edge.source;
      let target = edge.target;
      
      // 默认让ID字母序较小的节点作为源节点（或使用其他逻辑）
      if (edge.source > edge.target) {
        source = edge.target;
        target = edge.source;
      }
      
      // 转换关系类型为中文
      let relationLabel = '';  // 默认空标签，不显示
      
      currentBatch.push({
        data: {
          id: edge.id || `${source}-${target}`,
          source: source,
          target: target,
          label: relationLabel,
          weight: edge.weight || 1,
          relationType: edge.label || '', // 保留原始关系类型
          ...edge.data
        },
        group: 'edges'
      });
      
      // 达到批处理数量时，添加到最终元素列表
      if (currentBatch.length >= maxBatchSize) {
        edgeBatches.push(currentBatch);
        currentBatch = [];
      }
    }
    
    // 添加最后一批边
    if (currentBatch.length > 0) {
      edgeBatches.push(currentBatch);
    }
    
    // 将所有批次添加到元素列表
    edgeBatches.forEach(batch => {
      elements.push(...batch);
    });
  }
  
  console.timeEnd('生成图谱元素');
  console.log(`生成了 ${elements.filter(el => el.group !== 'edges').length} 个节点和 ${elements.filter(el => el.group === 'edges').length} 条边`);
  
  return elements;
}

/**
 * 筛选掉孤立节点
 * @param {Array} elements - 图谱元素
 * @returns {Array} 筛选后的元素
 */
export function filterIsolatedNodes(elements) {
  if (!elements || elements.length === 0) return [];
  
  // 获取所有节点和边
  const nodes = elements.filter(el => el.group !== 'edges');
  const edges = elements.filter(el => el.group === 'edges');
  
  // 找出非孤立节点
  const connectedNodeIds = new Set();
  edges.forEach(edge => {
    connectedNodeIds.add(edge.data.source);
    connectedNodeIds.add(edge.data.target);
  });
  
  // 筛选非孤立节点
  const nonIsolatedNodes = nodes.filter(node => connectedNodeIds.has(node.data.id));
  
  // 返回非孤立节点和所有边
  return [...nonIsolatedNodes, ...edges];
}

/**
 * 根据ID获取学者信息
 * @param {string} scholarId - 学者ID
 * @returns {Promise<Object>} 学者信息
 */
export async function getScholarById(scholarId) {
  try {
    const response = await fetchScholarDetails(scholarId);
    if (response.success && response.scholar) {
      // 更新缓存
      window.scholars[scholarId] = response.scholar;
      return response.scholar;
    } else {
      throw new Error(response.error || '获取学者信息失败');
    }
  } catch (error) {
    console.error('获取学者信息失败:', error);
    throw error;
  }
} 