#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
论文数据诊断工具
检查学者JSON文件中的论文数据与数据库中的记录是否一致
"""

import json
import os
import sqlite3
import argparse

def check_publications_count(file_path, db_path=None):
    """检查指定学者文件中的publication数量，并分析与数据库记录的差异
    
    Args:
        file_path: 学者JSON文件路径
        db_path: 数据库路径
        
    Returns:
        int: JSON文件中的论文数量，出错返回-1
    """
    try:
        # 读取JSON文件
        with open(file_path, 'r', encoding='utf-8') as f:
            scholar_data = json.load(f)
        
        scholar_id = scholar_data.get('scholar_id')
        scholar_name = scholar_data.get('name')
        publications = scholar_data.get('publications', [])
        pub_count = len(publications)
        
        print(f"学者ID: {scholar_id}")
        print(f"姓名: {scholar_name}")
        print(f"JSON文件中论文数量: {pub_count}")
        
        # 如果提供了数据库路径，连接数据库查询实际导入的论文
        if db_path and os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 查询数据库中该学者的论文数量
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM authorship 
                WHERE scholar_id = ?
            """, (scholar_id,))
            db_pub_count = cursor.fetchone()['count']
            print(f"数据库中论文关联数量: {db_pub_count}")
            
            # 分析差异
            if pub_count != db_pub_count:
                print(f"\n差异分析:")
                print(f"差异数量: {pub_count - db_pub_count}")

                # 分析可能被跳过的论文类型
                missing_title = 0
                empty_citesid = 0
                
                for pub in publications:
                    bib = pub.get('bib', {})
                    title = bib.get('title')
                    cites_id = pub.get('cites_id', [])
                    
                    if not title:
                        missing_title += 1
                    
                    if not cites_id or len(cites_id) == 0:
                        empty_citesid += 1
                
                print(f"缺少标题的论文: {missing_title}")
                print(f"没有引用ID的论文: {empty_citesid}")
                
                # 分析重复可能性
                # 计算有多少篇论文使用相同的cites_id
                cites_id_count = {}
                for pub in publications:
                    cites_id = pub.get('cites_id', [])
                    if cites_id and len(cites_id) > 0:
                        key = cites_id[0]
                        cites_id_count[key] = cites_id_count.get(key, 0) + 1
                
                # 找出重复的cites_id
                duplicates = {k: v for k, v in cites_id_count.items() if v > 1}
                print(f"重复引用ID的论文数量: {len(duplicates)}")
                print(f"去重后的论文数量应该是: {pub_count - sum(v-1 for v in duplicates.values())}")
                
                # 检查数据库中实际存储的论文
                cursor.execute("""
                    SELECT p.title, p.cites_id
                    FROM publications p
                    JOIN authorship a ON p.pub_id = a.pub_id
                    WHERE a.scholar_id = ?
                """, (scholar_id,))
                
                db_pubs = cursor.fetchall()
                print(f"\n数据库中实际存储的该学者论文数: {len(db_pubs)}")
                
                # 分析有效的引用ID
                valid_cite_ids = set()
                for pub in publications:
                    cites_id = pub.get('cites_id', [])
                    if cites_id and len(cites_id) > 0:
                        valid_cite_ids.add(cites_id[0])
                
                print(f"JSON中有效引用ID数量: {len(valid_cite_ids)}")
                
                # 转储一些示例缺失的论文
                print("\n示例可能被跳过的论文:")
                sample_count = 0
                for pub in publications:
                    bib = pub.get('bib', {})
                    title = bib.get('title', 'No Title')
                    cites_id = pub.get('cites_id', [])
                    cite_id = cites_id[0] if cites_id and len(cites_id) > 0 else "无引用ID"
                    
                    # 从数据库中查找这篇论文
                    found = False
                    for db_pub in db_pubs:
                        db_cites = json.loads(db_pub['cites_id'])
                        if db_cites and len(db_cites) > 0 and cites_id and len(cites_id) > 0:
                            if db_cites[0] == cites_id[0]:
                                found = True
                                break
                    
                    if not found and sample_count < 5:
                        sample_count += 1
                        print(f"标题: {title}")
                        print(f"引用ID: {cite_id}")
                        print(f"没有标题: {not title}")
                        print("---")
            
            conn.close()
        
        return pub_count
    except Exception as e:
        print(f"处理文件时出错: {str(e)}")
        return -1

def check_all_scholars(scholars_dir, db_path):
    """检查目录下所有学者文件的论文数据一致性
    
    Args:
        scholars_dir: 学者数据目录
        db_path: 数据库路径
        
    Returns:
        tuple: (检查文件数, 发现问题数)
    """
    if not os.path.exists(scholars_dir):
        print(f"错误: 目录不存在 - {scholars_dir}")
        return 0, 0
    
    if not os.path.exists(db_path):
        print(f"错误: 数据库文件不存在 - {db_path}")
        return 0, 0
    
    files_checked = 0
    problems_found = 0
    
    for file in os.listdir(scholars_dir):
        if file.endswith('.json'):
            file_path = os.path.join(scholars_dir, file)
            print(f"\n检查文件: {file}")
            
            # 获取JSON文件中的论文数量
            pub_count = check_publications_count(file_path, db_path)
            
            # 获取数据库中的论文数量
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    scholar_data = json.load(f)
                
                scholar_id = scholar_data.get('scholar_id')
                
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT COUNT(*) as count 
                    FROM authorship 
                    WHERE scholar_id = ?
                """, (scholar_id,))
                db_pub_count = cursor.fetchone()[0]
                conn.close()
                
                # 检查是否有差异
                if pub_count != db_pub_count:
                    problems_found += 1
                
                files_checked += 1
                
            except Exception as e:
                print(f"检查文件出错: {str(e)}")
    
    print(f"\n总结:")
    print(f"检查的文件数: {files_checked}")
    print(f"发现问题的文件数: {problems_found}")
    
    return files_checked, problems_found

def main():
    """命令行入口点"""
    parser = argparse.ArgumentParser(description='检查学者论文数据一致性')
    parser.add_argument('--file', '-f', help='单个学者JSON文件路径')
    parser.add_argument('--dir', '-d', help='学者数据目录')
    parser.add_argument('--db', required=True, help='数据库路径')
    
    args = parser.parse_args()
    
    if args.file:
        if not os.path.exists(args.file):
            print(f"错误: JSON文件不存在 - {args.file}")
            return
        
        check_publications_count(args.file, args.db)
    
    elif args.dir:
        check_all_scholars(args.dir, args.db)
    
    else:
        print("错误: 必须指定文件路径(-f)或目录路径(-d)")

if __name__ == "__main__":
    main() 