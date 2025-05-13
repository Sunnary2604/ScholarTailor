/**
 * ScholarTailor - 图谱面板组件
 * 处理图谱相关功能，包括初始化、布局和事件监听
 */

import { getGraphElements } from "../dataManager.js";
import detailPanel from "./detailPanel.js";
import eventBus from "../eventBus.js";
import { showStatusMessage } from "../utils.js";
import { deleteSingleRelationship } from "../api.js";
import { reloadData } from "../dataManager.js";

// 组件私有状态
const state = {
  cyInstance: null,
  activeNodeId: null,
  isVisible: true,
};

// 节点大小配置
const NODE_SIZE = {
  MIN: 15,
  MAX: 35,
  PRIMARY_FACTOR: 1.3,
  SECONDARY_FACTOR: 0.8,
};

// DOM元素引用
const elements = {
  // 集中管理DOM选择器
  container: () => document.getElementById("cy"),
  resetViewBtn: () => document.getElementById("reset-view-btn"),
  resetLayoutBtn: () => document.getElementById("reset-layout-btn"),
  graphViewBtn: () => document.getElementById("graph-view-btn"),
};

/**
 * 获取FCose布局参数
 * @returns {Object} - 布局参数配置
 */
function getFCoseLayoutOptions() {
  return {
    name: "fcose", // 名称
    quality: "default", // 质量 - 'draft', 'default', 'proof'
    randomize: true, // 是否使用随机初始布局
    animate: true, // 是否使用动画
    animationDuration: 2000, // 动画持续时间
    animationEasing: "ease-in-out", // 动画缓动函数
    fit: true, // 适应视图
    padding: 80, // 填充
    nodeRepulsion: 12000, // 节点间斥力
    idealEdgeLength: 300, // 理想边长
    nestingFactor: 0.1, // 嵌套因子
    gravity: 0.5, // 重力
    gravityRange: 4, // 重力范围
    numIter: 5000, // 迭代次数
    initialTemp: 100, // 初始温度
    coolingFactor: 0.99, // 冷却因子
    minTemp: 1.0, // 最小温度
    nodeDimensionsIncludeLabels: true, // 节点尺寸包含标签
    uniformNodeDimensions: false, // 统一节点尺寸
    packComponents: true, // 打包组件
    samplingType: true, // 采样类型
    sampleSize: 100, // 样本大小
    avoidOverlap: true, // 避免重叠
    avoidOverlapPadding: 50, // 避免重叠填充
    nodeEdgeWeightInfluence: 0.5, // 节点边权重影响
  };
}

/**
 * 初始化图谱
 * @param {string} containerId - 图谱容器ID
 * @param {Object} data - 图谱数据
 * @param {Object} perfOptions - 性能选项
 * @returns {Object} - cytoscape实例
 */
function initGraph(containerId, data, perfOptions = {}) {
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
            "background-opacity": 1,

            opacity: 1,
            "border-width": 1,
            "border-color": "rgb(103, 136, 173)", // 中等蓝色边框
            width: 18, // 减小次要节点尺寸
            height: 18, // 减小次要节点尺寸
          },
        },
        {
          selector:
            'node[nodeType="not-interested"], node[group="not-interested"]',
          style: {
            "background-color": "rgb(180, 180, 180)", // 灰色作为不感兴趣的节点
            "background-opacity": 0.6,
            "border-width": 1,
            "border-color": "rgb(130, 130, 130)", // 深灰色边框
            width: 16, // 更小的节点尺寸
            height: 16, // 更小的节点尺寸
            color: "#777", // 文字颜色更浅
            "text-opacity": 0.7, // 文字更透明
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
            "line-opacity": 0.6,
            "target-arrow-color": "rgb(120, 160, 210)",
       
          },
        },
        {
          selector: 'edge[relationType="advisor"]',
          style: {
            "line-color": "rgb(255, 149, 78)", // 低饱和度橙棕色
            "line-opacity": 0.9,
            "target-arrow-color": "rgb(255, 149, 78)",
            "target-arrow-opacity": 0.7,
            "target-arrow-shape": "triangle", // 添加箭头
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
            "border-color": "#FF5722",
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
            "line-opacity": 0.85, // 稍微透明
            "target-arrow-opacity": 0.85,
            "z-index": 899,
          },
        },
        // 根据关系类型设置不同的高亮边样式 - coauthor
        {
          selector: 'edge[relationType="coauthor"].highlighted-neighbor',
          style: {
            "line-color": "rgb(120, 160, 210)", // 保持与原始颜色一致
            "target-arrow-color": "rgb(120, 160, 210)",
          },
        },
        // 根据关系类型设置不同的高亮边样式 - advisor
        {
          selector: 'edge[relationType="advisor"].highlighted-neighbor',
          style: {
            "line-color": "rgb(255, 149, 78)", // 保持与原始颜色一致
            "target-arrow-color": "rgb(255, 149, 78)",
            "target-arrow-shape": "triangle", // 确保高亮状态下也有箭头
          },
        },
        // 根据关系类型设置不同的高亮边样式 - colleague
        {
          selector: 'edge[relationType="colleague"].highlighted-neighbor',
          style: {
            "line-color": "rgb(120, 180, 140)", // 保持与原始颜色一致
            "target-arrow-color": "rgb(120, 180, 140)",
          },
        },
      ],
      layout: getFCoseLayoutOptions(),
      // 应用性能选项
      ...cyPerfOptions,
    });

    // 保存实例到状态和全局变量
    state.cyInstance = cyInstance;
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
    // 点击时不处理，在右键点击时才显示菜单
  });

  // 边右键点击事件 - 只在边上阻止默认菜单，并显示自定义菜单
  cyInstance.on("cxttap", "edge", function (evt) {
    const edge = evt.target;

    // 阻止默认的浏览器右键菜单
    if (evt.originalEvent) {
      evt.originalEvent.preventDefault();
      evt.originalEvent.stopPropagation();
      console.log("已阻止边上的浏览器默认右键菜单");
    }

    // 获取边的数据
    const sourceId = edge.source().id();
    const targetId = edge.target().id();
    const relationType = edge.data("relationType") || "coauthor";
    const sourceName = edge.source().data("label") || sourceId;
    const targetName = edge.target().data("label") || targetId;

    // 显示右键菜单
    showEdgeContextMenu(evt.renderedPosition, {
      sourceId,
      targetId,
      relationType,
      sourceName,
      targetName,
    });
  });

  // 图谱点击事件（空白处）
  cyInstance.on("tap", function (evt) {
    if (evt.target === cyInstance) {
      // 清除所有状态
      cyInstance.elements().removeClass("selected");
      cyInstance.elements().removeClass("highlighted-neighbor");
      cyInstance.elements().removeClass("faded");
      // 清除详情面板
      detailPanel.clear();
      // 重置活跃节点
      state.activeNodeId = null;
      window.activeNodeId = null;
      // 重置缩放
      resetZoom();

      // 隐藏边上下文菜单
      // hideEdgeContextMenu();
    }
  });

  // 图谱右键点击事件（空白处或节点）- 不阻止默认菜单
  cyInstance.on("cxttap", function (evt) {
    // 如果点击的是边，事件会被边的cxttap事件处理器拦截
    // 所以这里只会处理空白处或节点的右键点击
    // 在空白处或节点上不禁用浏览器默认菜单
    // 所以这里不需要阻止默认事件
    // 隐藏之前可能显示的边菜单
    // hideEdgeContextMenu();
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

  // 设置布局控制按钮
  const resetLayoutBtn = elements.resetLayoutBtn();
  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener("click", function () {
      resetLayoutBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> 应用中...';
      resetLayoutBtn.disabled = true;

      // 应用最优布局
      applyOptimalLayout(resetLayoutBtn);
    });
  }

  // 重置视图按钮
  const resetViewBtn = elements.resetViewBtn();
  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", function () {
      resetGraphViewport();
    });
  }

  // 返回全局视图按钮
  const graphViewBtn = elements.graphViewBtn();
  if (graphViewBtn) {
    graphViewBtn.addEventListener("click", function () {
      state.cyInstance.nodes().removeClass("highlighted faded");
      resetZoom();
      graphViewBtn.classList.add("hidden");
    });
  }
}

/**
 * 应用最优布局设置
 * @param {HTMLElement} [button] - 可选的按钮元素，用于在布局完成后恢复状态
 * @returns {Object} 布局实例
 */
function applyOptimalLayout(button = null) {
  if (!state.cyInstance) {
    console.error("无法应用布局：图谱实例未初始化");
    return null;
  }

  // 应用fcose布局
  const layout = state.cyInstance.elements().layout(getFCoseLayoutOptions());

  // 启动布局
  layout.run();

  // 等待布局完成后调整节点大小并恢复按钮状态
  if (layout && layout.on) {
    layout.on("layoutstop", function () {
      // 布局完成后调整节点大小
      adjustNodeSizeByConnections();

      // 如果提供了按钮，恢复按钮状态
      if (button) {
        button.innerHTML = '<i class="fas fa-sync-alt"></i> 重新布局';
        button.disabled = false;

        // 显示成功消息
        showStatusMessage("布局已重新应用", "success");
      }
    });
  } else {
    // 如果layout对象未正确返回，直接调整节点大小
    setTimeout(function () {
      // 尝试调整节点大小
      adjustNodeSizeByConnections();

      // 如果提供了按钮，恢复按钮状态
      if (button) {
        button.innerHTML = '<i class="fas fa-sync-alt"></i> 重新布局';
        button.disabled = false;
      }
    }, 1000);
  }

  return layout;
}

/**
 * 应用指定的布局
 * @param {string} layoutName - 布局名称
 * @returns {Object} - 布局实例
 */
function applyLayout(layoutName = "fcose") {
  if (!state.cyInstance) {
    console.error("无法应用布局：图谱实例未初始化");
    return null;
  }

  // 对于fcose布局，使用优化的applyOptimalLayout函数
  if (layoutName === "fcose") {
    return applyOptimalLayout();
  }

  // 对于其他布局，使用原有逻辑
  const layoutConfig = getFCoseLayoutOptions();
  layoutConfig.name = layoutName;

  // 配置动画
  layoutConfig.animate = true;
  layoutConfig.animationDuration = 800;
  layoutConfig.animationEasing = "ease-in-out";

  console.log("应用布局:", layoutName);

  // 应用布局到可见元素
  const visibleElements = state.cyInstance.elements().not(".hidden");
  const layout = visibleElements.layout(layoutConfig);

  // 启动布局
  layout.run();

  return layout;
}

/**
 * 选择节点
 * @param {Object} node - Cytoscape节点对象
 */
function selectNode(node) {
  if (!node) return;

  // 如果点击的是当前选中的节点，则取消选择
  if (state.activeNodeId === node.id()) {
    clearNodeSelection();
    resetZoom();
    return;
  }

  // 更新活跃节点ID
  state.activeNodeId = node.id();
  window.activeNodeId = node.id();

  // 高亮选中节点
  state.cyInstance.elements().removeClass("selected");
  state.cyInstance.elements().removeClass("highlighted-neighbor");
  state.cyInstance.elements().addClass("faded");

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

  // 获取节点基本数据
  const nodeData = { ...node.data() };

  // 只有在nodeData中没有related_scholars字段时才构建相关学者数据
  if (!nodeData.related_scholars || nodeData.related_scholars.length === 0) {
    console.log("构建节点的相关学者数据");

    nodeData.related_scholars = [];

    // 将相邻节点添加到相关学者列表
    neighborhood.forEach((neighborNode) => {
      const neighborData = neighborNode.data();

      // 查找连接这两个节点的边
      const connectingEdge = node.edgesWith(neighborNode);
      let relationship = "关联学者";

      // 如果找到边，获取关系类型
      if (connectingEdge.length > 0) {
        // 获取主要关系类型
        const relationType = connectingEdge[0].data("relationType");

        // 检查是否存在多种关系类型
        const allRelations = connectingEdge[0].data("allRelations") || [];
        console.log("节点关系:", {
          source: node.id(),
          target: neighborNode.id(),
          主要类型: relationType,
          所有类型: allRelations,
        });

        // 根据关系类型设置显示文本
        if (relationType === "advisor") {
          relationship = "导师";
        } else if (relationType === "colleague") {
          relationship = "同事";
        } else if (relationType === "coauthor") {
          relationship = "合作者";
        }

        // 如果有多种关系，在关系文本中标注
        if (allRelations && allRelations.length > 1) {
          const relationTypes = [];

          // 按照优先级顺序添加关系类型
          if (allRelations.includes("advisor")) {
            relationTypes.push("导师");
          }
          if (allRelations.includes("colleague")) {
            relationTypes.push("同事");
          }
          if (allRelations.includes("coauthor")) {
            relationTypes.push("合作者");
          }

          // 如果确实找到了多种关系，则显示多重关系文本
          if (relationTypes.length > 1) {
            relationship = relationTypes.join("、");
          }
        }
      }

      // 确保关联学者必要字段存在
      if (neighborData.id) {
        nodeData.related_scholars.push({
          id: neighborData.id,
          name: neighborData.label || neighborData.name || neighborData.id,
          relationship: relationship,
        });
      }
    });
  }

  console.log(
    "从图显示学者详情:",
    nodeData.id,
    "相关学者:",
    nodeData.related_scholars?.length || 0
  );

  // 更新详情面板 - 这会内部触发API调用获取更详细的数据
  detailPanel.update(nodeData);

  // 不再额外触发scholar:select事件，因为detailPanel.update会处理
  // eventBus.emit("scholar:select", nodeData);
}

/**
 * 放大到指定元素
 * @param {Object} elements - 要放大显示的元素集合
 */
function zoomToElements(elements) {
  if (!elements || elements.length === 0) return;

  // 添加动画过渡
  state.cyInstance.animate({
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
  state.cyInstance.animate({
    fit: {
      padding: 70,
    },
    duration: 800,
    easing: "ease-in-out-cubic",
  });

  // 移除所有元素的淡化和高亮效果
  state.cyInstance.elements().removeClass("faded");
  state.cyInstance.elements().removeClass("highlighted-neighbor");
}

/**
 * 清除节点选择
 */
function clearNodeSelection() {
  if (!state.activeNodeId) return;

  // 清除活跃节点ID
  state.activeNodeId = null;
  window.activeNodeId = null;

  // 清除高亮和淡化
  state.cyInstance.elements().removeClass("selected");
  state.cyInstance.elements().removeClass("highlighted-neighbor");
  state.cyInstance.elements().removeClass("faded");

  // 清除详情面板
  detailPanel.clear();

  // 发布学者取消选择事件
  eventBus.emit("scholar:deselect");
}

/**
 * 调整节点大小
 * @param {Object} cy - Cytoscape实例
 */
function adjustNodeSizeByConnections(cy) {
  const cyToUse = cy || state.cyInstance;
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
function optimizeNodePositions(cy) {
  const cyToUse = cy || state.cyInstance;
  if (!cyToUse || cyToUse.nodes().length === 0) {
    console.log("无法优化节点位置：图谱为空");
    return;
  }

  // 延迟执行，确保布局已完全应用
  setTimeout(() => {
    console.log("优化节点显示...");

    try {
      // 调整节点大小，根据连接数动态调整
      adjustNodeSizeByConnections(cyToUse);

      // 为了确保设置生效，触发一次重新渲染
      cyToUse.elements().lock(); // 锁定所有元素位置
      setTimeout(() => {
        cyToUse.elements().unlock(); // 解锁所有元素位置
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
function resetGraphViewport() {
  if (!state.cyInstance) return;

  // 清除选中状态
  state.cyInstance.elements().removeClass("selected");
  state.cyInstance.elements().removeClass("highlighted-neighbor");
  state.cyInstance.elements().removeClass("faded");

  // 清除详情面板
  detailPanel.clear();

  // 重置活跃节点
  state.activeNodeId = null;
  window.activeNodeId = null;

  // 重置缩放，显示整个图
  state.cyInstance.animate({
    fit: {
      padding: 70,
    },
    duration: 800,
    easing: "ease-in-out-cubic",
  });

  // 显示成功消息
  showStatusMessage("视图已重置", "success");
}

/**
 * 高亮含有特定标签的节点
 * @param {string} tag - 标签
 */
function highlightNodesByTag(tag) {
  if (!state.cyInstance) return;

  // 重置当前高亮
  state.cyInstance.nodes().removeClass("highlighted faded");

  // 找到包含该标签的节点
  const matchedNodes = state.cyInstance.nodes().filter((node) => {
    const nodeTags = node.data("tags") || [];
    return nodeTags.includes(tag);
  });

  if (matchedNodes.length === 0) {
    return;
  }

  // 高亮匹配节点
  matchedNodes.addClass("highlighted");
  state.cyInstance.elements().difference(matchedNodes).addClass("faded");

  // 更新视图居中显示匹配节点
  state.cyInstance.fit(matchedNodes, 50);

  // 显示"返回全局视图"按钮
  const graphViewBtn = elements.graphViewBtn();
  if (graphViewBtn) {
    graphViewBtn.classList.remove("hidden");
  }
}

/**
 * 显示边的上下文菜单
 * @param {Object} position - 鼠标点击的坐标
 * @param {Object} edgeData - 边的数据
 */
function showEdgeContextMenu(position, edgeData) {
  // 添加调试信息
  console.log("显示边的右键菜单:", edgeData);

  // 隐藏已有的菜单
  hideEdgeContextMenu();

  // 不允许删除coauthor类型的关系
  if (edgeData.relationType === "coauthor") {
    console.log("跳过coauthor类型的关系，不显示菜单");
    return; // 直接退出，不显示菜单
  }

  try {
    // 创建菜单元素
    const menu = document.createElement("div");
    menu.id = "edge-context-menu";
    menu.className = "context-menu";

    // 设置菜单内容
    menu.innerHTML = `
      <div class="context-menu-header">
        关系: ${edgeData.sourceName} → ${edgeData.targetName}
      </div>
      <div class="context-menu-item" data-action="delete" 
           data-source-id="${edgeData.sourceId}" 
           data-target-id="${edgeData.targetId}" 
           data-relation-type="${edgeData.relationType}">
        <i class="fa fa-trash"></i> 删除关系
      </div>
    `;

    // 设置位置 - 确保菜单不会超出视口
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 200; // 估计值
    const menuHeight = 100; // 估计值

    let left = position.x;
    let top = position.y;

    // 检查右边界
    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 10;
    }

    // 检查下边界
    if (top + menuHeight > viewportHeight) {
      top = viewportHeight - menuHeight - 10;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // 确保显示
    menu.style.display = "block";
    menu.style.visibility = "visible";
    menu.style.opacity = "1";
    menu.style.zIndex = "10000";

    // 添加到文档
    document.body.appendChild(menu);
    console.log("菜单已添加到DOM", menu);

    // 阻止菜单上的右键点击事件，避免浏览器菜单
    menu.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });

    // 添加菜单项点击事件
    menu.querySelector(".context-menu-item").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("菜单项被点击", e.target);
      const item = e.target.closest(".context-menu-item");
      if (!item) return;

      const action = item.getAttribute("data-action");
      if (action === "delete") {
        const sourceId = item.getAttribute("data-source-id");
        const targetId = item.getAttribute("data-target-id");
        const relationType = item.getAttribute("data-relation-type");

        console.log("删除关系", { sourceId, targetId, relationType });
        _confirmDeleteRelationship(sourceId, targetId, relationType);
      }

      // 隐藏菜单
      hideEdgeContextMenu();
    });

    // 延迟添加文档点击事件，避免立即触发
    setTimeout(() => {
      // 使用捕获阶段处理点击事件，确保能正确处理
      const documentClickHandler = function (e) {
        // 检查点击是否在菜单外部
        if (menu && !menu.contains(e.target)) {
          console.log("文档点击事件 - 隐藏菜单", e.target);
          hideEdgeContextMenu();
          document.removeEventListener("click", documentClickHandler, true);
        }
      };

      document.addEventListener("click", documentClickHandler, true);
    }, 300); // 增加延迟，确保不会立即触发

    // 防止菜单被其他点击事件立即隐藏
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  } catch (error) {
    console.error("显示边的右键菜单失败:", error);
  }
}

/**
 * 隐藏边的上下文菜单
 */
function hideEdgeContextMenu() {
  try {
    const menu = document.getElementById("edge-context-menu");
    if (menu) {
      // 淡出效果
      menu.style.opacity = "0";
      // 延迟移除DOM元素
      setTimeout(() => {
        if (menu && menu.parentNode) {
          menu.parentNode.removeChild(menu);
        }
      }, 100);
    }
  } catch (error) {
    console.error("隐藏边的右键菜单失败:", error);
    // 尝试强制移除
    const menu = document.getElementById("edge-context-menu");
    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
    }
  }
}

/**
 * 确认删除关系
 * @param {string} sourceId - 源节点ID
 * @param {string} targetId - 目标节点ID
 * @param {string} relationType - 关系类型
 */
function _confirmDeleteRelationship(sourceId, targetId, relationType) {
  // 再次检查是否为coauthor关系
  if (relationType === "coauthor") {
    showStatusMessage("合作者关系不允许删除", "warning");
    return;
  }

  // 获取节点名称
  const sourceName = state.cyInstance.$id(sourceId).data("label") || sourceId;
  const targetName = state.cyInstance.$id(targetId).data("label") || targetId;

  // 创建确认对话框
  let confirmDialog = document.getElementById(
    "confirm-delete-relationship-dialog"
  );
  if (!confirmDialog) {
    confirmDialog = document.createElement("div");
    confirmDialog.id = "confirm-delete-relationship-dialog";
    confirmDialog.className = "modal-overlay";
    confirmDialog.innerHTML = `
      <div class="modal-container">
        <div class="modal-header">
          <h3>确认删除关系</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p>确定要删除 <span class="relation-source"></span> 和 <span class="relation-target"></span> 之间的关系吗？</p>
          <p>关系类型: <strong>${
            relationType === "advisor"
              ? "导师"
              : relationType === "colleague"
              ? "同事"
              : relationType
          }</strong></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary cancel-btn">取消</button>
          <button class="btn btn-danger confirm-btn">删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmDialog);

    // 关闭按钮事件
    confirmDialog
      .querySelector(".modal-close-btn")
      .addEventListener("click", () => {
        confirmDialog.style.display = "none";
      });

    // 取消按钮事件
    confirmDialog.querySelector(".cancel-btn").addEventListener("click", () => {
      confirmDialog.style.display = "none";
    });
  }

  // 设置关系数据
  confirmDialog.querySelector(".relation-source").textContent = sourceName;
  confirmDialog.querySelector(".relation-target").textContent = targetName;

  // 确认按钮事件
  const confirmBtn = confirmDialog.querySelector(".confirm-btn");
  // 移除之前的事件监听器
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  // 添加新的事件监听器
  newConfirmBtn.addEventListener("click", () => {
    _deleteRelationship(sourceId, targetId, relationType);
    confirmDialog.style.display = "none";
  });

  // 显示对话框
  confirmDialog.style.display = "flex";
}

/**
 * 删除关系
 * @param {string} sourceId - 源节点ID
 * @param {string} targetId - 目标节点ID
 * @param {string} relationType - 关系类型
 */
function _deleteRelationship(sourceId, targetId, relationType) {
  // 显示加载状态
  showStatusMessage("正在删除关系...", "info");

  // 调用API删除关系
  deleteSingleRelationship({
    source_id: sourceId,
    target_id: targetId,
    relation_type: relationType,
  })
    .then((result) => {
      if (result.success) {
        showStatusMessage("关系已删除，正在更新图谱...", "success");

        // 重新加载数据
        reloadData()
          .then(() => {
            // 重新加载完成后，应用最优布局
            applyOptimalLayout();
            showStatusMessage("图谱已更新", "success");
          })
          .catch((error) => {
            console.error("更新图谱失败:", error);
            showStatusMessage("更新图谱失败，请手动刷新页面", "error");
          });
      } else {
        showStatusMessage(
          `删除关系失败: ${result.error || "未知错误"}`,
          "error"
        );
      }
    })
    .catch((error) => {
      showStatusMessage(
        `删除关系失败: ${error.message || "网络错误"}`,
        "error"
      );
    });
}

// 组件公开API
export default {
  // 初始化组件
  init(data) {
    if (data && elements.container()) {
      initGraph("cy", data);
    }
    return this;
  },

  // 获取Cytoscape实例
  getCy() {
    return state.cyInstance;
  },

  // 选择节点
  selectNode(node) {
    selectNode(node);
    return this;
  },

  // 重置视图
  resetView() {
    resetGraphViewport();
    return this;
  },

  // 应用布局
  applyLayout(layoutName = "fcose") {
    return applyLayout(layoutName);
  },

  // 应用最优布局设置
  applyOptimalLayout(button = null) {
    return applyOptimalLayout(button);
  },

  // 调整节点大小
  adjustNodeSize() {
    adjustNodeSizeByConnections();
    return this;
  },

  // 高亮标签
  highlightByTag(tag) {
    highlightNodesByTag(tag);
    return this;
  },

  // 获取布局选项
  getLayoutOptions() {
    return getFCoseLayoutOptions();
  },
};
