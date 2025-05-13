/**
 * ScholarTailor - 帮助面板组件
 * 处理帮助和关于信息的显示
 */

// 组件状态
const state = {
  isVisible: false,
};

// 缓存DOM元素
const elements = {
  helpButton: () => document.getElementById("help-button"),
  helpPanel: () => document.getElementById("help-panel"),
  closeButton: () => document.getElementById("help-close-button"),
};

// 帮助面板内容
const helpContent = `
  <div class="help-section">
    <h3>基本操作</h3>
    <ul>
      <li><b>点击节点</b>：选择学者，显示详细信息</li>
      <li><b>右键点击边</b>：显示关系操作菜单（可删除非合作者关系）</li>
      <li><b>滚轮</b>：缩放图谱</li>
      <li><b>拖拽空白处</b>：移动整个图谱</li>
      <li><b>拖拽节点</b>：移动单个节点</li>
    </ul>
  </div>

  <div class="help-section">
    <h3>节点颜色说明</h3>
    <ul>
      <li><span class="color-sample primary-sample"></span> <b>主要学者</b>：深蓝色节点</li>
      <li><span class="color-sample secondary-sample"></span> <b>关联学者</b>：浅蓝色节点</li>
      <li><span class="color-sample hidden-sample"></span> <b>不感兴趣</b>：灰色节点</li>
    </ul>
  </div>

  <div class="help-section">
    <h3>边类型说明</h3>
    <ul>
      <li><span class="edge-sample coauthor-sample"></span> <b>合作者关系</b>：蓝色线条（不可删除）</li>
      <li><span class="edge-sample advisor-sample"></span> <b>导师关系</b>：橙色线条，带箭头</li>
      <li><span class="edge-sample colleague-sample"></span> <b>同事关系</b>：绿色线条</li>
    </ul>
  </div>

  <div class="help-section">
    <h3>功能按钮</h3>
    <ul>
      <li><b>重置视图</b>：恢复图谱到初始状态</li>
      <li><b>重新布局</b>：重新计算节点位置，优化布局</li>
      <li><b>筛选</b>：按条件筛选学者和关系</li>
      <li><b>添加学者</b>：添加新的学者</li>
    </ul>
  </div>

  <div class="help-footer">
    <p>ScholarTailor &copy; 2024 - 专为学术关系定制的可视化工具</p>
    <p class="version">版本: 1.0.0</p>
  </div>
`;

/**
 * 初始化帮助面板
 */
function init() {
  // 创建帮助按钮
  createHelpButton();

  // 创建帮助面板
  createHelpPanel();

  // 设置事件监听
  setupEventListeners();
}

/**
 * 创建帮助按钮
 */
function createHelpButton() {
  // 检查是否已存在
  if (elements.helpButton()) return;

  // 获取顶部导航栏
  const navActions = document.querySelector(".nav-actions");
  if (!navActions) {
    console.error("无法找到导航栏元素");
    return;
  }

  // 创建帮助按钮
  const helpButton = document.createElement("button");
  helpButton.id = "help-button";
  helpButton.className = "nav-btn";
  helpButton.title = "帮助和关于";
  helpButton.innerHTML = '<i class="fas fa-question-circle"></i>';

  // 插入到导航栏最后
  navActions.appendChild(helpButton);
}

/**
 * 创建帮助面板
 */
function createHelpPanel() {
  // 检查是否已存在
  if (elements.helpPanel()) return;

  // 创建面板容器
  const helpPanel = document.createElement("div");
  helpPanel.id = "help-panel";
  helpPanel.className = "help-panel";

  // 设置面板内容
  helpPanel.innerHTML = `
    <div class="help-header">
      <h2>使用帮助</h2>
      <button id="help-close-button" class="help-close-btn">&times;</button>
    </div>
    <div class="help-body">
      ${helpContent}
    </div>
  `;

  // 默认隐藏
  helpPanel.style.display = "none";

  // 添加到文档
  document.body.appendChild(helpPanel);
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
  // 帮助按钮点击事件 - 简单直接显示面板
  const helpButton = elements.helpButton();
  if (helpButton) {
    helpButton.addEventListener("click", showHelpPanel);
  }

  // 关闭按钮点击事件 - 直接隐藏面板
  const closeButton = elements.closeButton();
  if (closeButton) {
    closeButton.addEventListener("click", hideHelpPanel);
  }

  // 点击面板外部关闭 - 使用单一事件处理
  document.addEventListener("click", function (event) {
    const helpPanel = elements.helpPanel();
    const helpButton = elements.helpButton();

    // 如果面板可见且点击不在面板内且不是帮助按钮，则关闭面板
    if (
      state.isVisible &&
      helpPanel &&
      !helpPanel.contains(event.target) &&
      event.target !== helpButton
    ) {
      hideHelpPanel();
    }
  });
}

/**
 * 显示帮助面板
 * @param {Event} event - 事件对象
 */
function showHelpPanel(event) {
  // 阻止事件冒泡，防止立即触发document的点击事件
  if (event) {
    event.stopPropagation();
  }

  const helpPanel = elements.helpPanel();
  if (helpPanel && !state.isVisible) {
    // 更新状态
    state.isVisible = true;

    // 显示面板
    helpPanel.style.display = "block";

    // 添加动画效果
    setTimeout(() => {
      helpPanel.classList.add("visible");
    }, 10);
  }
}

/**
 * 隐藏帮助面板
 */
function hideHelpPanel() {
  const helpPanel = elements.helpPanel();
  if (helpPanel && state.isVisible) {
    // 更新状态，立即标记为不可见
    state.isVisible = false;

    // 移除可见类，触发过渡效果
    helpPanel.classList.remove("visible");

    // 等待过渡效果完成后隐藏
    setTimeout(() => {
      helpPanel.style.display = "none";
    }, 300);
  }
}

/**
 * 切换帮助面板显示状态
 * @param {Event} event - 事件对象
 */
function toggleHelpPanel(event) {
  if (state.isVisible) {
    hideHelpPanel();
  } else {
    showHelpPanel(event);
  }
}

// 导出组件
export default {
  init,
};
