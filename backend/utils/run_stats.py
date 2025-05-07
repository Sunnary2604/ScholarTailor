#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
运行数据库统计脚本
方便用户从命令行执行数据库统计
"""

import os
import sys
import importlib.util
import argparse

# 确保可以导入项目其他模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def run_stats():
    """运行数据库统计脚本"""
    # 获取db_stats.py的路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    stats_script = os.path.join(script_dir, 'db_stats.py')
    
    # 检查文件是否存在
    if not os.path.exists(stats_script):
        print(f"错误: 统计脚本不存在 {stats_script}")
        return False
    
    # 导入并运行脚本
    spec = importlib.util.spec_from_file_location("db_stats", stats_script)
    stats_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stats_module)
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='运行数据库统计')
    args = parser.parse_args()
    
    success = run_stats()
    if not success:
        sys.exit(1) 