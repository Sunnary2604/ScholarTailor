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
    console.log('开始从API获取网络数据...');
    const response = await fetch(`${API_BASE_URL}/network-data`);
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    const result = await response.json();
    if (result.success && result.data) {
      // 详细日志：输出API返回的原始数据
      console.log('API返回的原始数据:', {
        节点总数: result.data.nodes ? result.data.nodes.length : 0,
        主要节点数: result.data.nodes ? result.data.nodes.filter(n => n.group === 'primary').length : 0,
        次要节点数: result.data.nodes ? result.data.nodes.filter(n => n.group === 'secondary').length : 0,
        边总数: result.data.edges ? result.data.edges.length : 0
      });
      
      // 输出部分节点详情
      if (result.data.nodes && result.data.nodes.length > 0) {
        console.log('部分节点详情示例:');
        const sampleNodes = result.data.nodes.slice(0, Math.min(5, result.data.nodes.length));
        sampleNodes.forEach(node => {
          console.log(`节点 ${node.id}: 组=${node.group}, 标签=${node.label || node.data?.name}`);
        });
      }
      
      // 输出部分边详情
      if (result.data.edges && result.data.edges.length > 0) {
        console.log('部分边详情示例:');
        const sampleEdges = result.data.edges.slice(0, Math.min(5, result.data.edges.length));
        sampleEdges.forEach(edge => {
          console.log(`边 ${edge.source} -> ${edge.target}: 类型=${edge.label || '未指定'}, 权重=${edge.weight || 1}`);
        });
      }
      
      // 统一字段名
      if (result.data.nodes) {
        result.data.nodes.forEach(node => {
          if (node.data && node.data.citedby !== undefined && node.data.citations === undefined) {
            node.data.citations = node.data.citedby;
          }
        });
      }
      return result.data;
    } else {
      console.error('API返回失败:', result.error || '未知错误');
      throw new Error(result.error || '获取网络数据失败');
    }
  } catch (error) {
    console.error('获取学者数据失败:', error);
    // 如果API失败，尝试回退到静态文件
    try {
      console.log('尝试加载本地数据文件...');
      const fallbackResponse = await fetch('/data.json');
      if (fallbackResponse.ok) {
        console.warn('使用本地缓存数据文件');
        const data = await fallbackResponse.json();
        
        // 详细日志：输出本地数据
        console.log('本地数据文件内容:', {
          节点总数: data.nodes ? data.nodes.length : 0,
          主要节点数: data.nodes ? data.nodes.filter(n => n.group === 'primary').length : 0,
          次要节点数: data.nodes ? data.nodes.filter(n => n.group === 'secondary').length : 0,
          边总数: data.edges ? data.edges.length : 0
        });
        
        return data;
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
    const data = await response.json();
    
    // 统一字段名
    if (data.success && data.scholar) {
      // 确保citations字段存在
      if (data.scholar.citedby !== undefined && data.scholar.citations === undefined) {
        data.scholar.citations = data.scholar.citedby;
      }
    }
    
    return data;
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
    // 确保data中包含学者ID
    const requestData = { ...data, id: scholarId };
    
    const response = await fetch(`${API_BASE_URL}/scholars/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
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
    const response = await fetch(`${API_BASE_URL}/scholars/add`, {
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
    const response = await fetch(`${API_BASE_URL}/relationships/add`, {
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

/**
 * 迁移数据 - 清空数据库并重新导入数据
 * @param {string} dataDir - 可选的数据目录
 * @returns {Promise<Object>} 迁移结果
 */
export async function migrateData(dataDir = null) {
  try {
    const requestData = dataDir ? { data_dir: dataDir } : {};
    
    const response = await fetch(`${API_BASE_URL}/migrate-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('迁移数据失败:', error);
    throw error;
  }
}

// 导出所有API函数
export {
  
  API_BASE_URL
};