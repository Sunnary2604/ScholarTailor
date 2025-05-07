#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
ScholarVis API服务器
提供REST API接口，用于管理学者数据和关系
"""

import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from utils.scholarly_crawler import ScholarCrawler
from services.scholar_service import ScholarService
from services.relationship_service import RelationshipService
from services.interest_service import InterestService
from services.data_service import DataService
from utils.response_handler import ResponseHandler

# 获取项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# 配置
DATA_DIR = os.path.join(ROOT_DIR, 'data')
SCHOLARS_DIR = os.path.join(DATA_DIR, 'scholars')
CUSTOM_RELATIONSHIPS_FILE = os.path.join(DATA_DIR, 'custom_relationships.json')
OUTPUT_FILE = os.path.join(ROOT_DIR, 'data.json')
CUSTOM_DATA_FILE = os.path.join(DATA_DIR, 'custom_data.json')
DB_PATH = os.path.join(DATA_DIR, 'scholar.db')

# 初始化响应处理器
resp = ResponseHandler()

# 初始化Flask应用
app = Flask(__name__, static_folder=os.path.join(ROOT_DIR, 'frontend'))
CORS(app)  # 启用跨域支持

# 确保必要的目录存在
os.makedirs(SCHOLARS_DIR, exist_ok=True)

# 初始化爬虫和服务类
crawler = ScholarCrawler(data_dir=SCHOLARS_DIR)
scholar_service = ScholarService(crawler=crawler)
relationship_service = RelationshipService(custom_relationships_file=CUSTOM_RELATIONSHIPS_FILE)
interest_service = InterestService(scholars_dir=SCHOLARS_DIR, custom_data_file=CUSTOM_DATA_FILE)
data_service = DataService(
    scholars_dir=SCHOLARS_DIR,
    db_path=DB_PATH
)

# 静态文件服务
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# 提供data.json数据文件
@app.route('/data.json')
def serve_data():
    # 检查文件是否存在
    if os.path.exists(OUTPUT_FILE):
        # 如果存在，直接提供文件
        return send_from_directory(ROOT_DIR, 'data.json')
    else:
        # 如果不存在，从数据库获取数据并返回
        result = data_service.get_network_data()
        if result['success'] and 'data' in result:
            return jsonify(result['data'])
        else:
            # 出错时返回空数据结构
            return jsonify({'nodes': [], 'edges': []})

# API端点：添加单个学者
@app.route('/api/scholars/add', methods=['POST'])
def add_scholar():
    data = request.json
    if not data:
        return resp.error('缺少请求数据', 400)
    
    # 根据提供的数据类型调用不同的服务方法
    if 'scholar_id' in data:
        result = scholar_service.add_scholar_by_id(data['scholar_id'])
    elif 'name' in data:
        result = scholar_service.add_scholar_by_name(data['name'])
    else:
        return resp.error('缺少学者姓名或ID', 400)
    
    # 处理响应
    if result['success']:
        # 重新生成数据
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：批量添加学者
@app.route('/api/scholars/batch-add', methods=['POST'])
def batch_add_scholars():
    data = request.json
    if not data or 'names' not in data or not isinstance(data['names'], list):
        return resp.error('缺少学者姓名列表', 400)
    
    result = scholar_service.batch_add_scholars(data['names'])
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：更新单个学者
@app.route('/api/scholars/update', methods=['POST'])
def update_scholar():
    data = request.json
    if not data or 'id' not in data:
        return resp.error('缺少学者ID', 400)
    
    result = scholar_service.update_scholar(data['id'])
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：更新学者自定义字段
@app.route('/api/scholars/update-custom-fields', methods=['POST'])
def update_custom_fields():
    data = request.json
    if not data or 'id' not in data or 'custom_fields' not in data:
        return resp.error('缺少必要参数', 400)
    
    result = scholar_service.update_custom_fields(data['id'], data['custom_fields'])
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：刷新所有数据
@app.route('/api/scholars/refresh-all', methods=['POST'])
def refresh_all():
    data = request.json
    keep_custom = data.get('keep_custom_relationships', True) if data else True
    
    result = scholar_service.refresh_all_scholars(keep_custom)
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：添加关系
@app.route('/api/relationships/add', methods=['POST'])
def add_relationship():
    data = request.json
    if not data or 'source_id' not in data or 'target_id' not in data or 'type' not in data:
        return resp.error('缺少必要参数', 400)
    
    result = relationship_service.add_relationship(
        data['source_id'], 
        data['target_id'], 
        data['type'], 
        data.get('is_custom', True)
    )
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：批量删除关系
@app.route('/api/relationships/delete-batch', methods=['POST'])
def delete_relationships_batch():
    data = request.json
    if not data or 'relationships' not in data or not isinstance(data['relationships'], list):
        return resp.error('缺少关系列表', 400)
    
    result = relationship_service.delete_relationships_batch(data['relationships'])
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：更新学者标签
@app.route('/api/scholars/update-tags', methods=['POST'])
def update_scholar_tags():
    data = request.json
    if not data or 'id' not in data or 'tags' not in data:
        return resp.error('缺少必要参数', 400)
    
    result = interest_service.update_scholar_tags(data['id'], data['tags'])
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：初始化数据库
@app.route('/api/initialize-database', methods=['POST'])
def initialize_database():
    result = data_service.initialize_database()
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：将关联学者转换为主要学者
@app.route('/api/scholars/convert-to-main', methods=['POST'])
def convert_to_main_scholar():
    data = request.json
    if not data or 'scholar_id' not in data:
        return resp.error('缺少学者ID', 400)
    
    result = scholar_service.convert_to_main_scholar(data['scholar_id'])
    
    if result['success']:
        data_service.regenerate_network_data()
    
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：根据ID获取学者详情
@app.route('/api/scholars/<scholar_id>', methods=['GET'])
def get_scholar_by_id(scholar_id):
    if not scholar_id:
        return resp.error('缺少学者ID', 400)
    
    result = scholar_service.get_scholar_by_id(scholar_id)
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# API端点：获取网络数据
@app.route('/api/network-data', methods=['GET'])
def get_network_data():
    result = data_service.get_network_data()
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

# 全局错误处理
@app.errorhandler(404)
def not_found(error):
    return resp.error('API端点不存在', 404)

@app.errorhandler(405)
def method_not_allowed(error):
    return resp.error('不支持的HTTP方法', 405)

@app.errorhandler(500)
def server_error(error):
    return resp.error('服务器内部错误', 500)

# 启动服务器
if __name__ == '__main__':
    # 初始化数据库（如果需要）
    db_init_result = data_service.initialize_database()
    if not db_init_result['success']:
        print(f"警告: 数据库初始化失败: {db_init_result.get('error', '未知错误')}")
    
    # 启动Flask服务器
    app.run(debug=True, host='127.0.0.1', port=8080) 