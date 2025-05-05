#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
ScholarVis API服务器
提供REST API接口，用于管理学者数据和关系
"""

import os
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from scholarly_crawler import ScholarCrawler
from data_processor import ScholarDataProcessor
from ScholarVis import ScholarVis

# 获取项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# 配置
DATA_DIR = os.path.join(ROOT_DIR, 'data')
SCHOLARS_DIR = os.path.join(DATA_DIR, 'scholars')
CUSTOM_RELATIONSHIPS_FILE = os.path.join(DATA_DIR, 'custom_relationships.json')
OUTPUT_FILE = os.path.join(ROOT_DIR, 'data.json')
CUSTOM_DATA_FILE = os.path.join(DATA_DIR, 'custom_data.json')

# 初始化Flask应用
app = Flask(__name__, static_folder=os.path.join(ROOT_DIR, 'frontend'))
CORS(app)  # 启用跨域支持

# 确保必要的目录存在
os.makedirs(SCHOLARS_DIR, exist_ok=True)

# 初始化爬虫和数据处理器
crawler = ScholarCrawler(data_dir=SCHOLARS_DIR)
processor = ScholarDataProcessor(scholars_dir=SCHOLARS_DIR, output_file=OUTPUT_FILE)
scholar_vis = ScholarVis()  # 初始化ScholarVis类，用于标签管理

# 加载自定义关系
def load_custom_relationships():
    if os.path.exists(CUSTOM_RELATIONSHIPS_FILE):
        try:
            with open(CUSTOM_RELATIONSHIPS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载自定义关系失败: {str(e)}")
    return []

# 保存自定义关系
def save_custom_relationships(relationships):
    try:
        with open(CUSTOM_RELATIONSHIPS_FILE, 'w', encoding='utf-8') as f:
            json.dump(relationships, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存自定义关系失败: {str(e)}")
        return False

# 重新处理数据并生成可视化JSON
def regenerate_data():
    """重新处理数据并生成可视化JSON"""
    global processor
    
    # 重新加载所有数据
    processor.scholars = {}
    processor.secondary_scholars = {}
    processor.relationships = []
    
    # 加载学者数据
    processor.load_all_scholars_from_dir()
    
    # 加载自定义关系
    if os.path.exists(CUSTOM_RELATIONSHIPS_FILE):
        processor.load_custom_relationships(CUSTOM_RELATIONSHIPS_FILE)
    
    # 保存为JSON文件并返回结果
    output_file = processor.save_to_json()
    print(f"已重新生成数据文件: {output_file}")
    
    return output_file

# 静态文件服务
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# 提供data.json数据文件
@app.route('/data.json')
def serve_data():
    return send_from_directory(ROOT_DIR, 'data.json')

# API端点：添加单个学者
@app.route('/api/scholars/add', methods=['POST'])
def add_scholar():
    data = request.json
    if not data:
        return jsonify({'success': False, 'error': '缺少请求数据'}), 400
    
    # 处理通过ID添加的情况
    if 'scholar_id' in data:
        scholar_id = data['scholar_id']
        try:
            # 使用ID直接爬取学者数据
            scholar_data = crawler.search_author_by_id(scholar_id)
            
            if not scholar_data:
                return jsonify({'success': False, 'error': f'未找到ID为 "{scholar_id}" 的学者'}), 404
            
            # 重新生成数据
            regenerate_data()
            
            return jsonify({
                'success': True, 
                'scholar_id': scholar_data.get('scholar_id', ''),
                'message': f'成功添加学者 {scholar_data.get("name", "未知姓名")}'
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    # 处理通过名字添加的情况
    elif 'name' in data:
        scholar_name = data['name']
        try:
            # 爬取学者数据
            scholar_data = crawler.search_author(scholar_name)
            
            if not scholar_data:
                return jsonify({'success': False, 'error': f'未找到学者 "{scholar_name}"'}), 404
            
            # 重新生成数据
            regenerate_data()
            
            return jsonify({
                'success': True, 
                'scholar_id': scholar_data.get('scholar_id', ''),
                'message': f'成功添加学者 {scholar_data.get("name", scholar_name)}'
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        return jsonify({'success': False, 'error': '缺少学者姓名或ID'}), 400

# API端点：批量添加学者
@app.route('/api/scholars/batch-add', methods=['POST'])
def batch_add_scholars():
    data = request.json
    if not data or 'names' not in data or not isinstance(data['names'], list):
        return jsonify({'success': False, 'error': '缺少学者姓名列表'}), 400
    
    scholar_names = data['names']
    try:
        # 爬取多位学者数据
        results = crawler.batch_search_authors(scholar_names)
        
        # 重新生成数据
        regenerate_data()
        
        return jsonify({
            'success': True, 
            'added': len(results),
            'message': f'成功添加 {len(results)} 位学者'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API端点：更新单个学者
@app.route('/api/scholars/update', methods=['POST'])
def update_scholar():
    data = request.json
    if not data or 'id' not in data:
        return jsonify({'success': False, 'error': '缺少学者ID'}), 400
    
    scholar_id = data['id']
    
    # 查找对应的文件
    scholar_files = os.listdir(SCHOLARS_DIR)
    target_file = None
    
    for file in scholar_files:
        if file.endswith(f"_{scholar_id}.json"):
            target_file = os.path.join(SCHOLARS_DIR, file)
            break
    
    if not target_file:
        return jsonify({'success': False, 'error': f'未找到学者ID为 {scholar_id} 的数据文件'}), 404
    
    try:
        # 读取现有文件获取学者名称
        with open(target_file, 'r', encoding='utf-8') as f:
            scholar_data = json.load(f)
        
        scholar_name = scholar_data.get('name', '')
        
        if not scholar_name:
            return jsonify({'success': False, 'error': '学者数据文件格式错误'}), 500
        
        # 重新爬取学者数据
        updated_data = crawler.search_author(scholar_name)
        
        if not updated_data:
            return jsonify({'success': False, 'error': f'重新爬取学者 "{scholar_name}" 失败'}), 500
        
        # 重新生成数据
        regenerate_data()
        
        return jsonify({
            'success': True, 
            'message': f'成功更新学者 {scholar_name} 的数据'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API端点：更新学者自定义字段
@app.route('/api/scholars/update-custom-fields', methods=['POST'])
def update_custom_fields():
    data = request.json
    if not data or 'id' not in data or 'custom_fields' not in data:
        return jsonify({'success': False, 'error': '缺少必要参数'}), 400
    
    scholar_id = data['id']
    custom_fields = data['custom_fields']
    
    # 加载当前数据
    processor.scholars = {}
    processor.secondary_scholars = {}
    processor.relationships = []
    processor.load_all_scholars_from_dir()
    
    # 查找学者
    if scholar_id not in processor.scholars:
        return jsonify({'success': False, 'error': '未找到指定学者'}), 404
    
    try:
        # 更新自定义字段
        for key, value in custom_fields.items():
            processor.add_custom_scholar_field(scholar_id, key, value)
        
        # 找到对应的JSON文件
        scholar_files = os.listdir(SCHOLARS_DIR)
        target_file = None
        
        for file in scholar_files:
            if file.endswith(f"_{scholar_id}.json"):
                target_file = os.path.join(SCHOLARS_DIR, file)
                break
        
        if target_file:
            # 读取文件
            with open(target_file, 'r', encoding='utf-8') as f:
                scholar_data = json.load(f)
            
            # 更新自定义字段
            scholar_data['custom_fields'] = custom_fields
            
            # 写回文件
            with open(target_file, 'w', encoding='utf-8') as f:
                json.dump(scholar_data, f, ensure_ascii=False, indent=2)
        
        # 重新生成数据
        regenerate_data()
        
        return jsonify({
            'success': True, 
            'message': '成功更新自定义字段'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API端点：刷新所有数据
@app.route('/api/scholars/refresh-all', methods=['POST'])
def refresh_all():
    data = request.json
    keep_custom = data.get('keep_custom_relationships', True) if data else True
    
    try:
        # 备份自定义关系
        custom_relationships = []
        if keep_custom and os.path.exists(CUSTOM_RELATIONSHIPS_FILE):
            with open(CUSTOM_RELATIONSHIPS_FILE, 'r', encoding='utf-8') as f:
                custom_relationships = json.load(f)
        
        # 获取所有学者文件
        scholar_files = os.listdir(SCHOLARS_DIR)
        updated_count = 0
        
        for file in scholar_files:
            if file.endswith('.json'):
                try:
                    # 读取文件获取学者名称
                    file_path = os.path.join(SCHOLARS_DIR, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        scholar_data = json.load(f)
                    
                    scholar_name = scholar_data.get('name', '')
                    
                    if scholar_name:
                        # 重新爬取数据
                        crawler.search_author(scholar_name)
                        updated_count += 1
                        
                        # 避免过快请求
                        time.sleep(2)
                except Exception as e:
                    print(f"更新文件 {file} 时出错: {str(e)}")
        
        # 如果保留自定义关系，重新写入
        if keep_custom:
            save_custom_relationships(custom_relationships)
        
        # 重新生成数据
        regenerate_data()
        
        return jsonify({
            'success': True,
            'updated': updated_count,
            'message': f'成功更新 {updated_count} 位学者的数据'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API端点：添加关系
@app.route('/api/relationships/add', methods=['POST'])
def add_relationship():
    data = request.json
    if not data or 'source_id' not in data or 'target_id' not in data or 'type' not in data:
        return jsonify({'success': False, 'error': '缺少必要参数'}), 400
    
    source_id = data['source_id']
    target_id = data['target_id']
    relation_type = data['type']
    is_custom = data.get('is_custom', True)
    
    try:
        # 加载当前关系
        relationships = load_custom_relationships()
        
        # 检查是否已存在
        for rel in relationships:
            if rel.get('source') == source_id and rel.get('target') == target_id and rel.get('type') == relation_type:
                return jsonify({'success': False, 'error': '关系已存在'}), 400
        
        # 添加新关系
        new_relation = {
            'source': source_id,
            'target': target_id,
            'type': relation_type,
            'weight': 1,
            'metadata': {
                'is_custom': is_custom,
                'created': datetime.now().isoformat()
            }
        }
        
        relationships.append(new_relation)
        
        # 保存关系
        if save_custom_relationships(relationships):
            # 重新生成数据
            regenerate_data()
            
            return jsonify({
                'success': True,
                'message': '成功添加关系'
            })
        else:
            return jsonify({'success': False, 'error': '保存关系失败'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API端点：批量删除关系
@app.route('/api/relationships/delete-batch', methods=['POST'])
def delete_relationships_batch():
    data = request.json
    if not data or 'relationships' not in data or not isinstance(data['relationships'], list):
        return jsonify({'success': False, 'error': '缺少关系列表'}), 400
    
    relations_to_delete = data['relationships']
    
    try:
        # 加载当前关系
        relationships = load_custom_relationships()
        
        # 筛选出不需要删除的关系
        new_relationships = []
        for rel in relationships:
            should_keep = True
            
            for del_rel in relations_to_delete:
                if (rel.get('source') == del_rel.get('source_id') and 
                    rel.get('target') == del_rel.get('target_id') and 
                    rel.get('type') == del_rel.get('type')):
                    should_keep = False
                    break
            
            if should_keep:
                new_relationships.append(rel)
        
        # 保存新的关系列表
        if save_custom_relationships(new_relationships):
            # 重新生成数据
            regenerate_data()
            
            return jsonify({
                'success': True,
                'deleted': len(relationships) - len(new_relationships),
                'message': f'成功删除 {len(relationships) - len(new_relationships)} 个关系'
            })
        else:
            return jsonify({'success': False, 'error': '保存关系失败'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API端点：更新学者标签
@app.route('/api/scholars/update-tags', methods=['POST'])
def update_scholar_tags():
    data = request.json
    if not data or 'id' not in data or 'tags' not in data:
        return jsonify({'success': False, 'error': '缺少必要参数'}), 400
    
    scholar_id = data['id']
    tags = data['tags']
    
    try:
        # 保存标签并检查结果
        result = scholar_vis.update_scholar_tags(scholar_id, tags)
        if not result:
            print(f"ScholarVis.update_scholar_tags返回失败，学者ID: {scholar_id}")
            return jsonify({'success': False, 'error': '更新标签失败，可能是权限问题或文件系统错误'}), 500
        
        # 找到对应的JSON文件
        scholar_files = os.listdir(SCHOLARS_DIR)
        target_file = None
        
        for file in scholar_files:
            if file.endswith(f"_{scholar_id}.json"):
                target_file = os.path.join(SCHOLARS_DIR, file)
                break
        
        if target_file:
            try:
                # 读取文件
                with open(target_file, 'r', encoding='utf-8') as f:
                    scholar_data = json.load(f)
                
                # 确保custom_fields字段存在
                if 'custom_fields' not in scholar_data:
                    scholar_data['custom_fields'] = {}
                
                # 更新标签字段
                scholar_data['custom_fields']['tags'] = ','.join(tags)
                scholar_data['tags'] = tags  # 直接保存标签列表，方便前端使用
                
                # 写回文件
                with open(target_file, 'w', encoding='utf-8') as f:
                    json.dump(scholar_data, f, ensure_ascii=False, indent=2)
                
                # 仅调用一次数据重生成
                regenerate_data()
                
                return jsonify({
                    'success': True, 
                    'message': '成功更新标签'
                })
            except Exception as e:
                print(f"更新学者文件出错: {str(e)}")
                return jsonify({'success': False, 'error': f'更新学者文件失败: {str(e)}'}), 500
        else:
            return jsonify({'success': False, 'error': '未找到学者数据文件'}), 404
    except Exception as e:
        print(f"更新标签出错: {str(e)}")  # 添加错误日志
        return jsonify({'success': False, 'error': str(e)}), 500

# API端点：初始化数据库
@app.route('/api/initialize-database', methods=['POST'])
def initialize_database():
    try:
        # 清空学者数据目录
        scholar_files = os.listdir(SCHOLARS_DIR)
        for file in scholar_files:
            if file.endswith('.json'):
                file_path = os.path.join(SCHOLARS_DIR, file)
                os.remove(file_path)
                print(f"已删除文件: {file}")
        
        # 清空自定义关系文件
        if os.path.exists(CUSTOM_RELATIONSHIPS_FILE):
            with open(CUSTOM_RELATIONSHIPS_FILE, 'w', encoding='utf-8') as f:
                f.write('[]')
            print("已清空自定义关系文件")
        
        # 清空自定义数据文件
        if os.path.exists(CUSTOM_DATA_FILE):
            with open(CUSTOM_DATA_FILE, 'w', encoding='utf-8') as f:
                f.write('{"scholars": {}}')
            print("已清空自定义数据文件")
        
        # 初始化data.json
        processor = ScholarDataProcessor(scholars_dir=SCHOLARS_DIR, output_file=OUTPUT_FILE)
        processor.save_to_json()
        
        return jsonify({
            'success': True,
            'message': '数据库已成功初始化'
        })
    except Exception as e:
        print(f"初始化数据库失败: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# 启动服务器
if __name__ == '__main__':
    # 初始加载数据
    processor.load_all_scholars_from_dir()
    processor.load_custom_relationships(CUSTOM_RELATIONSHIPS_FILE)
    
    # 启动Flask服务器
    app.run(debug=True, host='127.0.0.1', port=8080) 