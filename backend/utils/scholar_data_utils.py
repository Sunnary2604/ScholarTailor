#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
学者数据处理工具函数
从原data_processor.py文件中提取的有用工具函数
"""

import json
import os
from datetime import datetime

def create_scholar_node(scholar_id, data, is_secondary=False):
    """创建学者节点
    
    Args:
        scholar_id: 学者ID
        data: 学者数据字典
        is_secondary: 是否为次要学者
        
    Returns:
        dict: 学者节点数据
    """
    node = {
        'id': scholar_id,
        'label': data.get('name', '未知学者'),
        'group': 'secondary' if is_secondary else 'primary',
        'data': {
            'id': scholar_id,
            'name': data.get('name', '未知学者'),
            'affiliation': data.get('affiliation', ''),
            'interests': data.get('interests', []),
            'citedby': data.get('citedby', 0),
            'scholar_id': scholar_id,
            'is_secondary': is_secondary,
            'homepage': data.get('homepage', ''),
            'scholar_url': data.get('scholar_url', f"https://scholar.google.com/citations?user={scholar_id}"),
            'last_updated': data.get('last_updated', datetime.now().isoformat())
        }
    }
    
    # 添加自定义字段
    if 'custom_fields' in data and isinstance(data['custom_fields'], dict):
        node['data']['custom_fields'] = data['custom_fields']
    
    # 添加标签
    if 'tags' in data and isinstance(data['tags'], list):
        node['data']['tags'] = data['tags']
    else:
        node['data']['tags'] = []
    
    # 添加论文
    if 'publications' in data and isinstance(data['publications'], list):
        node['data']['publications'] = data['publications']
    
    return node

def filter_homepage(homepage):
    """过滤学者主页URL，移除Google内部链接
    
    Args:
        homepage: 原始主页URL
        
    Returns:
        str: 过滤后的URL
    """
    if not homepage:
        return ''
        
    if 'googleusercontent' in homepage or 'scholar.google' in homepage:
        return '' 
        
    return homepage

def load_custom_relationships(relationships_file):
    """从文件加载自定义关系
    
    Args:
        relationships_file: 关系数据文件路径
        
    Returns:
        list: 关系列表，加载失败返回空列表
    """
    if not os.path.exists(relationships_file):
        print(f"警告: 关系文件 '{relationships_file}' 不存在")
        return []
    
    try:
        with open(relationships_file, 'r', encoding='utf-8') as f:
            relationships = json.load(f)
        
        print(f"读取了 {len(relationships)} 个自定义关系")
        return relationships
    except Exception as e:
        print(f"加载关系文件时出错: {str(e)}")
        return []

def save_visualization_data(data, output_file):
    """将可视化数据保存为JSON文件
    
    Args:
        data: 可视化数据字典
        output_file: 输出文件路径
        
    Returns:
        str: 输出文件路径
    """
    # 确保目录存在
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"数据已保存到: {output_file}")
    print(f"节点数: {data['meta']['node_count']}, 边数: {data['meta']['edge_count']}")
    
    return output_file

def process_scholar_publication(pub_data):
    """处理单个论文数据
    
    Args:
        pub_data: 原始论文数据
        
    Returns:
        dict: 处理后的论文数据
    """
    if 'bib' not in pub_data:
        return None
        
    bib = pub_data['bib']
    pub_data = {
        'title': bib.get('title', ''),
        'year': bib.get('pub_year', bib.get('year', '')),
        'venue': bib.get('venue', bib.get('citation', '')),
        'citations': pub_data.get('num_citations', 0)
    }
    
    return pub_data

def process_publications(publications):
    """批量处理论文数据
    
    Args:
        publications: 原始论文数据列表
        
    Returns:
        list: 处理后的论文数据列表
    """
    processed_pubs = []
    
    for pub in publications:
        processed_pub = process_scholar_publication(pub)
        if processed_pub:
            processed_pubs.append(processed_pub)
    
    return processed_pubs 