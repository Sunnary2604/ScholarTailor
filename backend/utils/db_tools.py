#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
数据库工具脚本
提供数据库清空、重建等功能
"""

import os
import sys
import argparse
import logging
import time

# 确保可以导入项目其他模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from db.db_manager import DBManager
from db.models import init_db
from utils.data_importer import import_all_scholar_files

def reset_database(db_path=None):
    """清空并重建数据库
    
    Args:
        db_path: 数据库路径
        
    Returns:
        bool: 是否成功
    """
    # 获取项目根目录
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # 设置默认数据库路径
    if not db_path:
        db_path = os.path.join(root_dir, 'data', 'scholar.db')
    
    try:
        # 检查数据库文件是否存在
        if os.path.exists(db_path):
            # 备份
            backup_path = f"{db_path}.bak.{int(time.time())}"
            os.rename(db_path, backup_path)
            logging.info(f"原数据库已备份到: {backup_path}")
        
        # 创建新的数据库
        db_manager = DBManager(db_path)
        init_db(db_manager)
        db_manager.close()
        
        logging.info(f"数据库已重置: {db_path}")
        return True
        
    except Exception as e:
        logging.error(f"重置数据库时出错: {str(e)}")
        return False

def rebuild_database(data_dir=None, db_path=None):
    """重建数据库并导入所有数据
    
    Args:
        data_dir: 数据目录路径
        db_path: 数据库路径
        
    Returns:
        tuple: (成功数量, 失败数量)
    """
    # 获取项目根目录
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # 设置默认路径
    if not data_dir:
        data_dir = os.path.join(root_dir, 'data', 'scholars')
    
    if not db_path:
        db_path = os.path.join(root_dir, 'data', 'scholar.db')
    
    # 重置数据库
    success = reset_database(db_path)
    if not success:
        return 0, 0
    
    # 导入所有学者数据
    success_count, failure_count = import_all_scholar_files(data_dir, db_path)
    
    return success_count, failure_count

def print_database_stats(db_path=None):
    """打印数据库统计信息
    
    Args:
        db_path: 数据库路径
    """
    # 获取项目根目录
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # 设置默认数据库路径
    if not db_path:
        db_path = os.path.join(root_dir, 'data', 'scholar.db')
    
    if not os.path.exists(db_path):
        logging.error(f"数据库文件不存在: {db_path}")
        return
    
    try:
        # 连接数据库
        db_manager = DBManager(db_path)
        
        # 查询各表数量
        tables = [
            "entities", "scholars", "publications", 
            "interests", "relationships", "authorship",
            "institutions"
        ]
        
        print("\n数据库统计信息:")
        print("=" * 40)
        
        total_records = 0
        for table in tables:
            cursor = db_manager.execute(f"SELECT COUNT(*) as count FROM {table}")
            result = cursor.fetchone()
            count = result['count'] if result else 0
            total_records += count
            print(f"{table:20s}: {count:10d} 条记录")
        
        print("=" * 40)
        print(f"总计: {total_records:18d} 条记录\n")
        
        # 查询实体类型分布
        cursor = db_manager.execute("""
            SELECT type, COUNT(*) as count
            FROM entities
            GROUP BY type
            ORDER BY count DESC
        """)
        results = cursor.fetchall()
        
        if results:
            print("实体类型分布:")
            print("-" * 40)
            for row in results:
                print(f"{row['type']:20s}: {row['count']:10d} 个")
            print()
        
        # 查询关系类型分布
        cursor = db_manager.execute("""
            SELECT relation_type, COUNT(*) as count
            FROM relationships
            GROUP BY relation_type
            ORDER BY count DESC
        """)
        results = cursor.fetchall()
        
        if results:
            print("关系类型分布:")
            print("-" * 40)
            for row in results:
                print(f"{row['relation_type']:20s}: {row['count']:10d} 条")
            print()
        
        # 查询兴趣分布
        cursor = db_manager.execute("""
            SELECT interest, COUNT(*) as count
            FROM interests
            GROUP BY interest
            ORDER BY count DESC
            LIMIT 10
        """)
        results = cursor.fetchall()
        
        if results:
            print("热门兴趣标签(TOP 10):")
            print("-" * 40)
            for row in results:
                print(f"{row['interest']:30s}: {row['count']:5d} 个")
            print()
        
        # 关闭数据库连接
        db_manager.close()
        
    except Exception as e:
        logging.error(f"查询数据库统计信息时出错: {str(e)}")

if __name__ == "__main__":
    # 设置日志
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='数据库管理工具')
    
    # 创建子命令解析器
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # reset命令
    reset_parser = subparsers.add_parser('reset', help='清空并重建数据库')
    reset_parser.add_argument('--db', help='数据库文件路径')
    
    # rebuild命令
    rebuild_parser = subparsers.add_parser('rebuild', help='重建数据库并导入所有数据')
    rebuild_parser.add_argument('--dir', help='JSON文件目录路径')
    rebuild_parser.add_argument('--db', help='数据库文件路径')
    
    # stats命令
    stats_parser = subparsers.add_parser('stats', help='显示数据库统计信息')
    stats_parser.add_argument('--db', help='数据库文件路径')
    
    args = parser.parse_args()
    
    # 执行命令
    if args.command == 'reset':
        reset_database(args.db)
    
    elif args.command == 'rebuild':
        success_count, failure_count = rebuild_database(args.dir, args.db)
        print(f"数据库重建完成: 成功导入 {success_count} 个文件, 失败 {failure_count} 个文件")
    
    elif args.command == 'stats':
        print_database_stats(args.db)
    
    else:
        parser.print_help() 