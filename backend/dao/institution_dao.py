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
    
    def create_institution(self, name, inst_id=None, type=None, url=None, lab=None):
        """创建机构记录
        
        Args:
            name: 机构名称
            inst_id: 机构ID (可选，如果未提供则自动生成)
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
            
            # 如果未提供机构ID，生成一个基于名称的哈希
            if not inst_id:
                inst_hash = hashlib.md5(name.encode('utf-8')).hexdigest()[:12]
                inst_id = f"inst_{inst_hash}"
            
            # 检查机构是否已存在
            if self.institution_exists(inst_id):
                # 更新机构信息
                update_query = """
                UPDATE institutions 
                SET name = ?, type = ?, url = ?, lab = ?
                WHERE inst_id = ?
                """
                self.db_manager.execute(update_query, (
                    name, type, url, lab, inst_id
                ))
                return True, inst_id
            
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
    
    def create_scholar_institution_relation(self, scholar_id, inst_id, start_year=None, end_year=None, is_current=True):
        """创建学者与机构的关联关系
        
        Args:
            scholar_id: 学者ID
            inst_id: 机构ID
            start_year: 开始年份
            end_year: 结束年份
            is_current: 是否为当前机构
            
        Returns:
            bool: 是否成功
        """
        try:
            # 检查关系是否已存在
            check_query = """
            SELECT 1 FROM scholar_institutions 
            WHERE scholar_id = ? AND inst_id = ?
            """
            cursor = self.db_manager.execute(check_query, (scholar_id, inst_id))
            if cursor.fetchone():
                # 如果关系已存在，则更新
                update_query = """
                UPDATE scholar_institutions 
                SET start_year = ?, end_year = ?, is_current = ? 
                WHERE scholar_id = ? AND inst_id = ?
                """
                self.db_manager.execute(update_query, (
                    start_year, end_year, is_current, scholar_id, inst_id
                ))
            else:
                # 添加新关系
                insert_query = """
                INSERT INTO scholar_institutions 
                (scholar_id, inst_id, start_year, end_year, is_current) 
                VALUES (?, ?, ?, ?, ?)
                """
                self.db_manager.execute(insert_query, (
                    scholar_id, inst_id, start_year, end_year, is_current
                ))
            
            return True
            
        except Exception as e:
            self.logger.error(f"创建学者-机构关系时出错: {str(e)}")
            return False
    
    def get_scholar_institutions(self, scholar_id):
        """获取学者所属的机构列表
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            list: 机构列表
        """
        try:
            query = """
            SELECT i.* 
            FROM institutions i
            JOIN scholar_institutions si ON i.inst_id = si.inst_id
            WHERE si.scholar_id = ?
            ORDER BY si.is_current DESC, si.end_year DESC
            """
            cursor = self.db_manager.execute(query, (scholar_id,))
            institutions = cursor.fetchall()
            return institutions
            
        except Exception as e:
            self.logger.error(f"获取学者机构时出错: {str(e)}")
            return []
    
    def get_institution_scholars(self, inst_id, limit=50):
        """获取机构所有学者
        
        Args:
            inst_id: 机构ID
            limit: 结果数量限制
            
        Returns:
            list: 学者列表
        """
        try:
            query = """
            SELECT s.*, e.name 
            FROM scholars s
            JOIN entities e ON s.scholar_id = e.id
            JOIN scholar_institutions si ON s.scholar_id = si.scholar_id
            WHERE si.inst_id = ?
            ORDER BY s.citedby DESC
            LIMIT ?
            """
            cursor = self.db_manager.execute(query, (inst_id, limit))
            scholars = cursor.fetchall()
            return scholars
            
        except Exception as e:
            self.logger.error(f"获取机构学者时出错: {str(e)}")
            return [] 