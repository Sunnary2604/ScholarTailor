/**
 * ScholarTailor - API接口模块
 * 处理所有与后端API的交互
 */

// API基础URL
const API_BASE_URL = '/api';

/**
 * 获取学者数据
 * @returns {Promise<Object>} 学者数据
 */
export async function fetchScholarData() {
  try {
    const response = await fetch(`${API_BASE_URL}/network-data`);
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    const result = await response.json();
    if (result.success && result.data) {
      return result.data;
    } else {
      throw new Error(result.error || '获取网络数据失败');
    }
  } catch (error) {
    console.error('获取学者数据失败:', error);
    // 如果API失败，尝试回退到静态文件
    try {
      const fallbackResponse = await fetch('/data.json');
      if (fallbackResponse.ok) {
        console.warn('使用本地缓存数据文件');
        return await fallbackResponse.json();
      } else {
        throw error;
      }
    } catch (fallbackError) {
      console.error('回退到静态文件也失败:', fallbackError);
      throw error;
    }
  }
}

/**
 * 获取学者详情
 * @param {string} scholarId - 学者ID
 * @returns {Promise<Object>} 学者详情
 */
export async function fetchScholarDetails(scholarId) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/${scholarId}`);
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('获取学者详情失败:', error);
    throw error;
  }
}

/**
 * 更新学者数据
 * @param {string} scholarId - 学者ID
 * @param {Object} data - 更新后的学者数据
 * @returns {Promise<Object>} 更新结果
 */
export async function updateScholar(scholarId, data) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/${scholarId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('更新学者数据失败:', error);
    throw error;
  }
}

/**
 * 添加新学者
 * @param {Object} data - 学者数据
 * @returns {Promise<Object>} 添加结果
 */
export async function addScholar(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('添加学者失败:', error);
    throw error;
  }
}

/**
 * 添加新关系
 * @param {Object} data - 关系数据
 * @returns {Promise<Object>} 添加结果
 */
export async function addRelationship(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/relationships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('添加关系失败:', error);
    throw error;
  }
}

/**
 * 删除关系
 * @param {string} relationshipId - 关系ID
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteRelationship(relationshipId) {
  try {
    const response = await fetch(`${API_BASE_URL}/relationships/${relationshipId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('删除关系失败:', error);
    throw error;
  }
}

/**
 * 搜索学者
 * @param {string} query - 查询关键词
 * @returns {Promise<Object>} 搜索结果
 */
export async function searchScholars(query) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('搜索学者失败:', error);
    throw error;
  }
}

// 导出所有API函数
export {
  
  API_BASE_URL
};