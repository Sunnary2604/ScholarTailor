/**
 * ScholarTailor - 添加学者与关系管理面板组件
 * 处理学者添加、批量添加以及关系管理功能
 */

import { showStatusMessage } from "../utils.js";
import { batchAddScholars, addRelationship } from "../api.js";
import eventBus from "../eventBus.js";
import {
  addNewScholar,
  getScholarOptions,
  reloadData,
} from "../dataManager.js";

// 组件私有状态
const state = {
  isVisible: false,
  activeTab: "scholars", // scholars 或 relationships
  isLoading: false,
};

// DOM元素引用
const elements = {
  modal: () => document.getElementById("add-scholar-modal"),
  closeBtn: () => document.getElementById("close-add-scholar-modal"),
  addScholarBtn: () => document.getElementById("add-new-scholar-btn"),
  batchAddBtn: () => document.getElementById("add-batch-scholars-btn"),
  nameInput: () => document.getElementById("add-scholar-input"),
  idInput: () => document.getElementById("add-scholar-id"),
  batchInput: () => document.getElementById("add-batch-scholars"),
  statusMsg: () => document.getElementById("add-scholar-status"),
  tabButtons: () =>
    document.querySelectorAll("#add-scholar-modal .tabs .tab-btn"),
  tabPanels: () => document.querySelectorAll(".tab-content"),
  scholarsTab: () => document.getElementById("add-scholars-tab"),
  relationshipsTab: () => document.getElementById("manage-relationships-tab"),
  sourceInput: () => document.getElementById("source-scholar-input"),
  sourceValue: () => document.getElementById("source-scholar-value"),
  targetInput: () => document.getElementById("target-scholar-input"),
  targetValue: () => document.getElementById("target-scholar-value"),
  relationTypeSelector: () => document.getElementById("relation-type"),
  addRelationBtn: () => document.getElementById("add-relation-btn"),
  panelTriggerBtn: () => document.getElementById("add-scholar-panel-btn"),
};

/**
 * 显示状态消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (info, success, error)
 */
function showAddScholarStatus(message, type = "info") {
  const statusDiv = elements.statusMsg();
  if (!statusDiv) return;

  statusDiv.textContent = message;
  statusDiv.className = "status-message " + type;

  // 3秒后自动清除成功信息，错误信息保留
  if (type !== "error") {
    setTimeout(() => {
      statusDiv.textContent = "";
      statusDiv.className = "status-message";
    }, 3000);
  }
}

// 渲染函数 - 根据状态更新UI
function render() {
  const modal = elements.modal();
  if (!modal) return;

  // 更新面板可见性
  if (state.isVisible) {
    modal.style.display = "block";
    // 面板显示时确保更新标签，但使用setTimeout避免争用问题
    setTimeout(() => {
      updateActiveTab();
    }, 50);
  } else {
    modal.style.display = "none";
  }
}

/**
 * 更新活跃选项卡
 */
function updateActiveTab() {
  // 注意：只选择添加面板模态窗口内的元素
  const modal = document.getElementById("add-scholar-modal");
  if (!modal) return;

  const tabButtons = modal.querySelectorAll(".tabs .tab-btn");
  const scholarsTab = document.getElementById("add-scholars-tab");
  const relationshipsTab = document.getElementById("manage-relationships-tab");

  console.log("当前活动标签:", state.activeTab);
  console.log("找到的标签按钮数量:", tabButtons.length);

  // 更新选项卡按钮状态
  tabButtons.forEach((btn) => {
    const tabName = btn.getAttribute("data-tab");
    console.log("按钮标签名:", tabName);
    if (tabName === state.activeTab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 隐藏所有标签内容
  if (scholarsTab) scholarsTab.classList.remove("active");
  if (relationshipsTab) relationshipsTab.classList.remove("active");

  // 显示当前活动标签内容
  if (state.activeTab === "scholars" && scholarsTab) {
    scholarsTab.classList.add("active");
    console.log("显示学者标签内容");
  } else if (state.activeTab === "relationships" && relationshipsTab) {
    relationshipsTab.classList.add("active");
    console.log("显示关系标签内容，加载关系数据");
    // 加载关系数据
    loadRelationshipData();
  }
}

/**
 * 加载关系管理所需数据
 */
function loadRelationshipData() {
  // 获取元素引用
  const sourceList = document.getElementById("source-scholar-list");
  const targetList = document.getElementById("target-scholar-list");
  const sourceInput = document.getElementById("source-scholar-input");
  const targetInput = document.getElementById("target-scholar-input");
  const sourceValue = document.getElementById("source-scholar-value");
  const targetValue = document.getElementById("target-scholar-value");

  if (!sourceList || !targetList) return;

  // 清空列表
  sourceList.innerHTML = "";
  targetList.innerHTML = "";

  // 使用dataManager.js中的函数获取学者选项
  getScholarOptions((options) => {
    // 按字典序排序学者名称
    options.sort((a, b) => {
      return a.name.localeCompare(b.name, "zh-CN");
    });

    console.log("排序后的学者列表:", options.map((o) => o.name).slice(0, 5));

    // 添加选项到datalist
    options.forEach(({ id, name }) => {
      // 创建源学者选项
      const sourceOption = document.createElement("option");
      sourceOption.value = name;
      sourceOption.dataset.id = id;
      sourceList.appendChild(sourceOption);

      // 创建目标学者选项
      const targetOption = document.createElement("option");
      targetOption.value = name;
      targetOption.dataset.id = id;
      targetList.appendChild(targetOption);
    });

    // 设置input事件监听器，更新隐藏字段的值
    if (sourceInput && sourceValue) {
      sourceInput.addEventListener("input", function () {
        // 查找匹配的选项
        const option = Array.from(sourceList.options).find(
          (opt) => opt.value === this.value
        );
        // 更新隐藏字段的值
        sourceValue.value = option ? option.dataset.id : "";
      });
    }

    if (targetInput && targetValue) {
      targetInput.addEventListener("input", function () {
        // 查找匹配的选项
        const option = Array.from(targetList.options).find(
          (opt) => opt.value === this.value
        );
        // 更新隐藏字段的值
        targetValue.value = option ? option.dataset.id : "";
      });
    }
  });
}

/**
 * 设置选项卡切换功能
 */
function setupTabSwitching() {
  const modal = document.getElementById("add-scholar-modal");
  if (!modal) {
    console.error("无法找到添加学者模态窗口");
    return;
  }

  const tabButtons = modal.querySelectorAll(".tabs .tab-btn");
  console.log("setupTabSwitching: 找到标签按钮数量", tabButtons.length);

  tabButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      const tabName = this.getAttribute("data-tab");
      console.log("标签切换: 点击了", tabName);
      if (tabName) {
        state.activeTab = tabName;
        updateActiveTab();
      }
    });
  });
}

/**
 * 添加单个学者
 */
function handleAddScholar() {
  const nameInput = elements.nameInput();
  const idInput = elements.idInput();
  const addNewScholarBtn = elements.addScholarBtn();

  if (!nameInput || !idInput || !addNewScholarBtn) return;

  const name = nameInput.value.trim();
  const scholarId = idInput.value.trim();

  if (!name && !scholarId) {
    showAddScholarStatus("请输入学者名称或ID", "error");
    return;
  }

  // 显示加载状态
  addNewScholarBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> 爬取中...';
  addNewScholarBtn.disabled = true;

  // 添加学者
  addNewScholar({ name, scholar_id: scholarId })
    .then((result) => {
      // 恢复按钮状态
      console.log("爬取学者结果:", result);
      addNewScholarBtn.innerHTML = "爬取学者";
      addNewScholarBtn.disabled = false;

      if (result && result.success) {
        nameInput.value = "";
        idInput.value = "";
        // 优先使用后端返回的scholar_name，如果没有则使用输入的name
        const displayName =
          result.scholar_name || name || result.scholar_id || "未知学者";
        showAddScholarStatus(`成功添加学者 ${displayName}`, "success");

        // 更新关系管理下拉菜单
        loadRelationshipData();

        // 发出学者添加事件
        eventBus.emit("scholar:added", result);

        // 重新加载数据并刷新图谱
        showAddScholarStatus("正在重新加载数据并刷新图谱...", "info");
        reloadData()
          .then(() => {
            showAddScholarStatus(
              `已刷新图谱，新增学者: ${displayName}`,
              "success"
            );
          })
          .catch((error) => {
            console.error("刷新图谱失败:", error);
            showAddScholarStatus("刷新图谱失败，请尝试手动刷新页面", "error");
          });
      } else {
        showAddScholarStatus(
          `添加学者失败: ${result?.error || "未知错误"}`,
          "error"
        );
      }
    })
    .catch((error) => {
      // 恢复按钮状态
      addNewScholarBtn.innerHTML = "爬取学者";
      addNewScholarBtn.disabled = false;
      showAddScholarStatus(
        `添加学者时出错: ${error.message || "未知错误"}`,
        "error"
      );
    });
}

/**
 * 批量添加学者
 */
function handleBatchAddScholars() {
  const batchInput = elements.batchInput();
  const batchAddBtn = elements.batchAddBtn();

  if (!batchInput || !batchAddBtn) return;

  const batchText = batchInput.value.trim();
  if (!batchText) {
    showAddScholarStatus("请输入要批量添加的学者", "error");
    return;
  }

  // 解析输入文本，每行一个学者
  const scholarLines = batchText.split("\n").filter((line) => line.trim());
  if (scholarLines.length === 0) {
    showAddScholarStatus("未找到有效的学者信息", "error");
    return;
  }

  // 显示加载状态
  batchAddBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> 批量爬取中...';
  batchAddBtn.disabled = true;
  showAddScholarStatus(
    `正在批量爬取 ${scholarLines.length} 位学者，请耐心等待...`,
    "info"
  );

  // 调用API批量添加
  batchAddScholars(scholarLines)
    .then((data) => {
      // 恢复按钮状态
      batchAddBtn.innerHTML = "批量爬取";
      batchAddBtn.disabled = false;

      if (data.success) {
        batchInput.value = "";
        showAddScholarStatus(
          `成功添加 ${data.added}/${scholarLines.length} 位学者`,
          "success"
        );

        // 更新关系管理下拉菜单
        loadRelationshipData();

        // 发出学者批量添加事件
        eventBus.emit("scholars:batchAdded", data);

        // 重新加载数据并刷新图谱
        if (data.added > 0) {
          showAddScholarStatus("正在重新加载数据并刷新图谱...", "info");
          reloadData()
            .then(() => {
              showAddScholarStatus(
                `已刷新图谱，新增 ${data.added} 位学者`,
                "success"
              );
            })
            .catch((error) => {
              console.error("刷新图谱失败:", error);
              showAddScholarStatus("刷新图谱失败，请尝试手动刷新页面", "error");
            });
        }
      } else {
        showAddScholarStatus(
          `批量添加学者失败: ${data.error || "未知错误"}`,
          "error"
        );
      }
    })
    .catch((error) => {
      // 恢复按钮状态
      batchAddBtn.innerHTML = "批量爬取";
      batchAddBtn.disabled = false;
      showAddScholarStatus(
        `批量添加学者时出错: ${error.message || "未知错误"}`,
        "error"
      );
    });
}

/**
 * 处理添加关系
 */
async function handleAddRelationship() {
  console.log("执行添加关系函数");
  const sourceValue = document.getElementById("source-scholar-value");
  const targetValue = document.getElementById("target-scholar-value");
  const sourceInput = document.getElementById("source-scholar-input");
  const targetInput = document.getElementById("target-scholar-input");
  const relationTypeSelect = elements.relationTypeSelector();
  const addRelationBtn = elements.addRelationBtn();

  if (!sourceValue || !targetValue || !relationTypeSelect || !addRelationBtn) {
    console.error("找不到必要的DOM元素", {
      sourceValue,
      targetValue,
      relationTypeSelect,
      addRelationBtn,
    });
    return;
  }

  const sourceId = sourceValue.value;
  const targetId = targetValue.value;
  const relationType = relationTypeSelect.value;

  console.log("添加关系参数:", { sourceId, targetId, relationType });

  // 验证输入
  if (!sourceId) {
    showAddScholarStatus("请选择或输入有效的源学者", "error");
    return;
  }

  if (!targetId) {
    showAddScholarStatus("请选择或输入有效的目标学者", "error");
    return;
  }

  if (!relationType) {
    showAddScholarStatus("请选择关系类型", "error");
    return;
  }

  if (sourceId === targetId) {
    showAddScholarStatus("不能选择相同的学者", "error");
    return;
  }

  // 禁用按钮防止重复提交
  addRelationBtn.disabled = true;
  addRelationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 添加中...';

  try {
    const data = {
      source_id: sourceId,
      target_id: targetId,
      type: relationType, // 修改为type，与后端API要求匹配
    };

    console.log("调用API添加关系:", data);
    const result = await addRelationship(data);
    console.log("API返回结果:", result);

    if (result.success) {
      showAddScholarStatus("关系添加成功", "success");

      // 清空输入框
      if (sourceInput) sourceInput.value = "";
      if (targetInput) targetInput.value = "";
      if (sourceValue) sourceValue.value = "";
      if (targetValue) targetValue.value = "";

      // 触发关系添加事件
      eventBus.emit("relationship:added", data);

      // 重新加载数据并刷新图谱，而不是刷新整个页面
      showAddScholarStatus("正在更新图谱以显示新增关系...", "info");
      reloadData()
        .then(() => {
          showAddScholarStatus("关系添加成功并更新图谱完成", "success");
        })
        .catch((error) => {
          console.error("刷新图谱失败:", error);
          showAddScholarStatus("刷新图谱失败，请尝试手动刷新页面", "error");
        });
    } else {
      showAddScholarStatus(
        `添加关系失败: ${result.error || "未知错误"}`,
        "error"
      );
    }
  } catch (error) {
    console.error("添加关系失败:", error);
    showAddScholarStatus(
      `添加关系失败: ${error.message || "未知错误"}`,
      "error"
    );
  } finally {
    // 恢复按钮状态
    addRelationBtn.disabled = false;
    addRelationBtn.innerHTML = "添加关系";
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  const modal = elements.modal();
  const closeBtn = elements.closeBtn();
  const addScholarBtn = elements.addScholarBtn();
  const batchAddBtn = elements.batchAddBtn();
  const addRelationBtn = elements.addRelationBtn();
  const panelTriggerBtn = elements.panelTriggerBtn();

  if (!modal) return;

  // 面板触发按钮
  if (panelTriggerBtn) {
    panelTriggerBtn.addEventListener("click", () => {
      show();
    });
  }

  // 右上角关闭按钮
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      hide();
    });
  }

  // 点击模态框背景关闭
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        hide();
      }
    });
  }

  // 添加学者按钮
  if (addScholarBtn) {
    addScholarBtn.addEventListener("click", handleAddScholar);
  }

  // 批量添加学者按钮
  if (batchAddBtn) {
    batchAddBtn.addEventListener("click", handleBatchAddScholars);
  }

  // 添加关系按钮
  if (addRelationBtn) {
    addRelationBtn.addEventListener("click", handleAddRelationship);
  }

  // 选项卡切换
  const tabBtns = document.querySelectorAll(
    "#add-scholar-modal .tabs .tab-btn"
  );
  if (tabBtns && tabBtns.length > 0) {
    console.log("找到标签按钮，正在绑定点击事件", tabBtns.length);
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const tabName = btn.getAttribute("data-tab");
        console.log("点击标签按钮:", tabName);
        if (tabName) {
          state.activeTab = tabName;
          // 直接调用updateActiveTab而不是render，这样更直接针对标签切换
          updateActiveTab();
        }
      });
    });
  }

  // ESC键关闭面板
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isVisible) {
      hide();
    }
  });
}

/**
 * 显示添加学者面板
 */
function show() {
  state.isVisible = true;
  render();

  // 触发事件
  eventBus.emit("addPanel:show");
}

/**
 * 隐藏添加学者面板
 */
function hide() {
  state.isVisible = false;
  render();

  // 触发事件
  eventBus.emit("addPanel:hide");
}

// 组件公开API
export default {
  // 初始化组件
  init() {
    setupEventListeners();
    // 单独设置标签切换功能
    setTimeout(() => {
      setupTabSwitching();
      console.log("标签切换功能已初始化");
    }, 100); // 延迟一点以确保DOM元素已加载
    return this;
  },

  // 显示面板
  show() {
    show();
    return this;
  },

  // 隐藏面板
  hide() {
    hide();
    return this;
  },

  // 切换到特定选项卡
  switchToTab(tabName) {
    if (tabName === "scholars" || tabName === "relationships") {
      state.activeTab = tabName;
      render();
    }
    return this;
  },

  // 重新加载关系数据
  reloadRelationships() {
    loadRelationshipData();
    return this;
  },
};
