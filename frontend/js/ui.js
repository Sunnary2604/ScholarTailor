/**
 * ScholarTailor - 用户界面模块
 * 处理所有用户界面相关的功能
 */

import { formatDateTime } from "./utils.js";
import { fetchScholarDetails, updateScholar, addScholar, API_BASE_URL } from "./api.js";
import { addNewScholar, getScholarById } from "./data.js";
import { getFCoseLayoutOptions } from "./graph.js";
import { applyLayout } from "./core.js";

/**
 * 更新详情面板
 * @param {Object} scholarData - 学者数据
 */
export function updateDetailPanel(scholarData) {
  // 如果没有数据，清空面板
  if (!scholarData) {
    clearDetailPanel();
    return;
  }

  try {
    // 根据学者ID实时获取最新数据
    if (scholarData.id) {
      getScholarById(scholarData.id)
        .then(latestData => {
          // 如果获取成功，使用最新数据更新面板
          updateDetailPanelUI(latestData);
        })
        .catch(error => {
          // 如果获取失败，使用传入的原始数据
          console.warn("无法获取最新学者数据，使用缓存数据:", error);
          updateDetailPanelUI(scholarData);
        });
    } else {
      // 如果没有ID，直接使用传入的数据
      updateDetailPanelUI(scholarData);
    }
  } catch (error) {
    console.error("更新详情面板时出错:", error);
    // 出错时仍尝试使用原始数据
    updateDetailPanelUI(scholarData);
  }
}

/**
 * 更新详情面板UI
 * @param {Object} scholarData - 学者数据
 */
function updateDetailPanelUI(scholarData) {
  try {
    // 设置学者名称
    const scholarNameEl = document.getElementById("scholar-name");
    if (scholarNameEl) {
      scholarNameEl.textContent = scholarData.name || "未知";
    }

    // 设置所属机构
    const affiliationEl = document.querySelector("#scholar-affiliation .value");
    if (affiliationEl) {
      affiliationEl.textContent = scholarData.affiliation || "-";
    }

    // 设置研究方向
    const interestsEl = document.querySelector("#scholar-interests .value");
    if (interestsEl) {
      interestsEl.textContent = scholarData.interests || "-";
    }

    // 设置引用次数
    const citationsEl = document.querySelector("#scholar-citations .value");
    if (citationsEl) {
      citationsEl.textContent = scholarData.citations || "-";
    }

    // 设置个人网页
    const homepageEl = document.querySelector("#scholar-homepage .value");
    if (homepageEl) {
      if (scholarData.homepage) {
        homepageEl.innerHTML = `<a href="${scholarData.homepage}" target="_blank">${scholarData.homepage}</a>`;
      } else {
        homepageEl.textContent = "-";
      }
    }

    // 设置标签
    const tagsEl = document.querySelector("#scholar-tags .scholar-tags");
    if (tagsEl) {
      if (scholarData.tags && scholarData.tags.length > 0) {
        let tagsHTML = "";
        scholarData.tags.forEach((tag) => {
          tagsHTML += `<span class="scholar-tag">${tag}</span>`;
        });
        tagsEl.innerHTML = tagsHTML;
      } else {
        tagsEl.innerHTML = "<span>暂无标签</span>";
      }
    }

    // 设置自定义字段
    const customFieldsEl = document.querySelector(".custom-fields-content");
    if (customFieldsEl) {
      if (
        scholarData.custom_fields &&
        Object.keys(scholarData.custom_fields).length > 0
      ) {
        let customFieldsHTML = "";
        for (const [key, value] of Object.entries(scholarData.custom_fields)) {
          customFieldsHTML += `<p><strong>${key}:</strong> ${value}</p>`;
        }
        customFieldsEl.innerHTML = customFieldsHTML;
      } else {
        customFieldsEl.innerHTML = "<p>暂无自定义字段</p>";
      }
    }

    // 设置论文列表
    const publicationListEl = document.getElementById("publication-list");
    if (publicationListEl) {
      if (scholarData.publications && scholarData.publications.length > 0) {
        let publicationsHTML = "";
        scholarData.publications.forEach((pub) => {
          publicationsHTML += `
            <li>
              <div class="publication-title">${pub.title}</div>
              <div class="publication-details">
                ${
                  pub.authors
                    ? `<span class="authors">${pub.authors}</span>`
                    : ""
                }
                ${pub.year ? `<span class="year">${pub.year}</span>` : ""}
                ${
                  pub.citations
                    ? `<span class="citations">引用: ${pub.citations}</span>`
                    : ""
                }
              </div>
            </li>
          `;
        });
        publicationListEl.innerHTML = publicationsHTML;
      } else {
        publicationListEl.innerHTML = "<li>暂无论文数据</li>";
      }
    }

    // 设置相关学者列表 - 添加点击导航功能
    const relatedScholarsEl = document.getElementById("related-scholars");
    if (relatedScholarsEl) {
      if (
        scholarData.related_scholars &&
        scholarData.related_scholars.length > 0
      ) {
        let relatedScholarsHTML = "";
        scholarData.related_scholars.forEach((scholar) => {
          relatedScholarsHTML += `
            <li class="related-scholar-item" data-scholar-id="${scholar.id}">
              <div class="scholar-name">${scholar.name}</div>
              <div class="relationship">${
                scholar.relationship || "未知关系"
              }</div>
            </li>
          `;
        });
        relatedScholarsEl.innerHTML = relatedScholarsHTML;
        
        // 添加点击事件
        const scholarItems = relatedScholarsEl.querySelectorAll('.related-scholar-item');
        scholarItems.forEach(item => {
          item.addEventListener('click', function() {
            const scholarId = this.getAttribute('data-scholar-id');
            if (scholarId) {
              // 查找并选择对应的节点
              const targetNode = window.cy.getElementById(scholarId);
              if (targetNode.length > 0) {
                // 滚动到节点并选中
                window.cy.center(targetNode);
                window.cy.zoom(1.5);
                const nodeSelectEvent = new Event('select-node');
                nodeSelectEvent.target = targetNode;
                selectScholarNode(targetNode);
              }
            }
          });
        });
      } else {
        relatedScholarsEl.innerHTML = "<li>暂无相关学者数据</li>";
      }
    }

    // 设置头像
    const avatarImg = document.getElementById("scholar-avatar");
    if (avatarImg) {
      // 根据节点类型设置默认头像
      let defaultAvatar = "https://placehold.co/300x300?text=U";
      if (scholarData.nodeType === 'primary') {
        defaultAvatar = "https://placehold.co/300x300?text=P";
      } else if (scholarData.nodeType === 'secondary') {
        defaultAvatar = "https://placehold.co/300x300?text=S";
      }
      
      avatarImg.src = scholarData.url_picture || defaultAvatar;
    }

    // 设置爬取按钮
    const fetchBtn = document.getElementById("fetch-scholar-btn");
    if (fetchBtn) {
      // 移除所有已有的点击事件监听器
      const newFetchBtn = fetchBtn.cloneNode(true);
      fetchBtn.parentNode.replaceChild(newFetchBtn, fetchBtn);

      // 添加新的事件监听器
      newFetchBtn.addEventListener("click", () => {
        // 使用update API更新学者信息
        fetch(`${API_BASE_URL}/scholars/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({id: scholarData.id})
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // 更新成功后，重新获取学者数据
            getScholarById(scholarData.id)
              .then(updatedScholar => {
                updateScholarData(updatedScholar);
              });
            // 显示成功消息
            showStatusMessage("成功更新学者数据", "success");
          } else {
            showStatusMessage("更新学者数据失败: " + (data.error || "未知错误"), "error");
          }
        })
        .catch(error => {
          showStatusMessage("更新学者数据时出错: " + error, "error");
        });
      });
    }

    // 设置Google Scholar链接
    const gsLinkEl = document.getElementById("scholar-gs-link");
    if (gsLinkEl && scholarData.scholar_id) {
      gsLinkEl.href = `https://scholar.google.com/citations?user=${scholarData.scholar_id}`;
    }

    // 显示详情面板
    const detailPanel = document.querySelector(".detail-panel");
    if (detailPanel) {
      detailPanel.classList.add("visible");
    }
  } catch (error) {
    console.error("更新详情面板UI时出错:", error);
  }
}

/**
 * 清除详情面板
 */
export function clearDetailPanel() {
  try {
    // 设置学者名称
    const scholarNameEl = document.getElementById("scholar-name");
    if (scholarNameEl) {
      scholarNameEl.textContent = "选择学者查看详情";
    }

    // 设置所属机构
    const affiliationEl = document.querySelector("#scholar-affiliation .value");
    if (affiliationEl) {
      affiliationEl.textContent = "-";
    }

    // 设置研究方向
    const interestsEl = document.querySelector("#scholar-interests .value");
    if (interestsEl) {
      interestsEl.textContent = "-";
    }

    // 设置引用次数
    const citationsEl = document.querySelector("#scholar-citations .value");
    if (citationsEl) {
      citationsEl.textContent = "-";
    }

    // 设置个人网页
    const homepageEl = document.querySelector("#scholar-homepage .value");
    if (homepageEl) {
      homepageEl.textContent = "-";
    }

    // 设置标签
    const tagsEl = document.querySelector("#scholar-tags .scholar-tags");
    if (tagsEl) {
      tagsEl.innerHTML = "-";
    }

    // 设置自定义字段
    const customFieldsEl = document.querySelector(".custom-fields-content");
    if (customFieldsEl) {
      customFieldsEl.innerHTML = "<p>选择学者查看详情</p>";
    }

    // 设置论文列表
    const publicationListEl = document.getElementById("publication-list");
    if (publicationListEl) {
      publicationListEl.innerHTML = "<li>选择学者查看论文</li>";
    }

    // 设置相关学者列表
    const relatedScholarsEl = document.getElementById("related-scholars");
    if (relatedScholarsEl) {
      relatedScholarsEl.innerHTML = "<li>选择学者查看关系</li>";
    }

    // 设置头像
    const avatarImg = document.getElementById("scholar-avatar");
    if (avatarImg) {
      avatarImg.src = "https://placehold.co/300x300?text=U";
    }
  } catch (error) {
    console.error("清除详情面板时出错:", error);
  }
}

/**
 * 设置管理面板事件
 */
export function setupAdminPanel() {
  // 管理面板按钮
  const adminBtn = document.getElementById("admin-btn");
  const adminModal = document.getElementById("admin-modal");
  const closeModalBtn = document.querySelector(".close-modal");
  const closeAdminBtn = document.getElementById("close-admin-btn");

  if (!adminBtn || !adminModal) return;

  // 打开管理面板
  adminBtn.addEventListener("click", function () {
    adminModal.style.display = "block";
    loadAdminPanelData();
  });

  // 关闭管理面板
  if (closeModalBtn) {
  closeModalBtn.addEventListener("click", function () {
    adminModal.style.display = "none";
  });
  }

  if (closeAdminBtn) {
  closeAdminBtn.addEventListener("click", function () {
    adminModal.style.display = "none";
  });
  }

  // 点击模态窗口外部关闭
  window.addEventListener("click", function (event) {
    if (event.target === adminModal) {
      adminModal.style.display = "none";
    }
  });

  // 添加学者按钮
  const addScholarBtn = document.getElementById("add-scholar-btn");
  if (addScholarBtn) {
    addScholarBtn.addEventListener("click", function() {
      const nameInput = document.getElementById("new-scholar-input");
      const idInput = document.getElementById("new-scholar-id");
      
      if (!nameInput || !idInput) return;
      
      const name = nameInput.value.trim();
      const scholarId = idInput.value.trim();
      
      if (!name) {
        showAdminStatus("请输入学者名称", "error");
        return;
      }
      
      addNewScholar({ name, scholar_id: scholarId })
        .then(success => {
          if (success) {
            nameInput.value = "";
            idInput.value = "";
            showAdminStatus("成功添加学者", "success");
          }
    });
  });
  }

  // 设置添加标签功能
  setupTagManagement();
  
  // 设置重置布局按钮
  setupLayoutControls();

  // 设置筛选面板
  setupFilterPanel();
}

/**
 * 设置布局控制
 */
function setupLayoutControls() {
  // 重置布局按钮
  const resetLayoutBtn = document.getElementById('reset-layout-btn');
  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener('click', function() {
      // 显示加载状态
      resetLayoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 应用中...';
      resetLayoutBtn.disabled = true;
      
      // 应用fcose布局
      const layout = applyLayout('fcose');

      // 等待布局完成后恢复按钮状态
      if (layout && layout.on) {
        layout.on('layoutstop', function() {
          // 布局完成后调整节点大小
          import('./graph.js').then(module => {
            module.adjustNodeSizeByConnections(window.cy);
          });
          
          resetLayoutBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 重新布局';
          resetLayoutBtn.disabled = false;
        });
      } else {
        // 如果layout对象未正确返回，3秒后恢复按钮状态
        setTimeout(function() {
          // 尝试调整节点大小
          import('./graph.js').then(module => {
            module.adjustNodeSizeByConnections(window.cy);
          });
          
          resetLayoutBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 重新布局';
          resetLayoutBtn.disabled = false;
        }, 3000);
      }
    });
  }
}

/**
 * 设置标签管理
 */
function setupTagManagement() {
  // 打开标签对话框
  const tagAddBtn = document.getElementById("tag-add-btn");
  const tagDialog = document.getElementById("tag-dialog");
  const closeTagDialog = document.querySelector(".tag-dialog-close");
  
  if (!tagAddBtn || !tagDialog) return;
  
  tagAddBtn.addEventListener("click", function() {
    tagDialog.style.display = "block";
    loadCurrentTags();
  });
  
  // 关闭标签对话框
  if (closeTagDialog) {
    closeTagDialog.addEventListener("click", function() {
      tagDialog.style.display = "none";
    });
  }
  
  // 保存标签
  const saveTagBtn = document.getElementById("save-tag-btn");
  if (saveTagBtn) {
    saveTagBtn.addEventListener("click", function() {
      saveScholarTags();
      tagDialog.style.display = "none";
    });
  }
  
  // 取消标签编辑
  const cancelTagBtn = document.getElementById("cancel-tag-btn");
  if (cancelTagBtn) {
    cancelTagBtn.addEventListener("click", function() {
      tagDialog.style.display = "none";
    });
}

  // 添加自定义标签
  const addCustomTagBtn = document.getElementById("add-custom-tag-btn");
  if (addCustomTagBtn) {
    addCustomTagBtn.addEventListener("click", function() {
      const customTagInput = document.getElementById("custom-tag-input");
      if (!customTagInput) return;
      
      const tagValue = customTagInput.value.trim();
      if (tagValue) {
        addTag(tagValue);
        customTagInput.value = "";
      }
    });
  }
  
  // 预定义标签点击
  const predefinedTags = document.querySelectorAll(".predefined-tags .scholar-tag");
  predefinedTags.forEach(tag => {
    tag.addEventListener("click", function() {
      const tagValue = this.getAttribute("data-tag");
      if (tagValue) {
        addTag(tagValue);
      }
    });
  });
}

/**
 * 加载当前标签
 */
function loadCurrentTags() {
  const currentTagsContainer = document.getElementById("current-tags");
  if (!currentTagsContainer) return;
  
  if (!window.activeNodeId || !window.scholars[window.activeNodeId]) {
    currentTagsContainer.innerHTML = "<span>未选择学者</span>";
    return;
  }

  const scholarData = window.scholars[window.activeNodeId];
  const tags = scholarData.tags || [];
  
  if (tags.length === 0) {
    currentTagsContainer.innerHTML = "<span>暂无标签</span>";
    return;
  }

  let tagsHTML = "";
  tags.forEach(tag => {
    tagsHTML += `
      <div class="tag-item">
        <span class="tag-name">${tag}</span>
        <span class="tag-remove" data-tag="${tag}">×</span>
      </div>
    `;
  });
  
  currentTagsContainer.innerHTML = tagsHTML;
  
  // 添加删除标签事件
  const removeButtons = currentTagsContainer.querySelectorAll(".tag-remove");
  removeButtons.forEach(btn => {
    btn.addEventListener("click", function() {
      const tagToRemove = this.getAttribute("data-tag");
      if (tagToRemove) {
        removeTag(tagToRemove);
      }
    });
  });
}

/**
 * 添加标签
 * @param {string} tag - 标签名称
 */
function addTag(tag) {
  const currentTagsContainer = document.getElementById("current-tags");
  if (!currentTagsContainer) return;
  
  if (!window.activeNodeId || !window.scholars[window.activeNodeId]) {
    return;
  }
  
  // 检查是否已存在此标签
  const scholarData = window.scholars[window.activeNodeId];
  const tags = scholarData.tags || [];
  
  if (tags.includes(tag)) {
    return; // 标签已存在
  }
  
  // 添加新标签
  tags.push(tag);
  scholarData.tags = tags;
  
  // 更新显示
  loadCurrentTags();
}

/**
 * 移除标签
 * @param {string} tag - 标签名称
 */
function removeTag(tag) {
  if (!window.activeNodeId || !window.scholars[window.activeNodeId]) {
    return;
  }
  
  // 移除标签
  const scholarData = window.scholars[window.activeNodeId];
  const tags = scholarData.tags || [];
  
  scholarData.tags = tags.filter(t => t !== tag);
  
  // 更新显示
  loadCurrentTags();
}

/**
 * 保存学者标签
 */
function saveScholarTags() {
  if (!window.activeNodeId || !window.scholars[window.activeNodeId]) {
    return;
  }
  
  const scholarData = window.scholars[window.activeNodeId];
  
  // 更新标签到服务器
  updateScholar(window.activeNodeId, { tags: scholarData.tags })
    .then(result => {
      if (result.success) {
        // 更新详情面板中的标签显示
        const tagsEl = document.querySelector("#scholar-tags .scholar-tags");
        if (tagsEl) {
          if (scholarData.tags && scholarData.tags.length > 0) {
            let tagsHTML = "";
            scholarData.tags.forEach((tag) => {
              tagsHTML += `<span class="scholar-tag">${tag}</span>`;
            });
            tagsEl.innerHTML = tagsHTML;
          } else {
            tagsEl.innerHTML = "<span>暂无标签</span>";
          }
        }
        
        showStatusMessage("标签已保存", "success");
      } else {
        showStatusMessage("保存标签失败", "error");
      }
    })
    .catch(error => {
      console.error("保存标签失败:", error);
      showStatusMessage("保存标签失败", "error");
  });
}

/**
 * 显示管理面板状态消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (info, success, error)
 */
export function showAdminStatus(message, type = "info") {
  const statusDiv = document.getElementById("admin-status");
  if (!statusDiv) return;
  
  statusDiv.textContent = message;
  statusDiv.className = "status-message " + type;
  
  // 3秒后自动清除
    setTimeout(() => {
    statusDiv.textContent = "";
    statusDiv.className = "status-message";
  }, 3000);
}

/**
 * 显示状态消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (info, success, error)
 */
function showStatusMessage(message, type = "info") {
  // 创建一个临时消息元素
  const messageDiv = document.createElement("div");
  messageDiv.className = `status-message-popup ${type}`;
  messageDiv.textContent = message;
  
  // 添加到页面
  document.body.appendChild(messageDiv);
  
  // 淡入
    setTimeout(() => {
    messageDiv.classList.add("visible");
  }, 10);
  
  // 3秒后淡出并移除
  setTimeout(() => {
    messageDiv.classList.remove("visible");
    setTimeout(() => {
      document.body.removeChild(messageDiv);
    }, 500);
  }, 3000);
}

/**
 * 更新学者数据
 * @param {Object} scholar - 学者数据
 */
function updateScholarData(scholar) {
  if (!scholar || !scholar.id) return;
  
  // 通过API获取最新学者数据
  getScholarById(scholar.id)
    .then(latestScholar => {
      // 更新内存中的学者数据
      window.scholars[scholar.id] = latestScholar;
      
      // 更新详情面板
      updateDetailPanelUI(latestScholar);
      
      // 显示成功消息
      showStatusMessage("成功更新学者数据", "success");
    })
    .catch(error => {
      console.error("获取学者数据失败:", error);
      showStatusMessage("获取学者数据失败", "error");
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
  
  // 添加选项
  Object.entries(window.scholars).forEach(([id, scholar]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = scholar.name;
    
    // 添加到源选择框
    sourceSelector.appendChild(option.cloneNode(true));
    
    // 添加到目标选择框
    targetSelector.appendChild(option);
  });
}

/**
 * 设置标签筛选功能
 */
export function setupTagFiltering() {
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

  // 如果没有选中任何标签，显示所有节点
  if (activeTagElements.length === 0) {
    window.cy.nodes().removeClass("hidden");
    return;
  }

  // 收集选中的标签
  activeTagElements.forEach((tagElement) => {
    selectedTags.push(tagElement.dataset.tag);
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
}

/**
 * 添加标签点击事件处理
 */
export function setupTagClickHandlers() {
  document.addEventListener("click", function (event) {
    // 检查是否点击的是标签
    const tagElement = event.target.closest(".scholar-tag");
    if (tagElement && !event.target.closest(".tag-filter-item")) {
      const tag = tagElement.textContent || tagElement.dataset.tag;
      highlightNodesByTag(tag);
    }
  });
}

/**
 * 高亮含有特定标签的节点
 * @param {string} tag - 标签
 */
function highlightNodesByTag(tag) {
  // 重置当前高亮
  window.cy.nodes().removeClass("highlighted faded");

  // 找到包含该标签的节点
  const matchedNodes = window.cy.nodes().filter((node) => {
    const nodeTags = node.data("tags") || [];
    return nodeTags.includes(tag);
  });

  if (matchedNodes.length === 0) {
    return;
  }

  // 高亮匹配节点
  matchedNodes.addClass("highlighted");
  window.cy.elements().difference(matchedNodes).addClass("faded");

  // 更新视图居中显示匹配节点
  window.cy.fit(matchedNodes, 50);

  // 显示"返回全局视图"按钮
  document.getElementById("graph-view-btn").classList.remove("hidden");
}

/**
 * 更新学者标签显示
 * @param {string} scholarId - 学者ID
 */
function updateScholarTags(scholarId) {
  const tagsContainer = document.querySelector("#scholar-tags .scholar-tags");
  const scholarData = window.scholars[scholarId];

  // 如果是关联学者，显示不可用信息
  if (scholarData && scholarData.is_secondary) {
    tagsContainer.textContent = "关联学者不支持标签";
    document.getElementById("tag-add-btn").style.display = "none"; // 隐藏添加标签按钮
    return;
  }

  // 恢复添加标签按钮
  document.getElementById("tag-add-btn").style.display = "";

  if (!scholarData || !scholarData.tags || scholarData.tags.length === 0) {
    tagsContainer.textContent = "无标签";
    return;
  }

  let tagsHTML = "";
  for (const tag of scholarData.tags) {
    // 添加data-tag属性以便应用特定的标签样式
    tagsHTML += `<span class="scholar-tag" data-tag="${tag}">${tag}</span>`;
  }

  tagsContainer.innerHTML = tagsHTML;
}

/**
 * 更新代表性论文列表
 * @param {Object} scholarData - 学者数据
 */
export function updatePublications(scholarData) {
  const publicationListEl = document.getElementById("publication-list");
  
  // 如果是关联学者或没有论文数据
  if (scholarData.is_secondary || !scholarData.publications || scholarData.publications.length === 0) {
    publicationListEl.innerHTML = "<li>暂无论文数据</li>";
    return;
  }

  let pubHTML = "";
  const publications = scholarData.publications
  
  publications.forEach(pub => {
    const title = pub.title || "未知标题";
    
    const venue = pub.venue || "";
    const year = pub.year || "";
    const citedby = pub.citations || 0; // 使用citations字段
    
    // 构建论文HTML
    pubHTML += `
      <li class="publication-item">
        <div class="publication-title">${title}</div>
        <div class="publication-venue">${venue} ${year}
          ${citedby > 0 ? `<span class="citation-count"><i class="fas fa-quote-right"></i> ${citedby}</span>
` : ""}
        </div>
      </li>
    `;
  });
  
  // 更新HTML
  publicationListEl.innerHTML = pubHTML;
}

/**
 * 设置筛选面板
 */
function setupFilterPanel() {
  const filterBtn = document.getElementById('filter-btn');
  const filterPanel = document.getElementById('filter-panel');
  const closeFilterBtn = document.getElementById('close-filter-panel');
  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const minConnectionsSlider = document.getElementById('min-connections');
  const minConnectionsValue = document.getElementById('min-connections-value');
  
  // 打开筛选面板
  if (filterBtn && filterPanel) {
    filterBtn.addEventListener('click', function() {
      filterPanel.classList.toggle('visible');
      // 更新滑块值
      if (minConnectionsValue) {
        minConnectionsValue.textContent = minConnectionsSlider.value;
      }
    });
  }
  
  // 关闭筛选面板
  if (closeFilterBtn && filterPanel) {
    closeFilterBtn.addEventListener('click', function() {
      filterPanel.classList.remove('visible');
    });
  }
  
  // 滑块值实时更新
  if (minConnectionsSlider && minConnectionsValue) {
    minConnectionsSlider.addEventListener('input', function() {
      minConnectionsValue.textContent = this.value;
    });
  }
  
  // 应用筛选按钮
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', function() {
      applyFilters();
      // 不关闭筛选面板，让用户可以继续调整筛选条件
    });
  }
  
  // 重置筛选按钮
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
      resetFilters();
    });
  }
  
  // 页面加载完成后应用默认筛选
  window.addEventListener('DOMContentLoaded', function() {
    // 默认隐藏连接数为1的节点
    setTimeout(function() {
      applyFilters();
    }, 1000); // 等待图谱加载完成
  });
}

/**
 * 应用筛选条件
 */
function applyFilters() {
  if (!window.cy) return;
  
  // 获取筛选条件
  const minConnections = parseInt(document.getElementById('min-connections').value) || 1;
  const showPrimary = document.getElementById('show-primary').checked;
  const showSecondary = document.getElementById('show-secondary').checked;
  const showCoauthor = document.getElementById('show-coauthor').checked;
  const showAdvisor = document.getElementById('show-advisor').checked;
  const showColleague = document.getElementById('show-colleague').checked;
  
  // 筛选节点
  window.cy.nodes().forEach(node => {
    // 初始状态：显示所有节点
    node.removeClass('filtered');
    
    // 根据连接数筛选
    const connections = node.connectedEdges().length;
    if (connections < minConnections) {
      node.addClass('filtered');
    }
    
    // 根据节点类型筛选
    const nodeType = node.data('nodeType');
    if ((nodeType === 'primary' && !showPrimary) || 
        (nodeType === 'secondary' && !showSecondary)) {
      node.addClass('filtered');
    }
  });
  
  // 筛选边
  window.cy.edges().forEach(edge => {
    // 初始状态：显示所有边
    edge.removeClass('filtered');
    
    // 根据关系类型筛选
    const relationType = edge.data('relationType');
    if ((relationType === 'coauthor' && !showCoauthor) ||
        (relationType === 'advisor' && !showAdvisor) ||
        (relationType === 'colleague' && !showColleague)) {
      edge.addClass('filtered');
    }
    
    // 如果边连接的任一节点被过滤掉，则边也应被过滤
    const sourceNode = edge.source();
    const targetNode = edge.target();
    if (sourceNode.hasClass('filtered') || targetNode.hasClass('filtered')) {
      edge.addClass('filtered');
    }
  });
  
  // 显示筛选后的图谱
  updateFilteredGraph();
}

// 将筛选函数暴露给window对象
window.applyFilters = applyFilters;

/**
 * 重置筛选条件
 */
function resetFilters() {
  // 重置连接数筛选
  const minConnectionsSlider = document.getElementById('min-connections');
  const minConnectionsValue = document.getElementById('min-connections-value');
  if (minConnectionsSlider) {
    minConnectionsSlider.value = 1;
    if (minConnectionsValue) {
      minConnectionsValue.textContent = '1';
    }
  }
  
  // 重置节点类型筛选
  const showPrimary = document.getElementById('show-primary');
  const showSecondary = document.getElementById('show-secondary');
  if (showPrimary) showPrimary.checked = true;
  if (showSecondary) showSecondary.checked = true;
  
  // 重置关系类型筛选
  const showCoauthor = document.getElementById('show-coauthor');
  const showAdvisor = document.getElementById('show-advisor');
  const showColleague = document.getElementById('show-colleague');
  if (showCoauthor) showCoauthor.checked = true;
  if (showAdvisor) showAdvisor.checked = true;
  if (showColleague) showColleague.checked = true;
  
  // 应用重置后的筛选条件
  applyFilters();
}

/**
 * 更新筛选后的图谱
 */
function updateFilteredGraph() {
  // 根据筛选条件隐藏/显示元素
  window.cy.elements().forEach(ele => {
    if (ele.hasClass('filtered')) {
      ele.style('display', 'none');
    } else {
      ele.style('display', 'element');
}
  });
  
  // 重新布局（可选）
  // applyLayout('fcose');
}

/**
 * 选择学者节点（从列表点击时使用）
 * @param {Object} node - 要选择的节点
 */
function selectScholarNode(node) {
  if (!node || !window.cy) return;
  
  try {
    // 导入graph.js中的selectNode函数
    import('./graph.js').then(module => {
      // 如果graph.js直接导出了selectNode，可以直接调用
      if (typeof module.selectNode === 'function') {
        module.selectNode(node);
      } else {
        // 否则，模拟与selectNode相同的行为
        // 取消现有选择
        window.cy.elements().removeClass('selected');
        window.cy.elements().removeClass('highlighted-neighbor');
        window.cy.elements().addClass('faded');
        
        // 获取关联元素
        const connectedEdges = node.connectedEdges();
        const neighborhood = node.neighborhood().nodes();
        const relatedElements = neighborhood.add(node).add(connectedEdges);
        
        // 突出显示节点
        relatedElements.removeClass('faded');
        node.addClass('selected');
        neighborhood.addClass('highlighted-neighbor');
        connectedEdges.addClass('highlighted-neighbor');
        
        // 更新活跃节点ID
        window.activeNodeId = node.id();
        
        // 更新详情面板
        updateDetailPanel(node.data());
      }
    }).catch(error => {
      console.error("加载graph.js模块失败:", error);
    });
  } catch (error) {
    console.error("选择学者节点时出错:", error);
  }
}

/**
 * 初始化搜索功能
 */
export function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  
  if (!searchInput || !searchBtn) return;
  
  // 搜索按钮点击事件
  searchBtn.addEventListener('click', function() {
    performSearch(searchInput.value);
  });
  
  // 搜索框回车事件
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      performSearch(this.value);
    }
  });
  
  // 添加搜索结果下拉菜单
  const searchContainer = searchInput.parentElement;
  if (searchContainer) {
    const searchResultsEl = document.createElement('div');
    searchResultsEl.className = 'search-results';
    searchResultsEl.style.display = 'none';
    searchContainer.appendChild(searchResultsEl);
    
    // 添加输入事件，实现实时搜索
    searchInput.addEventListener('input', function() {
      if (this.value.length >= 2) {
        showSearchSuggestions(this.value, searchResultsEl);
      } else {
        searchResultsEl.innerHTML = '';
        searchResultsEl.style.display = 'none';
      }
    });
    
    // 点击外部时隐藏搜索结果
    document.addEventListener('click', function(e) {
      if (!searchContainer.contains(e.target)) {
        searchResultsEl.style.display = 'none';
      }
    });
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
  const matchedNodes = window.cy.nodes().filter(node => {
    const nodeData = node.data();
    const nodeName = (nodeData.label || nodeData.name || '').toLowerCase();
    const nodeId = (nodeData.id || '').toLowerCase();
    
    return nodeName.includes(trimmedQuery) || nodeId.includes(trimmedQuery);
  });
  
  if (matchedNodes.length > 0) {
    // 选择第一个匹配的节点
    const firstNode = matchedNodes[0];
    
    // 居中并放大
    window.cy.center(firstNode);
    window.cy.zoom(1.5);
    
    // 选择节点
    import('./graph.js').then(module => {
      if (typeof module.selectNode === 'function') {
        module.selectNode(firstNode);
      }
    });
    
    // 如果有多个结果，显示消息
    if (matchedNodes.length > 1) {
      showStatusMessage(`找到 ${matchedNodes.length} 个结果，显示第一个`, "info");
    }
  } else {
    showStatusMessage("没有找到匹配的学者", "error");
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
    resultsEl.innerHTML = '';
    resultsEl.style.display = 'none';
    return;
  }
  
  // 按名称或ID搜索节点
  const matchedNodes = window.cy.nodes().filter(node => {
    const nodeData = node.data();
    const nodeName = (nodeData.label || nodeData.name || '').toLowerCase();
    const nodeId = (nodeData.id || '').toLowerCase();
    
    return nodeName.includes(trimmedQuery) || nodeId.includes(trimmedQuery);
  });
  
  if (matchedNodes.length > 0) {
    let resultsHTML = '';
    
    // 限制显示前5个结果
    const maxResults = Math.min(matchedNodes.length, 5);
    for (let i = 0; i < maxResults; i++) {
      const nodeData = matchedNodes[i].data();
      const nodeType = nodeData.nodeType === 'primary' ? '(主要)' : '(关联)';
      
      resultsHTML += `
        <div class="search-result-item" data-node-id="${nodeData.id}">
          <div class="result-name">${nodeData.label || nodeData.name || nodeData.id}</div>
          <div class="result-type">${nodeType}</div>
        </div>
      `;
    }
    
    // 如果有更多结果
    if (matchedNodes.length > maxResults) {
      resultsHTML += `<div class="more-results">还有 ${matchedNodes.length - maxResults} 个结果</div>`;
    }
    
    resultsEl.innerHTML = resultsHTML;
    resultsEl.style.display = 'block';
    
    // 添加点击事件
    const resultItems = resultsEl.querySelectorAll('.search-result-item');
    resultItems.forEach(item => {
      item.addEventListener('click', function() {
        const nodeId = this.getAttribute('data-node-id');
        if (nodeId) {
          const node = window.cy.getElementById(nodeId);
          if (node.length > 0) {
            // 居中并放大
            window.cy.center(node);
            window.cy.zoom(1.5);
            
            // 选择节点
            import('./graph.js').then(module => {
              if (typeof module.selectNode === 'function') {
                module.selectNode(node);
              }
            });
            
            // 隐藏搜索结果
            resultsEl.style.display = 'none';
          }
        }
      });
    });
  } else {
    resultsEl.innerHTML = '<div class="no-results">没有找到匹配结果</div>';
    resultsEl.style.display = 'block';
  }
}

// 导出函数
export {
  setupTagManagement
};
 