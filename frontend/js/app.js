// 添加重新加载数据按钮
const reloadBtn = document.getElementById('reload-data-btn');
if (reloadBtn) {
  reloadBtn.addEventListener('click', async function() {
    // 设置按钮为加载状态
    const originalText = this.innerHTML;
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
    
    try {
      await reloadData();
      showStatusMessage('数据已成功刷新', 'success');
    } catch (error) {
      console.error('刷新数据失败:', error);
      showStatusMessage('刷新数据失败', 'error');
    } finally {
      // 恢复按钮状态
      this.disabled = false;
      this.innerHTML = originalText;
    }
  });
} 