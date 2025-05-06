#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
ScholarVis - 数据处理模块
处理从scholarly获取的数据，生成适合前端可视化的JSON格式
"""

import json
import os
import glob
from datetime import datetime
from collections import defaultdict
from ScholarVis import ScholarVis

class ScholarDataProcessor:
    def __init__(self, scholars_dir='../data/scholars', output_file='../data.json'):
        """
        初始化数据处理器
        
        参数:
            scholars_dir (str): 学者数据目录
            output_file (str): 输出文件路径
        """
        self.scholars_dir = scholars_dir
        self.output_file = output_file
        self.scholars = {}  # 学者数据字典（主要学者）
        self.secondary_scholars = {}  # 关联学者数据字典（仅作为合作者出现）
        self.relationships = []  # 关系数据列表
        self.scholar_vis = ScholarVis()  # 初始化ScholarVis实例，用于加载自定义标签
    
    def load_scholar_data(self, scholar_data):
        """
        加载单个学者数据
        
        参数:
            scholar_data (dict): 从scholarly获取的学者原始数据
        """
        if not scholar_data or 'scholar_id' not in scholar_data:
            print("警告: 无效的学者数据")
            return
        
        scholar_id = scholar_data['scholar_id']
        
        # 检查是否已存在该学者
        if scholar_id in self.scholars:
            print(f"信息: 学者ID '{scholar_id}' 已存在，将被更新")
        
        # 如果该学者曾作为关联学者存在，应该将其移除
        if scholar_id in self.secondary_scholars:
            print(f"信息: 学者ID '{scholar_id}' 从关联学者升级为主要学者")
            del self.secondary_scholars[scholar_id]
        
        # 处理homepage字段，过滤掉Google用户内容链接
        homepage = scholar_data.get('homepage', '')
        if 'googleusercontent' in homepage or 'scholar.google' in homepage:
            homepage = ''  # 如果是Google内部链接，则清空
            
        # 提取基本信息
        scholar = {
            'id': scholar_id,
            'name': scholar_data.get('name', '未知'),
            'affiliation': scholar_data.get('affiliation', ''),
            'interests': scholar_data.get('interests', []),
            'citedby': scholar_data.get('citedby', 0),
            'scholar_url': f"https://scholar.google.com/citations?user={scholar_id}",
            'homepage': homepage,  # 使用过滤后的homepage
            'last_updated': scholar_data.get('last_updated', datetime.now().isoformat()),
            'custom_fields': scholar_data.get('custom_fields', {})  # 用于手动添加额外信息
        }
        
        # 加载自定义标签
        custom_tags = self.scholar_vis.get_scholar_tags(scholar_id)
        if custom_tags:
            scholar['tags'] = custom_tags
        elif 'tags' in scholar_data:
            scholar['tags'] = scholar_data['tags']
        else:
            scholar['tags'] = []
        
        # 提取论文信息
        publications = []
        for pub in scholar_data.get('publications', []):
            if 'bib' in pub:
                pub_data = {
                    'title': pub['bib'].get('title', ''),
                    'year': pub['bib'].get('pub_year', ''),
                    'venue': pub['bib'].get('citation', ''),  # 直接使用完整的citation字段
                    'citations': pub.get('num_citations', 0)
                }
                publications.append(pub_data)
        
        scholar['publications'] = publications
        
        # 存储到学者字典
        self.scholars[scholar_id] = scholar
        
        # 处理合作者关系
        self._process_coauthors(scholar_data)
    
    def load_all_scholars_from_dir(self):
        """
        从目录中加载所有学者JSON文件
        """
        # 获取目录中所有JSON文件
        json_pattern = os.path.join(self.scholars_dir, '*.json')
        json_files = glob.glob(json_pattern)
        
        if not json_files:
            print(f"警告: 目录 '{self.scholars_dir}' 中未找到JSON文件")
            return
        
        print(f"发现 {len(json_files)} 个学者数据文件")
        
        # 加载每个文件
        for file_path in json_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    scholar_data = json.load(f)
                    self.load_scholar_data(scholar_data)
                    print(f"已加载: {os.path.basename(file_path)}")
            except Exception as e:
                print(f"读取文件 '{file_path}' 时出错: {str(e)}")
    
    def _process_coauthors(self, scholar_data):
        """
        处理合作者关系，包括添加关联学者
        
        参数:
            scholar_data (dict): 学者数据
        """
        if 'scholar_id' not in scholar_data or 'coauthors' not in scholar_data:
            return
        
        scholar_id = scholar_data['scholar_id']
        
        for coauthor in scholar_data.get('coauthors', []):
            if 'scholar_id' in coauthor and coauthor['scholar_id']:
                coauthor_id = coauthor['scholar_id']
                
                # 创建关系记录
                relationship = {
                    'source': scholar_id,
                    'target': coauthor_id,
                    'type': 'coauthor',
                    'weight': 1  # 默认权重
                }
                
                # 检查是否已存在该关系
                if not any(r['source'] == relationship['source'] and 
                         r['target'] == relationship['target'] and
                         r['type'] == relationship['type'] for r in self.relationships):
                    self.relationships.append(relationship)
                
                # 如果合作者不在主要学者列表中，添加到关联学者
                if coauthor_id not in self.scholars and coauthor_id not in self.secondary_scholars:
                    # 处理homepage字段，过滤掉Google用户内容链接
                    homepage = coauthor.get('homepage', '')
                    if 'googleusercontent' in homepage or 'scholar.google' in homepage:
                        homepage = ''  # 如果是Google内部链接，则清空
                        
                    secondary_scholar = {
                        'id': coauthor_id,
                        'name': coauthor.get('name', '未知合作者'),
                        'affiliation': coauthor.get('affiliation', ''),
                        'is_secondary': True,  # 标记为关联学者
                        'homepage': homepage,  # 使用过滤后的homepage
                        'scholar_url': f"https://scholar.google.com/citations?user={coauthor_id}"
                    }
                    self.secondary_scholars[coauthor_id] = secondary_scholar
                    print(f"添加关联学者: {secondary_scholar['name']} ({coauthor_id})")
    
    def batch_load_scholars(self, scholars_data):
        """
        批量加载多位学者数据
        
        参数:
            scholars_data (dict): 以学者ID为键的学者数据字典
        """
        for scholar_id, data in scholars_data.items():
            self.load_scholar_data(data)
    
    def add_custom_relationship(self, source_id, target_id, relation_type, weight=1, metadata=None):
        """
        手动添加自定义关系
        
        参数:
            source_id (str): 源学者ID
            target_id (str): 目标学者ID
            relation_type (str): 关系类型，如'advisor', 'colleague'等
            weight (int): 关系权重
            metadata (dict): 关系元数据
        """
        # 检查主要学者和关联学者中是否存在这些ID
        source_exists = source_id in self.scholars or source_id in self.secondary_scholars
        target_exists = target_id in self.scholars or target_id in self.secondary_scholars
        
        if not source_exists or not target_exists:
            missing = []
            if not source_exists:
                missing.append(f"源学者ID '{source_id}'")
            if not target_exists:
                missing.append(f"目标学者ID '{target_id}'")
            
            print(f"警告: 添加关系失败，{' 和 '.join(missing)}不存在")
            
            # 添加一些调试信息
            print(f"当前已加载的主要学者ID: {list(self.scholars.keys())[:5]}...")
            print(f"当前已加载的关联学者ID: {list(self.secondary_scholars.keys())[:5]}...")
            return False
        
        relationship = {
            'source': source_id,
            'target': target_id,
            'type': relation_type,
            'weight': weight
        }
        
        if metadata:
            relationship['metadata'] = metadata
        
        # 检查是否已存在类似关系
        existing = next((r for r in self.relationships 
                     if r['source'] == source_id and r['target'] == target_id and r['type'] == relation_type), None)
        
        if existing:
            # 如果已存在，可以选择更新或跳过
            print(f"信息: 关系已存在，更新权重和元数据")
            existing['weight'] = weight
            if metadata:
                existing['metadata'] = metadata
        else:
            # 添加新关系
            self.relationships.append(relationship)
            print(f"已添加新关系: {source_id} -- {relation_type} --> {target_id}")
            
        return True
    
    def add_custom_scholar_field(self, scholar_id, field_name, field_value):
        """
        为学者添加自定义字段
        
        参数:
            scholar_id (str): 学者ID
            field_name (str): 字段名称
            field_value: 字段值
        """
        if scholar_id not in self.scholars:
            print(f"警告: 学者ID '{scholar_id}' 不存在于主要学者中")
            return False
        
        self.scholars[scholar_id]['custom_fields'][field_name] = field_value
        return True
    
    def create_scholar_node(self, scholar_id, data, is_secondary=False):
        """创建学者节点"""
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
                'homepage': data.get('homepage', ''),  # 确保直接获取homepage
                'scholar_url': data.get('scholar_url', f"https://scholar.google.com/citations?user={scholar_id}"),
                'last_updated': data.get('last_updated', datetime.now().isoformat())  # 确保添加last_updated字段
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
            # 直接包含所有论文，不做限制
            node['data']['publications'] = data['publications']
        
        return node
    
    def generate_visualization_data(self):
        """
        生成前端可视化所需数据格式
        
        返回:
            dict: 包含节点和边的数据结构
        """
        nodes = []
        uniqueScholars = set()  # 跟踪已添加的学者ID
        
        # 添加主要学者节点
        for scholar_id, scholar in self.scholars.items():
            if scholar_id not in uniqueScholars:
                node = self.create_scholar_node(scholar_id, scholar)
                nodes.append(node)
                uniqueScholars.add(scholar_id)
        
        # 添加关联学者节点（仅添加不在主要学者中的）
        for scholar_id, scholar in self.secondary_scholars.items():
            if scholar_id not in uniqueScholars:
            # 检查该关联学者是否与任何主要学者有关系
                has_relation = any(
                    (r['source'] == scholar_id and r['target'] in self.scholars) or
                    (r['target'] == scholar_id and r['source'] in self.scholars)
                    for r in self.relationships
                )
            
            # 只添加有关系的关联学者
            if has_relation:
                node = self.create_scholar_node(scholar_id, scholar, is_secondary=True)
                nodes.append(node)
                uniqueScholars.add(scholar_id)
        
        edges = []
        print(f"处理关系总数: {len(self.relationships)}")
        
        # 只添加至少一端连接到主要学者的边
        edge_count = 0
        for rel in self.relationships:
            source_is_primary = rel['source'] in self.scholars
            target_is_primary = rel['target'] in self.scholars
            
            # 如果至少一个端点是主要学者，添加此边
            if source_is_primary or target_is_primary:
                edge = {
                    'source': rel['source'],
                    'target': rel['target'],
                    'label': rel['type'],  # 确保使用'type'作为'label'
                    'weight': rel.get('weight', 1)
                }
                
                # 处理元数据
                if 'metadata' in rel:
                    edge['data'] = rel['metadata']
                    
                # 添加调试输出
                if edge_count < 5 or rel['type'] != 'coauthor':
                    print(f"添加边: {rel['source']} --[{rel['type']}]--> {rel['target']}")
                
                edges.append(edge)
                edge_count += 1
        
        print(f"生成的边总数: {len(edges)}")
        
        return {
            'nodes': nodes,
            'edges': edges,
            'meta': {
                'generated': datetime.now().isoformat(),
                'node_count': len(nodes),
                'edge_count': len(edges),
                'primary_count': len(self.scholars),
                'secondary_count': len([n for n in nodes if n['group'] == 'secondary']),
                'source_directory': self.scholars_dir
            }
        }
    
    def save_to_json(self, output_file=None):
        """
        将处理后的数据保存为JSON文件
        
        参数:
            output_file (str): 输出文件路径
        """
        if output_file:
            self.output_file = output_file
            
        data = self.generate_visualization_data()
        
        # 确保目录存在
        os.makedirs(os.path.dirname(os.path.abspath(self.output_file)), exist_ok=True)
        
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        print(f"数据已保存到: {self.output_file}")
        print(f"节点数: {data['meta']['node_count']}, 边数: {data['meta']['edge_count']}")
        print(f"主要学者: {data['meta']['primary_count']}, 关联学者: {data['meta']['secondary_count']}")
        
        return self.output_file
    
    def load_custom_relationships(self, relationships_file):
        """
        从文件加载自定义关系
        
        参数:
            relationships_file (str): 关系数据文件路径
        """
        if not os.path.exists(relationships_file):
            print(f"警告: 关系文件 '{relationships_file}' 不存在")
            return False
        
        try:
            with open(relationships_file, 'r', encoding='utf-8') as f:
                relationships = json.load(f)
            
            print(f"读取到 {len(relationships)} 个自定义关系")
            
            # 调试: 打印前几个关系
            if relationships:
                print("前3个关系示例:")
                for i, rel in enumerate(relationships[:3]):
                    print(f"  {i+1}. {rel.get('source', '?')} -- {rel.get('type', '?')} --> {rel.get('target', '?')}")
            
            count = 0
            failed_count = 0
            for rel in relationships:
                if 'source' in rel and 'target' in rel and 'type' in rel:
                    metadata = rel.get('metadata', None)
                    weight = rel.get('weight', 1)
                    
                    success = self.add_custom_relationship(
                        rel['source'], rel['target'], rel['type'], 
                        weight=weight, metadata=metadata
                    )
                    
                    if success:
                        count += 1
                    else:
                        failed_count += 1
            
            print(f"成功加载 {count} 个自定义关系, 失败 {failed_count} 个")
            
            # 打印当前所有关系类型统计
            relation_types = {}
            for r in self.relationships:
                rel_type = r.get('type', '未知')
                if rel_type in relation_types:
                    relation_types[rel_type] += 1
                else:
                    relation_types[rel_type] = 1
            
            print(f"当前关系类型统计: {relation_types}")
            
            return True
        except Exception as e:
            print(f"加载关系文件时出错: {str(e)}")
            return False


# 示例用法
if __name__ == "__main__":
    # 创建数据处理器
    processor = ScholarDataProcessor()
    
    # 从目录加载所有学者数据
    processor.load_all_scholars_from_dir()
    
    # 如果没有找到数据，使用示例数据
    if not processor.scholars:
        print("未找到真实学者数据，使用示例数据")
        
        # 添加示例学者数据
        example_scholar = {
            "scholar_id": "ABC123",
            "name": "张三",
            "affiliation": "示例大学",
            "interests": ["人工智能", "机器学习"],
            "citedby": 1000,
            "publications": [
                {"bib": {"title": "示例论文1", "pub_year": "2020", "venue": "CVPR"}, "num_citations": 100}
            ],
            "coauthors": [
                {"name": "李四", "scholar_id": "DEF456"}
            ]
        }
        
        # 加载示例数据
        processor.load_scholar_data(example_scholar)
        
        # 添加另一个学者
        another_scholar = {
            "scholar_id": "DEF456",
            "name": "李四",
            "affiliation": "另一所大学",
            "interests": ["计算机视觉"],
            "citedby": 500,
            "publications": []
        }
        processor.load_scholar_data(another_scholar)
        
        # 添加自定义关系
        processor.add_custom_relationship("ABC123", "DEF456", "advisor", metadata={"year": "2015"})
        processor.add_custom_scholar_field("ABC123", "graduation_year", "2010")
    
    # 保存为JSON文件
    processor.save_to_json() 