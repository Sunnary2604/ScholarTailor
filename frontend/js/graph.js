/**
 * ScholarTailor - 图谱模块
 * 处理图谱相关的功能，包括初始化、事件监听和布局控制
 */

import { getGraphElements } from "./data.js";
import { updateDetailPanel, clearDetailPanel } from "./ui.js";

// 初始化图谱相关的变量
const NODE_SIZE = {
  MIN: 15,
  MAX: 35,
  PRIMARY_FACTOR: 1.3,
  SECONDARY_FACTOR: 0.8,
};

/**
 * 初始化图谱
 * @param {string} containerId - 图谱容器ID
 * @param {Object} data - 图谱数据
 * @param {Object} perfOptions - 性能选项
 * @returns {Object} - cytoscape实例
 */
export function initGraph(containerId, data, perfOptions = {}) {
  // 检查容器元素是否存在
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`错误: 找不到图谱容器 (id="${containerId}")`);
    return null;
  }

  // 检查DOM元素大小
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;

  if (containerWidth < 10 || containerHeight < 10) {
    console.warn(
      `警告: 图谱容器尺寸过小 (${containerWidth}x${containerHeight})`
    );
    // 强制设置最小尺寸
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.minHeight = "500px";
  }

  // 设置cytoscape的性能选项
  const cyPerfOptions = {
    styleEnabled: true, // 如果设为false会大幅提高性能，但会禁用所有样式
    hideEdgesOnViewport: true, // 在视图移动时隐藏边以提高性能
    hideLabelsOnViewport: true, // 在视图移动时隐藏标签以提高性能
    textureOnViewport: true, // 在视图移动时使用纹理渲染以提高性能
    motionBlur: false, // 关闭运动模糊以提高性能
    wheelSensitivity: 0.3, // 降低滚轮灵敏度，避免快速缩放导致的卡顿
    ...perfOptions,
  };

  try {
    // 创建图谱实例
    const cyInstance = cytoscape({
      container: container,
      elements: getGraphElements(data),
      style: [
        {
          selector: "node",
          style: {
            "background-color": "rgb(144, 183, 228)", // 柔和的蓝色
            "background-opacity": 0.8, // 明确设置背景透明度
            "border-width": 2,
            "border-color": "rgb(100, 150, 200)", // 更协调的边框色
            label: "data(label)", // 显示label而非id
            "text-valign": "bottom", // 将文本放在节点下方
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "90px", // 增加最大宽度
            "font-size": "11px", // 减小字体大小
            color: "#000000", // 黑色字体
            "text-outline-width": 0, // 移除文本轮廓
            "text-background-color": "#ffffff", // 白色背景
            "text-background-opacity": 0.7, // 半透明背景
            "text-background-shape": "roundrectangle", // 圆角矩形背景
            "text-background-padding": "3px", // 增加边距
            "text-margin-y": 7, // 增加文本与节点的距离
            width: 25, // 减小节点尺寸
            height: 25, // 减小节点尺寸
            padding: "3px",
            shape: "ellipse",
            opacity: 0.9, // 设置整体透明度
          },
        },
        {
          selector: 'node[nodeType="primary"]',
          style: {
            "background-color": "#2e59a7", // 中等蓝色作为主要节点
            "border-width": 2,
            "border-color": "#003d74", // 深蓝色边框
            width: 30, // 减小主要节点尺寸
            height: 30, // 减小主要节点尺寸
            "background-opacity": 1, // 设置整体透明度
            "font-weight": "bold", // 粗体
          },
        },
        {
          selector: 'node[nodeType="secondary"]',
          style: {
            "background-color": "rgb(174, 207, 244)", // 淡蓝色作为次要节点
            "background-opacity": 0.8,
            "border-width": 1,
            "border-color": "rgb(103, 136, 173)", // 中等蓝色边框
            width: 18, // 减小次要节点尺寸
            height: 18, // 减小次要节点尺寸
          },
        },
        {
          selector: "edge",
          style: {
            width: 1, // 适中的宽度
            "line-color": "rgb(180, 180, 180)", // 中等灰色
            "line-opacity": 0.7, // 统一透明度
            "target-arrow-color": "rgb(180, 180, 180)",
            "target-arrow-opacity": 0.7,

            "curve-style": "bezier",
            label: "", // 不显示标签
            "font-size": "10px",
            "text-rotation": "autorotate",
            "text-margin-y": -10,
            "text-background-color": "#fff",
            "text-background-opacity": 0.7,
            "text-background-padding": "3px",
          },
        },
        // 根据关系类型设置不同的边样式
        {
          selector: 'edge[relationType="coauthor"]',
          style: {
            "line-color": "rgb(120, 160, 210)", // 低饱和度蓝色
            "line-opacity": 0.7,
            "target-arrow-color": "rgb(120, 160, 210)",
            "target-arrow-opacity": 0.7,
          },
        },
        {
          selector: 'edge[relationType="advisor"]',
          style: {
            "line-color": "rgb(210, 140, 90)", // 低饱和度橙棕色
            "line-opacity": 0.9,
            "target-arrow-color": "rgb(210, 140, 90)",
            "target-arrow-opacity": 0.7,
          },
        },
        {
          selector: 'edge[relationType="colleague"]',
          style: {
            "line-color": "rgb(120, 180, 140)", // 低饱和度绿色
            "line-opacity": 0.7,
            "target-arrow-color": "rgb(120, 180, 140)",
            "target-arrow-opacity": 0.7,
          },
        },
        // 添加选中状态的样式
        {
          selector: "node.selected",
          style: {
            "border-width": 3,
            "border-color": "#003d74", // 深蓝色边框
            "border-opacity": 1,
            "background-color": "rgb(10, 54, 110)", // 使用主节点颜色
            "background-opacity": 1, // 完全不透明
            "z-index": 999, // 确保选中的节点在最上层
          },
        },
        // 添加悬停状态的样式
        {
          selector: "node.hover",
          style: {
            "border-width": 2,
            "border-color": "#FFFFFF",
            "border-opacity": 0.9,
            "z-index": 998, // 确保悬停的节点在较上层
          },
        },
        // 高亮标签过滤的样式
        {
          selector: "node.highlighted",
          style: {
            "border-width": 2, // 减小边框宽度
            "border-color": "#FF5722",
            "border-opacity": 1,
            "background-color": "#FF5722",
            "z-index": 997, // 确保高亮的节点在较上层
          },
        },
        // 添加主要节点的高亮样式
        {
          selector: 'node[nodeType="primary"].highlighted-neighbor',
          style: {
            "border-width": 3,
            "border-color": "#3F51B5", // 深蓝色边框
            "border-opacity": 1,
            "background-color": "#7992d4", // 较深的蓝色
            "background-opacity": 1, // 完全不透明
            "z-index": 902,
          },
        },
        // 添加次要节点的高亮样式
        {
          selector: 'node[nodeType="secondary"].highlighted-neighbor',
          style: {
            "border-width": 2,
            "border-color": "#7986CB", // 较浅的蓝色边框
            "border-opacity": 1,
            "background-color": "rgb(174, 198, 223)", // 浅蓝色
            "background-opacity": 1, // 完全不透明
            "z-index": 901,
          },
        },
        // 淡化未高亮元素的样式
        {
          selector: ".faded",
          style: {
            opacity: 0.08, // 更淡的背景使高亮更显著
          },
        },
        // 隐藏元素样式
        {
          selector: ".hidden",
          style: {
            display: "none",
          },
        },
        // 筛选元素样式
        {
          selector: ".filtered",
          style: {
            display: "none",
          },
        },
        // 设置选中节点的边样式
        {
          selector: "edge.selected",
          style: {
            width: 2.5,
            "line-color": "rgb(255, 152, 0)", // 与选中节点边框一致
            "line-opacity": 0.85, // 稍微透明
            "target-arrow-color": "rgb(255, 152, 0)",
            "target-arrow-opacity": 0.85,
            "z-index": 998,
          },
        },
        // 设置相邻边的高亮样式
        {
          selector: "edge.highlighted-neighbor",
          style: {
            width: 2,
            "line-color": "rgb(94, 146, 188)", // 协调的蓝色，不太饱和
            "line-opacity": 0.85, // 稍微透明
            "target-arrow-color": "rgb(94, 146, 188)",
            "target-arrow-opacity": 0.85,
            "z-index": 899,
          },
        },
      ],
      layout: getFCoseLayoutOptions(),
      // 应用性能选项
      ...cyPerfOptions,
    });

    // 保存实例到全局变量
    window.cy = cyInstance;

    // 设置事件监听
    setupEventListeners(cyInstance);

    // 应用初始布局
    const layout = cyInstance.elements().layout(getFCoseLayoutOptions());
    layout.run();

    // 调整节点大小
    adjustNodeSizeByConnections(cyInstance);

    console.log("图谱初始化完成");

    return cyInstance;
  } catch (error) {
    console.error("初始化图谱失败:", error);
    return null;
  }
}

/**
 * 获取FCose布局参数，优化防止节点遮挡
 */
export function getFCoseLayoutOptions() {
  return {
    // 添加fcose布局（更优化的力导向布局）
    name: "fcose", // 名称
    quality: "default", // 质量 - 'draft', 'default', 'proof'
    randomize: false, // 是否使用随机初始布局
    animate: true, // 是否使用动画
    animationDuration: 2000, // 动画持续时间
    animationEasing: "ease-in-out", // 动画缓动函数
    fit: true, // 适应视图
    padding: 80, // 填充
    nodeRepulsion: 20000, // 节点间斥力
    idealEdgeLength: 400, // 理想边长
    edgeElasticity: 0.45, // 边的弹性
    nestingFactor: 0.1, // 嵌套因子
    gravity: 0.25, // 重力
    gravityRange: 3.8, // 重力范围
    gravityCompound: 1.0, // 复合重力
    numIter: 5000, // 迭代次数
    initialTemp: 200, // 初始温度
    coolingFactor: 0.95, // 冷却因子
    minTemp: 1.0, // 最小温度
    nodeDimensionsIncludeLabels: true, // 节点尺寸包含标签
    uniformNodeDimensions: false, // 统一节点尺寸
    packComponents: true, // 打包组件
    samplingType: true, // 采样类型
    sampleSize: 100, // 样本大小
    avoidOverlap: true, // 避免重叠
    avoidOverlapPadding: 50, // 避免重叠填充
    // 质量调整
    qualityFactor: 0.9, // 质量因子
    // 组件处理
    componentSpacing: 120, // 组件间距
    // 边长
    nodeEdgeWeightInfluence: 0.5, // 节点边权重影响
  };
}

/**
 * 设置事件监听
 * @param {Object} cyInstance - Cytoscape实例
 */
function setupEventListeners(cyInstance) {
  // 节点点击事件
  cyInstance.on("tap", "node", function (evt) {
    const node = evt.target;
    selectNode(node);
  });

  // 边点击事件
  cyInstance.on("tap", "edge", function (evt) {
    // 忽略边点击，保持最小功能
  });

  // 图谱点击事件（空白处）
  cyInstance.on("tap", function (evt) {
    if (evt.target === cyInstance) {
      // 清除所有状态
      cyInstance.elements().removeClass("selected");
      cyInstance.elements().removeClass("highlighted-neighbor");
      cyInstance.elements().removeClass("faded");
      // 清除详情面板
      clearDetailPanel();
      // 重置活跃节点
      window.activeNodeId = null;
      // 重置缩放
      resetZoom();
    }
  });

  // 节点悬停事件
  cyInstance.on("mouseover", "node", function (evt) {
    const node = evt.target;
    node.addClass("hover");
  });

  cyInstance.on("mouseout", "node", function (evt) {
    const node = evt.target;
    node.removeClass("hover");
  });
}

/**
 * 选择节点
 * @param {Object} node - Cytoscape节点对象
 */
export function selectNode(node) {
  if (!node) return;

  // 如果点击的是当前选中的节点，则取消选择
  if (window.activeNodeId === node.id()) {
    clearNodeSelection();
    resetZoom();
    return;
  }

  // 更新活跃节点ID
  window.activeNodeId = node.id();

  // 高亮选中节点
  window.cy.elements().removeClass("selected");
  window.cy.elements().removeClass("highlighted-neighbor");
  window.cy.elements().addClass("faded");

  // 获取相关节点和连接边
  const connectedEdges = node.connectedEdges();
  const neighborhood = node.neighborhood().nodes(); // 获取相邻节点
  const relatedElements = neighborhood.add(node).add(connectedEdges);

  // 移除相关元素的淡化效果
  relatedElements.removeClass("faded");

  // 高亮选中节点
  node.addClass("selected");

  // 高亮相关节点
  neighborhood.addClass("highlighted-neighbor");

  // 高亮相关边
  connectedEdges.addClass("highlighted-neighbor");

  // 放大到相关区域
  zoomToElements(relatedElements);

  // 构建节点数据，添加相关学者信息
  const nodeData = { ...node.data() };

  // 构建相关学者列表
  if (!nodeData.related_scholars) {
    nodeData.related_scholars = [];

    // 将相邻节点添加到相关学者列表
    neighborhood.forEach((neighborNode) => {
      const neighborData = neighborNode.data();

      // 查找连接这两个节点的边
      const connectingEdge = node.edgesWith(neighborNode);
      let relationship = "关联学者";

      // 如果找到边，获取关系类型
      if (connectingEdge.length > 0) {
        const relationType = connectingEdge[0].data("relationType");
        if (relationType === "coauthor") {
          relationship = "合作者";
        } else if (relationType === "advisor") {
          relationship = "导师";
        } else if (relationType === "colleague") {
          relationship = "同事";
        }
      }

      nodeData.related_scholars.push({
        id: neighborData.id,
        name: neighborData.label || neighborData.name || neighborData.id,
        relationship: relationship,
      });
    });
  }

  // 更新详情面板
  updateDetailPanel(nodeData);
}

/**
 * 放大到指定元素
 * @param {Object} elements - 要放大显示的元素集合
 */
function zoomToElements(elements) {
  if (!elements || elements.length === 0) return;

  // 添加动画过渡
  window.cy.animate({
    fit: {
      eles: elements,
      padding: 50,
    },
    duration: 800,
    easing: "ease-in-out-cubic",
  });
}

/**
 * 重置缩放级别，显示整个图
 */
function resetZoom() {
  window.cy.animate({
    fit: {
      padding: 70,
    },
    duration: 800,
    easing: "ease-in-out-cubic",
  });

  // 移除所有元素的淡化和高亮效果
  window.cy.elements().removeClass("faded");
  window.cy.elements().removeClass("highlighted-neighbor");
}

/**
 * 清除节点选择
 */
function clearNodeSelection() {
  if (!window.activeNodeId) return;

  // 清除活跃节点ID
  window.activeNodeId = null;

  // 清除高亮和淡化
  window.cy.elements().removeClass("selected");
  window.cy.elements().removeClass("highlighted-neighbor");
  window.cy.elements().removeClass("faded");

  // 清除详情面板
  clearDetailPanel();
}

/**
 * 调整节点大小
 * @param {Object} cy - Cytoscape实例
 */
export function adjustNodeSizeByConnections(cy) {
  const cyToUse = cy || window.cy;
  if (!cyToUse) return;

  // 先计算连接数范围
  let maxConnections = 1;
  cyToUse.nodes().forEach((node) => {
    const connections = node.connectedEdges().length;
    maxConnections = Math.max(maxConnections, connections);
  });

  cyToUse.nodes().forEach((node) => {
    const connections = node.connectedEdges().length;
    const nodeType = node.data("nodeType");

    // 节点基础大小
    let minSize = nodeType === "primary" ? 30 : 18;
    let maxSize = nodeType === "primary" ? 50 : 36;

    // 连接数权重因子 (0-1)
    const connectionFactor =
      maxConnections > 1 ? connections / maxConnections : 0;

    // 根据连接数调整尺寸
    const size = minSize + connectionFactor * (maxSize - minSize);

    // 设置节点大小
    node.style({
      width: size,
      height: size,
      "font-size": 10 + connectionFactor * 3, // 根据节点大小调整字体
    });

    // 存储节点的权重到数据中，方便其他地方使用
    node.data("weight", 1 + connectionFactor * 2);
  });
}

/**
 * 布局后优化节点位置
 * @param {Object} cy - Cytoscape实例
 */
export function optimizeNodePositions(cy) {
  if (!cy || cy.nodes().length === 0) {
    console.log("无法优化节点位置：图谱为空");
    return;
  }

  // 延迟执行，确保布局已完全应用
  setTimeout(() => {
    console.log("优化节点显示...");

    try {
      // 调整节点大小，根据连接数动态调整
      adjustNodeSizeByConnections(cy);

      // 为了确保设置生效，触发一次重新渲染
      cy.elements().lock(); // 锁定所有元素位置
      setTimeout(() => {
        cy.elements().unlock(); // 解锁所有元素位置
      }, 100);

      console.log("节点显示优化完成");
    } catch (error) {
      console.error("优化节点显示时出错:", error);
    }
  }, 500); // 延迟500ms执行，确保布局完成
}

/**
 * 重置图谱视图
 */
export function resetGraphViewport() {
  if (!window.cy) return;

  // 清除选中状态
  window.cy.elements().removeClass("selected");
  window.cy.elements().removeClass("highlighted-neighbor");
  window.cy.elements().removeClass("faded");

  // 清除详情面板
  clearDetailPanel();

  // 重置活跃节点
  window.activeNodeId = null;

  // 重置缩放，显示整个图
  window.cy.animate({
    fit: {
      padding: 70,
    },
    duration: 800,
    easing: "ease-in-out-cubic",
  });
}
