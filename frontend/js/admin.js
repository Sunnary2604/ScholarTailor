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

// 添加学者按钮点击事件
function setupAddScholarBtn() {
  const addBtn = document.getElementById('add-scholar-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      // 获取输入值
      const nameInput = document.getElementById('new-scholar-input');
      const idInput = document.getElementById('new-scholar-id');
      
      const name = nameInput.value.trim();
      const scholarId = idInput.value.trim();
      
      // 检查输入
      if (!name && !scholarId) {
        showAdminStatus('请输入学者姓名或ID', 'error');
        return;
      }
      
      // 设置按钮加载状态
      const originalBtnText = setButtonLoading(addBtn, true);
      
      try {
        let result;
        
        // 根据输入类型调用不同API
        if (scholarId) {
          // 处理ID或链接
          let id = scholarId;
          
          // 如果是完整的Google Scholar链接，提取ID
          if (scholarId.includes('user=')) {
            const match = scholarId.match(/user=([^&]+)/);
            if (match && match[1]) {
              id = match[1];
            }
          }
          
          result = await addScholar({ scholar_id: id });
        } else {
          // 仅使用姓名
          result = await addScholar({ name: name });
        }
        
        if (result.success) {
          showAdminStatus(`成功添加学者: ${result.message || ''}`, 'success');
          // 清空输入
          nameInput.value = '';
          idInput.value = '';
          
          // 刷新学者列表
          loadScholarList();
        } else {
          showAdminStatus(`添加学者失败: ${result.error || '未知错误'}`, 'error');
        }
      } catch (error) {
        showAdminStatus(`添加学者时出错: ${error.message}`, 'error');
      } finally {
        // 恢复按钮状态
        setButtonLoading(addBtn, false, originalBtnText);
      }
    });
  }
}

// 批量添加学者按钮点击事件
function setupBatchAddBtn() {
  const batchBtn = document.getElementById('batch-add-btn');
  if (batchBtn) {
    batchBtn.addEventListener('click', async () => {
      // 获取输入值
      const batchInput = document.getElementById('batch-scholars');
      const inputLines = batchInput.value.trim().split('\n').filter(line => line.trim() !== '');
      
      // 检查输入
      if (inputLines.length === 0) {
        showAdminStatus('请输入至少一个学者ID或名称', 'error');
        return;
      }
      
      // 分类输入行：ID/链接 vs 名称
      const scholarIds = [];
      const scholarNames = [];
      
      inputLines.forEach(line => {
        const trimmed = line.trim();
        // 检查是否为ID或链接格式
        if (trimmed.includes('user=') || trimmed.match(/^[A-Za-z0-9_-]{12,}$/)) {
          scholarIds.push(trimmed);
        } else {
          scholarNames.push(trimmed);
        }
      });
      
      // 设置按钮加载状态
      const originalBtnText = setButtonLoading(batchBtn, true);
      
      try {
        let result;
        let totalAdded = 0;
        
        // 如果有ID/链接，先处理它们
        if (scholarIds.length > 0) {
          showAdminStatus(`处理 ${scholarIds.length} 个学者ID/链接...`, 'info');
          result = await addScholarBatch(scholarIds);
          if (result.success) {
            totalAdded += result.added || 0;
          }
        }
        
        // 然后处理名称
        if (scholarNames.length > 0) {
          showAdminStatus(`处理 ${scholarNames.length} 个学者名称...`, 'info');
          result = await addScholarBatch(scholarNames);
          if (result.success) {
            totalAdded += result.added || 0;
          }
        }
        
        if (totalAdded > 0) {
          showAdminStatus(`成功添加 ${totalAdded} 位学者`, 'success');
          // 清空输入
          batchInput.value = '';
          
          // 刷新学者列表
          loadScholarList();
        } else {
          showAdminStatus(`批量添加学者失败: ${result ? result.error : '未知错误'}`, 'error');
        }
      } catch (error) {
        showAdminStatus(`批量添加学者时出错: ${error.message}`, 'error');
      } finally {
        // 恢复按钮状态
        setButtonLoading(batchBtn, false, originalBtnText);
      }
    });
  }
}

// 设置更新所有学者数据按钮
function setupRefreshAllBtn() {
  const refreshBtn = document.getElementById('refresh-all-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      // 询问用户确认
      if (!confirm('确定要更新所有学者数据吗？此操作可能需要较长时间。')) {
        return;
      }
      
      const keepCustom = document.getElementById('keep-custom').checked;
      
      // 设置按钮加载状态
      const originalBtnText = setButtonLoading(refreshBtn, true);
      
      try {
        const result = await refreshAllScholars(keepCustom);
        
        if (result.success) {
          showAdminStatus('成功更新所有学者数据', 'success');
        } else {
          showAdminStatus(`更新学者数据失败: ${result.error || '未知错误'}`, 'error');
        }
      } catch (error) {
        showAdminStatus(`更新学者数据时出错: ${error.message}`, 'error');
      } finally {
        // 恢复按钮状态
        setButtonLoading(refreshBtn, false, originalBtnText);
      }
    });
  }
}

// 设置初始化数据库按钮
function setupInitDbBtn() {
  const initDbBtn = document.getElementById('init-db-btn');
  if (initDbBtn) {
    initDbBtn.addEventListener('click', async () => {
      // 询问用户确认
      if (!confirm('警告：此操作将清空所有数据！确定要继续吗？')) {
        return;
      }
      
      // 再次确认
      if (!confirm('再次确认：此操作无法撤销，所有数据将被删除！')) {
        return;
      }
      
      // 设置按钮加载状态
      const originalBtnText = setButtonLoading(initDbBtn, true);
      
      try {
        const result = await initializeDatabase();
        
        if (result.success) {
          showAdminStatus('数据库已成功初始化', 'success');
          // 刷新页面
          setTimeout(() => window.location.reload(), 2000);
        } else {
          showAdminStatus(`初始化数据库失败: ${result.error || '未知错误'}`, 'error');
        }
      } catch (error) {
        showAdminStatus(`初始化数据库时出错: ${error.message}`, 'error');
      } finally {
        // 恢复按钮状态
        setButtonLoading(initDbBtn, false, originalBtnText);
      }
    });
  }
}

// 设置数据导入按钮
function setupMigrateDataBtn() {
  const migrateBtn = document.getElementById('migrate-data-btn');
  if (migrateBtn) {
    migrateBtn.addEventListener('click', async () => {
      // 询问用户确认
      if (!confirm('警告：此操作将清空数据库并重新导入所有文件，可能需要较长时间！确定要继续吗？')) {
        return;
      }
      
      // 再次确认
      if (!confirm('再次确认：此操作无法撤销，所有现有数据将被替换！')) {
        return;
      }
      
      // 设置按钮加载状态
      const originalBtnText = setButtonLoading(migrateBtn, true);
      
      try {
        const result = await migrateData();
        
        if (result.success) {
          showAdminStatus(`数据已成功重新导入: ${result.message || ''}`, 'success');
          // 刷新页面
          setTimeout(() => window.location.reload(), 2000);
        } else {
          showAdminStatus(`重新导入数据失败: ${result.error || '未知错误'}`, 'error');
        }
      } catch (error) {
        showAdminStatus(`重新导入数据时出错: ${error.message}`, 'error');
      } finally {
        // 恢复按钮状态
        setButtonLoading(migrateBtn, false, originalBtnText);
      }
    });
  }
} 