/**
 * ScholarTailor - 学者关系可视化系统
 * 前端主要逻辑脚本
 */

// 工具函数：设置元素不省略文本（显示完整文本）
function setNoEllipsis(element) {
  if (!element) return;
  
  if (typeof element === 'string') {
    // 如果传入的是选择器，获取对应的元素
    const selectedElements = document.querySelectorAll(element);
    selectedElements.forEach(el => {
      el.style.whiteSpace = "normal";
      el.style.overflow = "visible";
      el.style.textOverflow = "clip";
    });
  } else {
    // 如果传入的是DOM元素
    element.style.whiteSpace = "normal";
    element.style.overflow = "visible";
    element.style.textOverflow = "clip";
  }
  
  return element;
}

// 检查是否已经引入了布局库的相关脚本
function loadScript(url, callback) {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  script.onload = callback;
  document.head.appendChild(script);
}

// 注册cytoscape-fcose扩展
function registerFcoseExtension() {
  if (window.fcose && window.cytoscape) {
    try {
      // 注册fcose扩展
      window.cytoscape.use(window.fcose);
      console.log("fcose布局注册成功");
    } catch (e) {
      console.error("注册fcose扩展失败:", e);
    }
  } else {
    console.error("无法注册fcose扩展，依赖库未加载完成");
  }
}

// 确保先加载必要的依赖
function loadLayoutLibraries(callback) {
  if (!window.layoutBase) {
    loadScript("https://unpkg.com/layout-base/layout-base.js", function() {
      if (!window.coseBase) {
        loadScript("https://unpkg.com/cose-base/cose-base.js", function() {
          if (!window.fcose) {
            loadScript("https://unpkg.com/cytoscape-fcose/cytoscape-fcose.js", function() {
              registerFcoseExtension();
              callback();
            });
          } else {
            registerFcoseExtension();
            callback();
          }
        });
      } else if (!window.fcose) {
        loadScript("https://unpkg.com/cytoscape-fcose/cytoscape-fcose.js", function() {
          registerFcoseExtension();
          callback();
        });
      } else {
        registerFcoseExtension();
        callback();
      }
    });
  } else if (!window.coseBase) {
    loadScript("https://unpkg.com/cose-base/cose-base.js", function() {
      if (!window.fcose) {
        loadScript("https://unpkg.com/cytoscape-fcose/cytoscape-fcose.js", function() {
          registerFcoseExtension();
          callback();
        });
      } else {
        registerFcoseExtension();
        callback();
      }
    });
  } else if (!window.fcose) {
    loadScript("https://unpkg.com/cytoscape-fcose/cytoscape-fcose.js", function() {
      registerFcoseExtension();
      callback();
    });
  } else {
    registerFcoseExtension();
    callback();
  }
}

// 全局变量
let cy; // Cytoscape实例
let graphData; // 图谱数据
let activeNodeId = null; // 当前活跃节点ID
let scholars = {}; // 学者数据缓存
let customRelationships = []; // 自定义关系缓存
let isFocusedMode = false; // 是否处于焦点模式
let isAutoFocusEnabled = true; // 默认启用自动焦点模式

// 初始化函数
async function init() {
  try {
    // 加载数据
    graphData = await loadData();

    // 初始化图谱
    initGraph(graphData);

    // 设置事件监听
    setupEventListeners();

    // 缓存学者数据
    cacheScholars(graphData);

    // 初始化标签筛选功能
    setupTagFiltering();

    // 初始化标签点击事件
    setupTagClickHandlers();
    
    // 确保孤立节点切换按钮初始状态为未选中
    const isolatedToggle = document.getElementById("toggle-isolated");
    if (isolatedToggle) {
      isolatedToggle.checked = false;
    }

    console.log("ScholarTailor初始化完成");
  } catch (error) {
    console.error("初始化失败:", error);
    alert("加载数据失败，请刷新页面重试。");
  }
}

// 加载数据
async function loadData() {
  try {
    const response = await fetch("/data.json");
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("加载数据失败:", error);
    throw error;
  }
}

// 缓存学者数据，方便后续使用
function cacheScholars(data) {
  if (!data || !data.nodes) return;

  // 清空现有缓存
  scholars = {};

  // 首先处理主要学者(primary)
  for (const node of data.nodes) {
    if (node.data && node.group === "primary") {
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
      scholars[node.id] = node.data;
    }
  }

  // 再处理次要学者(secondary)，只添加不存在的学者
  for (const node of data.nodes) {
    if (node.data && node.group === "secondary" && !scholars[node.id]) {
      // 确保tags字段存在
      if (!node.data.tags) {
        node.data.tags = [];
      }

      // 确保设置为关联学者
      node.data.is_secondary = true;
      scholars[node.id] = node.data;
    }
  }

  // 找出并缓存自定义关系
  if (data.edges) {
    customRelationships = data.edges.filter(
      (edge) => edge.label !== "coauthor" || (edge.data && edge.data.is_custom)
    );
  }

  const primaryCount = Object.values(scholars).filter(
    (s) => !s.is_secondary
  ).length;
  const secondaryCount = Object.values(scholars).filter(
    (s) => s.is_secondary
  ).length;

  console.log(
    `已缓存 ${
      Object.keys(scholars).length
    } 位学者数据 (主要: ${primaryCount}, 潜在: ${secondaryCount})`
  );
}

// 初始化图谱
function initGraph(data) {
  // 定义节点和边的样式
  const cyStyle = [
    {
      selector: "node",
      style: {
        "background-color": "#6baed6", // 中性蓝色作为基础颜色
        label: "data(label)",
        width: 30,
        height: 30,
        "font-size": "10px",
        "text-valign": "bottom",
        "text-halign": "center",
        "text-margin-y": 8,
        "text-background-color": "#f8f9fa",
        "text-background-opacity": 0.9,
        "text-background-padding": "2px",
        "text-background-shape": "roundrectangle",
        "text-max-width": "120px",
        "text-overflow-wrap": "ellipsis",
      },
    },
    {
      // 主要学者节点样式
      selector: 'node[group="primary"]',
      style: {
        "background-color": "#3182bd", // 深蓝色表示主要学者
        width: 30,
        height: 30,
        "border-width": 2,
        "border-color": "#08519c",
        "font-weight": "bold",
      },
    },
    {
      // 关联学者节点样式（合作者）
      selector: 'node[group="secondary"]',
      style: {
        "background-color": "#9ecae1", // 浅蓝色表示关联学者
        width: 30,
        height: 30,
        "font-size": "9px",
        "border-width": 1,
        "border-color": "#6baed6",
        "text-opacity": 0.8,
      },
    },
    {
      // 只有一条边的孤立节点样式
      selector: "node[[degree = 1]]",
      style: {
        width: 10,
        height: 10,
        "font-size": "8px",
        "background-color": "rgba(205, 218, 225, 0.5)",  // 半透明浅蓝色
        'border-color': 'rgba(158, 202, 225, 0.5)',
        'text-opacity': 0.7,
        'z-index': 1 // 降低显示层级
      },
    },
    {
      selector: "edge",
      style: {
        width: 2,
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "line-color": "#bdc3c7",
        "target-arrow-color": "#bdc3c7",
        label: "data(label)",
        "font-size": "9px",
        "text-rotation": "autorotate",
        "text-background-color": "white",
        "text-background-opacity": 0.8,
        "text-background-padding": "2px",
      },
    },
    {
      selector: 'edge[label="coauthor"]',
      style: {
        "line-color": "#6baed6", // 蓝色表示合作关系
        "target-arrow-color": "#6baed6",
        label: "CO", // 简写为CO
      },
    },
    {
      selector: 'edge[label="advisor"]',
      style: {
        "line-color": "#fd8d3c", // 橙色表示导师关系
        "target-arrow-color": "#fd8d3c",
        label: "AD", // 简写为AD
      },
    },
    {
      selector: 'edge[label="colleague"]',
      style: {
        "line-color": "#31a354", // 绿色表示同事关系
        "target-arrow-color": "#31a354",
        label: "CL", // 简写为CL
      },
    },
    {
      // 多重关系的边特殊样式
      selector: 'edge[multiRelation]',
      style: {
        'width': 3, // 稍粗的线条
        'label': 'data(label)', // 保持使用关系标签
        'text-outline-color': '#fff',
        'text-outline-width': 2,
        'text-background-opacity': 1,
        'text-background-padding': '3px',
        'text-background-color': '#fff',
        'text-border-width': 1,
        'text-border-color': '#aaa',
        'text-border-opacity': 0.5
      }
    },
    {
      // 多重关系中导师关系优先显示
      selector: 'edge[multiRelation][label="advisor"]',
      style: {
        'line-color': '#fd8d3c',
        'target-arrow-color': '#fd8d3c',
        'label': 'AD*', // 添加星号表示含多重关系
        'line-style': 'solid',
        'z-index': 10 // 导师关系显示在最上层
      }
    },
    {
      // 多重关系中同事关系优先显示
      selector: 'edge[multiRelation][label="colleague"]',
      style: {
        'line-color': '#31a354',
        'target-arrow-color': '#31a354',
        'label': 'CL*', // 添加星号表示含多重关系
        'line-style': 'solid',
        'z-index': 9 // 同事关系显示优先级次于导师关系
      }
    },
    {
      // 多重关系中合作关系优先显示
      selector: 'edge[multiRelation][label="coauthor"]',
      style: {
        'line-color': '#6baed6',
        'target-arrow-color': '#6baed6',
        'label': 'CO*', // 添加星号表示含多重关系
        'line-style': 'solid',
        'z-index': 8 // 合作关系显示优先级最低
      }
    },
    {
      selector: ".highlighted",
      style: {
        "border-width": 4,
        "border-color": "#252525", // 深色边框突出显示
        "border-opacity": 0.8,
      },
    },
    {
      selector: ".related",
      style: {
        "border-width": 3,
        "border-color": "#737373", // 灰色边框表示相关
        "border-opacity": 0.6,
      },
    },
    {
      selector: ".faded",
      style: {
        opacity: 0.3,
      },
    },
    {
      selector: ".hidden",
      style: {
        display: "none",
      },
    },
  ];

  // 创建顶部工具栏
  const topToolbar = document.createElement("div");
  topToolbar.className = "top-toolbar";
  
  topToolbar.innerHTML = `
    <div class="toolbar-left">
      <div class="toolbar-group">
        <span class="toolbar-label">布局:</span>
        <select id="layout-select">
          <option value="fcose" selected>力导向(优化)</option>
          <option value="cose">力导向(传统)</option>
          <option value="circle">圆形</option>
          <option value="grid">网格</option>
          <option value="concentric">同心圆</option>
        </select>
      </div>
      
      <div class="toolbar-group">
        <span class="toolbar-label">关系:</span>
        <div class="relation-filters">
          <label><input type="checkbox" data-relation="coauthor" checked> 合作</label>
          <label><input type="checkbox" data-relation="advisor" checked> 导师</label>
          <label><input type="checkbox" data-relation="colleague" checked> 同事</label>
        </div>
      </div>
      
      <div class="toolbar-group">
        <label>
          <input type="checkbox" id="toggle-secondary" checked> 关联学者
        </label>
        <label>
          <input type="checkbox" id="toggle-isolated"> 孤立节点
        </label>
      </div>
    </div>
    
    <div class="toolbar-right">
      <div class="toolbar-group">
        <label class="control-label">
          <input type="checkbox" id="auto-focus" checked> 焦点模式
        </label>
      </div>
      
      <button id="graph-view-btn" class="control-btn" title="返回全局视图">
        <i class="fas fa-globe"></i> 全局视图
      </button>
    </div>
  `;
  
  // 将工具栏添加到graph-container的开头，而不是cy元素内部
  const graphContainer = document.querySelector(".graph-container");
  graphContainer.insertBefore(topToolbar, graphContainer.firstChild);
  
  // 过滤掉孤立节点(预处理元素)
  const filteredElements = filterIsolatedNodes(getGraphElements(data));
  
  // 创建Cytoscape实例，使用已过滤的元素
  cy = cytoscape({
    container: document.getElementById("cy"),
    elements: filteredElements,
    style: cyStyle,
    layout: getLayoutConfig("fcose"), // 使用优化过的fcose作为默认布局
    minZoom: 0.2,
    maxZoom: 3,
    wheelSensitivity: 0.3,
  });

  // 调整节点大小
  adjustNodeSizeByConnections();

  // 隐藏原有的全局视图按钮
  const oldGlobalViewBtn = document.getElementById("global-view-btn");
  if (oldGlobalViewBtn) {
    oldGlobalViewBtn.style.display = "none";
  }

  // 设置节点点击事件
  cy.on('tap', 'node', function(evt) {
    const node = evt.target;
    selectNode(node);
  });

  // 背景点击事件（取消选择）
  cy.on('tap', function(evt) {
    if (evt.target === cy) {
      clearNodeSelection();
    }
  });

  // 添加焦点模式选项事件监听
  document.body.addEventListener("change", function (event) {
    if (event.target.id === "auto-focus") {
      isAutoFocusEnabled = event.target.checked;
    } else if (event.target.id === "toggle-isolated") {
      toggleIsolatedNodes(event.target.checked);
    }
  });
}

// 新函数：预过滤孤立节点
function filterIsolatedNodes(elements) {
  // 创建临时图以分析连接
  const tempCy = cytoscape({
    headless: true,
    elements: elements
  });
  
  // 记录原始节点数量
  const originalNodeCount = tempCy.nodes().length;
  
  // 找出需要筛选的节点：只有一条边的关联学者节点（严格确保不是主要学者）
  const isolatedNodes = tempCy.nodes().filter(node => {
    const isSecondary = node.data("group") === "secondary";
    const connectionCount = node.connectedEdges().length;
    
    // 严格检查是否为关联学者且连接数少于2
    if (isSecondary && connectionCount < 2) {
      return true;
    }
    return false;
  });
  
  // 获取需要移除的孤立节点的ID列表
  const isolatedIds = isolatedNodes.map(node => node.id());
  
  console.log(`初始化筛选: 发现 ${isolatedIds.length} 个孤立关联学者节点 (总节点数: ${originalNodeCount})`);
  
  // 过滤原始元素，移除孤立节点及其连接的边
  const filteredElements = elements.filter(ele => {
    if (ele.data.source) { // 是边
      return !isolatedIds.includes(ele.data.source) && !isolatedIds.includes(ele.data.target);
    } else { // 是节点
      return !isolatedIds.includes(ele.data.id);
    }
  });
  
  // 销毁临时图
  tempCy.destroy();
  
  // 计算筛选后的节点数
  const remainingNodeCount = filteredElements.filter(ele => !ele.data.source).length;
  console.log(`初始化筛选: 保留 ${remainingNodeCount} 个节点 (移除 ${originalNodeCount - remainingNodeCount} 个孤立节点)`);
  
  return filteredElements;
}

// 调整节点大小根据连接数量
function adjustNodeSizeByConnections() {
  cy.nodes().forEach((node) => {
    const connections = node.connectedEdges().length;
    const isPrimary = node.data("group") === "primary";
    
    if (connections === 1) {
      // 孤立节点（只有一条边）
      node.style({
        'width': 10,
        'height': 10,
        'font-size': '8px',
        'background-color': 'rgba(158, 202, 225, 0.1)',  // 半透明浅蓝色
        'border-color': 'rgba(158, 202, 225, 0.1)',
        'text-opacity': 0.7,
        'z-index': 1
      });
    } else if (connections >= 2 && connections < 5) {
      // 有2-4条边的节点，使用默认尺寸
      node.style({
        'width': 25,
        'height': 25,
        'background-color': isPrimary ? '#3182bd' : '#9ecae1',
        'border-color': isPrimary ? '#08519c' : '#6baed6',
        'z-index': 5
      });
    } else if (connections >= 5) {
      // 重要节点（连接较多）
      node.style({
        'width': 35,
        'height': 35,
        'border-width': 2,
        'background-color': isPrimary ? '#3182bd' : '#9ecae1',
        'border-color': isPrimary ? '#08519c' : '#6baed6',
        'z-index': 10
      });
    }
    
    // 确保主要学者节点始终较为突出
    if (isPrimary && connections < 5) {
      node.style({
        'width': 30,
        'height': 30,
        'background-color': '#3182bd', // 深蓝色
        'border-width': 2,
        'border-color': '#08519c',
        'z-index': 8
      });
    }
  });
}

// 控制孤立节点的显示/隐藏
function toggleIsolatedNodes(show) {
  // 如果图谱已经存在
  if (cy) {
    if (show) {
      // 查找可能已经被隐藏的孤立节点
      const hiddenIsolatedNodes = graphData.nodes.filter(node => {
        // 只查找关联学者且只有一条边的节点
        if (node.group !== "secondary") return false;
        
        // 如果节点不在当前图中，可能是被隐藏的孤立节点
        const nodeInGraph = cy.getElementById(node.id).length > 0;
        if (!nodeInGraph) {
          // 查找与此节点相连的边
          const connectedEdges = graphData.edges.filter(edge => 
            edge.source === node.id || edge.target === node.id
          );
          // 如果只有一条边，则是孤立节点
          return connectedEdges.length < 2;
        }
        return false;
      });
      
      // 如果找到了被隐藏的孤立节点，将它们添加回图中
      if (hiddenIsolatedNodes.length > 0) {
        console.log(`显示 ${hiddenIsolatedNodes.length} 个孤立节点`);
        const elementsToAdd = [];
        
        // 添加节点
        hiddenIsolatedNodes.forEach(node => {
          elementsToAdd.push({
            data: {
              id: node.id,
              label: node.label,
              group: node.group,
              ...node.data,
            }
          });
        });
        
        // 添加与孤立节点相连的边
        graphData.edges.forEach(edge => {
          const sourceIsIsolated = hiddenIsolatedNodes.some(n => n.id === edge.source);
          const targetIsIsolated = hiddenIsolatedNodes.some(n => n.id === edge.target);
          
          if (sourceIsIsolated || targetIsIsolated) {
            // 检查目标节点是否在图中
            const targetInGraph = cy.getElementById(edge.target).length > 0;
            const sourceInGraph = cy.getElementById(edge.source).length > 0;
            
            if (targetInGraph || sourceInGraph) {
              elementsToAdd.push({
                data: {
                  id: `${edge.source}-${edge.target}`,
                  source: edge.source,
                  target: edge.target,
                  label: edge.label,
                  originalType: edge.label,
                  weight: edge.weight || 1,
                  metadata: edge.data,
                }
              });
    }
          }
        });
        
        // 添加元素到图中
        cy.add(elementsToAdd);
        
        // 获取当前布局类型并应用布局，增加孤立节点之间的距离
        const layoutName = document.getElementById("layout-select")?.value || "fcose";
        const layoutConfig = getLayoutConfig(layoutName);
        
        // 特别为孤立节点增加间距
        if (layoutName === "fcose" || layoutName === "cose") {
          // 显著增加节点排斥力来避免重叠
          layoutConfig.nodeRepulsion = 25000; // 增加节点间的排斥力
          // 增加理想边长以增加孤立节点间距
          layoutConfig.idealEdgeLength = 200; // 增加理想边长度
          // 调整重力以防止孤立节点飞得太远，但不要过度约束
          layoutConfig.gravity = 0.15; // 减小重力以允许节点更分散
          // 确保节点不重叠，增加额外的间距
          layoutConfig.avoidOverlap = true;
          layoutConfig.avoidOverlapPadding = 30; // 增加节点间的间距
          
          // 使用较大的冷却系数以允许布局更好地展开
          if (layoutName === "fcose") {
            layoutConfig.coolingFactor = 0.8;
            layoutConfig.samplingType = true; // 使用网格采样提高大图的性能
            layoutConfig.quality = "proof"; // 使用最高质量设置
            layoutConfig.randomize = true; // 重新随机放置节点以避免局部最小值
          }
        } else if (layoutName === "circle") {
          // 增加圆形布局半径
          layoutConfig.radius = 800; // 显著增加圆半径
          layoutConfig.startAngle = 0; // 从顶部开始
          layoutConfig.sweep = 2 * Math.PI; // 完整的圆
          layoutConfig.padding = 80; // 增加内部间距
        } else if (layoutName === "grid") {
          // 增加网格间距
          layoutConfig.nodeSpacing = 150; // 增加网格中的节点间距
          layoutConfig.avoidOverlap = true;
          layoutConfig.padding = 50;
        } else if (layoutName === "concentric") {
          // 增加同心圆间距
          layoutConfig.minNodeSpacing = 120; // 增加最小节点间距
          layoutConfig.avoidOverlap = true;
          layoutConfig.padding = 80; // 增加内部间距
          layoutConfig.equidistant = false; // 使用自然分布
        }
        
        // 运行布局
        const layout = cy.elements().layout(layoutConfig);
        
        // 执行布局
        layout.run();
        
        // 在布局完成后调整节点大小和边的样式
        layout.one("layoutstop", function() {
    adjustNodeSizeByConnections();
          
          // 设置在两秒后进行边样式的优化，确保布局完全稳定
          setTimeout(() => {
            // 调整孤立节点的边长度，使其与主要节点保持更远距离
            cy.edges().forEach(edge => {
              const source = edge.source();
              const target = edge.target();
              
              if ((source.data("group") === "secondary" && source.connectedEdges().length < 2) ||
                  (target.data("group") === "secondary" && target.connectedEdges().length < 2)) {
                // 这是连接到孤立节点的边，增加其长度和弯曲度
                edge.style({
                  'curve-style': 'bezier',
                  'control-point-step-size': 180, // 显著增加贝塞尔曲线控制点距离
                  'edge-distances': 'node-position',
                  'control-point-weight': 0.7, // 调整控制点权重以增加曲率
                  'control-point-distance': 100 // 增加控制点距离
                });
              }
            });
            
            // 如果是力导向布局，添加适当的边缘弯曲
            if (layoutName === "fcose" || layoutName === "cose") {
              const isolatedNodes = cy.nodes().filter(node => 
                node.data("group") === "secondary" && node.connectedEdges().length < 2
              );
              
              // 确保孤立节点的位置适当分散
              isolatedNodes.forEach(node => {
                // 获取连接的主要节点
                const connectedNode = node.neighborhood("node").first();
                
                // 如果存在连接的节点，将孤立节点稍微推远
                if (connectedNode.length > 0) {
                  // 获取当前位置
                  const pos = node.position();
                  const connPos = connectedNode.position();
                  
                  // 计算方向向量
                  const dx = pos.x - connPos.x;
                  const dy = pos.y - connPos.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  
                  // 单位向量
                  const unitX = dx / dist;
                  const unitY = dy / dist;
                  
                  // 增加距离 (额外推远20%)
                  const newDist = dist * 1.2;
                  
                  // 设置新位置
                  node.position({
                    x: connPos.x + unitX * newDist,
                    y: connPos.y + unitY * newDist
                  });
                }
              });
            }
          }, 500);
        });
      }
    } else {
      // 隐藏孤立节点
      const isolatedNodes = cy.nodes().filter(node => {
        return node.data("group") === "secondary" && node.connectedEdges().length < 2;
      });
      
      // 如果找到了孤立节点，将它们从图中移除
      if (isolatedNodes.length > 0) {
        console.log(`隐藏 ${isolatedNodes.length} 个孤立节点`);
        cy.remove(isolatedNodes);
        
        // 应用平滑的布局过渡
        const layoutName = document.getElementById("layout-select")?.value || "fcose";
        const layoutConfig = getLayoutConfig(layoutName);
        
        // 为不同布局类型设置平滑过渡参数
        layoutConfig.animate = true;
        layoutConfig.animationDuration = 500;
        layoutConfig.animationEasing = 'ease-out';
        
        // 运行布局
        cy.layout(layoutConfig).run();
      }
    }
  }
}

// 获取布局配置
function getLayoutConfig(name) {
  const layoutConfig = {
    cose: {
      name: "cose",
      idealEdgeLength: 120,
      nodeOverlap: 20,
      refresh: 20,
      padding: 80,
      randomize: false,
      animate: true,
      animationDuration: 800,
      animationEasing: 'ease-in-out',
      nodeRepulsion: 12000, // 增加节点排斥力
      gravity: 0.4, // 增加重力
      componentSpacing: 100, // 组件间距
      edgeElasticity: 100, // 边弹性
      nestingFactor: 1.2, // 嵌套因子
      numIter: 1000, // 迭代次数
      coolingFactor: 0.99 // 冷却系数
    },
    fcose: { // 添加fcose布局（更优化的力导向布局）
      name: 'fcose', // 名称
      quality: 'default', // 质量 - 'draft', 'default', 'proof'
      randomize: false, // 是否使用随机初始布局
      animate: true, // 是否使用动画
      animationDuration: 1000, // 动画持续时间
      animationEasing: 'ease-in-out', // 动画缓动函数
      fit: true, // 适应视图
      padding: 80, // 填充
      nodeRepulsion: 12000, // 节点间斥力
      idealEdgeLength: 100, // 理想边长
      edgeElasticity: 0.45, // 边的弹性
      nestingFactor: 0.1, // 嵌套因子
      gravity: 0.25, // 重力
      gravityRange: 3.8, // 重力范围
      gravityCompound: 1.0, // 复合重力
      numIter: 2500, // 迭代次数
      initialTemp: 200, // 初始温度
      coolingFactor: 0.95, // 冷却因子
      minTemp: 1.0, // 最小温度
      nodeDimensionsIncludeLabels: true, // 节点尺寸包含标签
      uniformNodeDimensions: false, // 统一节点尺寸
      packComponents: true, // 打包组件
      samplingType: true, // 采样类型
      sampleSize: 100, // 样本大小
      avoidOverlap: true, // 避免重叠
      avoidOverlapPadding: 10, // 避免重叠填充
      // 质量调整
      qualityFactor: 0.9, // 质量因子
      // 组件处理
      componentSpacing: 120, // 组件间距
      // 边长
      nodeEdgeWeightInfluence: 0.5 // 节点边权重影响
    },
    circle: {
      name: "circle",
      padding: 50,
      radius: 500, // 设置圆的半径
      startAngle: 3 / 2 * Math.PI, // 起始角度
      sweep: 2 * Math.PI, // 扫描角度
      clockwise: true, // 顺时针排列
      sort: function(a, b) { // 按节点连接数排序
        const aEdges = a.connectedEdges().length;
        const bEdges = b.connectedEdges().length;
        return bEdges - aEdges; // 连接数多的放前面
      }
    },
    grid: {
      name: "grid",
      padding: 50,
      avoidOverlap: true, // 避免重叠
      condense: true, // 紧凑布局
      rows: undefined, // 自动确定行数
      cols: undefined, // 自动确定列数
      sort: function(a, b) { // 排序函数
        // 优先按组排序，然后按连接数排序
        if (a.data('group') !== b.data('group')) {
          return a.data('group') === 'primary' ? -1 : 1;
        }
        return b.connectedEdges().length - a.connectedEdges().length;
      }
    },
    concentric: {
      name: "concentric",
      padding: 50,
      startAngle: 3/2 * Math.PI, // 起始角度
      sweep: 2 * Math.PI, // 扫描角度
      clockwise: true, // 顺时针方向
      equidistant: false, // 同心环等距
      minNodeSpacing: 50, // 最小节点间距
      avoidOverlap: true, // 避免重叠
      concentric: function(node) { // 定义节点的同心环级别
        // 连接数越多，越靠近中心
        const degree = node.connectedEdges().length;
        // 主要学者额外加分以靠近中心
        return degree + (node.data('group') === 'primary' ? 5 : 0);
      },
      levelWidth: function(nodes) { // 调整各级别宽度
        return nodes.length;
      }
    }
  };
  
  return layoutConfig[name] || layoutConfig.fcose; // 默认使用fcose
}

// 构建图谱元素
function getGraphElements(data) {
  const elements = [];

  // 添加节点
  if (data.nodes) {
    for (const node of data.nodes) {
      elements.push({
        data: {
          id: node.id,
          label: node.label,
          group: node.group, // 添加group属性，用于区分主要和关联学者
          ...node.data,
        },
      });
    }
  }

  // 添加边，处理多重关系
  if (data.edges) {
    // 用于记录已存在的关系
    const existingEdges = {};
    
    // 关系优先级映射（值越大优先级越高）
    const relationPriority = {
      "advisor": 3,    // 导师关系最高优先级
      "colleague": 2,  // 同事关系次之
      "coauthor": 1    // 合作关系优先级最低
    };

    // 辅助函数：处理多重关系
    function processMultipleRelation(existingEdge, newEdgeLabel, newEdgeWeight) {
      // 无论如何都记录所有关系类型
      if (!existingEdge.data.relationTypes.includes(newEdgeLabel)) {
        existingEdge.data.relationTypes.push(newEdgeLabel);
      }
      
      // 合并标签
      if (!existingEdge.data.allLabels) {
        existingEdge.data.allLabels = [existingEdge.data.originalType];
      }
      
      if (!existingEdge.data.allLabels.includes(newEdgeLabel)) {
        existingEdge.data.allLabels.push(newEdgeLabel);
        existingEdge.data.multiRelation = true;
      }
      
      // 根据优先级决定显示哪种关系
      const currentPriority = relationPriority[existingEdge.data.originalType] || 0;
      const newPriority = relationPriority[newEdgeLabel] || 0;
      
      // 如果新关系优先级更高，更新显示的关系类型
      if (newPriority > currentPriority) {
        existingEdge.data.label = newEdgeLabel;
        existingEdge.data.originalType = newEdgeLabel;
      }

      // 增加权重
      existingEdge.data.weight += newEdgeWeight || 1;
    }

    for (const edge of data.edges) {
      const edgeId = `${edge.source}-${edge.target}`;
      const reverseEdgeId = `${edge.target}-${edge.source}`;

      // 如果已经存在相同方向的边
      if (existingEdges[edgeId]) {
        processMultipleRelation(existingEdges[edgeId], edge.label, edge.weight || 1);
      }
      // 如果存在相反方向的边
      else if (existingEdges[reverseEdgeId]) {
        processMultipleRelation(existingEdges[reverseEdgeId], edge.label, edge.weight || 1);
      }
      // 新的边
      else {
        const newEdge = {
          data: {
            id: edgeId,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            originalType: edge.label, // 保存原始类型
            relationTypes: [edge.label], // 初始化关系类型数组
            allLabels: [edge.label],    // 所有关系标签
            weight: edge.weight || 1,
            metadata: edge.data,
          },
        };

        elements.push(newEdge);
        existingEdges[edgeId] = newEdge;
      }
    }
  }

  return elements;
}

// 设置事件监听
function setupEventListeners() {
  // 布局选择器
  document
    .getElementById("layout-select")
    .addEventListener("change", function () {
      const layout = this.value;
      changeLayout(layout);
    });

  // 关系过滤器
  const relationCheckboxes = document.querySelectorAll(
    '.relation-filters input[type="checkbox"]'
  );
  relationCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      filterRelationships();
    });
  });

  // 添加显示/隐藏关联学者的复选框事件监听
  const secondaryToggle = document.getElementById("toggle-secondary");
  if (secondaryToggle) {
    secondaryToggle.addEventListener("change", function () {
      toggleSecondaryScholars(this.checked);
    });
  }

  // 搜索按钮
  document.getElementById("search-btn").addEventListener("click", function () {
    searchScholar();
  });

  // 搜索输入框回车事件
  document
    .getElementById("search-input")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        searchScholar();
      }
    });

//   // 关闭详情面板
//   document.getElementById("close-panel").addEventListener("click", function () {
//     clearNodeSelection();
//   });

  // 管理面板相关事件
  setupAdminPanelEvents();

  // 添加新的全局视图按钮事件
  document.body.addEventListener("click", function (event) {
    if (
      event.target.id === "graph-view-btn" ||
      event.target.closest("#graph-view-btn")
    ) {
      resetToGlobalView();
    }
  });

  // 添加标签管理事件
  setupTagManagement();
}

// 管理面板事件设置
function setupAdminPanelEvents() {
  // 管理面板按钮
  const adminBtn = document.getElementById("admin-btn");
  const adminModal = document.getElementById("admin-modal");
  const closeModalBtn = document.querySelector(".close-modal");
  const closeAdminBtn = document.getElementById("close-admin-btn");

  // 打开管理面板
  adminBtn.addEventListener("click", function () {
    adminModal.style.display = "block";
    loadAdminPanelData();
  });

  // 关闭管理面板
  closeModalBtn.addEventListener("click", function () {
    adminModal.style.display = "none";
  });

  closeAdminBtn.addEventListener("click", function () {
    adminModal.style.display = "none";
  });

  // 点击模态窗口外部关闭
  window.addEventListener("click", function (event) {
    if (event.target === adminModal) {
      adminModal.style.display = "none";
    }
  });

  // 标签页切换
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      // 移除所有活跃标签
      tabBtns.forEach((b) => b.classList.remove("active"));

      // 隐藏所有内容区域
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });

      // 设置当前标签为活跃
      this.classList.add("active");

      // 显示对应内容
      const targetTab = this.dataset.tab;
      document.getElementById(targetTab).classList.add("active");
    });
  });

  // 保存更改按钮
  document
    .getElementById("save-changes-btn")
    .addEventListener("click", saveChanges);

  // 添加学者按钮
  document
    .getElementById("add-scholar-btn")
    .addEventListener("click", addNewScholar);

  // 批量添加学者按钮
  document
    .getElementById("batch-add-btn")
    .addEventListener("click", batchAddScholars);

  // 刷新所有数据按钮
  document
    .getElementById("refresh-all-btn")
    .addEventListener("click", refreshAllData);

  // 初始化数据库按钮
  document
    .getElementById("init-db-btn")
    .addEventListener("click", initializeDatabase);

  // 添加关系按钮
  document
    .getElementById("add-relation-btn")
    .addEventListener("click", addCustomRelationship);
}

// 加载管理面板数据
function loadAdminPanelData() {
  // 设置最近更新时间
  const lastUpdateTime = graphData.meta?.generated || "未知";
  document.getElementById("last-update-time").textContent =
    formatDateTime(lastUpdateTime);

  // 加载学者列表
  loadScholarList();

  // 加载关系下拉选项
  populateScholarDropdowns();

  // 加载自定义关系列表
  loadRelationshipList();
}

// 格式化日期时间
function formatDateTime(isoString) {
  if (!isoString) return "未知";

  try {
    // 处理ISO格式日期字符串
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      // 如果是无效日期，尝试其他格式
      return isoString;
    }

    // 使用本地化格式
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    console.error("日期格式化错误:", e);
    return isoString;
  }
}

// 加载学者列表到管理面板
function loadScholarList() {
  const scholarListEl = document.getElementById("scholar-list");

  // 如果没有学者数据
  if (!scholars || Object.keys(scholars).length === 0) {
    scholarListEl.innerHTML = '<div class="empty-list">暂无学者数据</div>';
    return;
  }

  // 收集所有主要学者（非关联学者）
  const mainScholars = Object.entries(scholars)
    .filter(([_, scholar]) => !scholar.is_secondary)
    .sort((a, b) => {
      // 按名称字典序排序
      const nameA = a[1].name || "";
      const nameB = b[1].name || "";
      return nameA.localeCompare(nameB);
    });

  // 如果没有主要学者
  if (mainScholars.length === 0) {
    scholarListEl.innerHTML = '<div class="empty-list">暂无主要学者数据</div>';
    return;
  }

  // 构建学者列表HTML
  let listHTML = "";
  for (const [id, scholar] of mainScholars) {
    const name = scholar.name || "未知";
    const affiliation = scholar.affiliation || "未知机构";
    const lastUpdated = formatDateTime(scholar.last_updated);

    listHTML += `
            <div class="scholar-item" data-id="${id}">
                <div class="scholar-info">
                    <div class="scholar-name">${name}</div>
                    <div class="scholar-detail">${affiliation} | 上次更新: ${lastUpdated}</div>
                </div>
                <div class="scholar-actions">
                    <button class="btn btn-sm update-scholar" title="更新数据">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="btn btn-sm edit-scholar" title="编辑自定义字段">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
  }

  scholarListEl.innerHTML = listHTML;

  // 添加事件监听
  const updateBtns = scholarListEl.querySelectorAll(".update-scholar");
  updateBtns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const scholarId = this.closest(".scholar-item").dataset.id;
      updateScholar(scholarId);
    });
  });

  const editBtns = scholarListEl.querySelectorAll(".edit-scholar");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const scholarId = this.closest(".scholar-item").dataset.id;
      editCustomFields(scholarId);
    });
  });

  console.log(`学者列表已加载，共 ${mainScholars.length} 条记录`);
}

// 填充学者下拉列表（关系管理）
function populateScholarDropdowns() {
  const sourceSelect = document.getElementById("source-scholar");
  const targetSelect = document.getElementById("target-scholar");

  // 清空现有选项
  sourceSelect.innerHTML = "";
  targetSelect.innerHTML = "";

  // 获取主要学者（非关联学者）
  const mainScholars = Object.entries(scholars)
    .filter(([_, scholar]) => !scholar.is_secondary)
    .sort((a, b) => {
      // 按名称字典序排序
      const nameA = a[1].name || "";
      const nameB = b[1].name || "";
      return nameA.localeCompare(nameB);
    });

  // 添加选项
  let options = "";
  for (const [id, scholar] of mainScholars) {
    const name = scholar.name || "未知";
    const affiliation = scholar.affiliation ? ` (${scholar.affiliation})` : "";

    options += `<option value="${id}">${name}${affiliation}</option>`;
  }

  sourceSelect.innerHTML = options;
  targetSelect.innerHTML = options;

  console.log(`学者下拉列表已加载，共 ${mainScholars.length} 条记录`);
}

// 加载关系列表
function loadRelationshipList() {
  const relationshipListEl = document.getElementById("relationship-list");

  // 筛选自定义关系
  const customRels = [];

  // 获取所有边
  if (graphData && graphData.edges) {
    for (const edge of graphData.edges) {
      // 确认是自定义关系或非自动生成的合作关系
      if (edge.label !== "coauthor" || (edge.data && edge.data.is_custom)) {
        customRels.push(edge);
      }
    }
  }

  if (customRels.length === 0) {
    relationshipListEl.innerHTML =
      '<div class="empty-list">暂无自定义关系</div>';
    return;
  }

  // 构建关系列表HTML
  let listHTML = "";
  for (const rel of customRels) {
    const sourceId = rel.source;
    const targetId = rel.target;

    // 获取学者名称
    const sourceName = scholars[sourceId]?.name || sourceId;
    const targetName = scholars[targetId]?.name || targetId;

    // 只显示主要学者之间的关系
    if (scholars[sourceId]?.is_secondary || scholars[targetId]?.is_secondary) {
      continue;
    }

    // 关系类型名称和样式类
    let relationType = rel.label;
    let relationTypeChinese = "合作者";

    if (relationType === "advisor") {
      relationTypeChinese = "导师";
    } else if (relationType === "colleague") {
      relationTypeChinese = "同事";
    }

    listHTML += `
            <div class="relationship-item" data-source="${sourceId}" data-target="${targetId}" data-type="${relationType}">
                <div class="relationship-detail">
                    <span>${sourceName}</span>
                    <span class="relationship-arrow">→</span>
                    <span class="relation-badge relation-${relationType}">${relationTypeChinese}</span>
                    <span class="relationship-arrow">→</span>
                    <span>${targetName}</span>
                </div>
                <div class="relationship-actions">
                    <button class="btn btn-sm delete-relation" title="删除关系">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
  }

  relationshipListEl.innerHTML =
    listHTML || '<div class="empty-list">暂无主要学者之间的关系</div>';

  // 添加删除关系的事件监听
  const deleteBtns = relationshipListEl.querySelectorAll(".delete-relation");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const item = this.closest(".relationship-item");
      const sourceId = item.dataset.source;
      const targetId = item.dataset.target;
      const relType = item.dataset.type;

      // 确认删除
      if (
        confirm(
          `确定要删除 ${scholars[sourceId]?.name || sourceId} 和 ${
            scholars[targetId]?.name || targetId
          } 之间的${
            relType === "advisor"
              ? "导师"
              : relType === "colleague"
              ? "同事"
              : "合作者"
          }关系吗？`
        )
      ) {
        item.remove();
        // 实际删除关系的逻辑在saveChanges中处理
      }
    });
  });

  console.log(
    `关系列表已加载，共显示 ${
      relationshipListEl.querySelectorAll(".relationship-item").length
    } 条记录`
  );
}

// 控制关联学者节点的显示/隐藏
function toggleSecondaryScholars(show) {
  const secondaryNodes = cy.nodes('[group="secondary"]');

  if (show) {
    secondaryNodes.removeClass("hidden");
  } else {
    secondaryNodes.addClass("hidden");
  }
}

// 更改图谱布局
function changeLayout(name) {
  console.log(`切换布局至: ${name}`);
  
  // 保存当前选中的节点，以便在布局后恢复焦点
  const selectedNode = cy.nodes('.highlighted')[0];
  
  // 获取布局配置
  const layoutConfig = getLayoutConfig(name);
  
  // 将动画设置为true以获得平滑过渡
  layoutConfig.animate = true;
  layoutConfig.animationDuration = 800;
  layoutConfig.animationEasing = 'ease-in-out-cubic';
  
  // 根据节点数量调整布局参数
  const nodeCount = cy.nodes().length;
  if (nodeCount > 100) {
    // 节点很多时使用更快的设置
    layoutConfig.quality = 'draft';
    layoutConfig.initialEnergyOnIncremental = 0.5;
  } else if (nodeCount > 50) {
    // 中等数量节点使用默认设置
    layoutConfig.quality = 'default';
  } else {
    // 节点较少时使用高质量设置
    layoutConfig.quality = 'proof';
  }
  
  // 应用新布局并设置动画完成后的回调
  const layout = cy.layout(layoutConfig);
  
  // 在布局完成后调整节点大小和恢复选择
  layout.one("layoutstop", function() {
    adjustNodeSizeByConnections();
    
    // 如果之前有选中的节点，保持选中状态并聚焦
    if (selectedNode) {
      // 暂时禁用自动焦点模式
      const wasAutoFocusEnabled = isAutoFocusEnabled;
      isAutoFocusEnabled = false;
      
      // 重新选中节点
      setTimeout(() => {
        selectNode(selectedNode);
        // 恢复焦点模式设置
        isAutoFocusEnabled = wasAutoFocusEnabled;
      }, 50);
    }
  });
  
  layout.run();
}

// 过滤关系
function filterRelationships() {
  const relationCheckboxes = document.querySelectorAll(
    '.relation-filters input[type="checkbox"]'
  );
  const selectedRelations = Array.from(relationCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.relation);

  // 过滤边
  cy.edges().forEach((edge) => {
    const relationType = edge.data("label");
    const isMultiRelation = edge.data("multiRelation");
    
    if (isMultiRelation) {
      // 对于多重关系，检查其包含的所有关系类型
      const relationTypes = edge.data("relationTypes") || [];
      const allLabels = edge.data("allLabels") || [];
      
      // 如果任何一种关系类型被选中，就显示该边
      const hasSelectedRelation = relationTypes.some(type => selectedRelations.includes(type));
      
      if (!hasSelectedRelation) {
        edge.addClass("hidden");
      } else {
        edge.removeClass("hidden");
        
        // 根据选中的关系调整显示的优先级
        // 优先级：advisor > colleague > coauthor
        if (selectedRelations.includes("advisor") && allLabels.includes("advisor")) {
          edge.data("label", "advisor");
          edge.style({
            'line-color': '#fd8d3c',
            'target-arrow-color': '#fd8d3c',
            'label': 'AD*'
          });
        } else if (selectedRelations.includes("colleague") && allLabels.includes("colleague")) {
          edge.data("label", "colleague");
          edge.style({
            'line-color': '#31a354',
            'target-arrow-color': '#31a354',
            'label': 'CL*'
          });
        } else if (selectedRelations.includes("coauthor") && allLabels.includes("coauthor")) {
          edge.data("label", "coauthor");
          edge.style({
            'line-color': '#6baed6',
            'target-arrow-color': '#6baed6',
            'label': 'CO*'
          });
        }
      }
    } else {
      // 对于单一关系，直接根据类型筛选
    if (!selectedRelations.includes(relationType)) {
      edge.addClass("hidden");
    } else {
      edge.removeClass("hidden");
      }
    }
  });
}

// 搜索学者 (支持模糊匹配)
function searchScholar() {
  const searchTerm = document
    .getElementById("search-input")
    .value.trim()
    .toLowerCase();

  if (!searchTerm) return;

  // 重置样式
  cy.elements().removeClass("highlighted faded");

  // 查找匹配节点 (使用模糊匹配)
  const matchedNodes = cy.nodes().filter((node) => {
    const name = (node.data("name") || "").toLowerCase();
    const affiliation = (node.data("affiliation") || "").toLowerCase();
    const interests = (node.data("interests") || []).join(" ").toLowerCase();
    const id = (node.data("id") || "").toLowerCase();

    return (
      name.includes(searchTerm) ||
      name.replace(/\s+/g, "").includes(searchTerm) || // 移除空格后匹配
      affiliation.includes(searchTerm) ||
      interests.includes(searchTerm) ||
      id.includes(searchTerm) ||
      levenshteinDistance(name, searchTerm) <= 2
    ); // 编辑距离不超过2
  });

  if (matchedNodes.length === 0) {
    alert("未找到匹配的学者");
    return;
  }

  // 高亮匹配节点
  matchedNodes.addClass("highlighted");
  cy.elements().difference(matchedNodes).addClass("faded");

  // 如果只有一个匹配项，选中它
  if (matchedNodes.length === 1) {
    selectNode(matchedNodes[0]);
  }

  // 更新视图居中显示匹配节点
  cy.fit(matchedNodes, 50);
}

// 计算两个字符串之间的编辑距离 (Levenshtein距离)
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // 初始化矩阵
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j] + 1 // 删除
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// 选择节点
function selectNode(node) {
  // 重置样式
  cy.elements().removeClass("highlighted related faded").removeStyle('opacity');

  // 高亮选中节点
  node.addClass("highlighted");

  // 高亮相邻节点
  const connectedNodes = node.neighborhood("node");
  connectedNodes.addClass("related");

  // 淡化其他节点，使用样式而不是类
  cy.elements().difference(node.union(node.neighborhood())).addClass("faded").style('opacity', 0.3);

  // 记录当前活跃节点
  activeNodeId = node.id();

  // 更新详情面板
  updateDetailPanel(node.data());

  // 显示返回全局视图按钮 (现在由控制面板中的按钮替代)
  const viewBtn = document.getElementById("graph-view-btn");
  if (viewBtn) {
    viewBtn.classList.remove("hidden");
  }

  // 平滑定位视图到选中节点
  const neighborhood = node.neighborhood().add(node);
  cy.animate({
    center: {
      eles: node
    },
    duration: 300,
    easing: 'ease-in-out-cubic',
    complete: function() {
  // 根据设置决定是否进入焦点模式
  if (isAutoFocusEnabled && !isFocusedMode) {
    enableFocusMode(node);
  }
    }
  });
}

// 启用焦点模式
function enableFocusMode(centerNode) {
  if (isFocusedMode) return; // 已经在焦点模式中，避免重复切换
  
  isFocusedMode = true;

  // 记录当前视图状态
  const currentPan = cy.pan();
  const currentZoom = cy.zoom();
  
  // 找出相关的节点和边
  const relevantElements = centerNode.union(centerNode.neighborhood());
  
  // 淡化不相关的节点而不是隐藏它们
  cy.elements().difference(relevantElements).addClass("faded").style('opacity', 0.1);

  // 突出显示中心节点和相关节点
  centerNode.addClass("highlighted").style('opacity', 1);
  centerNode.neighborhood("node").addClass("related").style('opacity', 1);
  centerNode.connectedEdges().style('opacity', 1);
  
  // 将视图聚焦到相关节点
  cy.animate({
    fit: {
      eles: relevantElements,
      padding: 50
    },
    duration: 500,
    easing: 'ease-in-out-cubic'
  });

  // 调整节点大小
    adjustNodeSizeByConnections();
}

// 重置到全局视图
function resetToGlobalView() {
  // 如果不在焦点模式，只需要清除选择
  if (!isFocusedMode) {
    clearNodeSelection();
    return;
  }

  // 重置焦点模式
  isFocusedMode = false;

  // 恢复所有节点的显示状态
  cy.elements().removeClass("hidden highlighted related faded").style('opacity', 1);

  // 平滑过渡到适合所有节点的视图
  cy.animate({
    fit: {
      padding: 50
    },
    duration: 500,
    easing: 'ease-in-out-cubic',
    complete: function() {
      // 调整节点大小
      adjustNodeSizeByConnections();
    }
  });
}

// 清除节点选择
function clearNodeSelection() {
  cy.elements().removeClass("highlighted related faded");
  clearDetailPanel();
  activeNodeId = null;
}

// 更新详情面板
function updateDetailPanel(scholarData) {
  // 如果没有数据，清空面板
  if (!scholarData) {
    clearDetailPanel();
    return;
  }

  // 设置学者名称
  const scholarNameEl = document.getElementById("scholar-name");
  scholarNameEl.textContent = scholarData.name || "未知";
  setNoEllipsis(scholarNameEl);

  // 处理关联学者(可能没有完整信息)
  const isSecondary = scholarData.is_secondary === true;

  // 设置学者所属机构
  const affiliationEl = document.querySelector("#scholar-affiliation .value");
  affiliationEl.textContent = scholarData.affiliation || "未知";
  setNoEllipsis(affiliationEl);

  // 设置研究兴趣
  const interestsEl = document.querySelector("#scholar-interests .value");
  if (isSecondary) {
    interestsEl.textContent = "信息不完整 (关联学者)";
  } else {
    // 将研究方向显示为标签
    if (scholarData.interests && scholarData.interests.length > 0) {
      interestsEl.innerHTML = "";
      scholarData.interests.forEach((interest) => {
        const interestTag = document.createElement("span");
        interestTag.className = "interest-tag";
        interestTag.textContent = interest;
        setNoEllipsis(interestTag);
        interestsEl.appendChild(interestTag);
      });
    } else {
      interestsEl.textContent = "未知";
    }
  }

  // 设置引用次数
  const citationsEl = document.querySelector("#scholar-citations .value");
  citationsEl.textContent = scholarData.citedby
    ? scholarData.citedby.toLocaleString()
    : "未知";
  setNoEllipsis(citationsEl);

  // 添加个人网页信息
  const homepageEl = document.querySelector("#scholar-homepage .value");
  if (scholarData.homepage) {
    homepageEl.innerHTML = `<a href="${scholarData.homepage}" target="_blank" class="scholar-link">${scholarData.homepage} <i class="fas fa-external-link-alt"></i></a>`;
    const linkElement = homepageEl.querySelector("a");
    if (linkElement) {
      setNoEllipsis(linkElement);
    }
  } else {
    homepageEl.textContent = "未提供";
  }

  // 设置学者头像
  const avatarImg = document.getElementById("scholar-avatar");
  if (avatarImg) {
    if (scholarData.avatar_url) {
      // 使用学者的头像URL
      avatarImg.src = scholarData.avatar_url;
    } else if (scholarData.scholar_id) {
      // 如果有Scholar ID但没有头像URL，尝试构建头像URL
      const scholarId = scholarData.scholar_id.replace("scholar_", "");
      avatarImg.src = `https://scholar.googleusercontent.com/citations?view_op=view_photo&user=${scholarId}`;
    } else {
      // 使用默认头像
      avatarImg.src = "https://placehold.co/300x300?text=U";
    }
  }

  // 更新代表性论文列表
  updatePublications(scholarData);
  
  // 更新相关学者列表
  updateRelatedScholars(scholarData.id);

  // 更新标签
  updateScholarTags(scholarData.id);

  // 设置自定义字段
  const customFieldsContainer = document.querySelector(".custom-fields-container");
  const customFieldsContent = document.querySelector(".custom-fields-content");

  if (customFieldsContent) {
    if (isSecondary) {
      // 关联学者显示提示信息和爬取按钮
      customFieldsContent.innerHTML = "<p>这是关联学者，仅作为合作者出现。可以爬取更多详细数据。</p>";
      
      // 显示爬取按钮
      const fetchBtn = document.getElementById("fetch-scholar-btn");
      if (fetchBtn) {
        fetchBtn.style.display = "flex";
      }
      
      // 设置Google Scholar链接
      const gsLink = document.getElementById("scholar-gs-link");
      if (gsLink) {
        if (scholarData.scholar_url) {
          gsLink.href = scholarData.scholar_url;
          gsLink.style.display = "flex";
        } else {
          gsLink.style.display = "none";
        }
      }
      
    } else if (scholarData.custom_fields && Object.keys(scholarData.custom_fields).length > 0) {
      // 有自定义字段的情况
      let customHTML = "<dl>";
      for (const [key, value] of Object.entries(scholarData.custom_fields)) {
        // 跳过tags字段，它已经在专门的标签部分显示
        if (key === "tags") continue;

        const formattedKey = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        customHTML += `<dt>${formattedKey}</dt><dd>${value}</dd>`;
      }
      customHTML += "</dl>";
      
      customFieldsContent.innerHTML = customHTML;
      
      // 对所有dt和dd元素应用无省略样式
      setNoEllipsis(`${customFieldsContent.tagName} dt, ${customFieldsContent.tagName} dd`);
      
      // 隐藏爬取按钮
      const fetchBtn = document.getElementById("fetch-scholar-btn");
      if (fetchBtn) {
        fetchBtn.style.display = "none";
      }
      
      // 设置Google Scholar链接
      const gsLink = document.getElementById("scholar-gs-link");
      if (gsLink) {
        if (scholarData.scholar_url) {
          gsLink.href = scholarData.scholar_url;
          gsLink.style.display = "flex";
        } else {
          gsLink.style.display = "none";
        }
      }
      
    } else {
      // 无额外信息的情况
      customFieldsContent.innerHTML = "<p>无额外信息</p>";
      
      // 隐藏爬取按钮
      const fetchBtn = document.getElementById("fetch-scholar-btn");
      if (fetchBtn) {
        fetchBtn.style.display = "none";
      }
      
      // 设置Google Scholar链接
      const gsLink = document.getElementById("scholar-gs-link");
      if (gsLink) {
        if (scholarData.scholar_url) {
          gsLink.href = scholarData.scholar_url;
          gsLink.style.display = "flex";
        } else {
          gsLink.style.display = "none";
        }
      }
    }
  }

  // 处理爬取按钮点击事件 - 先移除旧的事件监听器，再添加新的
  const fetchBtn = document.getElementById("fetch-scholar-btn");
  if (fetchBtn) {
    // 移除所有已有的点击事件监听器
    const newFetchBtn = fetchBtn.cloneNode(true);
    fetchBtn.parentNode.replaceChild(newFetchBtn, fetchBtn);
    
    // 添加新的事件监听器
    newFetchBtn.addEventListener("click", () => {
      fetchSecondaryScholarData(scholarData.id, scholarData.name);
    });
  }
  
  // 显示详情面板
  const detailPanel = document.getElementById("detail-panel");
  if (detailPanel) {
    detailPanel.classList.add("visible");
  } else {
    console.warn("未找到detail-panel元素，请检查HTML结构");
  }
}

// 更新相关学者列表
function updateRelatedScholars(scholarId) {
  const relatedScholarsEl = document.getElementById("related-scholars");

  // 获取与当前学者相连的所有边
  const connectedEdges = cy
    .edges()
    .filter(
      (edge) =>
        edge.data("source") === scholarId || edge.data("target") === scholarId
    );

  if (connectedEdges.length === 0) {
    relatedScholarsEl.innerHTML = "<li>无相关学者</li>";
    return;
  }

  let relatedHTML = "";

  // 处理每个相关学者
  connectedEdges.forEach((edge) => {
    const isSource = edge.data("source") === scholarId;
    const relatedId = isSource ? edge.data("target") : edge.data("source");
    const relatedNode = cy.getElementById(relatedId);

    if (relatedNode.length > 0) {
      const relatedData = relatedNode.data();
      // 使用relationTypes或allLabels属性获取所有关系类型，如果没有则使用label属性
      const relationTypes = edge.data("allLabels") || edge.data("relationTypes") || [edge.data("label")];
      const isSecondary = relatedData.group === "secondary";

      // 构建关系类型的标签，确保按照优先级排序：导师 > 同事 > 合作
      let relationBadges = "";
      // 定义关系类型的排序优先级
      const relationPriority = {
        "advisor": 3,
        "colleague": 2,
        "coauthor": 1
      };
      
      // 按优先级排序关系类型
      const sortedRelations = [...relationTypes].sort((a, b) => {
        return (relationPriority[b] || 0) - (relationPriority[a] || 0);
      });
      
      sortedRelations.forEach((type) => {
        // 关系类型的中文表示
        let relationTypeChinese = "合作者";
        let relationClass = "coauthor";
        
        if (type === "advisor") {
          relationTypeChinese = isSource ? "指导学生" : "导师";
          relationClass = "advisor";
        } else if (type === "colleague") {
          relationTypeChinese = "同事";
          relationClass = "colleague";
        }

        relationBadges += `<span class="relation-badge ${relationClass}">${relationTypeChinese}</span>`;
      });

      relatedHTML += `<li data-id="${relatedId}" class="${
        isSecondary ? "secondary-scholar" : "primary-scholar"
      }">
                <div class="relation-name">${relatedData.name}</div>
                <div class="relation-type">
                    ${relationBadges}
                    ${
                      edge.data("weight") > 1
                        ? `<span class="relation-weight">权重: ${edge.data(
                            "weight"
                          )}</span>`
                        : ""
                    }
                    ${
                      isSecondary
                        ? '<span class="secondary-badge">潜在</span>'
                        : ""
                    }
                </div>`;

      // 添加研究方向标签
      if (
        relatedData.interests &&
        relatedData.interests.length > 0 &&
        !isSecondary
      ) {
        relatedHTML += '<div class="relation-interests">';

        // 最多显示3个研究方向
        const displayInterests = relatedData.interests.slice(0, 3);
        displayInterests.forEach((interest) => {
          relatedHTML += `<span class="interest-mini-tag">${interest}</span>`;
        });

        if (relatedData.interests.length > 3) {
          relatedHTML += `<span class="interest-more">+${
            relatedData.interests.length - 3
          }</span>`;
        }

        relatedHTML += "</div>";
      }

      relatedHTML += `<div class="relation-affiliation">${
        relatedData.affiliation || ""
      }</div>
            </li>`;
    }
  });

  // 清空列表并添加新的HTML
  relatedScholarsEl.innerHTML = relatedHTML;
  
  // 对所有相关学者列表中的文本元素应用无省略样式
  setNoEllipsis("#related-scholars .relation-name");
  setNoEllipsis("#related-scholars .relation-type span");
  setNoEllipsis("#related-scholars .relation-interests span"); 
  setNoEllipsis("#related-scholars .relation-affiliation");

  // 使用事件委托方式添加点击事件，避免重复绑定
  // 首先移除可能存在的旧事件监听器
  const newRelatedScholarsEl = relatedScholarsEl.cloneNode(true);
  relatedScholarsEl.parentNode.replaceChild(newRelatedScholarsEl, relatedScholarsEl);
  
  // 添加点击事件跳转到相关学者
  newRelatedScholarsEl.addEventListener("click", function(event) {
    // 找到最近的li元素
    const listItem = event.target.closest("li[data-id]");
    if (listItem) {
      const nodeId = listItem.dataset.id;
      const node = cy.getElementById(nodeId);
      if (node.length > 0) {
        selectNode(node);
        cy.center(node);
      }
    }
  });
}

// 清除详情面板
function clearDetailPanel() {
  document.getElementById("scholar-name").textContent = "选择学者查看详情";
  document.querySelector("#scholar-affiliation .value").textContent = "-";
  document.querySelector("#scholar-interests .value").textContent = "-";
  document.querySelector("#scholar-citations .value").textContent = "-";
  document.querySelector(".custom-fields").innerHTML = "-";
  document.getElementById("publication-list").innerHTML =
    "<li>选择学者查看论文</li>";
  document.getElementById("related-scholars").innerHTML =
    "<li>选择学者查看关系</li>";
  document.getElementById("scholar-avatar").src = "./img/default-avatar.png";
}

// 添加新学者
async function addNewScholar() {
  const scholarInput = document.getElementById("new-scholar-input");
  const scholarIdInput = document.getElementById("new-scholar-id");

  const scholarName = scholarInput.value.trim();
  let scholarId = scholarIdInput.value.trim();

  // 检查是否有输入
  if (!scholarName && !scholarId) {
    showAdminStatus("请输入学者名称或Scholar ID/链接", "error");
    return;
  }

  // 从链接中提取Scholar ID
  scholarId = extractScholarIdFromInput(scholarId);

  // 准备请求数据
  const requestData = {};
  if (scholarId) {
    // 优先使用ID
    requestData.scholar_id = scholarId;
    showAdminStatus(`正在通过ID "${scholarId}" 爬取学者数据...`, "info");
  } else {
    // 使用名称
    requestData.name = scholarName;
    showAdminStatus(`正在爬取学者 "${scholarName}" 的数据...`, "info");
  }

  try {
    const response = await fetch("/api/scholars/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      showAdminStatus(
        `成功添加学者 "${result.message.replace("成功添加学者 ", "")}"`,
        "success"
      );
      scholarInput.value = "";
      scholarIdInput.value = "";

      // 重新加载数据
      await reloadData();
    } else {
      showAdminStatus(`添加学者失败: ${result.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("添加学者出错:", error);
    showAdminStatus(`添加学者时发生错误: ${error.message}`, "error");
  }
}

// 从输入中提取Scholar ID
function extractScholarIdFromInput(input) {
  if (!input) return "";
  
  // 检查是否是完整的Scholar页面URL
  if (input.includes("scholar.google.com")) {
    try {
      // 尝试解析URL参数
      const url = new URL(input);
      
      // 获取user参数值（Scholar ID）
      if (url.searchParams.has("user")) {
        return url.searchParams.get("user");
      }
      
      // 如果URL中包含"user="但没有通过searchParams获取到
      const userMatch = input.match(/[?&]user=([^&#]*)/);
      if (userMatch && userMatch[1]) {
        return userMatch[1];
      }
      
      // 对于citations页面
      const citationsMatch = input.match(/citations\?user=([^&#]*)/);
      if (citationsMatch && citationsMatch[1]) {
        return citationsMatch[1];
      }
    } catch (e) {
      console.warn("URL解析失败:", e);
      // 使用正则表达式提取ID
      const idMatch = input.match(/user=([^&#]*)/);
      if (idMatch && idMatch[1]) {
        return idMatch[1];
      }
    }
  }
  
  // 如果不是URL或无法提取ID，则返回原始输入
  return input;
}

// 批量添加学者
async function batchAddScholars() {
  const batchTextarea = document.getElementById("batch-scholars");
  const scholarNames = batchTextarea.value
    .trim()
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (scholarNames.length === 0) {
    showAdminStatus("请输入至少一个有效的学者名称", "error");
    return;
  }

  showAdminStatus(
    `正在批量爬取 ${scholarNames.length} 位学者的数据...`,
    "info"
  );

  try {
    const response = await fetch("/api/scholars/batch-add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ names: scholarNames }),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      showAdminStatus(`成功添加 ${result.added || 0} 位学者`, "success");
      batchTextarea.value = "";

      // 重新加载数据
      await reloadData();
    } else {
      showAdminStatus(
        `批量添加学者失败: ${result.error || "未知错误"}`,
        "error"
      );
    }
  } catch (error) {
    console.error("批量添加学者出错:", error);
    showAdminStatus(`批量添加学者时发生错误: ${error.message}`, "error");
  }
}

// 更新单个学者
async function updateScholar(scholarId) {
  if (!scholarId || !scholars[scholarId]) {
    showAdminStatus("无效的学者ID", "error");
    return;
  }

  const scholarName = scholars[scholarId].name || "未知学者";

  if (
    !confirm(
      `确定要更新 "${scholarName}" 的数据吗？这将从Google Scholar重新爬取数据。`
    )
  ) {
    return;
  }

  showAdminStatus(`正在更新学者 "${scholarName}" 的数据...`, "info");

  try {
    const response = await fetch("/api/scholars/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: scholarId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      showAdminStatus(`成功更新学者 "${scholarName}" 的数据`, "success");

      // 重新加载数据
      await reloadData();
    } else {
      showAdminStatus(`更新学者失败: ${result.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("更新学者出错:", error);
    showAdminStatus(`更新学者时发生错误: ${error.message}`, "error");
  }
}

// 编辑学者自定义字段
function editCustomFields(scholarId) {
  if (!scholarId || !scholars[scholarId]) {
    showAdminStatus("无效的学者ID", "error");
    return;
  }

  const scholar = scholars[scholarId];
  const scholarName = scholar.name || "未知学者";

  // 创建编辑模态窗口
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "block";
  modal.style.zIndex = "200"; // 确保在管理面板之上

  const customFields = scholar.custom_fields || {};
  const fieldKeys = Object.keys(customFields);

  // 构建字段编辑表单
  let fieldsHTML = "";
  for (const key of fieldKeys) {
    fieldsHTML += `
            <div class="form-group custom-field-group" data-key="${key}">
                <div class="field-header">
                    <input type="text" class="field-key" value="${key}" placeholder="字段名称">
                    <button class="btn btn-sm delete-field"><i class="fas fa-times"></i></button>
                </div>
                <input type="text" class="field-value" value="${customFields[key]}" placeholder="字段值">
            </div>
        `;
  }

  modal.innerHTML = `
        <div class="modal-content" style="width: 600px;">
            <div class="modal-header">
                <h2>编辑 ${scholarName} 的自定义字段</h2>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="custom-fields-form">
                    ${fieldsHTML}
                    <button id="add-field-btn" class="btn">添加新字段</button>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancel-edit-btn" class="btn">取消</button>
                <button id="save-fields-btn" class="btn btn-primary">保存</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // 关闭模态窗口
  modal.querySelector(".close-modal").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  modal.querySelector("#cancel-edit-btn").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // 添加新字段
  modal.querySelector("#add-field-btn").addEventListener("click", () => {
    const fieldContainer = modal.querySelector(".custom-fields-form");
    const newField = document.createElement("div");
    newField.className = "form-group custom-field-group";
    newField.dataset.key = "";

    newField.innerHTML = `
            <div class="field-header">
                <input type="text" class="field-key" value="" placeholder="字段名称">
                <button class="btn btn-sm delete-field"><i class="fas fa-times"></i></button>
            </div>
            <input type="text" class="field-value" value="" placeholder="字段值">
        `;

    fieldContainer.insertBefore(
      newField,
      modal.querySelector("#add-field-btn")
    );

    // 添加删除字段事件
    newField.querySelector(".delete-field").addEventListener("click", () => {
      fieldContainer.removeChild(newField);
    });
  });

  // 添加删除现有字段事件
  modal.querySelectorAll(".delete-field").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fieldGroup = btn.closest(".custom-field-group");
      fieldGroup.parentNode.removeChild(fieldGroup);
    });
  });

  // 保存字段
  modal
    .querySelector("#save-fields-btn")
    .addEventListener("click", async () => {
      const newCustomFields = {};

      modal.querySelectorAll(".custom-field-group").forEach((group) => {
        const keyEl = group.querySelector(".field-key");
        const valueEl = group.querySelector(".field-value");

        const key = keyEl.value.trim();
        const value = valueEl.value.trim();

        if (key && value) {
          newCustomFields[key] = value;
        }
      });

      try {
        const response = await fetch("/api/scholars/update-custom-fields", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: scholarId,
            custom_fields: newCustomFields,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP错误: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          document.body.removeChild(modal);
          showAdminStatus(`成功更新 "${scholarName}" 的自定义字段`, "success");

          // 更新本地缓存
          if (scholars[scholarId]) {
            scholars[scholarId].custom_fields = newCustomFields;
          }

          // 如果当前显示的是这个学者，更新详情面板
          if (activeNodeId === scholarId) {
            updateDetailPanel(scholars[scholarId]);
          }
        } else {
          showAdminStatus(
            `更新自定义字段失败: ${result.error || "未知错误"}`,
            "error"
          );
        }
      } catch (error) {
        console.error("更新自定义字段出错:", error);
        showAdminStatus(`更新自定义字段时发生错误: ${error.message}`, "error");
      }
    });
}

// 刷新所有数据
async function refreshAllData() {
  const keepCustom = document.getElementById("keep-custom").checked;

  if (
    !confirm(
      `确定要更新所有学者数据吗？这将从Google Scholar重新爬取所有学者的数据，${
        keepCustom ? "并保留" : "但不保留"
      }自定义关系。`
    )
  ) {
    return;
  }

  showAdminStatus("正在更新所有学者数据...", "info");

  try {
    const response = await fetch("/api/scholars/refresh-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keep_custom_relationships: keepCustom }),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      showAdminStatus(
        `成功更新 ${result.updated || 0} 位学者的数据`,
        "success"
      );

      // 重新加载数据
      await reloadData();
    } else {
      showAdminStatus(
        `更新所有数据失败: ${result.error || "未知错误"}`,
        "error"
      );
    }
  } catch (error) {
    console.error("更新所有数据出错:", error);
    showAdminStatus(`更新所有数据时发生错误: ${error.message}`, "error");
  }
}

// 添加自定义关系
async function addCustomRelationship() {
  const sourceId = document.getElementById("source-scholar").value;
  const targetId = document.getElementById("target-scholar").value;
  const relationType = document.getElementById("relation-type").value;

  if (!sourceId || !targetId) {
    showAdminStatus("请选择源学者和目标学者", "error");
    return;
  }

  if (sourceId === targetId) {
    showAdminStatus("源学者和目标学者不能是同一人", "error");
    return;
  }

  const sourceName = scholars[sourceId]?.name || sourceId;
  const targetName = scholars[targetId]?.name || targetId;

  // 关系类型中文名
  let relationTypeChinese = "合作者";
  if (relationType === "advisor") {
    relationTypeChinese = "导师";
  } else if (relationType === "colleague") {
    relationTypeChinese = "同事";
  }

  // 确认添加关系
  if (
    !confirm(
      `确定要添加 ${sourceName} 作为 ${targetName} 的${relationTypeChinese}关系吗？`
    )
  ) {
    return;
  }

  showAdminStatus(`正在添加关系...`, "info");

  try {
    const response = await fetch("/api/relationships/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_id: sourceId,
        target_id: targetId,
        type: relationType,
        is_custom: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      showAdminStatus(`成功添加关系`, "success");

      // 重新加载数据
      await reloadData();

      // 更新关系列表
      loadRelationshipList();
    } else {
      showAdminStatus(`添加关系失败: ${result.error || "未知错误"}`, "error");
    }
  } catch (error) {
    console.error("添加关系出错:", error);
    showAdminStatus(`添加关系时发生错误: ${error.message}`, "error");
  }
}

// 保存所有更改
async function saveChanges() {
  showAdminStatus("正在保存更改...", "info");

  // 收集需要删除的关系
  const customRelsList = document.getElementById("relationship-list");
  const currentRelItems = customRelsList.querySelectorAll(".relationship-item");

  // 当前显示的关系ID集合
  const currentRelIds = new Set();
  currentRelItems.forEach((item) => {
    const sourceId = item.dataset.source;
    const targetId = item.dataset.target;
    const relType = item.dataset.type;

    currentRelIds.add(`${sourceId}-${targetId}-${relType}`);
  });

  // 找出要删除的关系
  const relationsToDelete = [];
  customRelationships.forEach((rel) => {
    const relId = `${rel.source}-${rel.target}-${rel.type}`;
    if (!currentRelIds.has(relId)) {
      relationsToDelete.push({
        source_id: rel.source,
        target_id: rel.target,
        type: rel.type,
      });
    }
  });

  try {
    // 批量删除关系
    if (relationsToDelete.length > 0) {
      const response = await fetch("/api/relationships/delete-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ relationships: relationsToDelete }),
      });

      if (!response.ok) {
        throw new Error(`删除关系HTTP错误: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(`删除关系失败: ${result.error || "未知错误"}`);
      }
    }

    // 重新加载数据
    await reloadData();

    showAdminStatus("所有更改已保存", "success");

    // 延迟关闭管理面板
    setTimeout(() => {
      document.getElementById("admin-modal").style.display = "none";
    }, 1500);
  } catch (error) {
    console.error("保存更改出错:", error);
    showAdminStatus(`保存更改时发生错误: ${error.message}`, "error");
  }
}

// 重新加载数据
async function reloadData() {
  try {
    // 刷新图谱数据
    graphData = await loadData();

    // 更新缓存
    cacheScholars(graphData);

    // 更新管理面板数据
    loadAdminPanelData();

    // 重建图谱
    cy.elements().remove();
    cy.add(getGraphElements(graphData));

    // 应用当前布局
    const layoutName = document.getElementById("layout-select").value;
    changeLayout(layoutName);

    return true;
  } catch (error) {
    console.error("重新加载数据失败:", error);
    showAdminStatus("重新加载数据失败", "error");
    return false;
  }
}

// 显示管理面板状态消息
function showAdminStatus(message, type = "info") {
  const statusEl = document.getElementById("admin-status");
  statusEl.textContent = message;

  // 设置消息类型样式
  statusEl.className = "status-message";

  if (type === "error") {
    statusEl.classList.add("status-error");
  } else if (type === "success") {
    statusEl.classList.add("status-success");
  } else {
    statusEl.classList.add("status-info");
  }

  // 自动清除成功和信息消息
  if (type !== "error") {
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "status-message";
    }, 5000);
  }
}

// 爬取关联学者详细数据
async function fetchSecondaryScholarData(scholarId, scholarName) {
  if (!scholarId) {
    alert("无效的学者ID");
    return;
  }

  // 检查是否已有学者ID
  const hasScholarId =
    scholarId.startsWith("scholar_") || scholarId.match(/^[A-Za-z0-9_-]{12}$/);

  // 确认爬取
  if (
    !confirm(
      `确定要爬取学者 "${
        scholarName || scholarId
      }" 的详细数据吗？这将把该关联学者转为主要学者。`
    )
  ) {
    return;
  }

  try {
    // 显示加载状态
    const fetchBtn = document.getElementById("fetch-scholar-btn");
    if (fetchBtn) {
      fetchBtn.disabled = true;
      fetchBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> 正在爬取数据...';
    }

    // 准备请求数据
    let requestData;
    if (hasScholarId) {
      // 优先使用scholar_id查询
      requestData = { scholar_id: scholarId };
    } else {
      // 使用名称查询
      requestData = { name: scholarName };
    }

    // 调用API爬取数据
    const response = await fetch("/api/scholars/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      alert(`成功爬取学者 "${scholarName}" 的详细数据`);

      // 重新加载数据
      await reloadData();

      // 如果在焦点模式，重置到全局视图
      if (isFocusedMode) {
        resetToGlobalView();
      }

      // 尝试重新选择该学者
      const newNode = cy.getElementById(result.scholar_id || scholarId);
      if (newNode.length > 0) {
        selectNode(newNode);
      }
    } else {
      alert(`爬取详细数据失败: ${result.error || "未知错误"}`);
    }
  } catch (error) {
    console.error("爬取学者数据出错:", error);
    alert(`爬取数据时发生错误: ${error.message}`);
  } finally {
    // 恢复按钮状态
    const fetchBtn = document.getElementById("fetch-scholar-btn");
    if (fetchBtn) {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = '<i class="fas fa-download"></i> 爬取详细数据';
    }
  }
}

// 设置标签管理功能
function setupTagManagement() {
  const tagAddBtn = document.getElementById("tag-add-btn");
  const tagDialog = document.getElementById("tag-dialog");
  const tagDialogClose = document.querySelector(".tag-dialog-close");
  const cancelTagBtn = document.getElementById("cancel-tag-btn");
  const saveTagBtn = document.getElementById("save-tag-btn");
  const customTagInput = document.getElementById("custom-tag-input");
  const addCustomTagBtn = document.getElementById("add-custom-tag-btn");
  const currentTags = document.getElementById("current-tags");
  const predefinedTags = document.querySelectorAll(
    ".predefined-tags .scholar-tag"
  );

  let tempTags = [];

  // 打开标签对话框
  tagAddBtn.addEventListener("click", function () {
    if (!activeNodeId) return;

    // 获取当前学者的标签
    const scholarData = scholars[activeNodeId];
    tempTags = [...(scholarData.tags || [])];

    // 显示当前标签
    updateCurrentTagsDisplay();

    // 显示对话框
    tagDialog.classList.add("active");
  });

  // 关闭标签对话框
  function closeTagDialog() {
    tagDialog.classList.remove("active");
  }

  tagDialogClose.addEventListener("click", closeTagDialog);
  cancelTagBtn.addEventListener("click", closeTagDialog);

  // 更新当前标签显示
  function updateCurrentTagsDisplay() {
    if (tempTags.length === 0) {
      currentTags.innerHTML = "<p>尚未添加标签</p>";
      return;
    }

    let tagsHTML = "";
    for (const tag of tempTags) {
      tagsHTML += `
                <div class="scholar-tag">
                    ${tag}
                    <span class="delete-tag" data-tag="${tag}">×</span>
                </div>
            `;
    }
    currentTags.innerHTML = tagsHTML;

    // 添加删除标签事件
    const deleteButtons = currentTags.querySelectorAll(".delete-tag");
    deleteButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        const tag = this.dataset.tag;
        tempTags = tempTags.filter((t) => t !== tag);
        updateCurrentTagsDisplay();
      });
    });
  }

  // 点击预定义标签
  predefinedTags.forEach((tagBtn) => {
    tagBtn.addEventListener("click", function () {
      const tag = this.dataset.tag;
      if (!tempTags.includes(tag)) {
        tempTags.push(tag);
        updateCurrentTagsDisplay();
      }
    });
  });

  // 添加自定义标签
  addCustomTagBtn.addEventListener("click", function () {
    const customTag = customTagInput.value.trim();
    if (customTag && !tempTags.includes(customTag)) {
      tempTags.push(customTag);
      customTagInput.value = "";
      updateCurrentTagsDisplay();
    }
  });

  customTagInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      addCustomTagBtn.click();
    }
  });

  // 保存标签
  saveTagBtn.addEventListener("click", async function () {
    if (!activeNodeId) return;

    try {
      // 保存到本地缓存
      if (scholars[activeNodeId]) {
        scholars[activeNodeId].tags = [...tempTags];
      }

      // 更新标签显示
      updateScholarTags(activeNodeId);

      // 如果是主要学者，更新服务器端数据
      if (!scholars[activeNodeId].is_secondary) {
        await saveScholarTags(activeNodeId, tempTags);
      }

      closeTagDialog();
    } catch (error) {
      console.error("保存标签失败:", error);
      alert("保存标签失败，请重试");
    }
  });
}

// 保存学者标签到服务器
async function saveScholarTags(scholarId, tags) {
  try {
    // 使用新的API接口直接保存标签
    const response = await fetch("/api/scholars/update-tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: scholarId,
        tags: tags,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "未知错误");
    }

    return true;
  } catch (error) {
    console.error("保存标签出错:", error);
    throw error;
  }
}

// 更新学者标签显示
function updateScholarTags(scholarId) {
  const tagsContainer = document.querySelector("#scholar-tags .scholar-tags");
  const scholarData = scholars[scholarId];

  // 如果是关联学者，显示不可用信息
  if (scholarData && scholarData.is_secondary) {
    tagsContainer.textContent = "关联学者不支持标签";
    document.getElementById("tag-add-btn").style.display = "none"; // 隐藏添加标签按钮
    return;
  }

  // 恢复添加标签按钮
  document.getElementById("tag-add-btn").style.display = "";

  if (!scholarData || !scholarData.tags || scholarData.tags.length === 0) {
    tagsContainer.textContent = "无标签";
    return;
  }

  let tagsHTML = "";
  for (const tag of scholarData.tags) {
    // 添加data-tag属性以便应用特定的标签样式
    tagsHTML += `<span class="scholar-tag" data-tag="${tag}">${tag}</span>`;
  }

  tagsContainer.innerHTML = tagsHTML;
}

// 添加标签筛选功能
function setupTagFiltering() {
  // 收集所有标签
  const allTags = new Set();

  for (const scholarId in scholars) {
    const scholar = scholars[scholarId];
    if (scholar.tags && Array.isArray(scholar.tags)) {
      scholar.tags.forEach((tag) => allTags.add(tag));
    }
  }

  // 创建标签筛选区域
  if (allTags.size > 0) {
    const tagFiltersContainer = document.createElement("div");
    tagFiltersContainer.className = "toolbar-group tag-filters";
    tagFiltersContainer.innerHTML = "<span class='toolbar-label'>标签:</span>";

    const tagsContainer = document.createElement("div");
    tagsContainer.className = "filter-tags-container";

    allTags.forEach((tag) => {
      const tagSpan = document.createElement("span");
      tagSpan.className = "filter-tag";
      tagSpan.setAttribute("data-tag", tag);
      tagSpan.textContent = tag;
      tagSpan.addEventListener("click", function () {
        this.classList.toggle("active");
        filterByTagElements();
      });
      tagsContainer.appendChild(tagSpan);
    });

    tagFiltersContainer.appendChild(tagsContainer);
    
    // 添加到顶部工具栏的左侧
    const toolbarLeft = document.querySelector(".toolbar-left");
    if (toolbarLeft) {
      toolbarLeft.appendChild(tagFiltersContainer);
    }
  }
}

// 使用激活的标签元素进行筛选
function filterByTagElements() {
  const selectedTags = [];
  const activeTagElements = document.querySelectorAll(".filter-tag.active");

  // 如果没有选中任何标签，显示所有节点
  if (activeTagElements.length === 0) {
    cy.nodes().removeClass("hidden");
    return;
  }

  // 收集选中的标签
  activeTagElements.forEach((tagElement) => {
    selectedTags.push(tagElement.dataset.tag);
  });

  // 筛选节点
  cy.nodes().forEach((node) => {
    const nodeTags = node.data("tags") || [];
    // 如果节点没有选中的标签之一，隐藏它
    if (!selectedTags.some((tag) => nodeTags.includes(tag))) {
      node.addClass("hidden");
    } else {
      node.removeClass("hidden");
    }
  });
}

// 添加标签点击事件处理
function setupTagClickHandlers() {
  document.addEventListener("click", function (event) {
    // 检查是否点击的是标签
    const tagElement = event.target.closest(".scholar-tag");
    if (tagElement && !event.target.closest(".tag-filter-item")) {
      const tag = tagElement.textContent || tagElement.dataset.tag;
      highlightNodesByTag(tag);
    }
  });
}

// 高亮含有特定标签的节点
function highlightNodesByTag(tag) {
  // 重置当前高亮
  cy.nodes().removeClass("highlighted faded");

  // 找到包含该标签的节点
  const matchedNodes = cy.nodes().filter((node) => {
    const nodeTags = node.data("tags") || [];
    return nodeTags.includes(tag);
  });

  if (matchedNodes.length === 0) {
    return;
  }

  // 高亮匹配节点
  matchedNodes.addClass("highlighted");
  cy.elements().difference(matchedNodes).addClass("faded");

  // 更新视图居中显示匹配节点
  cy.fit(matchedNodes, 50);

  // 显示"返回全局视图"按钮
  document.getElementById("graph-view-btn").classList.remove("hidden");
}

// 初始化数据库
async function initializeDatabase() {
  if (
    !confirm(
      "警告：此操作将清空所有数据，包括学者数据、自定义关系和标签。此操作不可恢复！确定要继续吗？"
    )
  ) {
    return;
  }

  // 再次确认
  if (!confirm("最后确认：所有数据将被删除，确定要继续吗？")) {
    return;
  }

  showAdminStatus("正在初始化数据库...", "info");

  try {
    const response = await fetch("/api/initialize-database", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      showAdminStatus("数据库已成功初始化，页面将在3秒后刷新...", "success");

      // 3秒后刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } else {
      showAdminStatus(
        `初始化数据库失败: ${result.error || "未知错误"}`,
        "error"
      );
    }
  } catch (error) {
    console.error("初始化数据库出错:", error);
    showAdminStatus(`初始化数据库时发生错误: ${error.message}`, "error");
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", function() {
  // 先注册fcose布局插件
  if (window.cytoscape && window.fcose) {
    try {
      window.cytoscape.use(window.fcose);
      console.log("fcose布局注册成功");
      // 初始化主应用
      init();
    } catch (error) {
      console.error("注册fcose布局失败:", error);
      // 尝试使用我们的加载器
      loadLayoutLibraries(() => init());
    }
  } else {
    console.warn("fcose布局未加载，尝试动态加载...");
    // 使用我们的加载器
    loadLayoutLibraries(() => init());
  }
});

// 更新代表性论文列表
function updatePublications(scholarData) {
  const publicationListEl = document.getElementById("publication-list");
  
  // 如果是关联学者或没有论文数据
  if (scholarData.is_secondary || !scholarData.publications || scholarData.publications.length === 0) {
    publicationListEl.innerHTML = "<li>暂无论文数据</li>";
    return;
  }
  
  let pubHTML = "";
  const publications = scholarData.publications
  
  publications.forEach(pub => {
    const title = pub.title || "未知标题";
    
    const venue = pub.venue || "";
    const year = pub.year || "";
    const citedby = pub.citations || 0; // 使用citations字段
    
    // 构建论文HTML
    pubHTML += `
      <li class="publication-item">
        <div class="publication-title">${title}</div>
        <div class="publication-venue">${venue} ${year}
          ${citedby > 0 ? `<span class="citation-count"><i class="fas fa-quote-right"></i> ${citedby}</span>` : ""}
        </div>
      </li>
    `;
  });
  
  // 更新HTML
  publicationListEl.innerHTML = pubHTML;
  
  // 对所有论文标题和venue应用无省略样式
  setNoEllipsis(".publication-title");
  setNoEllipsis(".publication-venue");
}
