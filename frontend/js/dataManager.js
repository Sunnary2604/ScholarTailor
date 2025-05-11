/**
 * ScholarTailor - 数据管理模块
 * 处理数据加载、处理和管理相关的功能
 */

import { getNetworkData, addScholar, getScholarDetails } from "./api.js";
import eventBus from "./eventBus.js";
import adminPanel from "./components/adminPanel.js";
import graphPanel from "./components/graphPanel.js";

// 本地状态管理
const state = {
  scholars: {},
  relationships: [],
  currentScholar: null,
};

/**
 * 初始化数据管理器
 * @param {Object} initialData - 初始数据
 */
export function init(initialData) {
  if (initialData) {
    if (initialData.scholars) {
      state.scholars = { ...initialData.scholars };
    }
    if (initialData.relationships) {
      state.relationships = [...initialData.relationships];
    }
  }

  // 订阅学者更新事件
  eventBus.on("scholar:updated", (scholarData) => {
    updateScholar(scholarData);
  });

  return state;
}

/**
 * 获取所有学者数据
 * @returns {Object} 学者数据
 */
export function getAllScholars() {
  return { ...state.scholars };
}

/**
 * 根据ID获取学者详情，优先从API获取，然后更新缓存
 * @param {string} scholarId - 学者ID
 * @returns {Promise<Object>} - 学者详情对象
 */
export async function getScholarById(scholarId) {
  console.log(`获取学者详情: ${scholarId}`);

  if (!scholarId) {
    console.error("获取学者详情失败: 缺少学者ID");
    return null;
  }

  try {
    // 首先尝试从API获取最新详情
    const result = await getScholarDetails(scholarId);

    if (result.success && result.scholar) {
      const scholar = result.scholar;

      // 确保scholar_id存在
      if (!scholar.id && scholar.scholar_id) {
        scholar.id = scholar.scholar_id;
      } else if (!scholar.scholar_id && scholar.id) {
        scholar.scholar_id = scholar.id;
      }

      // 确保必要字段存在
      if (!scholar.nodeType) {
        scholar.nodeType = scholar.is_main_scholar ? "primary" : "secondary";
      }

      if (!scholar.tags) {
        scholar.tags = [];
      }

      if (!scholar.publications) {
        scholar.publications = [];
      }

      if (!scholar.related_scholars) {
        scholar.related_scholars = [];
      }

      // 更新缓存
      cacheScholar(scholar);
      console.log(`学者详情获取成功: ${scholarId}`);

      return scholar;
    } else {
      console.error(`学者详情API调用失败: ${result.error || "未知错误"}`);
      // 尝试从已有数据缓存中获取
      const cachedScholar = findScholarsById(scholarId);
      if (cachedScholar) {
        console.log(`使用缓存数据: ${scholarId}`);
        return cachedScholar;
      }

      return null;
    }
  } catch (error) {
    console.error(`获取学者详情时出错: ${error}`);
    // 尝试从已有数据缓存中获取
    const cachedScholar = findScholarsById(scholarId);
    if (cachedScholar) {
      console.log(`使用缓存数据: ${scholarId}`);
      return cachedScholar;
    }

    return null;
  }
}

/**
 * 更新学者数据
 * @param {Object} scholarData - 学者数据
 */
export function updateScholar(scholarData) {
  if (!scholarData || !scholarData.id) {
    console.error("更新学者数据失败: 无效的学者数据");
    return;
  }

  // 更新本地状态
  state.scholars[scholarData.id] = { ...scholarData };

  // 保持全局状态同步（兼容旧代码）
  if (window.scholars) {
    window.scholars[scholarData.id] = { ...scholarData };
  }

  // 如果是当前学者，更新当前学者状态
  if (state.currentScholar && state.currentScholar.id === scholarData.id) {
    state.currentScholar = { ...scholarData };
  }

  // 发布学者数据更新事件
  eventBus.emit("data:scholarUpdated", scholarData);
}

/**
 * 设置当前选中的学者
 * @param {Object|string} scholarOrId - 学者对象或ID
 */
export async function setCurrentScholar(scholarOrId) {
  try {
    let scholar;

    if (typeof scholarOrId === "string") {
      // 如果传入的是ID，获取完整数据
      scholar = await getScholarById(scholarOrId);
    } else if (scholarOrId && scholarOrId.id) {
      // 如果是对象且有ID，则使用该对象
      scholar = scholarOrId;
    } else {
      // 清除当前学者
      state.currentScholar = null;
      eventBus.emit("data:currentScholarChanged", null);
      return;
    }

    // 更新当前学者
    state.currentScholar = scholar;

    // 发布事件通知其他组件
    eventBus.emit("data:currentScholarChanged", scholar);
  } catch (error) {
    console.error("设置当前学者失败:", error);
    state.currentScholar = null;
    eventBus.emit("data:currentScholarChanged", null);
  }
}

/**
 * 获取当前选中的学者
 * @returns {Object|null} 当前学者数据
 */
export function getCurrentScholar() {
  return state.currentScholar;
}

/**
 * 获取所有学者选项（用于下拉菜单等）
 * @returns {Array} 学者选项数组
 */
export function getScholarOptions(onDataLoaded) {
  // 获取所有学者数据
  const scholars = state.scholars || window.scholars || {};

  // 准备学者选项数据
  const scholarOptions = Object.entries(scholars).map(([id, scholar]) => ({
    id,
    name: scholar.name,
    nodeType: scholar.nodeType || "secondary",
  }));

  // 调用回调函数处理加载的数据
  if (typeof onDataLoaded === "function") {
    onDataLoaded(scholarOptions);
  }

  return scholarOptions;
}

/**
 * 加载数据
 * @returns {Promise<Object>} 加载的数据
 */
export async function loadData() {
  try {
    const data = await getNetworkData();
    // 添加详细的数据日志
    console.log("=== loadData 函数接收到的数据 ===");
    console.log("节点总数:", data.nodes ? data.nodes.length : 0);
    console.log(
      "主要节点数:",
      data.nodes ? data.nodes.filter((n) => n.group === "primary").length : 0
    );
    console.log(
      "次要节点数:",
      data.nodes ? data.nodes.filter((n) => n.group === "secondary").length : 0
    );
    console.log("边总数:", data.edges ? data.edges.length : 0);
    return data;
  } catch (error) {
    console.error("加载数据失败:", error);
    throw error;
  }
}

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

      // 统一字段名，确保有citations字段
      if (
        node.data.citedby !== undefined &&
        node.data.citations === undefined
      ) {
        node.data.citations = node.data.citedby;
      }

      window.scholars[node.id] = node.data;
      // 同时更新内部状态
      state.scholars[node.id] = node.data;
    }
  }

  // 再处理关联学者(secondary)，只添加不存在的学者
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

      // 统一字段名，确保有citations字段
      if (
        node.data.citedby !== undefined &&
        node.data.citations === undefined
      ) {
        node.data.citations = node.data.citedby;
      }

      window.scholars[node.id] = node.data;
      // 同时更新内部状态
      state.scholars[node.id] = node.data;
    }
  }

  // 找出并缓存自定义关系
  if (data.edges) {
    const customRelationships = data.edges.filter(
      (edge) => edge.label !== "coauthor" || (edge.data && edge.data.is_custom)
    );

    window.customRelationships.push(...customRelationships);

    // 同时更新内部状态
    state.relationships = [...customRelationships];
  }

  console.log(`已缓存 ${Object.keys(window.scholars).length} 位学者数据`);

  // 发布数据更新事件
  eventBus.emit("data:scholarsUpdated", state.scholars);
}

/**
 * 重新加载数据
 * @returns {Promise<boolean>} 是否重新加载成功
 */
export async function reloadData() {
  try {
    console.log("DEBUGTAG: 开始reloadData函数");
    // 显示加载状态
    const statusElement = document.getElementById("data-status");
    if (statusElement) {
      statusElement.textContent = "正在加载数据...";
      statusElement.style.display = "block";
    }

    // 从API获取最新网络数据
    console.log("DEBUGTAG: 开始从API获取最新网络数据");
    const newData = await loadData();
    console.log("DEBUGTAG: 获取网络数据完成", {
      节点数量: newData?.nodes?.length || 0,
      边数量: newData?.edges?.length || 0,
    });

    // 检查边的关系类型
    if (newData && newData.edges) {
      console.log("DEBUGTAG: 检查边的关系类型...");
      // 统计每种关系类型的数量
      const relationCounts = {};
      newData.edges.forEach((edge) => {
        const relationType = edge.label || "unknown";
        relationCounts[relationType] = (relationCounts[relationType] || 0) + 1;
      });
      console.log("DEBUGTAG: 关系类型统计:", relationCounts);
    }

    // 更新缓存
    console.log("DEBUGTAG: 更新学者缓存");
    cacheScholars(newData);
    console.log(
      "DEBUGTAG: 学者缓存更新完成，数量:",
      Object.keys(state.scholars).length
    );

    // 更新管理面板数据
    loadAdminPanelData();

    // 检查图谱实例是否存在
    if (!window.cy) {
      console.error("DEBUGTAG: 图谱实例不存在，无法重新加载数据");
      if (statusElement) {
        statusElement.textContent = "图谱未初始化，无法加载数据";
        statusElement.style.display = "block";
      }
      return false;
    }

    // 检查孤立节点开关状态
    const isolatedToggle = document.getElementById("toggle-isolated");
    // 修改为默认显示孤立节点，除非用户明确要求不显示
    const shouldShowIsolatedNodes = isolatedToggle
      ? isolatedToggle.checked
      : true;

    // 记录日志
    console.log(`DEBUGTAG: 是否显示孤立节点: ${shouldShowIsolatedNodes}`);

    // 重建图谱，根据孤立节点开关状态决定是否预筛选孤立节点
    console.log("DEBUGTAG: 开始重建图谱");
    window.cy.elements().remove();
    if (!shouldShowIsolatedNodes) {
      // 如果不显示孤立节点，使用预过滤的元素
      console.log("DEBUGTAG: 过滤孤立节点后添加元素");
      const filteredElements = filterIsolatedNodes(getGraphElements(newData));
      window.cy.add(filteredElements);
    } else {
      // 显示所有节点
      console.log("DEBUGTAG: 添加所有图谱元素");
      window.cy.add(getGraphElements(newData));
    }

    // 应用布局
    try {
      console.log("DEBUGTAG: 应用图谱布局");
      graphPanel.applyLayout();
      console.log("DEBUGTAG: 图谱布局应用完成");

      // 显示加载完成状态
      if (statusElement) {
        statusElement.textContent = "数据加载完成";
        setTimeout(() => {
          statusElement.style.display = "none";
        }, 2000);
      }
    } catch (layoutError) {
      console.error("DEBUGTAG: 应用布局失败:", layoutError);
      // 即使布局失败，也返回true表示数据已加载
      if (statusElement) {
        statusElement.textContent = "数据已加载，但布局应用失败";
        setTimeout(() => {
          statusElement.style.display = "none";
        }, 3000);
      }
    }

    // 发布数据加载完成事件
    console.log("DEBUGTAG: 发布data:reloadCompleted事件");
    eventBus.emit("data:reloadCompleted", newData);
    console.log("DEBUGTAG: reloadData函数完成，返回true");

    return true;
  } catch (error) {
    console.error("DEBUGTAG: 重新加载数据失败:", error);
    adminPanel.showStatus("重新加载数据失败: " + error.message, "error");

    // 显示错误状态
    const statusElement = document.getElementById("data-status");
    if (statusElement) {
      statusElement.textContent = "数据加载失败";
      statusElement.style.display = "block";
      setTimeout(() => {
        statusElement.style.display = "none";
      }, 3000);
    }

    return false;
  }
}

/**
 * 加载管理面板数据
 */
export function loadAdminPanelData() {
  // 更新学者统计
  const primaryCount = Object.values(state.scholars).filter(
    (s) => s.nodeType === "primary"
  ).length;
  const secondaryCount = Object.values(state.scholars).filter(
    (s) => s.nodeType === "secondary"
  ).length;

  // 更新UI显示
  const statsElement = document.getElementById("scholar-stats");
  if (statsElement) {
    statsElement.textContent = `主要学者: ${primaryCount} | 关联学者: ${secondaryCount}`;
  }
}

/**
 * 从数据创建图谱元素
 * @param {Object} data - 网络数据 {nodes, edges}
 * @param {boolean} preFilter - 是否预先过滤节点
 * @param {boolean} hideNotInterested - 是否隐藏不感兴趣的学者，默认为true
 * @returns {Array} 图谱元素数组
 */
export function getGraphElements(
  data,
  preFilter = true,
  hideNotInterested = true
) {
  if (!data) return [];

  console.time("生成图谱元素");
  console.log("=== getGraphElements 函数开始处理数据 ===");
  console.log("接收的数据节点总数:", data.nodes ? data.nodes.length : 0);
  console.log("接收的数据边总数:", data.edges ? data.edges.length : 0);
  console.log("是否隐藏不感兴趣的学者:", hideNotInterested);

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
      // 跳过被标记为"不感兴趣"的学者节点（is_main_scholar=2），如果hideNotInterested为true
      if (hideNotInterested && node.data && node.data.is_main_scholar === 2) {
        console.log(
          `跳过不感兴趣学者节点: ${node.id} (${
            node.name || node.data?.name || "未命名"
          })`
        );
        continue;
      }

      // 确保使用name作为label，如果没有name则使用id
      const nodeLabel = node.name || node.data?.name || node.id || "未命名";

      // 处理学者类型
      let nodeType = node.group || "primary";

      // 如果有is_main_scholar属性，根据它确定节点类型
      if (node.data && node.data.is_main_scholar !== undefined) {
        if (node.data.is_main_scholar === 1) {
          nodeType = "primary";
        } else if (node.data.is_main_scholar === 0) {
          nodeType = "secondary";
        }
      }

      currentBatch.push({
        data: {
          id: node.id,
          label: nodeLabel,
          nodeType: nodeType,
          ...node.data,
        },
        group: "nodes",
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
    nodeBatches.forEach((batch) => {
      elements.push(...batch);
    });
  }

  // 批量处理边 - 新增边重复检测
  if (data.edges) {
    const edgeBatches = [];
    let currentBatch = [];

    // 创建一个Map来存储节点对之间的所有关系
    const edgeMap = new Map();

    // 关系类型优先级
    const relationPriority = {
      advisor: 1,
      colleague: 2,
      coauthor: 3,
    };

    // 第一遍遍历：收集所有边的信息
    for (const edge of data.edges) {
      // 检查源节点和目标节点是否存在于元素列表中
      // 如果节点是不感兴趣的学者（已被跳过），则跳过相关的边
      const sourceNode = elements.find((el) => el.data.id === edge.source);
      const targetNode = elements.find((el) => el.data.id === edge.target);

      if (!sourceNode || !targetNode) {
        console.log(
          `跳过边 ${edge.source}-${edge.target}，因为至少有一个端点不存在于图中`
        );
        continue;
      }

      // 创建边的唯一标识（按字母顺序排序节点ID）
      const [node1, node2] = [edge.source, edge.target].sort();
      const edgeKey = `${node1}-${node2}`;

      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          source: edge.source,
          target: edge.target,
          relations: new Set(),
          weights: new Map(),
          highestPriorityType: null,
        });
      }

      const edgeInfo = edgeMap.get(edgeKey);
      const relationType = edge.label || "";
      edgeInfo.relations.add(relationType);
      edgeInfo.weights.set(relationType, edge.weight || 1);

      // 更新最高优先级的关系类型
      if (
        !edgeInfo.highestPriorityType ||
        relationPriority[relationType] <
          relationPriority[edgeInfo.highestPriorityType]
      ) {
        console.log(
          `更新边 ${edgeKey} 的关系类型优先级: ${edgeInfo.highestPriorityType} -> ${relationType}`
        );
        edgeInfo.highestPriorityType = relationType;
      }
    }

    // 第二遍遍历：根据优先级创建边
    for (const [edgeKey, edgeInfo] of edgeMap) {
      // 使用最高优先级的关系类型
      const relationType = edgeInfo.highestPriorityType || "coauthor";
      const weight = edgeInfo.weights.get(relationType) || 1;

      // 记录关系类型和所有关系
      console.log(
        `创建边 ${edgeKey}，主要关系: ${relationType}, 所有关系: [${Array.from(
          edgeInfo.relations
        ).join(", ")}]`
      );

      // 创建边对象
      currentBatch.push({
        data: {
          id: edgeKey,
          source: edgeInfo.source,
          target: edgeInfo.target,
          label: "", // 默认不显示标签
          weight: weight,
          relationType: relationType,
          allRelations: Array.from(edgeInfo.relations), // 保存所有关系类型
        },
        group: "edges",
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
    edgeBatches.forEach((batch) => {
      elements.push(...batch);
    });
  }

  console.timeEnd("生成图谱元素");
  console.log(
    `最终生成了 ${
      elements.filter((el) => el.group !== "edges").length
    } 个节点和 ${elements.filter((el) => el.group === "edges").length} 条边`
  );

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
  const nodes = elements.filter((el) => el.group !== "edges");
  const edges = elements.filter((el) => el.group === "edges");

  // 找出非孤立节点
  const connectedNodeIds = new Set();
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.data.source);
    connectedNodeIds.add(edge.data.target);
  });

  // 筛选非孤立节点
  const nonIsolatedNodes = nodes.filter((node) =>
    connectedNodeIds.has(node.data.id)
  );

  // 返回非孤立节点和所有边
  return [...nonIsolatedNodes, ...edges];
}

/**
 * 使用后端过滤的数据更新网络
 * @param {Object} networkData - 已经过滤的网络数据
 * @param {Object} filterOptions - 筛选选项（可选）
 * @returns {boolean} 更新是否成功
 */
export function updateNetworkWithFilteredData(networkData, filterOptions = {}) {
  if (!window.cy) {
    console.error("无法更新网络，cytoscapeJS实例未初始化");
    return false;
  }

  if (!networkData) {
    console.error("网络数据为空");
    return false;
  }

  try {
    console.log("使用过滤后的数据更新网络:", networkData);
    console.log("过滤选项:", filterOptions);

    // 创建新的图谱元素 - 传递hideNotInterested参数
    const hideNotInterested =
      filterOptions.hideNotInterested !== undefined
        ? filterOptions.hideNotInterested
        : true;

    const elements = getGraphElements(networkData, true, hideNotInterested);

    // 更新图谱
    window.cy.elements().remove();
    window.cy.add(elements);

    // 如果节点数量过少，应用特殊布局
    if (elements.length < 20) {
      console.log("节点数量较少，应用circle布局");
      window.cy
        .layout({
          name: "circle",
          animate: true,
          animationDuration: 500,
        })
        .run();
    } else {
      console.log("应用fcose布局");
      // 应用fcose布局
      window.cy
        .layout({
          name: "fcose",
          animationDuration: 1000,
          quality: "proof",
          animate: true,
        })
        .run();
    }

    // 触发图谱更新事件
    eventBus.emit("graph:updated", {
      nodeCount: window.cy.nodes().length,
      edgeCount: window.cy.edges().length,
    });

    return true;
  } catch (error) {
    console.error("更新网络时出错:", error);
    return false;
  }
}

/**
 * 添加新学者
 * @param {Object} scholarData - 学者数据
 * @returns {Promise<Object>} 添加结果
 */
export async function addNewScholar(scholarData) {
  try {
    const result = await addScholar(scholarData);
    if (result.success) {
      // 更新本地状态
      if (result.scholar && result.scholar.id) {
        state.scholars[result.scholar.id] = result.scholar;

        // 兼容旧代码，同时更新全局变量
        if (window.scholars) {
          window.scholars[result.scholar.id] = result.scholar;
        }

        // 发布学者添加事件
        eventBus.emit("data:scholarAdded", result.scholar);
      }

      adminPanel.showStatus("成功添加新学者", "success");
    } else {
      adminPanel.showStatus("添加学者失败: " + result.message, "error");
    }

    // 直接返回完整结果而不是布尔值
    return result;
  } catch (error) {
    console.error("添加新学者失败:", error);
    adminPanel.showStatus("添加新学者失败: " + error.message, "error");
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 缓存单个学者数据
 * @param {Object} scholar - 学者详细数据
 */
export function cacheScholar(scholar) {
  if (!scholar || !scholar.id) {
    console.warn("无法缓存学者数据: 缺少学者ID");
    return;
  }

  const scholarId = scholar.id;

  // 更新内部缓存
  state.scholars[scholarId] = scholar;

  // 更新全局变量，以兼容旧代码
  if (window.scholars) {
    window.scholars[scholarId] = scholar;
  }

  console.log(`学者数据已缓存: ${scholarId}`);
}

/**
 * 查找缓存中的学者数据
 * @param {string} scholarId - 学者ID
 * @returns {Object|null} 学者数据或null
 */
export function findScholarsById(scholarId) {
  if (!scholarId) return null;

  // 优先从内部状态获取
  if (state.scholars[scholarId]) {
    return state.scholars[scholarId];
  }

  // 从全局变量获取
  if (window.scholars && window.scholars[scholarId]) {
    // 同步到内部状态
    state.scholars[scholarId] = window.scholars[scholarId];
    return window.scholars[scholarId];
  }

  return null;
}

// 导出状态对象（只读），用于测试和调试
export const getState = () => ({ ...state });
