/**
 * ScholarTailor - 工具函数模块
 * 包含各种通用工具函数
 */

/**
 * 设置元素不省略文本（显示完整文本）
 * @param {HTMLElement|string} element - DOM元素或选择器
 * @returns {HTMLElement|NodeList} 处理后的元素
 */
export function setNoEllipsis(element) {
  if (!element) return;

  if (typeof element === "string") {
    // 如果传入的是选择器，获取对应的元素
    const selectedElements = document.querySelectorAll(element);
    selectedElements.forEach((el) => {
      el.style.whiteSpace = "normal";
      el.style.overflow = "visible";
      el.style.textOverflow = "clip";
    });
    return selectedElements;
  } else {
    // 如果传入的是DOM元素
    element.style.whiteSpace = "normal";
    element.style.overflow = "visible";
    element.style.textOverflow = "clip";
    return element;
  }
}

/**
 * 动态加载脚本
 * @param {string} url - 脚本URL
 * @param {Function} callback - 加载成功回调
 * @param {Function} errorCallback - 加载失败回调
 */
export function loadScript(url, callback, errorCallback) {
  // 检查脚本是否已经加载
  const existingScript = document.querySelector(`script[src="${url}"]`);
  if (existingScript) {
    console.log(`脚本已存在: ${url}`);
    // 如果脚本已加载，直接调用回调
    if (callback) callback();
    return;
  }

  console.log(`加载脚本: ${url}`);
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = url;

  // 设置超时处理
  const timeoutId = setTimeout(() => {
    console.error(`脚本加载超时: ${url}`);
    if (errorCallback) errorCallback(new Error(`加载超时: ${url}`));
  }, 10000); // 10秒超时

  // 加载成功回调
  script.onload = function () {
    clearTimeout(timeoutId);
    console.log(`脚本加载成功: ${url}`);
    if (callback) callback();
  };

  // 加载错误处理
  script.onerror = function (e) {
    clearTimeout(timeoutId);
    console.error(`脚本加载失败: ${url}`, e);

    // 尝试使用备用CDN
    if (url.includes("unpkg.com")) {
      const fallbackUrl = url.replace("unpkg.com", "cdn.jsdelivr.net/npm");
      console.log(`尝试备用CDN: ${fallbackUrl}`);
      loadScript(fallbackUrl, callback, errorCallback);
    } else if (errorCallback) {
      errorCallback(e);
    }
  };

  document.head.appendChild(script);
}

/**
 * 加载布局库
 * @param {Function} callback - 加载完成回调
 */
export function loadLayoutLibraries(callback) {
  // 检查是否已加载
  if (window.cytoscape && window.fcose) {
    console.log("布局库已加载");
    if (callback) callback();
    return;
  }

  // 加载Cytoscape
  if (!window.cytoscape) {
    const cytoscapeScript = document.createElement("script");
    cytoscapeScript.src =
      "https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js";
    cytoscapeScript.onload = () => {
      console.log("Cytoscape加载完成");
      loadFcoseLayout(callback);
    };
    document.head.appendChild(cytoscapeScript);
  } else {
    loadFcoseLayout(callback);
  }
}

// 加载Fcose布局
function loadFcoseLayout(callback) {
  if (!window.fcose) {
    const fcoseScript = document.createElement("script");
    fcoseScript.src =
      "https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.min.js";
    fcoseScript.onload = () => {
      console.log("Fcose布局加载完成");
      if (callback) callback();
    };
    document.head.appendChild(fcoseScript);
  } else if (callback) {
    callback();
  }
}

/**
 * 格式化日期时间
 * @param {string} isoString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期时间字符串
 */
export function formatDateTime(isoString) {
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

/**
 * 计算两个字符串之间的编辑距离 (Levenshtein距离)
 * @param {string} a - 第一个字符串
 * @param {string} b - 第二个字符串
 * @returns {number} 编辑距离
 */
export function levenshteinDistance(a, b) {
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

/**
 * 从输入中提取Scholar ID
 * @param {string} input - 输入字符串
 * @returns {string} 提取的Scholar ID
 */
export function extractScholarIdFromInput(input) {
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

// 防抖函数
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 格式化日期
export function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// 格式化数字
export function formatNumber(num) {
  if (!num) return "0";
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

// 深拷贝对象
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;

  const copy = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepClone(obj[key]);
    }
  }

  return copy;
}

// 生成唯一ID
export function generateId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// 检查对象是否为空
export function isEmpty(obj) {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === "string") return obj.trim().length === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === "object") return Object.keys(obj).length === 0;
  return false;
}

// 获取URL参数
export function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// 设置URL参数
export function setUrlParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.pushState({}, "", url);
}

// 移除URL参数
export function removeUrlParam(name) {
  const url = new URL(window.location.href);
  url.searchParams.delete(name);
  window.history.pushState({}, "", url);
}

// 导出其他必要的函数
export { loadFcoseLayout };

/**
 * 显示状态消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success, error, warning, info)
 * @param {number} duration - 消息显示时间，毫秒，默认3000
 */
export function showStatusMessage(message, type = "info", duration = 3000) {
  // 获取状态元素
  const statusElement = document.getElementById("data-status");
  if (!statusElement) return;

  // 设置样式
  statusElement.className = "status-indicator";
  statusElement.classList.add(`status-${type}`);

  // 设置文本
  statusElement.textContent = message;

  // 显示消息
  statusElement.style.display = "block";

  // 设置自动隐藏
  setTimeout(() => {
    statusElement.style.display = "none";
  }, duration);
}
