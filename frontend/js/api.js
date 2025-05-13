/**
 * ScholarTailor - API接口模块
 * 处理所有与后端API的交互
 */

// API基础URL
const API_BASE_URL = "/api";

//==============================================================================
// 网络数据相关API
//==============================================================================

/**
 * 获取学者网络数据
 * @returns {Promise<Object>} 学者网络数据
 */
export async function getNetworkData() {
  try {
    console.log("开始从API获取网络数据...");
    const response = await fetch(`${API_BASE_URL}/network-data`);
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    const result = await response.json();
    if (result.success && result.data) {
      // 详细日志：输出API返回的原始数据
      console.log("API返回的原始数据:", {
        节点总数: result.data.nodes ? result.data.nodes.length : 0,
        主要节点数: result.data.nodes
          ? result.data.nodes.filter((n) => n.group === "primary").length
          : 0,
        次要节点数: result.data.nodes
          ? result.data.nodes.filter((n) => n.group === "secondary").length
          : 0,
        边总数: result.data.edges ? result.data.edges.length : 0,
      });

      // 输出部分节点详情
      if (result.data.nodes && result.data.nodes.length > 0) {
        console.log("部分节点详情示例:");
        const sampleNodes = result.data.nodes.slice(
          0,
          Math.min(5, result.data.nodes.length)
        );
        sampleNodes.forEach((node) => {
          console.log(
            `节点 ${node.id}: 组=${node.group}, 标签=${
              node.label || node.data?.name
            }`
          );
        });
      }

      // 输出部分边详情
      if (result.data.edges && result.data.edges.length > 0) {
        console.log("部分边详情示例:");
        const sampleEdges = result.data.edges.slice(
          0,
          Math.min(5, result.data.edges.length)
        );
        sampleEdges.forEach((edge) => {
          console.log(
            `边 ${edge.source} -> ${edge.target}: 类型=${
              edge.label || "未指定"
            }, 权重=${edge.weight || 1}`
          );
        });
      }

      // 统一字段名
      if (result.data.nodes) {
        result.data.nodes.forEach((node) => {
          if (
            node.data &&
            node.data.citedby !== undefined &&
            node.data.citations === undefined
          ) {
            node.data.citations = node.data.citedby;
          }
        });
      }
      return result.data;
    } else {
      console.error("API返回失败:", result.error || "未知错误");
      throw new Error(result.error || "获取网络数据失败");
    }
  } catch (error) {
    console.error("获取学者数据失败:", error);
    // 如果API失败，尝试回退到静态文件
    try {
      console.log("尝试加载本地数据文件...");
      const fallbackResponse = await fetch("/data.json");
      if (fallbackResponse.ok) {
        console.warn("使用本地缓存数据文件");
        const data = await fallbackResponse.json();

        // 详细日志：输出本地数据
        console.log("本地数据文件内容:", {
          节点总数: data.nodes ? data.nodes.length : 0,
          主要节点数: data.nodes
            ? data.nodes.filter((n) => n.group === "primary").length
            : 0,
          次要节点数: data.nodes
            ? data.nodes.filter((n) => n.group === "secondary").length
            : 0,
          边总数: data.edges ? data.edges.length : 0,
        });

        return data;
      } else {
        throw error;
      }
    } catch (fallbackError) {
      console.error("回退到静态文件也失败:", fallbackError);
      throw error;
    }
  }
}

/**
 * 应用高级筛选
 * @param {Object} filterParams - 筛选参数
 * @returns {Promise<Object>} 筛选结果
 */
export async function applyAdvancedFilter(filterParams) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/filter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filter_params: filterParams }),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("应用高级筛选失败:", error);
    throw error;
  }
}

//==============================================================================
// 学者管理相关API
//==============================================================================

/**
 * 添加新学者
 * @param {Object} data - 学者数据
 * @returns {Promise<Object>} 添加结果
 */
export async function addScholar(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("添加学者失败:", error);
    throw error;
  }
}

/**
 * 批量添加学者
 * @param {Array<string>} scholars - 学者列表
 * @returns {Promise<Object>} 添加结果
 */
export async function batchAddScholars(scholars) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/batch-add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scholars }),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("批量添加学者失败:", error);
    throw error;
  }
}

/**
 * 更新学者数据
 * @param {string} scholarId - 学者ID
 * @param {Object} [data] - 更新后的学者数据（可选）
 * @returns {Promise<Object>} 更新结果
 * @description 支持的学者状态：
 *   - is_main_scholar = 0: 关联学者
 *   - is_main_scholar = 1: 主要学者
 *   - is_main_scholar = 2: 不感兴趣的学者（将被隐藏）
 */
export async function updateScholar(scholarId, data = null) {
  try {
    console.log(
      `DEBUGTAG: 开始updateScholar - scholarId=${scholarId}, data=`,
      data
    );

    // 确保data中包含学者ID
    const requestData = data ? { ...data, id: scholarId } : { id: scholarId };
    console.log(`DEBUGTAG: 构建请求数据 - requestData=`, requestData);

    // 记录is_main_scholar的状态，便于追踪
    if (requestData.is_main_scholar !== undefined) {
      const statusText =
        {
          0: "关联学者",
          1: "主要学者",
          2: "不感兴趣",
        }[requestData.is_main_scholar] || "未知状态";

      console.log(
        `DEBUGTAG: 更新学者[${scholarId}]状态为: ${requestData.is_main_scholar} (${statusText})`
      );
    }

    // 打印完整请求内容
    console.log(`DEBUGTAG: 发送POST请求 - ${API_BASE_URL}/scholars/update`);
    console.log(`DEBUGTAG: 请求体 - ${JSON.stringify(requestData)}`);

    const response = await fetch(`${API_BASE_URL}/scholars/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    console.log(`DEBUGTAG: 收到响应 - status=${response.status}`);

    if (!response.ok) {
      console.error(`DEBUGTAG: HTTP错误: ${response.status}`);
      throw new Error(`HTTP错误: ${response.status}`);
    }

    const result = await response.json();
    console.log(`DEBUGTAG: 响应内容 - `, result);

    return result;
  } catch (error) {
    console.error(`DEBUGTAG: 更新学者数据失败:`, error);
    throw error;
  }
}

/**
 * 更新学者标签 (将被废弃，请使用 addScholarTag 代替)
 * @param {string} scholarId - 学者ID
 * @param {Array} tags - 标签列表
 * @returns {Promise<Object>} 更新结果
 * @deprecated 请使用 addScholarTag 代替
 */
export async function saveScholarTags(scholarId, tags) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/update-tags`, {
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

    return await response.json();
  } catch (error) {
    console.error("更新学者标签失败:", error);
    throw error;
  }
}

// 保持向后兼容
export const updateScholarTags = saveScholarTags;

/**
 * 添加学者标签
 * @param {string} scholarId - 学者ID
 * @param {string} tag - 要添加的标签
 * @returns {Promise<Object>} 添加结果
 */
export async function addScholarTag(scholarId, tag) {
  try {
    const response = await fetch(`${API_BASE_URL}/scholars/add-tag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: scholarId,
        tag: tag,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("添加学者标签失败:", error);
    throw error;
  }
}

/**
 * 获取学者详情
 * @param {string} scholarId - 学者ID
 * @returns {Promise<Object>} - 学者详细信息
 */
export async function getScholarDetails(scholarId) {
  console.log(`API: 获取学者详情 ID: ${scholarId}`);

  try {
    const response = await fetch(`${API_BASE_URL}/scholars/${scholarId}`);

    if (!response.ok) {
      console.error(
        `获取学者详情失败: ${response.status} ${response.statusText}`
      );
      if (response.status === 404) {
        throw new Error(`未找到ID为 "${scholarId}" 的学者`);
      }
      throw new Error(`服务器错误: ${response.status}`);
    }

    const data = await response.json();

    // 记录API返回的关键数据
    if (data.success) {
      const scholar = data.scholar;
      console.log(`学者数据获取成功:`, {
        id: scholar.scholar_id || scholar.id,
        name: scholar.name,
        tags: scholar.tags ? scholar.tags.length : 0,
        publications: scholar.publications ? scholar.publications.length : 0,
        related_scholars: scholar.related_scholars
          ? scholar.related_scholars.length
          : 0,
      });

      // 检查关键字段是否存在
      if (!scholar.tags) {
        console.warn("API返回的学者数据缺少tags字段");
        scholar.tags = [];
      }

      if (!scholar.publications) {
        console.warn("API返回的学者数据缺少publications字段");
        scholar.publications = [];
      }

      if (!scholar.related_scholars) {
        console.warn("API返回的学者数据缺少related_scholars字段");
        scholar.related_scholars = [];
      }

      // 确保ID字段存在
      if (!scholar.id && scholar.scholar_id) {
        scholar.id = scholar.scholar_id;
      }
    } else {
      console.error("获取学者详情失败:", data.error);
    }

    return data;
  } catch (error) {
    console.error(`获取学者详情时出错: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

//==============================================================================
// 关系管理相关API
//==============================================================================

/**
 * 获取自定义关系列表
 * @returns {Promise<Object>} 关系列表
 */
export async function getCustomRelationships() {
  try {
    const response = await fetch(`${API_BASE_URL}/relationships/custom`);
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("获取自定义关系失败:", error);
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("添加关系失败:", error);
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
    const response = await fetch(
      `${API_BASE_URL}/relationships/${relationshipId}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("删除关系失败:", error);
    throw error;
  }
}

//==============================================================================
// 系统管理相关API
//==============================================================================

/**
 * 初始化数据库
 * @returns {Promise<Object>} 初始化结果
 */
export async function initializeDatabase() {
  try {
    const response = await fetch(`${API_BASE_URL}/initialize-database`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("初始化数据库失败:", error);
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("迁移数据失败:", error);
    throw error;
  }
}

// 添加一个辅助函数来处理API响应
function handleResponse(response) {
  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status}`);
  }
  return response.json();
}

// 处理API错误
function handleError(error) {
  console.error("API请求失败:", error);
  throw error;
}

// 更新toggleScholarHidden函数使用这些辅助函数并添加适当的loading状态处理
export function toggleScholarHidden(scholarId) {
  // 显示全局loading状态
  const loadingIndicator = document.getElementById("global-loading");
  if (loadingIndicator) loadingIndicator.style.display = "block";

  return fetch("/api/scholars/toggle-hidden", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scholar_id: scholarId,
    }),
  })
    .then(handleResponse)
    .catch(handleError)
    .finally(() => {
      // 隐藏全局loading状态
      if (loadingIndicator) loadingIndicator.style.display = "none";
    });
}

// 导出API基础URL
export { API_BASE_URL };
