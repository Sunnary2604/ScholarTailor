/**
 * ScholarTailor - 搜索面板组件
 * 处理学者搜索和搜索结果展示功能
 */

import { showStatusMessage } from "../utils.js";
import eventBus from "../eventBus.js";
import graphPanel from "./graphPanel.js";

// 组件私有状态
const state = {
  results: [],
  query: "",
  showSuggestions: false,
};

// DOM元素引用
const elements = {
  searchInput: () => document.getElementById("search-input"),
  searchBtn: () => document.getElementById("search-btn"),
  searchContainer: () => document.querySelector(".search-container"),
  searchResults: () => document.querySelector(".search-results"),
};

/**
 * 初始化搜索结果容器
 */
function initSearchResultsContainer() {
  const searchContainer = elements.searchContainer();
  if (!searchContainer) return;

  // 检查是否已存在搜索结果容器
  let searchResultsEl = elements.searchResults();

  // 如果不存在，创建一个
  if (!searchResultsEl) {
    searchResultsEl = document.createElement("div");
    searchResultsEl.className = "search-results";
    searchResultsEl.style.display = "none";
    searchContainer.appendChild(searchResultsEl);
  }
}

/**
 * 执行搜索
 * @param {string} query - 搜索关键词
 */
function performSearch(query) {
  if (!query || !window.cy) return;

  const trimmedQuery = query.trim().toLowerCase();
  if (trimmedQuery.length < 1) return;

  // 按名称或ID搜索节点
  const matchedNodes = window.cy.nodes().filter((node) => {
    const nodeData = node.data();
    const nodeName = (nodeData.label || nodeData.name || "").toLowerCase();
    const nodeId = (nodeData.id || "").toLowerCase();

    return nodeName.includes(trimmedQuery) || nodeId.includes(trimmedQuery);
  });

  if (matchedNodes.length > 0) {
    // 选择第一个匹配的节点
    const firstNode = matchedNodes[0];

    // 居中并放大
    window.cy.center(firstNode);
    window.cy.zoom(1.5);

    // 选择节点并触发事件
    graphPanel.selectNode(firstNode);

    // 发出搜索成功事件
    eventBus.emit("search:success", {
      query: trimmedQuery,
      results: matchedNodes.length,
      node: firstNode.data(),
    });

    // 如果有多个结果，显示消息
    if (matchedNodes.length > 1) {
      showStatusMessage(
        `找到 ${matchedNodes.length} 个结果，显示第一个`,
        "info"
      );
    }
  } else {
    showStatusMessage("没有找到匹配的学者", "error");

    // 发出搜索失败事件
    eventBus.emit("search:fail", {
      query: trimmedQuery,
    });
  }
}

/**
 * 显示搜索建议
 * @param {string} query - 搜索关键词
 * @param {HTMLElement} resultsEl - 搜索结果容器
 */
function showSearchSuggestions(query, resultsEl) {
  if (!query || !window.cy || !resultsEl) return;

  const trimmedQuery = query.trim().toLowerCase();
  if (trimmedQuery.length < 1) {
    resultsEl.innerHTML = "";
    resultsEl.style.display = "none";
    return;
  }

  // 按名称或ID搜索节点
  const matchedNodes = window.cy.nodes().filter((node) => {
    const nodeData = node.data();
    const nodeName = (nodeData.label || nodeData.name || "").toLowerCase();
    const nodeId = (nodeData.id || "").toLowerCase();

    return nodeName.includes(trimmedQuery) || nodeId.includes(trimmedQuery);
  });

  if (matchedNodes.length > 0) {
    let resultsHTML = "";

    // 限制显示前5个结果
    const maxResults = Math.min(matchedNodes.length, 5);
    for (let i = 0; i < maxResults; i++) {
      const nodeData = matchedNodes[i].data();
      const nodeType = nodeData.nodeType === "primary" ? "(主要)" : "(关联)";

      resultsHTML += `
        <div class="search-result-item" data-node-id="${nodeData.id}">
          <div class="result-name">${
            nodeData.label || nodeData.name || nodeData.id
          }</div>
          <div class="result-type">${nodeType}</div>
        </div>
      `;
    }

    // 如果有更多结果
    if (matchedNodes.length > maxResults) {
      resultsHTML += `<div class="more-results">还有 ${
        matchedNodes.length - maxResults
      } 个结果</div>`;
    }

    resultsEl.innerHTML = resultsHTML;
    resultsEl.style.display = "block";

    // 触发搜索建议事件
    eventBus.emit("search:suggestions", {
      query: trimmedQuery,
      count: matchedNodes.length,
    });

    // 添加点击事件
    const resultItems = resultsEl.querySelectorAll(".search-result-item");
    resultItems.forEach((item) => {
      item.addEventListener("click", function () {
        const nodeId = this.getAttribute("data-node-id");
        if (nodeId) {
          const node = window.cy.getElementById(nodeId);
          if (node.length > 0) {
            // 居中并放大
            window.cy.center(node);
            window.cy.zoom(1.5);

            // 选择节点
            graphPanel.selectNode(node);

            // 触发搜索结果选择事件
            eventBus.emit("search:resultSelected", {
              nodeId,
              node: node.data(),
            });

            // 隐藏搜索结果
            resultsEl.style.display = "none";
          }
        }
      });
    });
  } else {
    resultsEl.innerHTML = '<div class="no-results">没有找到匹配结果</div>';
    resultsEl.style.display = "block";
  }
}

// 初始化事件监听
function setupEventListeners() {
  const searchInput = elements.searchInput();
  const searchBtn = elements.searchBtn();

  if (!searchInput || !searchBtn) return;

  // 搜索按钮点击事件
  searchBtn.addEventListener("click", function () {
    performSearch(searchInput.value);
  });

  // 搜索框回车事件
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      performSearch(this.value);
    }
  });

  // 初始化搜索结果容器
  initSearchResultsContainer();

  const searchResultsEl = elements.searchResults();
  if (searchResultsEl) {
    // 输入事件，实现实时搜索建议
    searchInput.addEventListener("input", function () {
      if (this.value.length >= 2) {
        showSearchSuggestions(this.value, searchResultsEl);
      } else {
        searchResultsEl.innerHTML = "";
        searchResultsEl.style.display = "none";
      }
    });

    // 点击外部时隐藏搜索结果
    document.addEventListener("click", function (e) {
      const searchContainer = elements.searchContainer();
      if (searchContainer && !searchContainer.contains(e.target)) {
        searchResultsEl.style.display = "none";
      }
    });
  }
}

// 组件公开API
export default {
  // 初始化组件
  init() {
    setupEventListeners();
    return this;
  },

  // 执行搜索
  search(query) {
    performSearch(query);
    return this;
  },

  // 清除搜索框
  clear() {
    const searchInput = elements.searchInput();
    if (searchInput) {
      searchInput.value = "";

      // 隐藏搜索结果
      const searchResultsEl = elements.searchResults();
      if (searchResultsEl) {
        searchResultsEl.innerHTML = "";
        searchResultsEl.style.display = "none";
      }
    }
    return this;
  },

  // 设置搜索框值
  setQuery(query) {
    const searchInput = elements.searchInput();
    if (searchInput) {
      searchInput.value = query;
    }
    return this;
  },
};
