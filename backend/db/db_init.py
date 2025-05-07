"""
数据库初始化脚本
用于创建和初始化SQLite数据库
"""

import os
import sys
import logging

# 确保可以导入父目录模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from db.db_manager import DBManager
from db.models import init_db

def initialize_database(db_path=None):
    """初始化数据库"""
    logging.info("正在初始化数据库...")
    
    # 创建数据库管理器实例
    db_manager = DBManager(db_path)
    
    # 初始化数据库结构
    version = init_db(db_manager)
    
    logging.info(f"数据库初始化完成，当前版本: {version}")
    
    return db_manager

if __name__ == "__main__":
    # 设置日志
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # 从命令行参数获取数据库路径
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    
    try:
        # 初始化数据库
        db_manager = initialize_database(db_path)
        print(f"数据库已成功初始化: {db_manager.db_path}")
    except Exception as e:
        logging.error(f"数据库初始化失败: {str(e)}")
        sys.exit(1) 