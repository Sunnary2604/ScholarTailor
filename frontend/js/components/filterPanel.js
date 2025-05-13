/**
 * ScholarTailor - 筛选面板组件
 * 处理所有与筛选面板相关的交互和显示
 */

import { showStatusMessage } from "../utils.js";
import { applyAdvancedFilter } from "../api.js";
import { updateNetworkWithFilteredData } from "../dataManager.js";
import eventBus from "../eventBus.js";

// 组件私有状态
const state = {
  isVisible: false,
  filterConditions: {
    minConnections: 2,
    showPrimary: true,
    showSecondary: true,
    showCoauthor: true,
    showAdvisor: true,
    showColleague: true,
    hideNotInterested: true,
    customFilters: [],
  },
  // 追踪自定义筛选条件ID
  nextFilterId: 1,
  // 当前活跃的标签筛选
  activeTagFilters: [],
};

// DOM元素引用
const elements = {
  panel: () => document.getElementById("filter-panel"),
  overlay: () => document.getElementById("filter-overlay"),
  closeBtn: () => document.getElementById("close-filter-panel"),
  applyBtn: () => document.getElementById("apply-filters-btn"),
  resetBtn: () => document.getElementById("reset-filters-btn"),
  addFilterBtn: () => document.getElementById("add-filter-btn"),
  minConnectionsSlider: () => document.getElementById("min-connections"),
  minConnectionsValue: () => document.getElementById("min-connections-value"),
  showPrimary: () => document.getElementById("show-primary"),
  showSecondary: () => document.getElementById("show-secondary"),
  showCoauthor: () => document.getElementById("show-coauthor"),
  showAdvisor: () => document.getElementById("show-advisor"),
  showColleague: () => document.getElementById("show-colleague"),
  hideNotInterested: () => document.getElementById("hide-not-interested"),
  customFiltersContainer: () =>
    document.getElementById("custom-filters-container"),
  statusMessage: () => document.getElementById("filter-status"),
  tagFiltersContainer: () => document.querySelector(".tag-filters"),
};

// 渲染函数 - 根据状态更新UI
function render() {
  const panel = elements.panel();
  const overlay = elements.overlay();

  if (!panel || !overlay) return;

  // 更新面板可见性
  if (state.isVisible) {
    panel.classList.add("visible");
    overlay.classList.add("visible");
  } else {
    panel.classList.remove("visible");
    overlay.classList.remove("visible");
  }

  // 更新筛选条件
  updateFilterControls();
}

/**
 * 更新筛选控件的值
 */
function updateFilterControls() {
  // 更新连接数滑块
  const minConnectionsSlider = elements.minConnectionsSlider();
  const minConnectionsValue = elements.minConnectionsValue();

  if (minConnectionsSlider && minConnectionsValue) {
    minConnectionsSlider.value = state.filterConditions.minConnections;
    minConnectionsValue.textContent = state.filterConditions.minConnections;
  }

  // 更新节点类型复选框
  const showPrimary = elements.showPrimary();
  const showSecondary = elements.showSecondary();

  if (showPrimary) showPrimary.checked = state.filterConditions.showPrimary;
  if (showSecondary)
    showSecondary.checked = state.filterConditions.showSecondary;

  // 更新关系类型复选框
  const showCoauthor = elements.showCoauthor();
  const showAdvisor = elements.showAdvisor();
  const showColleague = elements.showColleague();

  if (showCoauthor) showCoauthor.checked = state.filterConditions.showCoauthor;
  if (showAdvisor) showAdvisor.checked = state.filterConditions.showAdvisor;
  if (showColleague)
    showColleague.checked = state.filterConditions.showColleague;

  // 更新隐藏不感兴趣选项（高级筛选）
  const hideNotInterested = elements.hideNotInterested();
  if (hideNotInterested)
    hideNotInterested.checked = state.filterConditions.hideNotInterested;
}

/**
 * 添加筛选条件
 */
function addFilterCondition() {
  const customFiltersContainer = elements.customFiltersContainer();
  if (!customFiltersContainer) return;

  // 创建筛选条件项
  const filterItem = document.createElement("div");
  filterItem.className = "custom-filter-item";

  // 生成唯一ID
  const filterId = "filter-" + state.nextFilterId++;
  filterItem.id = filterId;

  // 添加筛选条件内容
  filterItem.innerHTML = `
    <div class="filter-content">
      <div class="filter-condition-row">
        <select class="filter-dimension-select" onchange="window.filterPanelMethods.updateFilterOperators(this)">
          <option value="">-- 选择筛选维度 --</option>
          <optgroup label="学者属性">
            <option value="interestKeyword" data-type="scholar">研究方向</option>
            <option value="tagFilter" data-type="scholar">学者标签</option>
            <option value="affiliationKeyword" data-type="scholar">所属机构</option>
            <option value="minCitations" data-type="scholar">引用次数</option>
            <option value="minHIndex" data-type="scholar">H指数</option>
          </optgroup>
          <optgroup label="论文属性">
            <option value="venueKeyword" data-type="publication">期刊/会议名</option>
            <option value="yearFrom" data-type="publication">发表年份起</option>
            <option value="yearTo" data-type="publication">发表年份止</option>
            <option value="paperTitleKeyword" data-type="publication">论文标题</option>
            <option value="minPaperCitations" data-type="publication">论文引用次数</option>
          </optgroup>
          <optgroup label="机构属性">
            <option value="countryKeyword" data-type="institution">所在国家/地区</option>
            <option value="institutionType" data-type="institution">机构类型</option>
          </optgroup>
        </select>
        
        <select class="filter-operator-select">
          <option value="contains">包含</option>
        </select>
      </div>
      
      <input type="text" class="filter-value-input" placeholder="输入筛选值">

    </div>
     <button class="remove-filter-btn" onclick="window.filterPanelMethods.removeFilterCondition('${filterId}')">
        <i class="fas fa-times fa-lg"></i>
      </button>
  `;

  // 添加到容器
  customFiltersContainer.appendChild(filterItem);
}

/**
 * 移除筛选条件
 * @param {string} filterId - 筛选条件ID
 */
function removeFilterCondition(filterId) {
  const filterItem = document.getElementById(filterId);
  if (filterItem) {
    filterItem.remove();
  }
}

/**
 * 更新筛选操作符
 * @param {HTMLElement} dimensionSelect - 维度选择元素
 */
function updateFilterOperators(dimensionSelect) {
  const filterItem = dimensionSelect.closest(".custom-filter-item");
  if (!filterItem) return;

  const operatorSelect = filterItem.querySelector(".filter-operator-select");
  const valueInput = filterItem.querySelector(".filter-value-input");

  if (!operatorSelect || !valueInput) return;

  // 清空现有选项
  operatorSelect.innerHTML = "";

  // 根据选择的维度添加适当的操作符
  const dimension = dimensionSelect.value;
  const selectedOption = dimensionSelect.options[dimensionSelect.selectedIndex];
  const filterType = selectedOption.getAttribute("data-type") || "";

  // 设置筛选类型
  filterItem.setAttribute("data-filter-type", filterType);

  // 根据维度类型设置操作符和输入类型
  if (
    dimension === "minCitations" ||
    dimension === "minHIndex" ||
    dimension === "minPaperCitations" ||
    dimension === "yearFrom" ||
    dimension === "yearTo"
  ) {
    // 数值比较操作符
    operatorSelect.innerHTML = `
      <option value="gt">大于</option>
      <option value="lt">小于</option>
      <option value="eq">等于</option>
    `;

    // 如果是数字类型的输入框
    if (valueInput.tagName.toLowerCase() === "select") {
      // 如果当前是select，需要替换为input
      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.className = "filter-value-input";
      numInput.min = "0";

      // 年份特殊处理
      if (dimension === "yearFrom" || dimension === "yearTo") {
        numInput.min = "1900";
        numInput.max = "2100";
        numInput.placeholder =
          dimension === "yearFrom" ? "起始年份" : "结束年份";
      } else {
        numInput.placeholder = "输入数值";
      }

      // 替换元素
      valueInput.parentNode.replaceChild(numInput, valueInput);
    } else {
      // 已经是input，只需调整属性
      valueInput.type = "number";
      valueInput.min = "0";

      // 年份特殊处理
      if (dimension === "yearFrom" || dimension === "yearTo") {
        valueInput.min = "1900";
        valueInput.max = "2100";
        valueInput.placeholder =
          dimension === "yearFrom" ? "起始年份" : "结束年份";
      } else {
        valueInput.placeholder = "输入数值";
      }
    }
  } else if (dimension === "tagFilter" || dimension === "institutionType") {
    // 标签或机构类型，使用选择框
    operatorSelect.innerHTML = `
      <option value="eq">等于</option>
    `;

    // 如果当前不是select，需要替换
    if (valueInput.tagName.toLowerCase() !== "select") {
      // 创建选择框
      const selectBox = document.createElement("select");
      selectBox.className = "filter-value-input";

      if (dimension === "tagFilter") {
        // 加载标签选项
        selectBox.innerHTML = `
          <option value="">-- 选择标签 --</option>
          <option value="SameField">相同领域</option>
          <option value="Interested">感兴趣</option>
          <option value="HighImpact">高影响力</option>
        `;
        // 添加用户自定义标签
        loadTagsForFilter(selectBox);
      } else if (dimension === "institutionType") {
        // 机构类型选项
        selectBox.innerHTML = `
          <option value="">-- 选择机构类型 --</option>
          <option value="university">大学</option>
          <option value="research">研究所</option>
          <option value="industry">企业</option>
          <option value="government">政府机构</option>
        `;
      }

      // 替换元素
      valueInput.parentNode.replaceChild(selectBox, valueInput);
    }
  } else {
    // 文本搜索操作符
    operatorSelect.innerHTML = `
      <option value="contains">包含</option>
      <option value="equals">等于</option>
    `;

    // 如果不是普通文本输入框，需要替换
    if (
      valueInput.tagName.toLowerCase() !== "input" ||
      valueInput.type !== "text"
    ) {
      // 创建文本输入框
      const textInput = document.createElement("input");
      textInput.type = "text";
      textInput.className = "filter-value-input";
      textInput.placeholder = "输入关键词";

      // 替换元素
      valueInput.parentNode.replaceChild(textInput, valueInput);
    } else {
      // 已经是文本输入框，只需调整属性
      valueInput.type = "text";
      valueInput.placeholder = "输入关键词";
    }
  }
}

/**
 * 加载学者标签到筛选选项中
 * @param {HTMLSelectElement} selectElement - 可选的标签选择元素
 */
function loadTagsForFilter(selectElement = null) {
  // 如果提供了选择元素，使用它，否则使用默认的选择器
  const tagSelect = selectElement || document.getElementById("filter-tag");
  if (!tagSelect) return;

  // 清除除默认选项外的所有选项
  const defaultOptions = Array.from(tagSelect.options).filter(
    (option) =>
      option.value === "" ||
      option.value === "SameField" ||
      option.value === "Interested" ||
      option.value === "HighImpact"
  );

  tagSelect.innerHTML = "";
  defaultOptions.forEach((option) => tagSelect.appendChild(option));

  // 收集系统中的所有标签
  const allTags = new Set();
  for (const scholarId in window.scholars) {
    const scholar = window.scholars[scholarId];
    if (scholar.tags && Array.isArray(scholar.tags)) {
      scholar.tags.forEach((tag) => {
        // 跳过已有的默认标签
        if (
          tag !== "SameField" &&
          tag !== "Interested" &&
          tag !== "HighImpact"
        ) {
          allTags.add(tag);
        }
      });
    }
  }

  // 添加标签到选择器
  allTags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    tagSelect.appendChild(option);
  });
}

/**
 * 应用高级筛选条件
 */
function applyAdvancedFilters() {
  // 显示加载状态
  showFilterStatus("正在应用筛选条件...", "info");

  // 收集基本筛选条件
  const minConnections = parseInt(elements.minConnectionsSlider().value) || 1;
  const showPrimary = elements.showPrimary().checked;
  const showSecondary = elements.showSecondary().checked;
  const showCoauthor = elements.showCoauthor().checked;
  const showAdvisor = elements.showAdvisor().checked;
  const showColleague = elements.showColleague().checked;
  const hideNotInterested = elements.hideNotInterested().checked;

  // 更新状态
  state.filterConditions.minConnections = minConnections;
  state.filterConditions.showPrimary = showPrimary;
  state.filterConditions.showSecondary = showSecondary;
  state.filterConditions.showCoauthor = showCoauthor;
  state.filterConditions.showAdvisor = showAdvisor;
  state.filterConditions.showColleague = showColleague;
  state.filterConditions.hideNotInterested = hideNotInterested;

  // 初始化筛选参数对象
  const filterParams = {
    minConnections,
    showPrimary,
    showSecondary,
    showCoauthor,
    showAdvisor,
    showColleague,
    hideNotInterested,
  };

  // 收集自定义筛选条件
  const customFilters = document.querySelectorAll(".custom-filter-item");
  let hasAdvancedFilters = false;

  customFilters.forEach((filter) => {
    const dimensionSelect = filter.querySelector(".filter-dimension-select");
    const operatorSelect = filter.querySelector(".filter-operator-select");
    const valueInput = filter.querySelector(".filter-value-input");

    if (!dimensionSelect || !operatorSelect || !valueInput) return;

    const dimension = dimensionSelect.value;
    const operator = operatorSelect.value;
    let value = valueInput.value;

    // 跳过未设置的筛选条件
    if (!dimension || !value) return;

    // 对于数值类型，转换为数字
    if (
      dimensionSelect.options[dimensionSelect.selectedIndex].getAttribute(
        "data-type"
      ) === "scholar" &&
      (dimension === "minCitations" || dimension === "minHIndex")
    ) {
      value = parseInt(value) || 0;
    } else if (
      dimensionSelect.options[dimensionSelect.selectedIndex].getAttribute(
        "data-type"
      ) === "publication" &&
      (dimension === "yearFrom" ||
        dimension === "yearTo" ||
        dimension === "minPaperCitations")
    ) {
      value = parseInt(value) || 0;
    }

    // 根据操作符处理值
    if (operator === "contains") {
      // 适用于文本搜索
      filterParams[dimension] = value;
    } else if (operator === "gt" && typeof value === "number") {
      // 大于
      filterParams[dimension] = value;
    } else if (operator === "lt" && typeof value === "number") {
      // 小于 - 需要后端支持
      filterParams[dimension + "Lt"] = value;
    } else if (operator === "eq") {
      // 等于
      filterParams[dimension] = value;
    } else if (operator === "startsWith" || operator === "endsWith") {
      // 开头/结尾匹配 - 需要后端支持
      filterParams[
        dimension + operator.charAt(0).toUpperCase() + operator.slice(1)
      ] = value;
    }

    hasAdvancedFilters = true;
  });

  // 修改这里：始终使用API进行筛选
  // 由于"隐藏不感兴趣的学者"选项的处理需要后端支持，所以我们总是使用API
  applyAdvancedFilterViaAPI(filterParams);

  // 触发筛选应用事件
  eventBus.emit("filter:applied", {
    params: filterParams,
    hasAdvancedFilters,
  });

  // 关闭筛选面板
  hide();
}

/**
 * 通过API应用高级筛选条件
 * @param {Object} filterParams - 筛选参数
 */
function applyAdvancedFilterViaAPI(filterParams) {
  // 检查参数有效性
  if (
    !filterParams ||
    typeof filterParams !== "object" ||
    Array.isArray(filterParams)
  ) {
    console.error("无效的筛选参数:", filterParams);
    showFilterStatus("筛选参数无效，使用基本筛选", "error");
    applyFilters();
    return;
  }

  // 确保必要的基本筛选参数存在
  if (typeof filterParams.minConnections !== "number") {
    filterParams.minConnections =
      parseInt(elements.minConnectionsSlider().value) || 1;
  }

  if (typeof filterParams.showPrimary !== "boolean") {
    filterParams.showPrimary = elements.showPrimary().checked;
  }

  if (typeof filterParams.showSecondary !== "boolean") {
    filterParams.showSecondary = elements.showSecondary().checked;
  }

  // 获取不感兴趣的学者过滤选项
  if (typeof filterParams.hideNotInterested !== "boolean") {
    const hideNotInterested = elements.hideNotInterested();
    // 确保值是布尔类型，不是字符串
    if (hideNotInterested) {
      filterParams.hideNotInterested = hideNotInterested.checked;
    } else {
      // 默认值为true
      filterParams.hideNotInterested = true;
    }
  }

  console.log("发送筛选请求:", filterParams);
  console.log(
    "hideNotInterested的值:",
    filterParams.hideNotInterested,
    "类型:",
    typeof filterParams.hideNotInterested
  );

  // 输出原始checkbox状态，方便调试
  const hideNotInterestedCheckbox = elements.hideNotInterested();
  if (hideNotInterestedCheckbox) {
    console.log("原始checkbox状态:", hideNotInterestedCheckbox.checked);
  }

  // 使用API函数应用筛选
  applyAdvancedFilter(filterParams)
    .then((data) => {
      if (data.success) {
        // 筛选成功，更新图表
        updateNetworkWithFilteredData(data.data, {
          hideNotInterested: filterParams.hideNotInterested,
        });
        showFilterStatus(
          `筛选成功：找到 ${data.data.nodes.length} 个学者节点`,
          "success"
        );

        // 导入graphPanel模块并应用最优布局
        import("../components/graphPanel.js").then((graphPanelModule) => {
          const graphPanel = graphPanelModule.default;
          // 延迟一些时间等待图谱更新完成
          setTimeout(() => {
            graphPanel.applyOptimalLayout();
          }, 500);
        });
      } else {
        showFilterStatus(`筛选错误：${data.error || "未知错误"}`, "error");
        // 出错时应用基本筛选
        applyFilters();
      }
    })
    .catch((error) => {
      console.error("应用高级筛选时出错:", error);
      showFilterStatus("应用筛选时发生错误，使用基本筛选", "error");
      // 出错时应用基本筛选
      applyFilters();
    });
}

/**
 * 应用基本筛选条件
 */
function applyFilters() {
  if (!window.cy) return;

  // 获取筛选条件
  const minConnections = parseInt(elements.minConnectionsSlider().value) || 1;
  const showPrimary = elements.showPrimary().checked;
  const showSecondary = elements.showSecondary().checked;
  const showCoauthor = elements.showCoauthor().checked;
  const showAdvisor = elements.showAdvisor().checked;
  const showColleague = elements.showColleague().checked;

  // 获取节点总数
  const totalNodes = window.cy.nodes().length;
  // 移除基于节点总数的筛选逻辑
  const shouldApplyConnectionFilter = false; // 始终不应用连接数筛选

  // 筛选节点
  window.cy.nodes().forEach((node) => {
    // 初始状态：显示所有节点
    node.removeClass("filtered");

    // 基于连接数的筛选逻辑
    const connections = node.connectedEdges().length;
    if (connections < minConnections) {
      node.addClass("filtered");
    }

    // 根据节点类型筛选
    const nodeType = node.data("nodeType");
    if (
      (nodeType === "primary" && !showPrimary) ||
      (nodeType === "secondary" && !showSecondary)
    ) {
      node.addClass("filtered");
    }
  });

  // 筛选边
  window.cy.edges().forEach((edge) => {
    // 初始状态：显示所有边
    edge.removeClass("filtered");

    // 根据关系类型筛选
    const relationType = edge.data("relationType");
    if (
      (relationType === "coauthor" && !showCoauthor) ||
      (relationType === "advisor" && !showAdvisor) ||
      (relationType === "colleague" && !showColleague)
    ) {
      edge.addClass("filtered");
    }

    // 如果边连接的任一节点被过滤掉，则边也应被过滤
    const sourceNode = edge.source();
    const targetNode = edge.target();
    if (sourceNode.hasClass("filtered") || targetNode.hasClass("filtered")) {
      edge.addClass("filtered");
    }
  });

  // 显示筛选后的图谱
  updateFilteredGraph();
}

/**
 * 重置高级筛选条件
 */
function resetAdvancedFilters() {
  // 重置基本筛选
  resetBasicFilters();

  // 清空自定义筛选条件
  const customFiltersContainer = elements.customFiltersContainer();
  if (customFiltersContainer) {
    customFiltersContainer.innerHTML = "";
  }

  // 显示状态消息
  showFilterStatus("已重置所有筛选条件", "info");

  // 重置图谱显示 - 显示所有节点和边
  if (window.cy) {
    window.cy.elements().removeClass("filtered");
    window.cy.elements().style("display", "element");
  }

  // 触发筛选重置事件
  eventBus.emit("filter:reset");
}

/**
 * 重置基本筛选条件
 */
function resetBasicFilters() {
  // 重置连接数筛选
  const minConnectionsSlider = elements.minConnectionsSlider();
  const minConnectionsValue = elements.minConnectionsValue();
  if (minConnectionsSlider) {
    minConnectionsSlider.value = 1;
    if (minConnectionsValue) {
      minConnectionsValue.textContent = "1";
    }
  }

  // 重置节点类型筛选
  const showPrimary = elements.showPrimary();
  const showSecondary = elements.showSecondary();
  if (showPrimary) showPrimary.checked = true;
  if (showSecondary) showSecondary.checked = true;

  // 重置关系类型筛选
  const showCoauthor = elements.showCoauthor();
  const showAdvisor = elements.showAdvisor();
  const showColleague = elements.showColleague();
  if (showCoauthor) showCoauthor.checked = true;
  if (showAdvisor) showAdvisor.checked = true;
  if (showColleague) showColleague.checked = true;

  // 重置隐藏不感兴趣选项（高级筛选）
  const hideNotInterested = elements.hideNotInterested();
  if (hideNotInterested) hideNotInterested.checked = true;

  // 更新状态
  state.filterConditions = {
    minConnections: 1,
    showPrimary: true,
    showSecondary: true,
    showCoauthor: true,
    showAdvisor: true,
    showColleague: true,
    hideNotInterested: true,
    customFilters: [],
  };
}

/**
 * 显示筛选状态消息
 * @param {string} message - 状态消息
 * @param {string} type - 消息类型 (info, success, error)
 */
function showFilterStatus(message, type = "info") {
  const statusElement = elements.statusMessage();
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = "status-message " + type;
}

/**
 * 更新筛选后的图谱
 */
function updateFilteredGraph() {
  // 根据筛选条件隐藏/显示元素
  window.cy.elements().forEach((ele) => {
    if (ele.hasClass("filtered")) {
      ele.style("display", "none");
    } else {
      ele.style("display", "element");
    }
  });

  // 检查是否所有节点都被过滤掉了
  const visibleNodes = window.cy
    .nodes()
    .filter((node) => !node.hasClass("filtered"));
  if (visibleNodes.length === 0) {
    // 没有可见节点，显示所有节点，并提示用户
    window.cy.nodes().style("display", "element");
    window.cy.edges().style("display", "element");
    showFilterStatus("当前筛选条件下没有匹配的节点，已显示所有节点", "warning");

    // 重置节点过滤状态，但保留筛选条件设置
    window.cy.elements().removeClass("filtered");
  }
}

/**
 * 设置标签筛选UI
 * 从scholars数据中收集所有标签，并创建标签筛选UI
 */
function setupTagFiltering() {
  // 收集所有标签
  const allTags = new Set();

  for (const scholarId in window.scholars) {
    const scholar = window.scholars[scholarId];
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

/**
 * 使用激活的标签元素进行筛选
 */
function filterByTagElements() {
  const selectedTags = [];
  const activeTagElements = document.querySelectorAll(".filter-tag.active");

  // 更新状态
  state.activeTagFilters = [];

  // 如果没有选中任何标签，显示所有节点
  if (activeTagElements.length === 0) {
    window.cy.nodes().removeClass("hidden");
    return;
  }

  // 收集选中的标签
  activeTagElements.forEach((tagElement) => {
    const tag = tagElement.dataset.tag;
    selectedTags.push(tag);
    state.activeTagFilters.push(tag);
  });

  // 筛选节点
  window.cy.nodes().forEach((node) => {
    const nodeTags = node.data("tags") || [];
    // 如果节点没有选中的标签之一，隐藏它
    if (!selectedTags.some((tag) => nodeTags.includes(tag))) {
      node.addClass("hidden");
    } else {
      node.removeClass("hidden");
    }
  });

  // 触发筛选应用事件
  eventBus.emit("tagFilter:applied", {
    tags: selectedTags,
  });
}

// 初始化事件监听
function setupEventListeners() {
  // 打开筛选面板
  const filterBtn = document.getElementById("filter-btn");
  if (filterBtn) {
    filterBtn.addEventListener("click", show);
  }

  // 关闭筛选面板
  const closeBtn = elements.closeBtn();
  if (closeBtn) {
    closeBtn.addEventListener("click", hide);
  }

  // 点击遮罩层关闭筛选面板
  const overlay = elements.overlay();
  if (overlay) {
    overlay.addEventListener("click", hide);
  }

  // 滑块值实时更新
  const minConnectionsSlider = elements.minConnectionsSlider();
  const minConnectionsValue = elements.minConnectionsValue();
  if (minConnectionsSlider && minConnectionsValue) {
    minConnectionsSlider.addEventListener("input", function () {
      minConnectionsValue.textContent = this.value;
    });
  }

  // 应用筛选按钮
  const applyBtn = elements.applyBtn();
  if (applyBtn) {
    applyBtn.addEventListener("click", applyAdvancedFilters);
  }

  // 重置筛选按钮
  const resetBtn = elements.resetBtn();
  if (resetBtn) {
    resetBtn.addEventListener("click", resetAdvancedFilters);
  }

  // 添加筛选条件按钮
  const addFilterBtn = elements.addFilterBtn();
  if (addFilterBtn) {
    addFilterBtn.addEventListener("click", addFilterCondition);
  }

  // 将筛选函数暴露给全局作用域，以便HTML中的onclick调用
  window.filterPanelMethods = {
    removeFilterCondition,
    updateFilterOperators,
  };

  // 设置标签筛选UI
  setupTagFiltering();

  // 监听数据加载事件
  eventBus.on("data:loaded", () => {
    setupTagFiltering();
  });
}

/**
 * 显示筛选面板
 */
function show() {
  state.isVisible = true;
  render();

  // 触发事件
  eventBus.emit("filter:show");
}

/**
 * 隐藏筛选面板
 */
function hide() {
  state.isVisible = false;
  render();

  // 触发事件
  eventBus.emit("filter:hide");
}

// 组件公开API
export default {
  // 初始化组件
  init() {
    setupEventListeners();
    return this;
  },

  // 显示筛选面板
  show() {
    show();
    return this;
  },

  // 隐藏筛选面板
  hide() {
    hide();
    return this;
  },

  // 应用筛选
  applyFilters() {
    applyFilters();
    return this;
  },

  // 重置筛选
  resetFilters() {
    resetAdvancedFilters();
    return this;
  },

  // 添加筛选条件
  addFilterCondition() {
    addFilterCondition();
    return this;
  },

  // 获取当前筛选条件
  getFilterConditions() {
    return {
      ...state.filterConditions,
      activeTagFilters: [...state.activeTagFilters],
    };
  },

  // 设置标签筛选
  setupTagFiltering() {
    setupTagFiltering();
    return this;
  },

  // 筛选标签
  filterByTagElements() {
    filterByTagElements();
    return this;
  },
};
