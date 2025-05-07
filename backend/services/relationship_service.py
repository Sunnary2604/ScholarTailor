"""
关系服务类
处理与实体间关系相关的业务逻辑
"""

import json
import logging
from datetime import datetime
from dao.relationship_dao import RelationshipDao
from dao.entity_dao import EntityDao

class RelationshipService:
    """关系服务类，处理实体关系相关业务逻辑"""
    
    def __init__(self, custom_relationships_file=None):
        """初始化服务类
        
        Args:
            custom_relationships_file: 自定义关系文件路径(可选)
        """
        self.relationship_dao = RelationshipDao()
        self.entity_dao = EntityDao()
        self.custom_relationships_file = custom_relationships_file
        self.logger = logging.getLogger(__name__)
    
    def load_custom_relationships(self):
        """加载自定义关系
        
        Returns:
            list: 关系列表
        """
        if not self.custom_relationships_file:
            return []
            
        try:
            with open(self.custom_relationships_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"加载自定义关系失败: {str(e)}")
            return []
    
    def save_custom_relationships(self, relationships):
        """保存自定义关系
        
        Args:
            relationships: 关系列表
            
        Returns:
            bool: 是否成功保存
        """
        if not self.custom_relationships_file:
            return False
            
        try:
            with open(self.custom_relationships_file, 'w', encoding='utf-8') as f:
                json.dump(relationships, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            self.logger.error(f"保存自定义关系失败: {str(e)}")
            return False
    
    def add_relationship(self, source_id, target_id, relation_type, is_custom=True):
        """添加关系
        
        Args:
            source_id: 源实体ID
            target_id: 目标实体ID
            relation_type: 关系类型
            is_custom: 是否为自定义关系
            
        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 加载当前关系
            relationships = self.load_custom_relationships()
            
            # 检查是否已存在
            for rel in relationships:
                if rel.get('source') == source_id and rel.get('target') == target_id and rel.get('type') == relation_type:
                    return {
                        'success': False,
                        'error': '关系已存在'
                    }
            
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
            if self.save_custom_relationships(relationships):
                # 同时添加到数据库
                data = new_relation.get('metadata', {})
                self.relationship_dao.create_relationship(
                    source_id, 
                    target_id, 
                    relation_type, 
                    weight=new_relation.get('weight', 1), 
                    data=data
                )
                
                return {
                    'success': True,
                    'message': '成功添加关系'
                }
            else:
                return {
                    'success': False,
                    'error': '保存关系失败'
                }
                
        except Exception as e:
            self.logger.error(f"添加关系时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def delete_relationships_batch(self, relations_to_delete):
        """批量删除关系
        
        Args:
            relations_to_delete: 要删除的关系列表，每个关系应包含source_id, target_id, type字段
            
        Returns:
            dict: {'success': bool, 'deleted': int, 'message': str, 'error': str}
        """
        try:
            # 加载当前关系
            relationships = self.load_custom_relationships()
            
            # 筛选出不需要删除的关系
            new_relationships = []
            deleted_count = 0
            
            for rel in relationships:
                should_keep = True
                
                for del_rel in relations_to_delete:
                    if (rel.get('source') == del_rel.get('source_id') and 
                        rel.get('target') == del_rel.get('target_id') and 
                        rel.get('type') == del_rel.get('type')):
                        should_keep = False
                        
                        # 同时从数据库中删除
                        self.relationship_dao.delete_relationship(
                            del_rel.get('source_id'),
                            del_rel.get('target_id'),
                            del_rel.get('type')
                        )
                        
                        deleted_count += 1
                        break
                
                if should_keep:
                    new_relationships.append(rel)
            
            # 保存新的关系列表
            if self.save_custom_relationships(new_relationships):
                return {
                    'success': True,
                    'deleted': deleted_count,
                    'message': f'成功删除 {deleted_count} 个关系'
                }
            else:
                return {
                    'success': False,
                    'error': '保存关系失败'
                }
                
        except Exception as e:
            self.logger.error(f"批量删除关系时出错: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            } 