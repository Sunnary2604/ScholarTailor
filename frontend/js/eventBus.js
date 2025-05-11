/**
 * ScholarTailor - 事件总线模块
 * 用于组件间通信，减少组件间的直接依赖
 */

// 事件存储对象
const events = {};

/**
 * 订阅事件
 * @param {string} eventName - 事件名称
 * @param {Function} callback - 回调函数
 */
function on(eventName, callback) {
  if (!events[eventName]) {
    events[eventName] = [];
  }
  events[eventName].push(callback);
}

/**
 * 取消订阅事件
 * @param {string} eventName - 事件名称
 * @param {Function} callback - 要取消的回调函数
 */
function off(eventName, callback) {
  if (!events[eventName]) return;

  if (callback) {
    // 移除特定回调
    events[eventName] = events[eventName].filter((cb) => cb !== callback);
  } else {
    // 移除所有回调
    delete events[eventName];
  }
}

/**
 * 触发事件
 * @param {string} eventName - 事件名称
 * @param {*} data - 传递给回调函数的数据
 */
function emit(eventName, data) {
  if (!events[eventName]) return;

  try {
    events[eventName].forEach((callback) => {
      callback(data);
    });
  } catch (error) {
    console.error(`事件处理错误 (${eventName}):`, error);
  }
}

/**
 * 只订阅一次事件
 * @param {string} eventName - 事件名称
 * @param {Function} callback - 回调函数
 */
function once(eventName, callback) {
  const onceCallback = (data) => {
    callback(data);
    off(eventName, onceCallback);
  };

  on(eventName, onceCallback);
}

export default {
  on,
  off,
  emit,
  once,
};
