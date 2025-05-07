"""
关系数据访问对象
提供relationships表和scholar_institutions表的基本CRUD操作
"""

import json
import hashlib
from datetime import datetime
from db.db_manager import DBManager
import logging

class RelationshipDao:
    """关系数据访问对象"""
    
    def __init__(self):
        """初始化DAO，获取数据库连接"""
        self.db_manager = DBManager()
        self.logger = logging.getLogger(__name__)
    
    def relationship_exists(self, source_id, target_id, relation_type=None, source_type='scholar', target_type='scholar'):
        """检查关系是否存在
        
        Args:
            source_id: 源实体ID
            target_id: 目标实体ID
            relation_type: 关系类型(可选)
            source_type: 源实体类型，默认为scholar
            target_type: 目标实体类型，默认为scholar
            
        Returns:
            bool: 关系是否存在
        """
        if relation_type:
            query = """
            SELECT 1 FROM relationships 
            WHERE source_id = ? AND target_id = ? 
            AND source_type = ? AND target_type = ?
            AND relation_type = ?
            """
            cursor = self.db_manager.execute(query, (source_id, target_id, source_type, target_type, relation_type))
        else:
            query = """
            SELECT 1 FROM relationships 
            WHERE source_id = ? AND target_id = ?
            AND source_type = ? AND target_type = ?
            """
            cursor = self.db_manager.execute(query, (source_id, target_id, source_type, target_type))
            
        result = cursor.fetchone()
        return result is not None
    
    def create_relationship(self, source_id, target_id, relation_type, weight=1, data=None, source_type='scholar', target_type='scholar', is_custom=False):
        """创建实体关系
        
        Args:
            source_id: 源实体ID
            target_id: 目标实体ID
            relation_type: 关系类型
            weight: 关系权重
            data: 关系其他数据(JSON格式)
            source_type: 源实体类型，默认为scholar
            target_type: 目标实体类型，默认为scholar
            is_custom: 是否自定义关系，默认为False
            
        Returns:
            bool: 是否成功创建
        """
        try:
            # 检查关系是否已存在
            if self.relationship_exists(source_id, target_id, relation_type, source_type, target_type):
                # 已存在，更新权重
                return self.update_relationship_weight(source_id, target_id, relation_type, weight, source_type, target_type)
            
            # 转换data为JSON字符串
            data_json = json.dumps(data) if data else None
            
            # 插入关系
            query = """
            INSERT INTO relationships (source_id, source_type, target_id, target_type, relation_type, weight, is_custom, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            self.db_manager.execute(query, (
                source_id, source_type, target_id, target_type, relation_type, weight, 1 if is_custom else 0, data_json
            ))
            
            return True
            
        except Exception as e:
            self.logger.error(f"创建关系记录时出错: {str(e)}")
            return False
    
    def update_relationship_weight(self, source_id, target_id, relation_type, weight_delta=1, source_type='scholar', target_type='scholar'):
        """更新关系权重
        
        Args:
            source_id: 源实体ID
            target_id: 目标实体ID
            relation_type: 关系类型
            weight_delta: 权重增量
            source_type: 源实体类型，默认为scholar
            target_type: 目标实体类型，默认为scholar
            
        Returns:
            bool: 是否成功更新
        """
        try:
            query = """
            UPDATE relationships 
            SET weight = weight + ?
            WHERE source_id = ? AND target_id = ? 
            AND source_type = ? AND target_type = ?
            AND relation_type = ?
            """
            
            self.db_manager.execute(query, (
                weight_delta, source_id, target_id, source_type, target_type, relation_type
            ))
            
            return True
            
        except Exception as e:
            self.logger.error(f"更新关系权重时出错: {str(e)}")
            return False
    
    def scholar_institution_exists(self, scholar_id, inst_id):
        """检查学者-机构关系是否存在
        
        Args:
            scholar_id: 学者ID
            inst_id: 机构ID
            
        Returns:
            bool: 关系是否存在
        """
        query = """
        SELECT 1 FROM scholar_institutions 
        WHERE scholar_id = ? AND inst_id = ?
        """
        cursor = self.db_manager.execute(query, (scholar_id, inst_id))
        result = cursor.fetchone()
        return result is not None
    
    def create_scholar_institution(self, scholar_id, inst_id, start_year=None, end_year=None, is_current=True):
        """创建学者-机构关系
        
        Args:
            scholar_id: 学者ID
            inst_id: 机构ID
            start_year: 开始年份
            end_year: 结束年份
            is_current: 是否当前机构
            
        Returns:
            bool: 是否成功创建
        """
        try:
            # 检查关系是否已存在
            if self.scholar_institution_exists(scholar_id, inst_id):
                return True  # 已存在，无需创建
            
            # 插入关系
            query = """
            INSERT INTO scholar_institutions (scholar_id, inst_id, start_year, end_year, is_current)
            VALUES (?, ?, ?, ?, ?)
            """
            
            self.db_manager.execute(query, (
                scholar_id, inst_id, start_year, end_year, 1 if is_current else 0
            ))
            
            # 同时在relationships表中创建关系记录
            self.create_relationship(
                scholar_id, 
                inst_id, 
                "affiliated_with", 
                1, 
                None, 
                'scholar', 
                'institution'
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"创建学者-机构关系时出错: {str(e)}")
            return False
    
    def create_scholar_institutions_from_scholars(self):
        """从学者表中提取机构关系，保存到scholar_institutions表中
        
        Returns:
            int: 添加的关系数量
        """
        try:
            # 获取所有学者和机构信息
            query = """
            SELECT s.scholar_id, s.affiliation
            FROM scholars s
            WHERE s.affiliation IS NOT NULL AND s.affiliation != ''
            """
            cursor = self.db_manager.execute(query)
            scholar_affiliations = cursor.fetchall()
            
            # 获取所有机构
            inst_query = "SELECT inst_id, name FROM institutions"
            cursor = self.db_manager.execute(inst_query)
            institutions = {row['name']: row['inst_id'] for row in cursor.fetchall()}
            
            # 关联学者和机构
            count = 0
            for row in scholar_affiliations:
                scholar_id = row['scholar_id']
                affiliation = row['affiliation']
                
                # 查找匹配的机构ID
                inst_id = institutions.get(affiliation)
                if inst_id:
                    # 创建关系
                    success = self.create_scholar_institution(scholar_id, inst_id)
                    if success:
                        count += 1
            
            return count
            
        except Exception as e:
            self.logger.error(f"从学者表提取机构关系时出错: {str(e)}")
            return 0
    
    def get_scholar_institutions(self, scholar_id):
        """获取学者的所有机构关系
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            list: 机构关系列表
        """
        query = """
        SELECT si.*, i.name as institution_name
        FROM scholar_institutions si
        JOIN institutions i ON si.inst_id = i.inst_id
        WHERE si.scholar_id = ?
        ORDER BY si.is_current DESC, si.end_year DESC, si.start_year DESC
        """
        cursor = self.db_manager.execute(query, (scholar_id,))
        institutions = cursor.fetchall()
        return institutions
    
    def get_institution_scholars(self, inst_id, limit=100, offset=0):
        """获取机构的所有学者
        
        Args:
            inst_id: 机构ID
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 学者列表
        """
        query = """
        SELECT s.*, e.name
        FROM scholars s
        JOIN entities e ON s.scholar_id = e.id
        JOIN scholar_institutions si ON s.scholar_id = si.scholar_id
        WHERE si.inst_id = ?
        ORDER BY s.is_main_scholar DESC, s.citedby DESC
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (inst_id, limit, offset))
        scholars = cursor.fetchall()
        
        # 解析JSON数据
        for scholar in scholars:
            if scholar.get('cites_per_year'):
                try:
                    scholar['cites_per_year'] = json.loads(scholar['cites_per_year'])
                except:
                    scholar['cites_per_year'] = {}
                    
        return scholars
    
    def get_collaborators(self, scholar_id, limit=100, offset=0):
        """获取学者的合作者
        
        Args:
            scholar_id: 学者ID
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 合作者列表，包含合作次数
        """
        query = """
        SELECT r.target_id as scholar_id, r.weight as collaboration_count
        FROM relationships r
        WHERE r.source_id = ? 
        AND r.source_type = 'scholar'
        AND r.target_type = 'scholar'
        AND r.relation_type = 'coauthor'
        ORDER BY r.weight DESC
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (scholar_id, limit, offset))
        collaborators = cursor.fetchall()
        return collaborators 