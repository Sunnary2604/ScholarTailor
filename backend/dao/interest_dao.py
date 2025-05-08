"""
兴趣标签数据访问对象
提供interests表的基本CRUD操作
"""

import json
from datetime import datetime
from db.db_manager import DBManager
import logging

class InterestDao:
    """兴趣标签数据访问对象"""
    
    def __init__(self):
        """初始化DAO，获取数据库连接"""
        self.db_manager = DBManager()
        self.logger = logging.getLogger(__name__)
    
    def interest_exists(self, entity_id, interest):
        """检查兴趣标签是否存在
        
        Args:
            entity_id: 实体ID
            interest: 兴趣标签内容
            
        Returns:
            bool: 标签是否存在
        """
        query = """
        SELECT 1 FROM interests 
        WHERE entity_id = ? AND interest = ?
        """
        cursor = self.db_manager.execute(query, (entity_id, interest))
        result = cursor.fetchone()
        return result is not None
    
    def create_interest(self, entity_id, interest, is_custom=False):
        """添加兴趣标签
        
        Args:
            entity_id: 实体ID
            interest: 兴趣标签内容
            is_custom: 是否为自定义标签
            
        Returns:
            bool: 是否成功创建
        """
        try:
            # 检查兴趣标签是否已存在
            if self.interest_exists(entity_id, interest):
                return True  # 已存在，无需创建
            
            # 插入兴趣标签
            query = """
            INSERT INTO interests (entity_id, interest, is_custom)
            VALUES (?, ?, ?)
            """
            
            self.db_manager.execute(query, (
                entity_id, interest, 1 if is_custom else 0
            ))
            
            return True
            
        except Exception as e:
            self.logger.error(f"添加兴趣标签时出错: {str(e)}")
            return False
    
    def create_interests_batch(self, entity_id, interests, is_custom=False):
        """批量添加兴趣标签
        
        Args:
            entity_id: 实体ID
            interests: 兴趣标签列表
            is_custom: 是否为自定义标签
            
        Returns:
            int: 成功添加的标签数量
        """
        count = 0
        for interest in interests:
            if interest and self.create_interest(entity_id, interest, is_custom):
                count += 1
        return count
    
    def get_entity_interests(self, entity_id):
        """获取实体的所有兴趣标签
        
        Args:
            entity_id: 实体ID
            
        Returns:
            list: 兴趣标签列表
        """
        query = """
        SELECT * FROM interests
        WHERE entity_id = ?
        ORDER BY is_custom DESC
        """
        cursor = self.db_manager.execute(query, (entity_id,))
        interests = cursor.fetchall()
        return interests
    
    def get_entities_by_interest(self, interest, entity_type=None, limit=100, offset=0):
        """根据兴趣标签获取实体
        
        Args:
            interest: 兴趣标签
            entity_type: 实体类型(可选)
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 实体列表
        """
        if entity_type:
            query = """
            SELECT e.* 
            FROM entities e
            JOIN interests i ON e.id = i.entity_id
            WHERE i.interest = ? AND e.type = ?
            LIMIT ? OFFSET ?
            """
            cursor = self.db_manager.execute(query, (interest, entity_type, limit, offset))
        else:
            query = """
            SELECT e.* 
            FROM entities e
            JOIN interests i ON e.id = i.entity_id
            WHERE i.interest = ?
            LIMIT ? OFFSET ?
            """
            cursor = self.db_manager.execute(query, (interest, limit, offset))
            
        entities = cursor.fetchall()
        
        # 解析JSON数据
        for entity in entities:
            if entity.get('data'):
                try:
                    entity['data'] = json.loads(entity['data'])
                except:
                    entity['data'] = {}
                    
        return entities
    
    def get_scholars_by_interest(self, interest, limit=100, offset=0):
        """根据兴趣标签获取学者
        
        Args:
            interest: 兴趣标签
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 学者列表
        """
        query = """
        SELECT s.*, e.name
        FROM scholars s
        JOIN entities e ON s.scholar_id = e.id
        JOIN interests i ON e.id = i.entity_id
        WHERE i.interest = ? AND e.type = 'scholar'
        ORDER BY s.is_main_scholar DESC, s.citedby DESC
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (interest, limit, offset))
        scholars = cursor.fetchall()
        
        # 解析JSON数据
        for scholar in scholars:
            if scholar.get('cites_per_year'):
                try:
                    scholar['cites_per_year'] = json.loads(scholar['cites_per_year'])
                except:
                    scholar['cites_per_year'] = {}
                    
        return scholars
    
    def get_top_interests(self, entity_type='scholar', limit=20):
        """获取最热门的兴趣标签
        
        Args:
            entity_type: 实体类型
            limit: 返回数量限制
            
        Returns:
            list: 兴趣标签及计数列表
        """
        query = """
        SELECT i.interest, COUNT(*) as count
        FROM interests i
        JOIN entities e ON i.entity_id = e.id
        WHERE e.type = ?
        GROUP BY i.interest
        ORDER BY count DESC
        LIMIT ?
        """
        cursor = self.db_manager.execute(query, (entity_type, limit))
        interests = cursor.fetchall()
        return interests
    
    def delete_interest(self, entity_id, interest):
        """删除兴趣标签
        
        Args:
            entity_id: 实体ID
            interest: 兴趣标签内容
            
        Returns:
            bool: 是否成功删除
        """
        try:
            query = """
            DELETE FROM interests 
            WHERE entity_id = ? AND interest = ?
            """
            
            self.db_manager.execute(query, (entity_id, interest))
            return True
            
        except Exception as e:
            self.logger.error(f"删除兴趣标签时出错: {str(e)}")
            return False
    
    def delete_entity_interests(self, entity_id):
        """删除实体的所有兴趣标签
        
        Args:
            entity_id: 实体ID
            
        Returns:
            bool: 是否成功删除
        """
        try:
            query = """
            DELETE FROM interests 
            WHERE entity_id = ?
            """
            
            self.db_manager.execute(query, (entity_id,))
            return True
            
        except Exception as e:
            self.logger.error(f"删除实体的所有兴趣标签时出错: {str(e)}")
            return False 