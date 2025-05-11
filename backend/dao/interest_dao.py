"""
兴趣标签数据访问对象
处理实体(学者)的兴趣标签数据访问
"""

import json
import logging
from db.db_manager import DBManager


class InterestDao:
    """兴趣标签数据访问对象"""
    
    def __init__(self):
        """初始化DAO"""
        self.db_manager = DBManager()
        self.logger = logging.getLogger(__name__)
    
    def create_interest(self, entity_id, interest, is_custom=False):
        """创建实体兴趣标签
        
        Args:
            entity_id: 实体ID
            interest: 兴趣标签
            is_custom: 是否为自定义标签，用于区分自定义标签和系统生成的兴趣标签
            
        Returns:
            bool: 是否成功创建
        """
        try:
            # 检查是否已存在
            if self.interest_exists(entity_id, interest):
                # 更新is_custom字段
                query = """
                UPDATE interests 
                SET is_custom = ? 
                WHERE entity_id = ? AND interest = ?
                """
                self.db_manager.execute(
                    query, (1 if is_custom else 0, entity_id, interest)
                )
            else:
                # 创建新兴趣标签
                query = """
                INSERT INTO interests (entity_id, interest, is_custom)
                VALUES (?, ?, ?)
                """
                self.db_manager.execute(
                    query, (entity_id, interest, 1 if is_custom else 0)
                )
            
            self.db_manager.commit()
            return True
            
        except Exception as e:
            self.logger.error(f"创建兴趣标签时出错: {str(e)}")
            self.db_manager.rollback()
            return False
    
    def create_interests_batch(self, entity_id, interests, is_custom=False):
        """批量创建实体兴趣标签
        
        Args:
            entity_id: 实体ID
            interests: 兴趣标签列表
            is_custom: 是否为自定义标签
            
        Returns:
            bool: 是否成功创建
        """
        if not interests:
            return True

        try:
            # 批量插入
            params = [
                (entity_id, interest, 1 if is_custom else 0) for interest in interests
            ]

            query = """
            INSERT OR REPLACE INTO interests (entity_id, interest, is_custom) 
            VALUES (?, ?, ?)
            """

            self.db_manager.executemany(query, params)
            self.db_manager.commit()
            return True

        except Exception as e:
            self.logger.error(f"批量创建兴趣标签时出错: {str(e)}")
            self.db_manager.rollback()
            return False

    def interest_exists(self, entity_id, interest):
        """检查实体兴趣标签是否存在

        Args:
            entity_id: 实体ID
            interest: 兴趣标签

        Returns:
            bool: 是否存在
        """
        try:
            query = """
            SELECT 1 FROM interests 
            WHERE entity_id = ? AND interest = ?
            """
            cursor = self.db_manager.execute(query, (entity_id, interest))
            return cursor.fetchone() is not None

        except Exception as e:
            self.logger.error(f"检查兴趣标签是否存在时出错: {str(e)}")
            return False
    
    def get_entity_interests(self, entity_id):
        """获取实体的所有兴趣标签
        
        Args:
            entity_id: 实体ID
            
        Returns:
            list: 兴趣标签列表，包含is_custom字段区分自定义标签
        """
        try:
            query = """
            SELECT interest, is_custom 
            FROM interests 
            WHERE entity_id = ?
            ORDER BY is_custom DESC, interest ASC
            """
            cursor = self.db_manager.execute(query, (entity_id,))

            interests = []
            for row in cursor.fetchall():
                interests.append(
                    {
                        "interest": row.get("interest", ""),
                        "is_custom": row.get("is_custom", 0),
                    }
                )

            return interests

        except Exception as e:
            self.logger.error(f"获取实体兴趣标签时出错: {str(e)}")
            return []

    def get_all_interests(self, is_custom=None):
        """获取所有兴趣标签
        
        Args:
            is_custom: 筛选条件，None表示获取全部，True只获取自定义标签，False只获取系统标签
            
        Returns:
            list: 兴趣标签列表
        """
        try:
            if is_custom is None:
                query = "SELECT DISTINCT interest FROM interests ORDER BY interest"
                cursor = self.db_manager.execute(query)
            else:
                query = "SELECT DISTINCT interest FROM interests WHERE is_custom = ? ORDER BY interest"
                cursor = self.db_manager.execute(query, (1 if is_custom else 0,))

            return [row.get("interest") for row in cursor.fetchall()]

        except Exception as e:
            self.logger.error(f"获取所有兴趣标签时出错: {str(e)}")
            return []
    
    def delete_interest(self, entity_id, interest):
        """删除实体兴趣标签
        
        Args:
            entity_id: 实体ID
            interest: 兴趣标签
            
        Returns:
            bool: 是否成功删除
        """
        try:
            query = """
            DELETE FROM interests 
            WHERE entity_id = ? AND interest = ?
            """
            self.db_manager.execute(query, (entity_id, interest))
            self.db_manager.commit()
            return True
            
        except Exception as e:
            self.logger.error(f"删除兴趣标签时出错: {str(e)}")
            self.db_manager.rollback()
            return False
    
    def delete_entity_interests(self, entity_id, is_custom=None):
        """删除实体所有兴趣标签
        
        Args:
            entity_id: 实体ID
            is_custom: 筛选条件，None表示删除全部，True只删除自定义标签，False只删除系统标签
            
        Returns:
            bool: 是否成功删除
        """
        try:
            if is_custom is None:
                query = "DELETE FROM interests WHERE entity_id = ?"
                self.db_manager.execute(query, (entity_id,))
            else:
                query = "DELETE FROM interests WHERE entity_id = ? AND is_custom = ?"
                self.db_manager.execute(query, (entity_id, 1 if is_custom else 0))

            self.db_manager.commit()
            return True
            
        except Exception as e:
            self.logger.error(f"删除实体兴趣标签时出错: {str(e)}")
            self.db_manager.rollback()
            return False 
