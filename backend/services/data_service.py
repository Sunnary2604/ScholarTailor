"""
数据服务类
处理数据初始化、重新生成和管理相关的业务逻辑
"""

import os
import json
import logging
from db.db_manager import DBManager
from dao.entity_dao import EntityDao
from dao.scholar_dao import ScholarDao
from dao.publication_dao import PublicationDao
from dao.relationship_dao import RelationshipDao
from dao.authorship_dao import AuthorshipDao
from dao.institution_dao import InstitutionDao
from dao.interest_dao import InterestDao
from utils.data_importer import import_all_scholar_files, ScholarImporter


class DataService:
    """数据服务类，处理数据初始化和再生成相关业务逻辑"""

    def __init__(self, db_manager=None, scholars_dir=None, db_path=None):
        """初始化服务类
        
        Args:
            db_manager: 数据库管理器实例，如果为None则创建新实例
            scholars_dir: 学者数据目录
            db_path: 数据库文件路径
        """
        self.db_manager = db_manager or DBManager()
        self.scholars_dir = scholars_dir
        self.db_path = db_path
        self.logger = logging.getLogger(__name__)

        # 初始化各DAO对象
        self.entity_dao = EntityDao()
        self.scholar_dao = ScholarDao()
        self.publication_dao = PublicationDao()
        self.relationship_dao = RelationshipDao()
        self.authorship_dao = AuthorshipDao()
        self.institution_dao = InstitutionDao()
        self.interest_dao = InterestDao()

    def initialize_database(self):
        """初始化数据库
        
        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 清空数据库表
            self._clear_database_tables()

            # 导入JSON数据到数据库
            if self.scholars_dir and os.path.exists(self.scholars_dir):
                success_count, total_count = import_all_scholar_files(
                    data_dir=self.scholars_dir, db_path=self.db_path)

                if success_count > 0:
                    return {
                        'success':
                        True,
                        'message':
                        f'数据库已成功初始化，导入了{success_count}/{total_count}个学者文件'
                    }
                else:
                    return {'success': False, 'error': f'数据库已清空，但未能成功导入任何学者数据'}
            else:
                return {'success': True, 'message': '数据库已成功清空，未指定学者数据目录进行导入'}

        except Exception as e:
            self.logger.error(f"初始化数据库失败: {str(e)}")
            return {'success': False, 'error': str(e)}

    def _clear_database_tables(self):
        """清空数据库中的所有表"""
        try:
            connection = self.db_manager.get_connection()
            cursor = connection.cursor()

            # 获取所有表名
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()

            # 先关闭外键约束
            cursor.execute("PRAGMA foreign_keys=OFF;")

            # 清空每个表
            for table in tables:
                table_name = table[0]
                if table_name != 'sqlite_sequence':  # 跳过系统表
                    try:
                        cursor.execute(f"DELETE FROM {table_name};")
                        self.logger.info(f"清空表: {table_name}")
                    except Exception as e:
                        self.logger.warning(f"清空表 {table_name} 时出错: {str(e)}")

            # 重置自增ID
            cursor.execute("DELETE FROM sqlite_sequence;")

            # 重新开启外键约束
            cursor.execute("PRAGMA foreign_keys=ON;")

            # 提交更改
            connection.commit()
            self.logger.info("所有表已清空")

            return True
        except Exception as e:
            self.logger.error(f"清空数据库表时出错: {str(e)}")
            if connection:
                connection.rollback()
            return False

    def regenerate_network_data(self):
        """重新生成网络数据"""
        try:
            # 生成数据
            data = self.generate_data()
            
            # 写入到数据文件
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            return {
                'success': True,
                'message': '成功重新生成网络数据'
            }
            
        except Exception as e:
            self.logger.error(f"重新生成网络数据时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_network_data(self):
        """从数据库获取网络数据
        
        Returns:
            dict: {'success': bool, 'data': dict, 'error': str}
                  data格式与data.json相同，包含nodes和edges
        """
        try:
            # 直接从数据库获取数据，而不是生成文件
            data = self.generate_data()
            
            return {
                'success': True,
                'data': data
            }
            
        except Exception as e:
            self.logger.error(f"获取网络数据时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def generate_data(self):
        """生成网络数据"""
        try:
            # 获取所有主要学者
            main_scholars = self.scholar_dao.get_main_scholars()
            if not main_scholars:
                self.logger.warning("未找到任何主要学者数据")
                return {'success': False, 'error': '未找到任何主要学者数据'}

            # 生成主要学者节点列表
            nodes = []
            main_scholar_ids = set()
            
            # 处理主要学者
            for scholar in main_scholars:
                try:
                    # 获取学者的实体信息
                    entity = self.entity_dao.get_entity_by_id(
                        scholar['scholar_id'])
                    if not entity:
                        self.logger.warning(f"未找到学者ID {scholar['scholar_id']} 的实体信息")
                        continue

                    # 检查实体数据是否完整
                    if 'name' not in entity:
                        self.logger.warning(f"学者ID {scholar['scholar_id']} 的实体信息缺少name字段")
                        continue

                    # 获取学者兴趣标签
                    interests = self.interest_dao.get_entity_interests(
                        scholar['scholar_id'])

                    # 创建节点
                    node = {
                        'id': scholar['scholar_id'],
                        'label': entity['name'],
                        'group': 'primary',
                        'data': {
                            'id': scholar['scholar_id'],
                            'name': entity['name'],
                            'affiliation': scholar.get('affiliation', ''),
                            'interests': [i['interest'] for i in interests] if interests else [],
                            'scholar_id': scholar['scholar_id'],
                            'is_secondary': False,
                            'citedby': scholar.get('citedby', 0),
                            'hindex': scholar.get('hindex', 0),
                            'i10index': scholar.get('i10index', 0),
                            'url_picture': scholar.get('url_picture', ''),
                            'homepage': scholar.get('homepage', '')
                        }
                    }

                    # 如果entity数据含有额外信息，添加
                    if entity.get('data'):
                        try:
                            entity_data = entity['data']
                            if isinstance(entity_data, str):
                                entity_data = json.loads(entity_data)
                            for key, value in entity_data.items():
                                node['data'][key] = value
                        except json.JSONDecodeError as e:
                            self.logger.warning(f"解析学者ID {scholar['scholar_id']} 的额外数据失败: {str(e)}")
                        except Exception as e:
                            self.logger.warning(f"处理学者ID {scholar['scholar_id']} 的额外数据时出错: {str(e)}")

                    nodes.append(node)
                    main_scholar_ids.add(scholar['scholar_id'])
                except Exception as e:
                    self.logger.error(f"处理学者ID {scholar['scholar_id']} 时出错: {str(e)}")
                    continue

            if not nodes:
                self.logger.error("未能生成任何有效节点")
                return {'success': False, 'error': '未能生成任何有效节点'}

            # 获取所有关系（所有学者之间的关系）
            all_edges = []
            secondary_scholar_connections = {}  # 用于记录次要学者的连接数
            
            # 首先收集所有关系
            for scholar_id in main_scholar_ids:
                try:
                    relationships = self.relationship_dao.get_collaborators(
                        scholar_id)

                    for rel in relationships:
                        target_id = rel['scholar_id']
                        weight = rel.get('collaboration_count', 1)
                        
                        # 记录边
                        edge = {
                            'source': scholar_id,
                            'target': target_id,
                            'label': 'coauthor',
                            'weight': weight
                        }
                        all_edges.append(edge)
                        
                        # 如果不是主要学者，记录其连接数
                        if target_id not in main_scholar_ids:
                            if target_id not in secondary_scholar_connections:
                                secondary_scholar_connections[target_id] = 0
                            secondary_scholar_connections[target_id] += 1
                            
                except Exception as e:
                    self.logger.error(f"处理学者ID {scholar_id} 的关系时出错: {str(e)}")
                    continue
            
            # 选择连接数大于2的次要学者
            significant_secondary_scholars = {
                scholar_id: count for scholar_id, count in secondary_scholar_connections.items() 
                if count > 2  # 连接数大于2
            }
            
            # 获取并添加有意义的次要学者节点
            for scholar_id in significant_secondary_scholars.keys():
                try:
                    # 获取学者数据
                    scholar = self.scholar_dao.get_scholar_by_id(scholar_id)
                    if not scholar:
                        continue
                        
                    # 获取实体信息
                    entity = self.entity_dao.get_entity_by_id(scholar_id)
                    if not entity or 'name' not in entity:
                        continue
                    
                    # 获取学者兴趣标签
                    interests = self.interest_dao.get_entity_interests(scholar_id)
                    
                    # 创建次要学者节点
                    node = {
                        'id': scholar_id,
                        'label': entity['name'],
                        'group': 'secondary',
                        'data': {
                            'id': scholar_id,
                            'name': entity['name'],
                            'affiliation': scholar.get('affiliation', ''),
                            'interests': [i['interest'] for i in interests] if interests else [],
                            'scholar_id': scholar_id,
                            'is_secondary': True,
                            'citedby': scholar.get('citedby', 0),
                            'hindex': scholar.get('hindex', 0),
                            'i10index': scholar.get('i10index', 0),
                            'url_picture': scholar.get('url_picture', ''),
                            'homepage': scholar.get('homepage', '')
                        }
                    }
                    
                    # 如果entity数据含有额外信息，添加
                    if entity.get('data'):
                        try:
                            entity_data = entity['data']
                            if isinstance(entity_data, str):
                                entity_data = json.loads(entity_data)
                            for key, value in entity_data.items():
                                node['data'][key] = value
                        except json.JSONDecodeError as e:
                            self.logger.warning(f"解析次要学者ID {scholar_id} 的额外数据失败: {str(e)}")
                        except Exception as e:
                            self.logger.warning(f"处理次要学者ID {scholar_id} 的额外数据时出错: {str(e)}")
                    
                    nodes.append(node)
                    
                except Exception as e:
                    self.logger.error(f"处理次要学者ID {scholar_id} 时出错: {str(e)}")
                    continue
            
            # 筛选显示的边（只包含已选定显示的节点之间的边）
            valid_node_ids = {node['id'] for node in nodes}
            edges = [
                edge for edge in all_edges 
                if edge['source'] in valid_node_ids and edge['target'] in valid_node_ids
            ]

            # 生成网络数据
            network_data = {
                'nodes': nodes,
                'edges': edges
            }
            
            self.logger.info(f"生成网络数据：{len(nodes)}个节点，{len(edges)}条边 (主要学者:{len(main_scholar_ids)}，次要学者:{len(significant_secondary_scholars)})")

            return network_data

        except Exception as e:
            self.logger.error(f"生成网络数据失败: {str(e)}")
            return {'success': False, 'error': str(e)}
 