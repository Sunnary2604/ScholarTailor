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
from dao.publication_dao import PublicationDao
from dao.authorship_dao import AuthorshipDao
from dao.relationship_dao import RelationshipDao
from dao.institution_dao import InstitutionDao

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
        self.publication_dao = PublicationDao()
        self.authorship_dao = AuthorshipDao()
        self.relationship_dao = RelationshipDao()
        self.institution_dao = InstitutionDao()
        self.crawler = crawler
        self.logger = logging.getLogger(__name__)
        
        # 缓存已处理的实体ID和论文，避免重复处理
        self.processed_entities = set()
        self.processed_publications = set()
    
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
            
            # 处理学者数据 - 使用新方法全面导入
            result = self._import_scholar_complete(scholar_id, scholar_data)
            
            if result['success']:
                return {
                    'success': True,
                    'scholar_id': scholar_id,
                            'message': f'成功添加学者 {scholar_data.get("name", "Unknown")}'
                        }
            else:
                return {
                    'success': False,
                    'error': result.get('error', '导入学者数据失败')
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
            
            # 处理学者数据 - 使用新方法全面导入
            result = self._import_scholar_complete(scholar_id, scholar_data)
            
            if result['success']:
                return {
                    'success': True,
                    'scholar_id': scholar_id,
                            'message': f'成功添加学者 {scholar_data.get("name", name)}'
                        }
            else:
                return {
                    'success': False,
                    'error': result.get('error', '导入学者数据失败')
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
                    
                    # 处理学者数据 - 使用新方法全面导入
                    result = self._import_scholar_complete(scholar_id, scholar_data)
                    
                    if result['success']:
                        added_count += 1
                        
                except Exception as e:
                    self.logger.error(f"批量添加学者时处理单个学者出错: {str(e)}")
                    continue
            
            return {
                'success': added_count > 0,
                'added': added_count,
                'message': f'成功添加 {added_count}/{len(names)} 位学者'
            }
            
        except Exception as e:
            self.logger.error(f"批量添加学者时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'added': 0
            }
    
    def _import_scholar_complete(self, scholar_id, scholar_data):
        """全面导入学者数据到所有相关表
        
        Args:
            scholar_id: 学者ID
            scholar_data: 爬取的学者数据
            
        Returns:
            dict: {'success': bool, 'error': str}
        """
        try:
            # 开始事务
            from db.db_manager import DBManager
            db_manager = DBManager()
            db_manager.begin_transaction()
            
            try:
                # 提取学者名称和基本信息
                scholar_name = scholar_data.get('name', 'Unknown Scholar')
                
                # 1. 创建学者详情记录
                self.scholar_dao.create_scholar(scholar_id, scholar_data, is_main_scholar=1)
                
                # 2. 创建学者实体
                entity_data = {
                    'source': scholar_data.get('source', 'google_scholar'),
                    'filled': scholar_data.get('filled', True)
                }
                self.entity_dao.create_entity(
                    id=scholar_id,
                    type='scholar',
                    name=scholar_name,
                    data=entity_data
                )
                
                # 3. 添加兴趣标签
                interests = scholar_data.get('interests', [])
                # 先删除旧的兴趣标签
                self.interest_dao.delete_entity_interests(scholar_id)
                # 添加新的兴趣标签
                self.interest_dao.create_interests_batch(scholar_id, interests)
                
                # 4. 导入论文数据
                publications = scholar_data.get('publications', [])
                self.logger.info(f"导入 {len(publications)} 篇论文 - 学者: {scholar_name}")
                imported_pub_count = 0
                
                for pub in publications:
                    try:
                        # 导入单篇论文
                        if self._import_publication(scholar_id, pub):
                            imported_pub_count += 1
                    except Exception as pub_error:
                        self.logger.error(f"导入论文时出错: {str(pub_error)}")
                        continue
                
                self.logger.info(f"成功导入 {imported_pub_count}/{len(publications)} 篇论文 - 学者: {scholar_name}")
                
                # 5. 导入合作者关系
                coauthors = scholar_data.get('coauthors', [])
                self.logger.info(f"导入 {len(coauthors)} 位合作者 - 学者: {scholar_name}")
                imported_coauthor_count = 0
                
                for coauthor in coauthors:
                    try:
                        # 导入单个合作者
                        if self._import_coauthor(scholar_id, coauthor):
                            imported_coauthor_count += 1
                    except Exception as coauthor_error:
                        self.logger.error(f"导入合作者时出错: {str(coauthor_error)}")
                        continue
                
                self.logger.info(f"成功导入 {imported_coauthor_count}/{len(coauthors)} 位合作者 - 学者: {scholar_name}")
                
                # 6. 处理机构信息
                try:
                    # 获取学者的机构信息
                    affiliation = scholar_data.get('affiliation', '')
                    
                    if affiliation:
                        # 生成机构ID (使用哈希值避免重复)
                        import hashlib
                        inst_id = f"inst_{hashlib.md5(affiliation.encode('utf-8')).hexdigest()[:12]}"
                        
                        # 先检查机构是否已存在
                        if not self.institution_dao.get_institution_by_name(affiliation):
                            # 创建机构记录，地区、国家和类型暂时留空
                            self.institution_dao.create_institution(
                                inst_id=inst_id,
                                name=affiliation,
                                type=None,
                                url=None,
                                lab=None
                            )
                            self.logger.info(f"创建新机构: {affiliation}")
                        else:
                            # 获取已存在机构的ID
                            existing_inst = self.institution_dao.get_institution_by_name(affiliation)
                            if existing_inst:
                                inst_id = existing_inst.get('inst_id')
                        
                        # 创建学者-机构关联
                        self.institution_dao.create_scholar_institution_relation(
                            scholar_id=scholar_id,
                            inst_id=inst_id,
                            is_current=True
                        )
                        self.logger.info(f"建立学者-机构关联: {scholar_name} -> {affiliation}")
                except Exception as inst_error:
                    self.logger.error(f"处理机构信息时出错: {str(inst_error)}")
                    # 继续执行，不中断整个导入流程
                
                # 提交事务
                db_manager.commit()
                
                return {
                    'success': True
                }
                
            except Exception as inner_error:
                # 回滚事务
                db_manager.rollback()
                self.logger.error(f"导入学者数据时出错，已回滚: {str(inner_error)}")
                return {
                    'success': False,
                    'error': str(inner_error)
                }
                
        except Exception as outer_error:
            self.logger.error(f"准备导入学者数据时出错: {str(outer_error)}")
            return {
                'success': False,
                'error': str(outer_error)
            }
    
    def _import_publication(self, scholar_id, pub_data):
        """导入单篇论文数据
        
        Args:
            scholar_id: 学者ID
            pub_data: 论文数据
            
        Returns:
            bool: 是否成功
        """
        try:
            # 创建论文记录
            success, cites_id = self.publication_dao.create_publication(pub_data, scholar_id)
            
            if not success or not cites_id:
                return False
            
            # 建立作者关系
            self.authorship_dao.create_authorship(scholar_id, cites_id)
            
            return True
            
        except Exception as e:
            self.logger.error(f"导入论文时出错: {str(e)}")
            return False
    
    def _import_coauthor(self, scholar_id, coauthor_data):
        """导入合作者关系
        
        Args:
            scholar_id: 学者ID
            coauthor_data: 合作者数据
            
        Returns:
            bool: 是否成功
        """
        try:
            # 检查必要字段
            coauthor_id = coauthor_data.get('scholar_id')
            if not coauthor_id:
                return False
            
            coauthor_name = coauthor_data.get('name', 'Unknown Scholar')
            
            # 1. 创建合作者详情
            success = self.scholar_dao.create_coauthor(coauthor_id, coauthor_data)
            if not success:
                self.logger.warning(f"创建合作者详情失败: {coauthor_id}, {coauthor_name}")
            
            # 2. 检查合作者实体是否已存在
            if not self.entity_dao.entity_exists(coauthor_id):
                # 创建合作者实体
                entity_data = {'is_coauthor': True}
                self.entity_dao.create_entity(
                    id=coauthor_id,
                    type='scholar',
                    name=coauthor_name,
                    data=entity_data
                )
                self.logger.info(f"创建合作者实体: {coauthor_id}, {coauthor_name}")
            
            # 3. 创建合作关系
            # 计算权重(合作次数)
            weight = coauthor_data.get('co_authored_papers', 1)
            
            # 创建双向关系
            self.relationship_dao.create_relationship(
                source_id=scholar_id,
                target_id=coauthor_id,
                relation_type='coauthor',
                weight=weight
            )
            
            self.relationship_dao.create_relationship(
                source_id=coauthor_id,
                target_id=scholar_id,
                relation_type='coauthor',
                weight=weight
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"导入合作者关系时出错: {str(e)}")
            return False
    
    def update_scholar(self, scholar_id):
        """更新学者信息，并将关联学者转换为主要学者
        
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
            
            # 优先使用ID直接获取学者数据
            updated_data = self.crawler.search_author_by_id(scholar_id)
            
            # 获取学者名称，以备ID查询失败时使用
            scholar_name = entity.get('name', '')
            
            # 如果使用ID获取失败，则尝试使用名称
            if not updated_data:
                if not scholar_name:
                    return {
                        'success': False,
                        'error': '无法确定学者名称'
                    }
                
                self.logger.info(f"使用ID {scholar_id} 获取学者数据失败，尝试使用名称 '{scholar_name}' 获取")
                updated_data = self.crawler.search_author(scholar_name)
            
            if not updated_data:
                return {
                    'success': False,
                    'error': f'重新爬取学者数据失败，ID: {scholar_id}, 名称: {entity.get("name", "Unknown")}'
                }
            
            # 使用全面导入方法更新学者数据
            result = self._import_scholar_complete(scholar_id, updated_data)
            
            if result['success']:
                return {
                    'success': True,
                            'message': f'成功更新学者数据 (ID: {scholar_id})'
                        }
            else:
                return {
                    'success': False,
                    'error': result.get('error', '更新学者数据失败')
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
            interests = self.interest_dao.get_entity_interests(scholar_id)
            if interests:
                # 将interests对象列表转换为字符串列表
                interest_list = [interest.get('interest', '') for interest in interests if interest.get('interest')]
                scholar_data['interests'] = interest_list
            
            # 设置nodeType
            scholar_data['nodeType'] = 'primary' if scholar_data.get('is_main_scholar') else 'secondary'
            
            # 获取学者发表的论文
            try:
                # 增加获取数量，并确保按引用次数降序排序
                publications = self.publication_dao.get_publications_by_scholar(scholar_id, limit=20)
                
                # 按照引用次数手动排序（以防SQL排序未生效）
                if publications:
                    publications = sorted(publications, key=lambda x: x.get('num_citations', 0) or 0, reverse=True)
                
                # 格式化论文数据
                if publications:
                    formatted_publications = []
                    for pub in publications:
                        formatted_pub = {
                            'title': pub.get('title', ''),
                            'year': pub.get('year', ''),
                            'venue': pub.get('venue', ''),
                            'citedby': pub.get('num_citations', 0),  # 使用citedby字段名与前端保持一致
                            'citation_text': pub.get('citation_text', '')
                        }
                        formatted_publications.append(formatted_pub)
                    
                    scholar_data['publications'] = formatted_publications
            except Exception as pub_error:
                self.logger.error(f"获取学者论文信息时出错: {str(pub_error)}")
                scholar_data['publications'] = []  # 出错时设置为空列表
            
            # 获取相关学者（合作者）
            try:
                collaborators = self.relationship_dao.get_collaborators(scholar_id)
                
                if collaborators:
                    related_scholars = []
                    for collab in collaborators:
                        # 获取合作者基本信息
                        collab_id = collab.get('scholar_id')
                        if not collab_id:
                            continue
                        
                        collab_entity = self.entity_dao.get_entity_by_id(collab_id)
                        if not collab_entity:
                            continue
                        
                        related_scholar = {
                            'id': collab_id,
                            'name': collab_entity.get('name', 'Unknown'),
                            'relationship': collab.get('relation_type', 'coauthor')
                        }
                        related_scholars.append(related_scholar)
                    
                    scholar_data['related_scholars'] = related_scholars
            except Exception as rel_error:
                self.logger.error(f"获取相关学者时出错: {str(rel_error)}")
                scholar_data['related_scholars'] = []  # 出错时设置为空列表
            
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