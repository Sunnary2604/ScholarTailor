"""
学者数据访问对象
提供scholars表的基本CRUD操作
"""

import json
from datetime import datetime
from db.db_manager import DBManager
import logging
import hashlib

class ScholarDao:
    """学者数据访问对象"""
    
    def __init__(self):
        """初始化DAO，获取数据库连接"""
        self.db_manager = DBManager()
        self.logger = logging.getLogger(__name__)
    
    def scholar_exists(self, scholar_id):
        """检查学者是否存在
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            bool: 学者是否存在
        """
        query = "SELECT 1 FROM scholars WHERE scholar_id = ?"
        cursor = self.db_manager.execute(query, (scholar_id,))
        result = cursor.fetchone()
        return result is not None
    
    def create_scholar(self, scholar_id, data, is_main_scholar=1):
        """创建学者详情记录
        
        Args:
            scholar_id: 学者ID
            data: 学者数据
            is_main_scholar: 是否为主要学者
            
        Returns:
            bool: 是否成功创建
        """
        try:
            # 检查是否已存在学者详情
            if self.scholar_exists(scholar_id):
                # 已存在，更新记录
                return self.update_scholar(scholar_id, data, is_main_scholar)
            
            # 提取学者详情信息
            affiliation = data.get('affiliation', '')
            email_domain = data.get('email_domain', '')
            homepage = data.get('homepage', '')
            url_picture = data.get('url_picture', '')
            citedby = data.get('citedby', 0)
            citedby5y = data.get('citedby5y', 0)
            hindex = data.get('hindex', 0)
            hindex5y = data.get('hindex5y', 0)
            i10index = data.get('i10index', 0)
            i10index5y = data.get('i10index5y', 0)
            
            # 引用统计数据转换为JSON
            cites_per_year = json.dumps(data.get('cites_per_year', {}))
            
            # 公开访问数据
            public_access = data.get('public_access', {})
            public_access_available = public_access.get('available', 0)
            public_access_unavailable = public_access.get('not_available', 0)
            
            # 最后更新时间
            last_updated = data.get('last_updated', datetime.now().isoformat())
            
            # 插入学者详情
            query = """
            INSERT INTO scholars (
                scholar_id, affiliation, email_domain, homepage, url_picture,
                citedby, citedby5y, hindex, hindex5y, i10index, i10index5y,
                cites_per_year, public_access_available, public_access_unavailable,
                last_updated, is_main_scholar
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            self.db_manager.execute(query, (
                scholar_id, affiliation, email_domain, homepage, url_picture,
                citedby, citedby5y, hindex, hindex5y, i10index, i10index5y,
                cites_per_year, public_access_available, public_access_unavailable,
                last_updated, is_main_scholar
            ))
            
            return True
            
        except Exception as e:
            self.logger.error(f"创建学者详情时出错: {str(e)}")
            return False
    
    def create_coauthor(self, coauthor_id, coauthor_data):
        """创建合作者详情记录
        
        Args:
            coauthor_id: 合作者ID
            coauthor_data: 合作者数据
            
        Returns:
            bool: 是否成功创建
        """
        try:
            # 合作者只需要保存基本信息，可以为空
            # 当用户点击查看合作者详情时，可以标记为主要学者并爬取更多信息
            
            # 检查学者是否已存在
            if self.scholar_exists(coauthor_id):
                return True  # 已存在，无需创建
            
            # 提取基本信息
            name = coauthor_data.get('name', 'Unknown Scholar')
            affiliation = coauthor_data.get('affiliation', '')
            
            # 插入学者详情，设置为非主要学者
            query = """
            INSERT INTO scholars (
                scholar_id, affiliation, last_updated, is_main_scholar
            ) VALUES (?, ?, ?, 0)
            """
            
            self.db_manager.execute(query, (
                coauthor_id, affiliation, datetime.now().isoformat()
            ))
            
            return True
            
        except Exception as e:
            self.logger.error(f"创建合作者详情时出错: {str(e)}")
            return False
    
    def update_scholar(self, scholar_id, data, is_main_scholar=None):
        """更新学者详情记录
        
        Args:
            scholar_id: 学者ID
            data: 学者数据
            is_main_scholar: 是否为主要学者，为None时保持原值
            
        Returns:
            bool: 是否成功更新
        """
        try:
            # 提取学者详情信息
            affiliation = data.get('affiliation', '')
            email_domain = data.get('email_domain', '')
            homepage = data.get('homepage', '')
            url_picture = data.get('url_picture', '')
            citedby = data.get('citedby', 0)
            citedby5y = data.get('citedby5y', 0)
            hindex = data.get('hindex', 0)
            hindex5y = data.get('hindex5y', 0)
            i10index = data.get('i10index', 0)
            i10index5y = data.get('i10index5y', 0)
            
            # 引用统计数据转换为JSON
            cites_per_year = json.dumps(data.get('cites_per_year', {}))
            
            # 公开访问数据
            public_access = data.get('public_access', {})
            public_access_available = public_access.get('available', 0)
            public_access_unavailable = public_access.get('not_available', 0)
            
            # 最后更新时间
            last_updated = data.get('last_updated', datetime.now().isoformat())
            
            # 处理is_main_scholar参数
            update_main_scholar = is_main_scholar is not None
            
            if update_main_scholar:
                main_scholar_value = is_main_scholar
            else:
                # 获取当前值
                check_query = "SELECT is_main_scholar FROM scholars WHERE scholar_id = ?"
                cursor = self.db_manager.execute(check_query, (scholar_id,))
                result = cursor.fetchone()
                main_scholar_value = result.get('is_main_scholar', 0) if result else 0
            
            # 更新学者详情
            query = """
            UPDATE scholars SET
                affiliation = ?,
                email_domain = ?,
                homepage = ?,
                url_picture = ?,
                citedby = ?,
                citedby5y = ?,
                hindex = ?,
                hindex5y = ?,
                i10index = ?,
                i10index5y = ?,
                cites_per_year = ?,
                public_access_available = ?,
                public_access_unavailable = ?,
                last_updated = ?,
                is_main_scholar = ?
            WHERE scholar_id = ?
            """
            
            self.db_manager.execute(query, (
                affiliation, email_domain, homepage, url_picture,
                citedby, citedby5y, hindex, hindex5y, i10index, i10index5y,
                cites_per_year, public_access_available, public_access_unavailable,
                last_updated, main_scholar_value, scholar_id
            ))
            
            return True
            
        except Exception as e:
            self.logger.error(f"更新学者详情时出错: {str(e)}")
            return False
    
    def convert_to_main_scholar(self, scholar_id):
        """将关联学者转换为主要学者
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            bool: 是否成功转换
        """
        try:
            # 检查学者是否存在
            if not self.scholar_exists(scholar_id):
                return False
                
            # 更新为主要学者
            query = "UPDATE scholars SET is_main_scholar = 1 WHERE scholar_id = ?"
            self.db_manager.execute(query, (scholar_id,))
            
            return True
            
        except Exception as e:
            self.logger.error(f"将学者转换为主要学者时出错: {str(e)}")
            return False
    
    def get_scholar_by_id(self, scholar_id):
        """根据ID获取学者
        
        Args:
            scholar_id: 学者ID
            
        Returns:
            dict: 学者数据
        """
        query = "SELECT * FROM scholars WHERE scholar_id = ?"
        cursor = self.db_manager.execute(query, (scholar_id,))
        scholar = cursor.fetchone()
        
        if scholar and scholar.get('cites_per_year'):
            # 解析JSON数据
            try:
                scholar['cites_per_year'] = json.loads(scholar['cites_per_year'])
            except:
                scholar['cites_per_year'] = {}
                
        return scholar
    
    def get_main_scholars(self, limit=100, offset=0):
        """获取主要学者列表
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 主要学者列表
        """
        query = """
        SELECT s.*, e.name 
        FROM scholars s
        JOIN entities e ON s.scholar_id = e.id
        WHERE s.is_main_scholar = 1
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (limit, offset))
        scholars = cursor.fetchall()
        
        # 解析JSON数据
        for scholar in scholars:
            if scholar.get('cites_per_year'):
                try:
                    scholar['cites_per_year'] = json.loads(scholar['cites_per_year'])
                except:
                    scholar['cites_per_year'] = {}
        
        return scholars
    
    def get_related_scholars(self, limit=100, offset=0):
        """获取关联学者列表
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 关联学者列表
        """
        query = """
        SELECT s.*, e.name 
        FROM scholars s
        JOIN entities e ON s.scholar_id = e.id
        WHERE s.is_main_scholar = 0
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (limit, offset))
        scholars = cursor.fetchall()
        
        # 解析JSON数据
        for scholar in scholars:
            if scholar.get('cites_per_year'):
                try:
                    scholar['cites_per_year'] = json.loads(scholar['cites_per_year'])
                except:
                    scholar['cites_per_year'] = {}
        
        return scholars 