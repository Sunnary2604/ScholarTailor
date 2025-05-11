"""
作者关系数据访问对象
提供authorship表的基本CRUD操作
"""

import json
from datetime import datetime
from db.db_manager import DBManager
import logging


class AuthorshipDao:
    """作者关系数据访问对象"""

    def __init__(self):
        """初始化DAO，获取数据库连接"""
        self.db_manager = DBManager()
        self.logger = logging.getLogger(__name__)

    def authorship_exists(self, scholar_id, cites_id):
        """检查作者关系是否存在

        Args:
            scholar_id: 学者ID
            cites_id: 论文引用ID

        Returns:
            bool: 关系是否存在
        """
        query = """
        SELECT 1 FROM authorship 
        WHERE scholar_id = ? AND cites_id = ?
        """
        cursor = self.db_manager.execute(query, (scholar_id, cites_id))
        result = cursor.fetchone()
        return result is not None

    def create_authorship(self, scholar_id, cites_id, is_corresponding=False):
        """创建作者关系

        Args:
            scholar_id: 学者ID
            cites_id: 论文引用ID
            is_corresponding: 是否为通讯作者

        Returns:
            bool: 是否成功创建
        """
        try:
            self.logger.info(f"创建作者关系: 学者 {scholar_id}, 论文 {cites_id}")

            # 检查关系是否已存在
            if self.authorship_exists(scholar_id, cites_id):
                # 如果已存在且是把作者更新为通讯作者，则更新
                if is_corresponding:
                    self.logger.info(f"作者关系已存在，更新为通讯作者")
                    return self.update_authorship_corresponding(
                        scholar_id, cites_id, is_corresponding
                    )
                self.logger.info(f"作者关系已存在，无需创建")
                return True  # 已存在，无需创建

            # 插入作者关系
            query = """
            INSERT INTO authorship (scholar_id, cites_id, is_corresponding)
            VALUES (?, ?, ?)
            """

            self.db_manager.execute(
                query, (scholar_id, cites_id, 1 if is_corresponding else 0)
            )

            # 提交事务
            self.db_manager.commit()
            self.logger.info(f"成功创建作者关系: 学者 {scholar_id}, 论文 {cites_id}")

            return True

        except Exception as e:
            self.logger.error(f"创建作者关系时出错: {str(e)}")
            self.db_manager.rollback()
            import traceback

            self.logger.error(traceback.format_exc())
            return False

    def update_authorship_corresponding(self, scholar_id, cites_id, is_corresponding):
        """更新作者为通讯作者

        Args:
            scholar_id: 学者ID
            cites_id: 论文引用ID
            is_corresponding: 是否为通讯作者

        Returns:
            bool: 是否成功更新
        """
        try:
            query = """
            UPDATE authorship 
            SET is_corresponding = ?
            WHERE scholar_id = ? AND cites_id = ?
            """

            self.db_manager.execute(
                query, (1 if is_corresponding else 0, scholar_id, cites_id)
            )

            return True

        except Exception as e:
            self.logger.error(f"更新通讯作者时出错: {str(e)}")
            return False

    def get_publication_authors(self, cites_id):
        """获取论文的所有作者

        Args:
            cites_id: 论文引用ID

        Returns:
            list: 作者列表
        """
        query = """
        SELECT s.*, e.name, a.is_corresponding
        FROM scholars s
        JOIN entities e ON s.scholar_id = e.id
        JOIN authorship a ON s.scholar_id = a.scholar_id
        WHERE a.cites_id = ?
        ORDER BY a.is_corresponding DESC, s.is_main_scholar DESC
        """
        cursor = self.db_manager.execute(query, (cites_id,))
        authors = cursor.fetchall()

        # 解析JSON数据
        for author in authors:
            if author.get("cites_per_year"):
                try:
                    author["cites_per_year"] = json.loads(author["cites_per_year"])
                except:
                    author["cites_per_year"] = {}

        return authors

    def get_corresponding_authors(self, cites_id):
        """获取论文的通讯作者

        Args:
            cites_id: 论文引用ID

        Returns:
            list: 通讯作者列表
        """
        query = """
        SELECT s.*, e.name
        FROM scholars s
        JOIN entities e ON s.scholar_id = e.id
        JOIN authorship a ON s.scholar_id = a.scholar_id
        WHERE a.cites_id = ? AND a.is_corresponding = 1
        """
        cursor = self.db_manager.execute(query, (cites_id,))
        authors = cursor.fetchall()

        # 解析JSON数据
        for author in authors:
            if author.get("cites_per_year"):
                try:
                    author["cites_per_year"] = json.loads(author["cites_per_year"])
                except:
                    author["cites_per_year"] = {}

        return authors

    def is_author(self, scholar_id, cites_id):
        """检查学者是否为论文作者

        Args:
            scholar_id: 学者ID
            cites_id: 论文引用ID

        Returns:
            bool: 是否为作者
        """
        return self.authorship_exists(scholar_id, cites_id)

    def create_authorships_batch(self, authorship_data):
        """批量创建作者与论文的关系

        Args:
            authorship_data: 作者关系数据列表，每项为 (scholar_id, cites_id) 元组

        Returns:
            bool: 是否成功
        """
        if not authorship_data:
            return True

        try:
            # 准备SQL语句 - 确保表名为authorship
            query = """
            INSERT OR IGNORE INTO authorship (scholar_id, cites_id)
            VALUES (?, ?)
            """

            # 批量执行插入
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.executemany(query, authorship_data)
                conn.commit()

            self.logger.info(f"成功批量创建 {len(authorship_data)} 条作者关系")
            return True
        except Exception as e:
            self.logger.error(f"批量创建作者关系时出错: {str(e)}")
            import traceback

            self.logger.error(traceback.format_exc())
            self.db_manager.rollback()
            return False
