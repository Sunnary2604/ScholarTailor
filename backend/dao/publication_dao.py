"""
论文数据访问对象
提供publications表的基本CRUD操作
"""

import json
import hashlib
from datetime import datetime
from db.db_manager import DBManager
import logging

class PublicationDao:
    """论文数据访问对象"""
    
    def __init__(self):
        """初始化DAO，获取数据库连接"""
        self.db_manager = DBManager()
        self.logger = logging.getLogger(__name__)
    
    def publication_exists(self, cites_id):
        """检查论文是否存在
        
        Args:
            cites_id: 论文引用ID
            
        Returns:
            bool: 论文是否存在
        """
        query = "SELECT 1 FROM publications WHERE cites_id = ?"
        cursor = self.db_manager.execute(query, (cites_id,))
        result = cursor.fetchone()
        return result is not None
    
    def create_publication(self, pub_data, scholar_id=None):
        """创建论文记录
        
        Args:
            pub_data: 论文数据
            scholar_id: 相关学者ID（可选，用于生成无引用ID论文的唯一标识）
            
        Returns:
            tuple: (是否成功, cites_id)
        """
        try:
            # 检查必要字段
            bib = pub_data.get('bib', {})
            title = bib.get('title')
            
            if not title:
                self.logger.warning("跳过无标题论文")
                return False, None
            
            # 获取引用ID作为论文的唯一标识
            cites_id_list = pub_data.get('cites_id', [])
            primary_cites_id = None
            
            if cites_id_list and len(cites_id_list) > 0:
                # 有引用ID，使用第一个作为唯一标识
                primary_cites_id = str(cites_id_list[0])  # 确保是字符串形式
            else:
                # 无引用ID，使用标题和作者ID生成唯一标识
                # 对于中文标题，先转为字节再编码，以保留中文信息
                title_bytes = title.encode('utf-8')
                title_hash = hashlib.md5(title_bytes).hexdigest()[:16]
                scholar_suffix = f"_{scholar_id[:8]}" if scholar_id else ""
                primary_cites_id = f"title_{title_hash}{scholar_suffix}"
                self.logger.info(f"为无引用ID论文生成唯一标识: {primary_cites_id}, 标题: {title[:30]}...")
            
            # 生成pub_id (保持兼容旧代码)
            author_pub_id = pub_data.get('author_pub_id')
            pub_id = author_pub_id if author_pub_id else f"pub_{hashlib.md5(primary_cites_id.encode('utf-8')).hexdigest()[:12]}"
            
            # 检查论文是否已存在
            if self.publication_exists(primary_cites_id):
                return True, primary_cites_id  # 已存在，无需创建
            
            # 提取论文信息
            year = bib.get('pub_year', bib.get('year'))
            try:
                year = int(year) if year else None
            except:
                year = None
                
            venue = bib.get('venue', '')
            citation_text = self._format_citation_text(bib)
            num_citations = pub_data.get('num_citations', 0)
            citedby_url = pub_data.get('citedby_url', '')
            
            # 插入论文
            query = """
            INSERT INTO publications (
                cites_id, pub_id, title, year, venue, citation_text, num_citations, citedby_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            self.db_manager.execute(query, (
                primary_cites_id, pub_id, title, year, venue, citation_text, num_citations, citedby_url
            ))
            
            return True, primary_cites_id
            
        except Exception as e:
            self.logger.error(f"创建论文记录时出错: {str(e)}")
            return False, None
    
    def _format_citation_text(self, bib):
        """格式化引用文本
        
        Args:
            bib: 论文引用数据
            
        Returns:
            str: 格式化的引用文本
        """
        try:
            # 尝试格式化引用文本
            authors = bib.get('author', '')
            title = bib.get('title', '')
            venue = bib.get('venue', '')
            year = bib.get('pub_year', bib.get('year', ''))
            
            citation = f"{authors}. \"{title}\". "
            if venue:
                citation += f"{venue}. "
            if year:
                citation += f"{year}."
                
            return citation
            
        except Exception as e:
            self.logger.error(f"格式化引用文本时出错: {str(e)}")
            return ""
    
    def get_publication_by_cites_id(self, cites_id):
        """根据引用ID获取论文
        
        Args:
            cites_id: 论文引用ID
            
        Returns:
            dict: 论文数据
        """
        query = "SELECT * FROM publications WHERE cites_id = ?"
        cursor = self.db_manager.execute(query, (cites_id,))
        publication = cursor.fetchone()
        return publication
    
    def get_publications_by_scholar(self, scholar_id, limit=100, offset=0):
        """获取学者的发表论文
        
        Args:
            scholar_id: 学者ID
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 论文列表
        """
        query = """
        SELECT p.* 
        FROM publications p
        JOIN authorship a ON p.cites_id = a.cites_id
        WHERE a.scholar_id = ?
        ORDER BY p.year DESC, p.num_citations DESC
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (scholar_id, limit, offset))
        publications = cursor.fetchall()
        return publications
    
    def get_top_cited_publications(self, limit=10):
        """获取被引用次数最多的论文
        
        Args:
            limit: 返回数量限制
            
        Returns:
            list: 论文列表
        """
        query = """
        SELECT * FROM publications
        ORDER BY num_citations DESC
        LIMIT ?
        """
        cursor = self.db_manager.execute(query, (limit,))
        publications = cursor.fetchall()
        return publications
    
    def get_publications_by_year_range(self, start_year, end_year, limit=100, offset=0):
        """根据年份范围获取论文
        
        Args:
            start_year: 开始年份
            end_year: 结束年份
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            list: 论文列表
        """
        query = """
        SELECT * FROM publications
        WHERE year BETWEEN ? AND ?
        ORDER BY year DESC, num_citations DESC
        LIMIT ? OFFSET ?
        """
        cursor = self.db_manager.execute(query, (start_year, end_year, limit, offset))
        publications = cursor.fetchall()
        return publications 