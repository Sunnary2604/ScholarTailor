/**
 * ScholarTailor - 学者详情面板组件
 * 处理所有与学者详情面板相关的交互和显示
 */

import { getScholarById, reloadData } from "../dataManager.js";
import { updateScholar, addScholarTag } from "../api.js";
import { showStatusMessage } from "../utils.js";
import eventBus from "../eventBus.js";
import graphPanel from "../components/graphPanel.js";

// 组件私有状态
const state = {
  currentScholar: null,
  isVisible: false,
};

// DOM元素引用
const elements = {
  panel: () => document.querySelector(".detail-panel"),
  scholarName: () => document.getElementById("scholar-name"),
  affiliationEl: () => document.querySelector("#scholar-affiliation .value"),
  interestsEl: () => document.querySelector("#scholar-interests .value"),
  citationsEl: () => document.querySelector("#scholar-citations .value"),
  homepageEl: () => document.querySelector("#scholar-homepage .value"),
  tagsEl: () => document.querySelector("#scholar-tags .scholar-tags"),
  customFieldsEl: () => document.querySelector(".custom-fields-content"),
  publicationListEl: () => document.getElementById("publication-list"),
  relatedScholarsEl: () => document.getElementById("related-scholars"),
  avatarImg: () => document.getElementById("scholar-avatar"),
  fetchBtn: () => document.getElementById("fetch-scholar-btn"),
  gsLinkEl: () => document.getElementById("scholar-gs-link"),
  notInterestedBtn: () => document.getElementById("not-interested-btn"),
};

// 渲染函数 - 根据状态更新UI
function render() {
  // 如果没有当前学者数据，清空面板
  if (!state.currentScholar) {
    _clearPanel();
    return;
  }

  try {
    // 更新各部分UI
    _updateBasicInfo(state.currentScholar);
    _updateTags(state.currentScholar);
    _updateCustomFields(state.currentScholar);
    _updatePublications(state.currentScholar);
    _updateRelatedScholars(state.currentScholar);
    _updateButtons(state.currentScholar);

    // 显示面板
    const panel = elements.panel();
    if (panel && state.isVisible) {
      panel.classList.add("visible");
    } else if (panel) {
      panel.classList.remove("visible");
    }
  } catch (error) {
    console.error("渲染详情面板时出错:", error);
  }
}

/**
 * 清空详情面板内容
 * @private
 */
function _clearPanel() {
  const defaultValues = {
    name: "选择学者查看详情",
    affiliation: "-",
    interests: "-",
    citations: "-",
    homepage: "-",
    tags: "-",
    customFields: "<p>选择学者查看详情</p>",
    publications: "<li>选择学者查看论文</li>",
    relatedScholars: "<li>选择学者查看关系</li>",
    avatarSrc: "https://placehold.co/300x300?text=U",
  };

  try {
    // 设置默认值
    const scholarNameEl = elements.scholarName();
    if (scholarNameEl) {
      scholarNameEl.textContent = defaultValues.name;
    }

    const affiliationEl = elements.affiliationEl();
    if (affiliationEl) {
      affiliationEl.textContent = defaultValues.affiliation;
    }

    const interestsEl = elements.interestsEl();
    if (interestsEl) {
      interestsEl.textContent = defaultValues.interests;
    }

    const citationsEl = elements.citationsEl();
    if (citationsEl) {
      citationsEl.textContent = defaultValues.citations;
    }

    const homepageEl = elements.homepageEl();
    if (homepageEl) {
      homepageEl.textContent = defaultValues.homepage;
    }

    const tagsEl = elements.tagsEl();
    if (tagsEl) {
      tagsEl.innerHTML = defaultValues.tags;
    }

    const customFieldsEl = elements.customFieldsEl();
    if (customFieldsEl) {
      customFieldsEl.innerHTML = defaultValues.customFields;
    }

    const publicationListEl = elements.publicationListEl();
    if (publicationListEl) {
      publicationListEl.innerHTML = defaultValues.publications;
    }

    const relatedScholarsEl = elements.relatedScholarsEl();
    if (relatedScholarsEl) {
      relatedScholarsEl.innerHTML = defaultValues.relatedScholars;
    }

    const avatarImg = elements.avatarImg();
    if (avatarImg) {
      avatarImg.src = defaultValues.avatarSrc;
    }
  } catch (error) {
    console.error("清除详情面板时出错:", error);
  }
}

/**
 * 更新基本信息区域
 * @private
 * @param {Object} scholarData - 学者数据
 */
function _updateBasicInfo(scholarData) {
  // 设置学者名称
  const scholarNameEl = elements.scholarName();
  if (scholarNameEl) {
    scholarNameEl.textContent = scholarData.name || "未知";
  }

  // 设置所属机构
  const affiliationEl = elements.affiliationEl();
  if (affiliationEl) {
    affiliationEl.textContent = scholarData.affiliation || "-";
  }

  // 设置研究方向 - 使用标签样式
  const interestsEl = elements.interestsEl();
  if (interestsEl) {
    if (scholarData.interests && scholarData.interests.length > 0) {
      let interestsHTML = "";
      scholarData.interests.forEach((interest) => {
        interestsHTML += `<span class="interest-tag">${interest}</span>`;
      });
      interestsEl.innerHTML = interestsHTML;
    } else {
      interestsEl.textContent = "-";
    }
  }

  // 设置引用次数
  const citationsEl = elements.citationsEl();
  if (citationsEl) {
    citationsEl.textContent =
      scholarData.citedby || scholarData.citations || "-";
  }

  // 设置个人网页
  const homepageEl = elements.homepageEl();
  if (homepageEl) {
    if (scholarData.homepage) {
      homepageEl.innerHTML = `<a href="${scholarData.homepage}" target="_blank" class="text-description">${scholarData.homepage}</a>`;
    } else {
      homepageEl.textContent = "-";
    }
  }

  // 设置头像
  const avatarImg = elements.avatarImg();
  if (avatarImg) {
    // 根据节点类型设置默认头像
    let defaultAvatar = "https://placehold.co/300x300?text=U";
    if (scholarData.nodeType === "primary") {
      defaultAvatar = "https://placehold.co/300x300?text=P";
    } else if (scholarData.nodeType === "secondary") {
      defaultAvatar = "https://placehold.co/300x300?text=S";
    }

    avatarImg.src = scholarData.url_picture || defaultAvatar;
  }

  // 设置Google Scholar链接
  const gsLinkEl = elements.gsLinkEl();
  if (gsLinkEl && scholarData.scholar_id) {
    gsLinkEl.href = `https://scholar.google.com/citations?user=${scholarData.scholar_id}`;
  }
}

/**
 * 更新标签区域
 * @param {Object} scholar - 学者数据
 */
function _updateTags(scholar) {
  console.log("更新学者标签区域:", scholar ? scholar.id : "无数据");

  // 获取标签容器
  const tagContainer = elements.tagsEl();
  if (!tagContainer) return;

  // 清空原有内容
  tagContainer.innerHTML = "";

  // 检查学者数据是否存在
  if (!scholar) {
    console.warn("无法更新标签区域：学者数据为空");
    tagContainer.innerHTML = '<div class="empty-msg">暂无标签数据</div>';
    return;
  }

  // 优先使用tags字段（custom_tags, is_custom=1），其次使用interests字段
  const tags = scholar.tags || [];
  console.log("学者标签数据:", tags);

  if (tags.length === 0) {
    tagContainer.innerHTML = '<div class="empty-msg">暂无标签数据</div>';
    return;
  }

  // 创建标签元素
  const tagElements = document.createDocumentFragment();

  tags.forEach((tag) => {
    if (!tag) return; // 跳过空标签

    const tagSpan = document.createElement("span");
    tagSpan.className = "tag";
    tagSpan.textContent = tag;
    tagSpan.title = "点击筛选含有此标签的节点";

    // 添加点击事件
    tagSpan.addEventListener("click", function () {
      console.log("点击标签:", tag);
      if (typeof graphPanel !== "undefined" && graphPanel.highlightByTag) {
        graphPanel.highlightByTag(tag);
      }
    });

    tagElements.appendChild(tagSpan);
  });

  tagContainer.appendChild(tagElements);
}

/**
 * 更新自定义字段区域
 * @private
 * @param {Object} scholarData - 学者数据
 */
function _updateCustomFields(scholarData) {
  const customFieldsEl = elements.customFieldsEl();
  if (!customFieldsEl) return;

  // 根据学者类型设置不同内容
  if (scholarData.nodeType === "primary" || scholarData.is_main_scholar) {
    // 主要学者
    customFieldsEl.innerHTML =
      "<p class='text-description'>这是主要学者，已包含详细数据。</p>";
  } else {
    // 关联学者
    customFieldsEl.innerHTML =
      "<p class='text-description'>这是关联学者，仅作为合作者出现。可以爬取更多详细数据。</p>";
  }

  // 如果有自定义字段，显示它们
  if (
    scholarData.custom_fields &&
    Object.keys(scholarData.custom_fields).length > 0
  ) {
    let customHTML = '<dl class="custom-fields-list">';
    for (const [key, value] of Object.entries(scholarData.custom_fields)) {
      // 跳过tags字段，它已经单独显示
      if (key === "tags") continue;
      customHTML += `<dt class="text-label">${key}:</dt><dd class="text-description">${value}</dd>`;
    }
    customHTML += "</dl>";
    customFieldsEl.innerHTML += customHTML;
  }
}

/**
 * 更新论文列表
 * @param {Object} scholar - 学者数据
 */
function _updatePublications(scholar) {
  console.log("更新学者论文列表:", scholar ? scholar.id : "无数据");

  // 获取论文容器
  const pubContainer = elements.publicationListEl();
  if (!pubContainer) return;

  // 清空原有内容
  pubContainer.innerHTML = "";

  // 检查学者数据是否存在
  if (!scholar) {
    console.warn("无法更新论文列表：学者数据为空");
    pubContainer.innerHTML = '<div class="empty-msg">暂无论文数据</div>';
    return;
  }

  // 获取论文列表
  const publications = scholar.publications || [];
  console.log("学者论文数据:", publications.length, "篇");

  if (publications.length === 0) {
    pubContainer.innerHTML = '<div class="empty-msg">暂无论文数据</div>';
    return;
  }

  // 创建论文列表容器
  const pubList = document.createElement("div");
  pubList.className = "publication-list";

  // 最多显示10篇，按引用次数排序
  const sortedPubs = [...publications]
    .sort(
      (a, b) =>
        (b.citedby || b.citations || 0) - (a.citedby || a.citations || 0)
    )
    .slice(0, 10);

  sortedPubs.forEach((pub) => {
    // 检查必要字段
    if (!pub || !pub.title) {
      console.warn("跳过无效论文数据:", pub);
      return;
    }

    const pubItem = document.createElement("div");
    pubItem.className = "card";

    // 格式化引用信息
    const citationCount = pub.citedby || pub.citations || 0;

    // 创建论文标题
    const pubTitle = document.createElement("div");
    pubTitle.className = "publication-title text-emphasis";
    pubTitle.textContent = pub.title;

    // 创建发表地点（灰色斜体）
    const pubVenue = document.createElement("div");
    pubVenue.className = "publication-venue text-citation";
    pubVenue.textContent = pub.venue || "";

    // 创建引用信息
    const pubCitation = document.createElement("div");
    pubCitation.className = "pub-citation";

    // 年份
    const pubYear = document.createElement("span");
    pubYear.className = "pub-year text-description";
    pubYear.textContent = pub.year || "";

    // 引用计数
    const citationBadge = document.createElement("span");
    citationBadge.className = "citation-count";
    citationBadge.textContent =
      citationCount > 0 ? `引用: ${citationCount}` : "暂无引用";

    pubCitation.appendChild(pubYear);
    pubCitation.appendChild(citationBadge);

    // 将元素添加到列表项
    pubItem.appendChild(pubTitle);
    pubItem.appendChild(pubVenue);
    pubItem.appendChild(pubCitation);
    pubList.appendChild(pubItem);
  });

  pubContainer.appendChild(pubList);
}

/**
 * 更新相关学者列表
 * @param {Object} scholar - 学者数据
 */
function _updateRelatedScholars(scholar) {
  console.log("更新相关学者列表:", scholar ? scholar.id : "无数据");

  // 获取相关学者容器
  const relatedContainer = elements.relatedScholarsEl();
  if (!relatedContainer) return;

  // 清空原有内容
  relatedContainer.innerHTML = "";

  // 检查学者数据是否存在
  if (!scholar) {
    console.warn("无法更新相关学者列表：学者数据为空");
    relatedContainer.innerHTML =
      '<div class="empty-msg">暂无相关学者数据</div>';
    return;
  }

  // 获取相关学者列表
  const relatedScholars = scholar.related_scholars || [];
  console.log("相关学者数据:", relatedScholars.length, "位");

  if (relatedScholars.length === 0) {
    relatedContainer.innerHTML =
      '<div class="empty-msg">暂无相关学者数据</div>';
    return;
  }

  // 创建相关学者列表容器
  const relatedList = document.createElement("div");
  relatedList.className = "related-scholars-list";

  // 最多显示前15位相关学者
  const sortedScholars = [...relatedScholars]
    .filter((rs) => rs && rs.id && rs.name) // 确保必要字段存在
    .slice(0, 15);

  sortedScholars.forEach((related) => {
    // 检查必要字段
    if (!related || !related.id || !related.name) {
      console.warn("跳过无效相关学者数据:", related);
      return;
    }

    const relatedItem = document.createElement("div");
    relatedItem.className = "card";

    // 创建相关学者链接
    const scholarLink = document.createElement("a");
    scholarLink.href = "#";
    scholarLink.className = "scholar-link text-emphasis";
    scholarLink.textContent = related.name;
    scholarLink.dataset.scholarId = related.id;
    scholarLink.title = related.name;

    // 添加点击事件，跳转到相关学者
    scholarLink.addEventListener("click", function (e) {
      e.preventDefault();
      const scholarId = this.dataset.scholarId;
      console.log("点击相关学者:", scholarId);
      eventBus.emit("scholar:selected", { id: scholarId });
    });

    // 创建关系类型标签
    const relationshipType = document.createElement("span");
    relationshipType.className = "relationship-type";

    // 记录详细的关系信息
    console.log("显示学者关系:", {
      scholar: related.name,
      relationship: related.relationship,
    });

    // 设置关系类型文本，支持多种关系的展示
    relationshipType.textContent = related.relationship || "相关学者";
    relationshipType.title = related.relationship || "相关学者";

    // 如果是多重关系，添加自定义样式
    if (related.relationship && related.relationship.includes("、")) {
      relationshipType.className += " multi-relationship";
      relationshipType.title = "存在多种关系: " + related.relationship;
    }

    // 将元素添加到列表项
    relatedItem.appendChild(scholarLink);
    relatedItem.appendChild(relationshipType);
    relatedList.appendChild(relatedItem);
  });

  relatedContainer.appendChild(relatedList);
}

/**
 * 更新功能按钮
 * @private
 * @param {Object} scholarData - 学者数据
 */
function _updateButtons(scholarData) {
  const fetchBtn = elements.fetchBtn();
  const notInterestedBtn = elements.notInterestedBtn();

  if (!fetchBtn && !notInterestedBtn) return;

  // 处理爬取按钮
  if (fetchBtn) {
    // 移除所有已有的点击事件监听器
    const newFetchBtn = fetchBtn.cloneNode(true);
    fetchBtn.parentNode.replaceChild(newFetchBtn, fetchBtn);

    // 如果是主要学者，隐藏爬取按钮
    if (
      scholarData.is_main_scholar === 1 ||
      scholarData.nodeType === "primary"
    ) {
      newFetchBtn.style.display = "none";
    } else {
      newFetchBtn.style.display = "inline-block";

      // 添加新的事件监听器
      newFetchBtn.addEventListener("click", () => {
        _handleScholarFetch(newFetchBtn, scholarData);
      });
    }
  }

  // 处理不感兴趣按钮
  if (notInterestedBtn) {
    // 移除所有已有的点击事件监听器
    const newNotInterestedBtn = notInterestedBtn.cloneNode(true);
    notInterestedBtn.parentNode.replaceChild(
      newNotInterestedBtn,
      notInterestedBtn
    );

    // 如果是不感兴趣的学者，显示"已标记为不感兴趣"
    if (scholarData.is_main_scholar === 2) {
      newNotInterestedBtn.textContent = "已隐藏";
      newNotInterestedBtn.classList.add("disabled");
      newNotInterestedBtn.disabled = true;
    } else {
      newNotInterestedBtn.textContent = "隐藏";
      newNotInterestedBtn.classList.remove("disabled");
      newNotInterestedBtn.disabled = false;

      // 添加新的事件监听器
      newNotInterestedBtn.addEventListener("click", () => {
        _handleNotInterested(newNotInterestedBtn, scholarData);
      });
    }
  }
}

/**
 * 处理学者数据爬取
 * @private
 * @param {HTMLElement} button - 爬取按钮元素
 * @param {Object} scholarData - 学者数据
 */
function _handleScholarFetch(button, scholarData) {
  // 设置按钮为加载状态
  const originalText = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 爬取中...';
  button.disabled = true;

  // 使用API更新学者信息 - 不传第二个参数时，后端会自动将学者设为主要学者
  updateScholar(scholarData.id)
    .then((data) => {
      // 恢复按钮状态
      button.innerHTML = originalText;
      button.disabled = false;

      if (data.success) {
        showStatusMessage("正在重新加载数据并刷新图谱...", "info");

        // 重新加载数据并刷新图谱
        reloadData()
          .then(() => {
            // 更新成功后，重新获取学者数据
            getScholarById(scholarData.id).then((updatedScholar) => {
              // 更新本地数据并触发数据更新事件
              eventBus.emit("scholar:updated", updatedScholar);

              // 更新UI - 不需要手动设置状态，因为后端已经完成了
              state.currentScholar = updatedScholar;
              render();

              // 隐藏爬取按钮 (因为现在是主要学者)
              button.style.display = "none";

              // 通知图表更新节点类型
              eventBus.emit("graph:updateNode", {
                id: scholarData.id,
                data: { nodeType: "primary" },
                classes: {
                  remove: ["secondary-node"],
                  add: ["primary-node"],
                },
              });

              showStatusMessage("成功更新学者数据并刷新图谱", "success");
            });
          })
          .catch((error) => {
            console.error("刷新图谱失败:", error);
            showStatusMessage("刷新图谱失败，请尝试手动刷新页面", "error");
          });
      } else {
        showStatusMessage(
          "更新学者数据失败: " + (data.error || "未知错误"),
          "error"
        );
      }
    })
    .catch((error) => {
      // 恢复按钮状态
      button.innerHTML = originalText;
      button.disabled = false;
      showStatusMessage("更新学者数据时出错: " + error, "error");
    });
}

/**
 * 处理不感兴趣学者标记
 * @private
 * @param {HTMLElement} button - 不感兴趣按钮元素
 * @param {Object} scholarData - 学者数据
 */
function _handleNotInterested(button, scholarData) {
  console.log(
    `DEBUGTAG: 开始_handleNotInterested - scholarId=${scholarData.id}`
  );
  console.log(`DEBUGTAG: 学者数据:`, scholarData);

  // 设置按钮为加载状态
  const originalText = button.textContent;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在处理...';
  button.disabled = true;
  console.log(`DEBUGTAG: 按钮状态已设置为加载中`);

  // 准备更新数据 - 设置is_main_scholar为2表示不感兴趣
  const updateData = {
    is_main_scholar: 2,
  };
  console.log(`DEBUGTAG: 准备更新数据 - updateData=`, updateData);

  // 使用API更新学者信息，直接传递学者ID和更新数据
  console.log(`DEBUGTAG: 调用updateScholar API - scholarId=${scholarData.id}`);
  updateScholar(scholarData.id, updateData)
    .then((result) => {
      console.log(`DEBUGTAG: updateScholar API返回结果:`, result);

      if (result.success) {
        console.log(`DEBUGTAG: 更新成功 - 显示成功消息`);
        showStatusMessage("已将该学者标记为不感兴趣", "success");

        // 更新按钮状态
        button.textContent = "已标记为不感兴趣";
        button.classList.add("disabled");
        button.disabled = true;
        console.log(`DEBUGTAG: 按钮状态已更新为已禁用`);

        // 更新本地数据
        if (window.scholars && window.scholars[scholarData.id]) {
          window.scholars[scholarData.id].is_main_scholar = 2;
          console.log(
            `DEBUGTAG: 已更新本地缓存数据 - 学者${scholarData.id}.is_main_scholar=2`
          );
        }

        // 更新当前学者状态
        if (
          state.currentScholar &&
          state.currentScholar.id === scholarData.id
        ) {
          state.currentScholar.is_main_scholar = 2;
          console.log(
            `DEBUGTAG: 已更新当前状态 - currentScholar.is_main_scholar=2`
          );
        }

        // 通知图表更新节点类型和样式
        console.log(`DEBUGTAG: 发出graph:updateNode事件`);
        eventBus.emit("graph:updateNode", {
          id: scholarData.id,
          data: {
            is_main_scholar: 2,
            nodeType: "hidden", // 可以定义一个新的节点类型
          },
          classes: {
            add: ["not-interested-node"],
            remove: ["primary-node", "secondary-node"],
          },
        });

        // 触发学者更新事件
        console.log(`DEBUGTAG: 发出scholar:updated事件`);
        eventBus.emit("scholar:updated", {
          ...state.currentScholar,
          is_main_scholar: 2,
        });

        // 重新加载数据并刷新图谱
        console.log(`DEBUGTAG: 开始重新加载数据`);
        reloadData()
          .then(() => {
            console.log(`DEBUGTAG: 数据重新加载成功`);
            showStatusMessage("图谱已更新，该学者将被隐藏", "success");
          })
          .catch((error) => {
            console.error(`DEBUGTAG: 刷新图谱失败:`, error);
            showStatusMessage("图谱刷新失败，请手动刷新页面", "error");
          });
      } else {
        // 恢复按钮状态
        console.log(`DEBUGTAG: 更新失败 - 恢复按钮状态`);
        button.textContent = originalText;
        button.disabled = false;

        showStatusMessage(
          "标记不感兴趣失败: " + (result.error || "未知错误"),
          "error"
        );
      }
    })
    .catch((error) => {
      // 恢复按钮状态
      console.error(`DEBUGTAG: 更新请求出错:`, error);
      button.textContent = originalText;
      button.disabled = false;

      showStatusMessage("标记不感兴趣时出错: " + error, "error");
    });
}

/**
 * 保存学者标签
 * @private
 * @param {string} scholarId - 学者ID
 * @param {Array} tags - 标签数组
 */
function _saveScholarTags(scholarId, tags) {
  if (!scholarId || !window.scholars[scholarId]) {
    showStatusMessage("未选择学者，无法保存标签", "error");
    return Promise.reject(new Error("无效的学者ID"));
  }

  // 显示加载状态
  showStatusMessage("正在保存标签...", "info");

  // 记录警告日志
  console.warn(
    "使用 _saveScholarTags (update-tags API) 更新标签将被废弃，请考虑使用 addTag API"
  );

  // 使用API更新标签
  return saveScholarTags(scholarId, tags)
    .then((result) => {
      if (result.success) {
        // 更新本地学者数据
        window.scholars[scholarId].tags = tags;

        // 更新图上的标签数据
        if (window.cy) {
          const node = window.cy.getElementById(scholarId);
          if (node.length > 0) {
            node.data("tags", tags);
          }
        }

        // 触发标签更新事件
        eventBus.emit("scholar:tagsUpdated", {
          scholarId,
          tags,
        });

        showStatusMessage("标签已保存", "success");
        return true;
      } else {
        console.error("保存标签失败:", result);
        showStatusMessage(
          `保存标签失败: ${result.error || "未知错误"}`,
          "error"
        );
        return Promise.reject(new Error(result.error || "未知错误"));
      }
    })
    .catch((error) => {
      console.error("保存标签失败:", error);
      showStatusMessage(
        `保存标签失败: ${error.message || "网络错误"}`,
        "error"
      );
      return Promise.reject(error);
    });
}

/**
 * 设置标签点击事件处理
 * 当用户点击学者标签时高亮相关节点
 */
function setupTagClickHandlers() {
  document.addEventListener("click", function (event) {
    // 检查是否点击的是标签
    const tagElement = event.target.closest(".scholar-tag");
    if (tagElement && !event.target.closest(".tag-filter-item")) {
      const tag = tagElement.textContent || tagElement.dataset.tag;
      graphPanel.highlightByTag(tag);
    }
  });
}

/**
 * 设置标签管理面板
 * @private
 */
function _setupTagManagement() {
  // 获取标签添加按钮
  const tagAddBtn = document.getElementById("tag-add-btn");
  if (!tagAddBtn) return;

  // 获取标签对话框元素
  const tagDialog = document.getElementById("tag-dialog");
  const closeTagDialog = document.querySelector(".tag-dialog-close");
  const cancelTagBtn = document.getElementById("cancel-tag-btn");
  const saveTagBtn = document.getElementById("save-tag-btn");
  const addCustomTagBtn = document.getElementById("add-custom-tag-btn");
  const customTagInput = document.getElementById("custom-tag-input");
  const currentTagsContainer = document.getElementById("current-tags");
  const predefinedTags = document.querySelectorAll(
    ".predefined-tags .scholar-tag"
  );

  // 添加标签按钮点击事件
  tagAddBtn.addEventListener("click", () => {
    _openTagDialog();
  });

  // 关闭对话框事件
  if (closeTagDialog) {
    closeTagDialog.addEventListener("click", () => {
      tagDialog.style.display = "none";
    });
  }

  // 取消按钮事件
  if (cancelTagBtn) {
    cancelTagBtn.addEventListener("click", () => {
      tagDialog.style.display = "none";
    });
  }

  // 添加自定义标签事件
  if (addCustomTagBtn && customTagInput) {
    addCustomTagBtn.addEventListener("click", () => {
      const customTag = customTagInput.value.trim();
      if (customTag) {
        _addCustomTag(customTag);
        customTagInput.value = "";
      }
    });

    // 回车键添加标签
    customTagInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const customTag = customTagInput.value.trim();
        if (customTag) {
          _addCustomTag(customTag);
          customTagInput.value = "";
        }
      }
    });
  }

  // 预定义标签点击事件
  if (predefinedTags) {
    predefinedTags.forEach((tag) => {
      tag.addEventListener("click", () => {
        const tagValue = tag.dataset.tag;
        _addCustomTag(tagValue);
      });
    });
  }

  // 保存标签按钮事件
  if (saveTagBtn) {
    saveTagBtn.addEventListener("click", () => {
      _saveTagsFromDialog();
      tagDialog.style.display = "none";
    });
  }
}

/**
 * 打开标签管理对话框
 * @private
 */
function _openTagDialog() {
  if (!state.currentScholar || !state.currentScholar.id) {
    showStatusMessage("未选择学者，无法管理标签", "error");
    return;
  }

  const tagDialog = document.getElementById("tag-dialog");
  const currentTagsContainer = document.getElementById("current-tags");

  if (!tagDialog || !currentTagsContainer) return;

  // 清空当前标签容器
  currentTagsContainer.innerHTML = "";

  // 获取当前学者的标签
  const currentTags = state.currentScholar.tags || [];

  // 显示当前标签
  currentTags.forEach((tag) => {
    const tagSpan = document.createElement("span");
    tagSpan.className = "tag";
    tagSpan.textContent = tag;

    // 添加删除按钮
    const deleteBtn = document.createElement("span");
    deleteBtn.className = "tag-delete";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      tagSpan.remove();
    });

    tagSpan.appendChild(deleteBtn);
    currentTagsContainer.appendChild(tagSpan);
  });

  // 显示对话框
  tagDialog.style.display = "block";
}

/**
 * 添加自定义标签到对话框
 * @private
 * @param {string} tag - 标签文本
 */
function _addCustomTag(tag) {
  if (!tag) return;

  const currentTagsContainer = document.getElementById("current-tags");
  if (!currentTagsContainer) return;

  // 检查标签是否已存在
  const existingTags = currentTagsContainer.querySelectorAll(".tag");
  for (const existingTag of existingTags) {
    if (existingTag.textContent.replace("×", "").trim() === tag) {
      // 标签已存在，闪烁提示
      existingTag.classList.add("tag-highlight");
      setTimeout(() => {
        existingTag.classList.remove("tag-highlight");
      }, 1000);
      return;
    }
  }

  // 创建新标签
  const tagSpan = document.createElement("span");
  tagSpan.className = "tag";
  tagSpan.textContent = tag;

  // 添加删除按钮
  const deleteBtn = document.createElement("span");
  deleteBtn.className = "tag-delete";
  deleteBtn.innerHTML = "&times;";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tagSpan.remove();
  });

  tagSpan.appendChild(deleteBtn);
  currentTagsContainer.appendChild(tagSpan);

  // 高亮新添加的标签
  tagSpan.classList.add("tag-highlight");
  setTimeout(() => {
    tagSpan.classList.remove("tag-highlight");
  }, 1000);
}

/**
 * 从对话框保存标签
 * @private
 */
function _saveTagsFromDialog() {
  if (!state.currentScholar || !state.currentScholar.id) {
    showStatusMessage("未选择学者，无法保存标签", "error");
    return;
  }

  const currentTagsContainer = document.getElementById("current-tags");
  if (!currentTagsContainer) return;

  // 收集当前标签
  const tagElements = currentTagsContainer.querySelectorAll(".tag");
  const newTags = Array.from(tagElements).map((el) =>
    el.textContent.replace("×", "").trim()
  );

  // 获取当前标签
  const currentTags = state.currentScholar.tags || [];

  // 显示加载状态
  showStatusMessage("正在保存标签...", "info");

  // 标签差异分析
  const tagsToAdd = newTags.filter((tag) => !currentTags.includes(tag));
  const tagsToRemove = currentTags.filter((tag) => !newTags.includes(tag));

  console.log("需要添加的标签:", tagsToAdd);
  console.log("需要移除的标签:", tagsToRemove);

  const promises = [];

  // 添加新标签
  for (const tag of tagsToAdd) {
    promises.push(
      addScholarTag(state.currentScholar.id, tag).then((result) => {
        if (!result.success) {
          console.error(`添加标签"${tag}"失败:`, result.error || "未知错误");
        }
        return result;
      })
    );
  }

  // 执行所有标签操作
  Promise.all(promises)
    .then((results) => {
      // 更新当前学者的标签
      if (window.scholars[state.currentScholar.id]) {
        window.scholars[state.currentScholar.id].tags = newTags;
      }

      // 更新当前显示的学者标签
      state.currentScholar.tags = newTags;
      _updateTags(state.currentScholar);

      // 更新图上的标签数据
      if (window.cy) {
        const node = window.cy.getElementById(state.currentScholar.id);
        if (node.length > 0) {
          node.data("tags", newTags);
        }
      }

      // 触发标签更新事件
      eventBus.emit("scholar:tagsUpdated", {
        scholarId: state.currentScholar.id,
        tags: newTags,
      });

      showStatusMessage("标签已保存", "success");
    })
    .catch((error) => {
      console.error("保存标签失败:", error);
      showStatusMessage(
        `保存标签失败: ${error.message || "网络错误"}`,
        "error"
      );
    });
}

// 组件公开API
export default {
  // 初始化组件
  init() {
    // 移除现有的事件监听，避免重复订阅
    eventBus.off("scholar:select", this.show);

    // 订阅相关事件
    eventBus.on("scholar:select", this.show);
    setupTagClickHandlers();

    // 设置标签管理
    _setupTagManagement();

    console.log("详情面板已初始化，并订阅scholar:select事件");
    return this;
  },

  // 显示详情面板并加载学者数据
  show(scholarData) {
    console.log("detailPanel.show被调用，scholarId:", scholarData?.id);

    // 防止重复调用或处理相同学者
    if (
      state.currentScholar &&
      scholarData &&
      state.currentScholar.id === scholarData.id
    ) {
      console.log("忽略重复的学者选择事件:", scholarData.id);
      return;
    }

    if (!scholarData) {
      state.currentScholar = null;
      state.isVisible = false;
      render();
      return;
    }

    try {
      // 根据学者ID实时获取最新数据
      if (scholarData.id) {
        console.log("开始获取学者详情:", scholarData.id);

        // 显示加载状态
        state.isVisible = true;
        const tempScholar = { ...scholarData, _loading: true };
        state.currentScholar = tempScholar;
        render();

        // 获取详细数据
        getScholarById(scholarData.id)
          .then((latestData) => {
            // 如果获取成功，使用最新数据更新面板
            console.log("成功获取学者详情:", latestData);

            // 检查后端返回的数据结构
            if (latestData.scholar) {
              // API直接返回的数据格式
              const scholar = latestData.scholar;
              scholar.id = scholar.scholar_id || scholarData.id;
              state.currentScholar = scholar;
            } else {
              // dataManager已经处理过的数据格式
              latestData.id = latestData.scholar_id || scholarData.id;
              state.currentScholar = latestData;
            }

            // 检查所需的基本字段是否存在
            if (!state.currentScholar.tags) {
              state.currentScholar.tags = [];
            }

            if (!state.currentScholar.publications) {
              state.currentScholar.publications = [];
            }

            if (!state.currentScholar.related_scholars) {
              state.currentScholar.related_scholars = [];
            }

            // 确保nodeType字段存在
            if (!state.currentScholar.nodeType) {
              state.currentScholar.nodeType = state.currentScholar
                .is_main_scholar
                ? "primary"
                : "secondary";
            }

            state.isVisible = true;
            render();
          })
          .catch((error) => {
            // 如果获取失败，使用传入的原始数据
            console.warn("无法获取最新学者数据，使用缓存数据:", error);
            scholarData.id = scholarData.scholar_id || scholarData.id;
            state.currentScholar = scholarData;
            state.isVisible = true;
            render();
          });
      } else {
        // 如果没有ID，直接使用传入的数据
        state.currentScholar = scholarData;
        state.isVisible = true;
        render();
      }
    } catch (error) {
      console.error("更新详情面板时出错:", error);
      // 出错时仍尝试使用原始数据
      state.currentScholar = scholarData;
      state.isVisible = true;
      render();
    }
  },

  // 更新详情面板
  update(scholarData) {
    this.show(scholarData);
  },

  // 隐藏详情面板
  hide() {
    state.isVisible = false;
    render();
  },

  // 清空详情面板
  clear() {
    state.currentScholar = null;
    render();
  },

  // 更新学者标签，并保存到服务器
  updateTags(scholarId, tags) {
    if (!scholarId || !window.scholars[scholarId]) {
      return Promise.reject(new Error("无效的学者ID"));
    }

    // 更新本地数据
    window.scholars[scholarId].tags = tags;

    // 如果是当前显示的学者，更新UI
    if (state.currentScholar && state.currentScholar.id === scholarId) {
      state.currentScholar.tags = tags;
      _updateTags(state.currentScholar);
    }

    // 保存到服务器
    return _saveScholarTags(scholarId, tags);
  },

  // 添加标签
  addTag(scholarId, tag) {
    if (!scholarId || !window.scholars[scholarId]) {
      return Promise.reject(new Error("无效的学者ID"));
    }

    const scholarData = window.scholars[scholarId];
    const tags = scholarData.tags || [];

    // 检查标签是否已存在
    if (tags.includes(tag)) {
      return Promise.resolve(false);
    }

    // 使用新API添加标签
    return addScholarTag(scholarId, tag).then((result) => {
      if (result.success) {
        // 如果API返回了更新后的标签列表，使用它
        if (result.tags) {
          scholarData.tags = result.tags;
          // 如果是当前显示的学者，更新UI
          if (state.currentScholar && state.currentScholar.id === scholarId) {
            state.currentScholar.tags = result.tags;
            _updateTags(state.currentScholar);
          }
          return true;
        } else {
          // 添加新标签
          tags.push(tag);
          scholarData.tags = tags;
          // 如果是当前显示的学者，更新UI
          if (state.currentScholar && state.currentScholar.id === scholarId) {
            state.currentScholar.tags = tags;
            _updateTags(state.currentScholar);
          }
          return true;
        }
      } else {
        console.error("添加标签失败:", result.error || "未知错误");
        return Promise.reject(new Error(result.error || "添加标签失败"));
      }
    });
  },

  // 移除标签
  removeTag(scholarId, tag) {
    if (!scholarId || !window.scholars[scholarId]) {
      return Promise.reject(new Error("无效的学者ID"));
    }

    const scholarData = window.scholars[scholarId];
    const tags = scholarData.tags || [];

    // 移除标签
    const newTags = tags.filter((t) => t !== tag);

    // 如果没有变化，直接返回
    if (newTags.length === tags.length) {
      return Promise.resolve(false);
    }

    // 更新并保存
    return this.updateTags(scholarId, newTags);
  },

  // 设置标签点击事件处理
  setupTagClickHandlers() {
    setupTagClickHandlers();
    return this;
  },
};
