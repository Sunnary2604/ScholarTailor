"""
学者服务类
处理与学者相关的业务逻辑
"""

import os
import json
import logging
import time
from datetime import datetime
from dao.scholar_dao import ScholarDao
from dao.entity_dao import EntityDao
from dao.interest_dao import InterestDao

class ScholarService:
    """学者服务类，处理学者相关业务逻辑"""
    
    def __init__(self, crawler=None):
        """初始化服务类
        
        Args:
            crawler: 爬虫实例(可选)，用于从外部获取学者信息
        """
        self.scholar_dao = ScholarDao()
        self.entity_dao = EntityDao()
        self.interest_dao = InterestDao()
        self.crawler = crawler
        self.logger = logging.getLogger(__name__)
    
    def add_scholar_by_id(self, scholar_id):
        """通过ID添加学者
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            dict: {'success': bool, 'scholar_id': str, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {
                    'success': False,
                    'error': '未配置爬虫，无法获取学者数据'
                }
            
            # 使用爬虫获取学者数据
            scholar_data = self.crawler.search_author_by_id(scholar_id)
            
            if not scholar_data:
                return {
                    'success': False,
                    'error': f'未找到ID为 "{scholar_id}" 的学者'
                }
            
            # 创建学者实体及详情
            name = scholar_data.get('name', 'Unknown Scholar')
            
            # 将学者标记为主要学者
            self.scholar_dao.create_scholar(scholar_id, scholar_data, is_main_scholar=1)
            
            # 创建学者实体
            entity_data = {
                'source': scholar_data.get('source', 'google_scholar'),
                'filled': scholar_data.get('filled', True)
            }
            self.entity_dao.create_entity(
                id=scholar_id,
                type='scholar',
                name=name,
                data=entity_data
            )
            
            # 添加兴趣标签
            interests = scholar_data.get('interests', [])
            self.interest_dao.create_interests_batch(scholar_id, interests)
            
            return {
                'success': True,
                'scholar_id': scholar_id,
                'message': f'成功添加学者 {name}'
            }
            
        except Exception as e:
            self.logger.error(f"通过ID添加学者时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def add_scholar_by_name(self, name):
        """通过名称添加学者
        
        Args:
            name: 学者名称
            
        Returns:
            dict: {'success': bool, 'scholar_id': str, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {
                    'success': False,
                    'error': '未配置爬虫，无法获取学者数据'
                }
            
            # 使用爬虫获取学者数据
            scholar_data = self.crawler.search_author(name)
            
            if not scholar_data:
                return {
                    'success': False,
                    'error': f'未找到学者 "{name}"'
                }
            
            # 获取学者ID
            scholar_id = scholar_data.get('scholar_id')
            if not scholar_id:
                return {
                    'success': False,
                    'error': '获取的学者数据中缺少scholar_id'
                }
            
            # 创建学者实体及详情
            actual_name = scholar_data.get('name', name)
            
            # 将学者标记为主要学者
            self.scholar_dao.create_scholar(scholar_id, scholar_data, is_main_scholar=1)
            
            # 创建学者实体
            entity_data = {
                'source': scholar_data.get('source', 'google_scholar'),
                'filled': scholar_data.get('filled', True)
            }
            self.entity_dao.create_entity(
                id=scholar_id,
                type='scholar',
                name=actual_name,
                data=entity_data
            )
            
            # 添加兴趣标签
            interests = scholar_data.get('interests', [])
            self.interest_dao.create_interests_batch(scholar_id, interests)
            
            return {
                'success': True,
                'scholar_id': scholar_id,
                'message': f'成功添加学者 {actual_name}'
            }
            
        except Exception as e:
            self.logger.error(f"通过名称添加学者时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def batch_add_scholars(self, names):
        """批量添加学者
        
        Args:
            names: 学者名称列表
            
        Returns:
            dict: {'success': bool, 'added': int, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {
                    'success': False,
                    'error': '未配置爬虫，无法获取学者数据'
                }
            
            # 批量爬取学者数据
            results = self.crawler.batch_search_authors(names)
            
            added_count = 0
            for scholar_data in results:
                try:
                    # 获取学者ID
                    scholar_id = scholar_data.get('scholar_id')
                    if not scholar_id:
                        continue
                    
                    # 创建学者详情
                    self.scholar_dao.create_scholar(scholar_id, scholar_data, is_main_scholar=1)
                    
                    # 创建学者实体
                    name = scholar_data.get('name', 'Unknown Scholar')
                    entity_data = {
                        'source': scholar_data.get('source', 'google_scholar'),
                        'filled': scholar_data.get('filled', True)
                    }
                    self.entity_dao.create_entity(
                        id=scholar_id,
                        type='scholar',
                        name=name,
                        data=entity_data
                    )
                    
                    # 添加兴趣标签
                    interests = scholar_data.get('interests', [])
                    self.interest_dao.create_interests_batch(scholar_id, interests)
                    
                    added_count += 1
                except Exception as inner_e:
                    self.logger.error(f"批量添加学者时处理单个学者数据出错: {str(inner_e)}")
                    continue
            
            return {
                'success': True,
                'added': added_count,
                'message': f'成功添加 {added_count} 位学者'
            }
            
        except Exception as e:
            self.logger.error(f"批量添加学者时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_scholar(self, scholar_id):
        """更新学者信息
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {
                    'success': False,
                    'error': '未配置爬虫，无法获取学者数据'
                }
            
            # 获取学者当前信息
            scholar = self.scholar_dao.get_scholar_by_id(scholar_id)
            if not scholar:
                return {
                    'success': False,
                    'error': f'未找到学者ID为 {scholar_id} 的记录'
                }
            
            # 获取学者实体信息以获取名称
            entity = self.entity_dao.get_entity_by_id(scholar_id)
            if not entity:
                return {
                    'success': False,
                    'error': f'未找到学者ID为 {scholar_id} 的实体记录'
                }
            
            # 获取学者名称
            scholar_name = entity.get('name', '')
            
            if not scholar_name:
                return {
                    'success': False,
                    'error': '无法确定学者名称'
                }
            
            # 重新爬取学者数据
            updated_data = self.crawler.search_author(scholar_name)
            
            if not updated_data:
                return {
                    'success': False,
                    'error': f'重新爬取学者 "{scholar_name}" 失败'
                }
            
            # 更新学者详情
            self.scholar_dao.update_scholar(scholar_id, updated_data)
            
            # 更新学者实体
            entity_data = {
                'source': updated_data.get('source', 'google_scholar'),
                'filled': updated_data.get('filled', True),
                'updated_at': datetime.now().isoformat()
            }
            self.entity_dao.update_entity(scholar_id, name=scholar_name, data=entity_data)
            
            # 获取新的兴趣标签
            new_interests = updated_data.get('interests', [])
            
            # 添加新的兴趣标签
            self.interest_dao.create_interests_batch(scholar_id, new_interests)
            
            return {
                'success': True,
                'message': f'成功更新学者 {scholar_name} 的数据'
            }
            
        except Exception as e:
            self.logger.error(f"更新学者信息时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def refresh_all_scholars(self, keep_custom=True):
        """刷新所有学者数据
        
        Args:
            keep_custom: 是否保留自定义关系
            
        Returns:
            dict: {'success': bool, 'updated': int, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {
                    'success': False,
                    'error': '未配置爬虫，无法获取学者数据'
                }
            
            # 获取所有学者
            scholars = self.scholar_dao.get_main_scholars(limit=1000)
            updated_count = 0
            
            for scholar in scholars:
                try:
                    scholar_id = scholar.get('scholar_id')
                    if not scholar_id:
                        continue
                    
                    # 更新学者
                    update_result = self.update_scholar(scholar_id)
                    if update_result['success']:
                        updated_count += 1
                    
                    # 避免过快请求
                    time.sleep(2)
                except Exception as e:
                    self.logger.error(f"更新学者 {scholar.get('name', '未知')} 时出错: {str(e)}")
                    continue
            
            return {
                'success': True,
                'updated': updated_count,
                'message': f'成功更新 {updated_count} 位学者的数据'
            }
            
        except Exception as e:
            self.logger.error(f"刷新所有学者数据时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_custom_fields(self, scholar_id, custom_fields):
        """更新学者自定义字段
        
        Args:
            scholar_id: 学者ID
            custom_fields: 自定义字段字典
            
        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 获取学者实体信息
            entity = self.entity_dao.get_entity_by_id(scholar_id)
            if not entity:
                return {
                    'success': False,
                    'error': '未找到指定学者'
                }
            
            # 获取当前实体数据
            current_data = entity.get('data', {})
            if isinstance(current_data, str):
                try:
                    current_data = json.loads(current_data)
                except:
                    current_data = {}
            
            # 更新自定义字段
            if 'custom_fields' not in current_data:
                current_data['custom_fields'] = {}
            
            for key, value in custom_fields.items():
                current_data['custom_fields'][key] = value
            
            # 更新实体数据
            self.entity_dao.update_entity(scholar_id, data=current_data)
            
            return {
                'success': True,
                'message': '成功更新自定义字段'
            }
            
        except Exception as e:
            self.logger.error(f"更新学者自定义字段时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_scholar_tags(self, scholar_id, tags):
        """更新学者标签
        
        Args:
            scholar_id: 学者ID
            tags: 标签列表
            
        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 检查学者是否存在
            if not self.scholar_dao.scholar_exists(scholar_id):
                return {
                    'success': False,
                    'error': '未找到指定学者'
                }
            
            # 清除旧标签
            old_interests = self.interest_dao.get_entity_interests(scholar_id)
            for interest in old_interests:
                if interest.get('is_custom', 0) == 1:  # 只删除自定义标签
                    self.interest_dao.delete_interest(scholar_id, interest.get('interest', ''))
            
            # 添加新标签
            for tag in tags:
                self.interest_dao.create_interest(scholar_id, tag, is_custom=True)
            
            # 更新实体数据
            entity = self.entity_dao.get_entity_by_id(scholar_id)
            if entity:
                current_data = entity.get('data', {})
                if isinstance(current_data, str):
                    try:
                        current_data = json.loads(current_data)
                    except:
                        current_data = {}
                
                if 'custom_fields' not in current_data:
                    current_data['custom_fields'] = {}
                
                current_data['custom_fields']['tags'] = ','.join(tags)
                self.entity_dao.update_entity(scholar_id, data=current_data)
            
            return {
                'success': True,
                'message': '成功更新标签'
            }
            
        except Exception as e:
            self.logger.error(f"更新学者标签时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def convert_to_main_scholar(self, scholar_id):
        """将学者转换为主要学者
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 检查是否主要学者
            check_query = "SELECT is_main_scholar FROM scholars WHERE scholar_id = ?"
            result = self.scholar_dao.convert_to_main_scholar(scholar_id)
            
            if result:
                return {
                    'success': True,
                    'message': f'成功将学者转换为主要学者'
                }
            else:
                return {
                    'success': False,
                    'error': '转换失败，可能学者不存在'
                }
                
        except Exception as e:
            self.logger.error(f"将学者转换为主要学者时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
            
    def get_scholar_by_id(self, scholar_id):
        """根据ID获取学者信息
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            dict: {'success': bool, 'scholar': dict, 'error': str}
        """
        try:
            # 从数据库获取学者基本信息
            scholar_data = self.scholar_dao.get_scholar_by_id(scholar_id)
            
            if not scholar_data:
                return {
                    'success': False,
                    'error': f'未找到ID为 "{scholar_id}" 的学者'
                }
            
            # 获取学者实体信息（名称等）
            entity_data = self.entity_dao.get_entity_by_id(scholar_id)
            
            # 合并实体数据和学者数据
            if entity_data:
                for key, value in entity_data.items():
                    if key not in scholar_data:
                        scholar_data[key] = value
            
            # 获取学者的兴趣领域
            interests = self.interest_dao.get_interests_by_scholar_id(scholar_id)
            if interests:
                scholar_data['interests'] = interests
            
            # 设置nodeType
            scholar_data['nodeType'] = 'primary' if scholar_data.get('is_main_scholar') else 'secondary'
            
            return {
                'success': True,
                'scholar': scholar_data
            }
            
        except Exception as e:
            self.logger.error(f"获取学者信息时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            } 