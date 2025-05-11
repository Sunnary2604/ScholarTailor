/**
 * ScholarTailor - 管理面板组件
 * 处理管理面板相关功能，包括学者管理、数据初始化和迁移等功能
 */

import { showStatusMessage } from "../utils.js";
import { migrateData, initializeDatabase, batchAddScholars } from "../api.js";
import { getScholarOptions } from "../dataManager.js";
import eventBus from "../eventBus.js";

// 组件私有状态
const state = {
  isVisible: false,
  activeTab: "tab-scholars", // 当前活动选项卡: tab-scholars, tab-relationships
  isLoading: false,
};

// DOM元素引用
const elements = {
  adminModal: () => document.getElementById("admin-modal"),
  closeModalBtn: () => document.querySelector(".close-modal"),
  closeAdminBtn: () => document.getElementById("close-admin-btn"),
  adminBtn: () => document.getElementById("admin-btn"),
  statusElement: () => document.getElementById("admin-status"),
  initDbBtn: () => document.getElementById("init-db-btn"),
  migrateDataBtn: () => document.getElementById("migrate-data-btn"),
  tabButtons: () => document.querySelectorAll(".tab-btn"),
  tabContents: () => document.querySelectorAll(".tab-content"),
  batchInput: () => document.getElementById("batch-scholars"),
  batchAddBtn: () => document.getElementById("batch-add-btn"),
};

/**
 * 显示管理面板状态消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (info, success, error)
 */
function showAdminStatus(message, type = "info") {
  const statusDiv = elements.statusElement();
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

  // 触发事件
  eventBus.emit("admin:status", { message, type });
}

/**
 * 为按钮添加加载状态
 * @param {HTMLElement} button - 按钮元素
 * @param {boolean} isLoading - 是否处于加载状态
 * @param {string} originalText - 原始文本(可选，仅在isLoading=false时需要)
 * @returns {string} 返回按钮原始文本(仅在isLoading=true时)
 */
function setButtonLoading(button, isLoading, originalText) {
  if (isLoading) {
    const btnText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    return btnText;
  } else {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

/**
 * 设置初始化数据库按钮
 */
function setupInitDbBtn() {
  const initDbBtn = elements.initDbBtn();
  if (!initDbBtn) return;

  initDbBtn.addEventListener("click", async () => {
    // 询问用户确认
    if (!confirm("警告：此操作将清空所有数据！确定要继续吗？")) {
      return;
    }

    // 再次确认
    if (!confirm("再次确认：此操作无法撤销，所有数据将被删除！")) {
      return;
    }

    // 设置按钮加载状态
    const originalBtnText = setButtonLoading(initDbBtn, true);

    try {
      const result = await initializeDatabase();

      if (result.success) {
        showAdminStatus("数据库已成功初始化", "success");
        // 发送事件通知
        eventBus.emit("admin:dbInitialized", { success: true });
        // 刷新页面
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showAdminStatus(
          `初始化数据库失败: ${result.error || "未知错误"}`,
          "error"
        );
        // 发送事件通知
        eventBus.emit("admin:dbInitialized", {
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      showAdminStatus(`初始化数据库时出错: ${error.message}`, "error");
      // 发送事件通知
      eventBus.emit("admin:dbInitialized", {
        success: false,
        error: error.message,
      });
    } finally {
      // 恢复按钮状态
      setButtonLoading(initDbBtn, false, originalBtnText);
    }
  });
}

/**
 * 设置数据迁移按钮
 */
function setupMigrateDataBtn() {
  const migrateDataBtn = elements.migrateDataBtn();
  if (!migrateDataBtn) return;

  migrateDataBtn.addEventListener("click", async () => {
    // 询问用户确认
    if (
      !confirm(
        "警告：此操作将清空数据库并重新导入所有文件，可能需要较长时间！确定要继续吗？"
      )
    ) {
      return;
    }

    // 再次确认
    if (!confirm("再次确认：此操作无法撤销，所有现有数据将被替换！")) {
      return;
    }

    // 设置按钮加载状态
    const originalBtnText = setButtonLoading(migrateDataBtn, true);

    try {
      const result = await migrateData();

      if (result.success) {
        showAdminStatus(
          `数据已成功重新导入: ${result.message || ""}`,
          "success"
        );
        // 发送事件通知
        eventBus.emit("admin:dataMigrated", {
          success: true,
          message: result.message,
        });
        // 刷新页面
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showAdminStatus(
          `重新导入数据失败: ${result.error || "未知错误"}`,
          "error"
        );
        // 发送事件通知
        eventBus.emit("admin:dataMigrated", {
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      showAdminStatus(`重新导入数据时出错: ${error.message}`, "error");
      // 发送事件通知
      eventBus.emit("admin:dataMigrated", {
        success: false,
        error: error.message,
      });
    } finally {
      // 恢复按钮状态
      setButtonLoading(migrateDataBtn, false, originalBtnText);
    }
  });
}

/**
 * 设置批量添加学者功能
 */
function setupBatchAddScholars() {
  const batchAddBtn = elements.batchAddBtn();
  const batchInput = elements.batchInput();

  if (!batchAddBtn || !batchInput) return;

  batchAddBtn.addEventListener("click", async () => {
    const batchText = batchInput.value.trim();
    if (!batchText) {
      showAdminStatus("请输入要批量添加的学者", "error");
      return;
    }

    // 解析输入文本，每行一个学者
    const scholarLines = batchText.split("\n").filter((line) => line.trim());
    if (scholarLines.length === 0) {
      showAdminStatus("未找到有效的学者信息", "error");
      return;
    }

    // 显示加载状态
    const originalBtnText = setButtonLoading(batchAddBtn, true);
    showAdminStatus(
      `正在批量爬取 ${scholarLines.length} 位学者，请耐心等待...`,
      "info"
    );

    try {
      // 调用API批量添加
      const data = await batchAddScholars(scholarLines);

      if (data.success) {
        batchInput.value = "";
        showAdminStatus(
          `成功添加 ${data.added}/${scholarLines.length} 位学者`,
          "success"
        );

        // 发送事件通知
        eventBus.emit("admin:scholarsBatchAdded", {
          success: true,
          added: data.added,
          total: scholarLines.length,
        });
      } else {
        showAdminStatus(
          `批量添加学者失败: ${data.error || "未知错误"}`,
          "error"
        );

        // 发送事件通知
        eventBus.emit("admin:scholarsBatchAdded", {
          success: false,
          error: data.error,
        });
      }
    } catch (error) {
      showAdminStatus(
        `批量添加学者时出错: ${error.message || "未知错误"}`,
        "error"
      );

      // 发送事件通知
      eventBus.emit("admin:scholarsBatchAdded", {
        success: false,
        error: error.message,
      });
    } finally {
      // 恢复按钮状态
      setButtonLoading(batchAddBtn, false, originalBtnText);
    }
  });
}

/**
 * 设置选项卡切换功能
 */
function setupTabSwitching() {
  const tabButtons = elements.tabButtons();
  const tabContents = elements.tabContents();

  if (!tabButtons.length || !tabContents.length) return;

  tabButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // 移除所有选项卡的active类
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // 添加active类到当前选项卡
      this.classList.add("active");
      const tabId = this.getAttribute("data-tab");
      if (tabId) {
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
          tabContent.classList.add("active");
          state.activeTab = tabId;

          // 如果是关系选项卡，加载关系数据
          if (tabId === "tab-relationships") {
            loadAdminPanelData();
          }

          // 发送事件通知
          eventBus.emit("admin:tabChanged", { tabId });
        }
      }
    });
  });
}

/**
 * 加载管理面板数据
 */
function loadAdminPanelData() {
  // 填充学者选择框
  const sourceSelector = document.getElementById("source-scholar");
  const targetSelector = document.getElementById("target-scholar");

  if (!sourceSelector || !targetSelector) return;

  // 清空选择框
  sourceSelector.innerHTML = "";
  targetSelector.innerHTML = "";

  // 使用dataManager.js中的函数获取学者选项
  getScholarOptions((options) => {
    // 添加选项
    options.forEach(({ id, name }) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;

      // 添加到源选择框
      sourceSelector.appendChild(option.cloneNode(true));

      // 添加到目标选择框
      targetSelector.appendChild(option);
    });
  });
}

/**
 * 显示管理面板
 */
function showModal() {
  const adminModal = elements.adminModal();
  if (!adminModal) return;

  adminModal.style.display = "block";
  state.isVisible = true;

  // 加载数据
  loadAdminPanelData();

  // 触发显示事件
  eventBus.emit("admin:show");
}

/**
 * 隐藏管理面板
 */
function hideModal() {
  const adminModal = elements.adminModal();
  if (!adminModal) return;

  adminModal.style.display = "none";
  state.isVisible = false;

  // 触发隐藏事件
  eventBus.emit("admin:hide");
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
  // 管理面板按钮
  const adminBtn = elements.adminBtn();
  if (adminBtn) {
    adminBtn.addEventListener("click", showModal);
  }

  // 关闭模态窗口
  const closeModalBtn = elements.closeModalBtn();
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", hideModal);
  }

  // 关闭管理面板按钮
  const closeAdminBtn = elements.closeAdminBtn();
  if (closeAdminBtn) {
    closeAdminBtn.addEventListener("click", hideModal);
  }

  // 点击模态窗口外部关闭
  const adminModal = elements.adminModal();
  if (adminModal) {
    window.addEventListener("click", function (event) {
      if (event.target === adminModal) {
        hideModal();
      }
    });
  }

  // 设置选项卡切换
  setupTabSwitching();

  // 设置初始化数据库按钮
  setupInitDbBtn();

  // 设置数据迁移按钮
  setupMigrateDataBtn();

  // 设置批量添加学者功能
  setupBatchAddScholars();
}

// 组件公开API
export default {
  // 初始化组件
  init() {
    setupEventListeners();
    return this;
  },

  // 显示管理面板
  show() {
    showModal();
    return this;
  },

  // 隐藏管理面板
  hide() {
    hideModal();
    return this;
  },

  // 显示状态消息
  showStatus(message, type = "info") {
    showAdminStatus(message, type);
    return this;
  },

  // 切换到特定选项卡
  switchToTab(tabId) {
    const tabButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabButton) {
      tabButton.click();
    }
    return this;
  },

  // 加载关系数据
  loadRelationshipData() {
    loadAdminPanelData();
    return this;
  },
};
