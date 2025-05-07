"""
机构数据访问对象
提供institutions表的基本CRUD操作
"""

import json
import hashlib
from datetime import datetime
from db.db_manager import DBManager
import logging

class InstitutionDao:
    """机构数据访问对象"""
    
    def __init__(self):
        """初始化DAO，获取数据库连接"""
        self.db_manager = DBManager()
        self.logger = logging.getLogger(__name__)
    
    def institution_exists(self, inst_id):
        """检查机构是否存在
        
        Args:
            inst_id: 机构ID
            
        Returns:
            bool: 机构是否存在
        """
        query = "SELECT 1 FROM institutions WHERE inst_id = ?"
        cursor = self.db_manager.execute(query, (inst_id,))
        result = cursor.fetchone()
        return result is not None
    
    def create_institution(self, name, type=None, url=None, lab=None):
        """创建机构记录
        
        Args:
            name: 机构名称
            type: 机构类型
            url: 机构网址
            lab: 实验室名称
            
        Returns:
            tuple: (是否成功, inst_id)
        """
        try:
            if not name:
                self.logger.warning("跳过无名称机构")
                return False, None
            
            # 生成机构ID - 使用MD5哈希
            inst_hash = hashlib.md5(name.encode('utf-8')).hexdigest()[:12]
            inst_id = f"inst_{inst_hash}"
            
            # 检查机构是否已存在
            if self.institution_exists(inst_id):
                return True, inst_id  # 已存在，无需创建
            
            # 插入机构
            query = """
            INSERT INTO institutions (inst_id, name, type, url, lab)
            VALUES (?, ?, ?, ?, ?)
            """
            
            self.db_manager.execute(query, (
                inst_id, name, type, url, lab
            ))
            
            return True, inst_id
            
        except Exception as e:
            self.logger.error(f"创建机构记录时出错: {str(e)}")
            return False, None
    
    def extract_and_save_institutions_from_scholars(self):
        """从学者表中提取不同的机构，保存到institutions表中
        
        Returns:
            int: 添加的机构数量
        """
        try:
            # 获取所有不重复的机构名称
            query = """
            SELECT DISTINCT affiliation
            FROM scholars
            WHERE affiliation IS NOT NULL AND affiliation != ''
            """
            cursor = self.db_manager.execute(query)
            affiliations = [row['affiliation'] for row in cursor.fetchall()]
            
            # 为每个机构生成ID并插入表中
            count = 0
            for affiliation in affiliations:
                success, _ = self.create_institution(affiliation)
                if success:
                    count += 1
            
            return count
            
        except Exception as e:
            self.logger.error(f"提取机构信息时出错: {str(e)}")
            return 0
    
    def get_institution_by_id(self, inst_id):
        """根据ID获取机构
        
        Args:
            inst_id: 机构ID
            
        Returns:
            dict: 机构数据
        """
        query = "SELECT * FROM institutions WHERE inst_id = ?"
        cursor = self.db_manager.execute(query, (inst_id,))
        institution = cursor.fetchone()
        return institution
    
    def get_institution_by_name(self, name):
        """根据名称获取机构
        
        Args:
            name: 机构名称
            
        Returns:
            dict: 机构数据
        """
        query = "SELECT * FROM institutions WHERE name = ?"
        cursor = self.db_manager.execute(query, (name,))
        institution = cursor.fetchone()
        return institution
    
    def get_institutions(self, limit=100, offset=0):
        """获取机构列表
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 机构列表
        """
        query = """
        SELECT * FROM institutions
        ORDER BY name
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (limit, offset))
        institutions = cursor.fetchall()
        return institutions
    
    def search_institutions(self, keyword, limit=20):
        """搜索机构
        
        Args:
            keyword: 搜索关键词
            limit: 结果数量限制
            
        Returns:
            list: 机构列表
        """
        search_term = f"%{keyword}%"
        query = """
        SELECT * FROM institutions
        WHERE name LIKE ?
        ORDER BY name
        LIMIT ?
        """
        cursor = self.db_manager.execute(query, (search_term, limit))
        institutions = cursor.fetchall()
        return institutions 