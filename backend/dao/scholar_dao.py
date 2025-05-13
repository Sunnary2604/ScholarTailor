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
            affiliation = data.get("affiliation", "")
            email_domain = data.get("email_domain", "")
            homepage = data.get("homepage", "")
            url_picture = data.get("url_picture", "")
            citedby = data.get("citedby", 0)
            citedby5y = data.get("citedby5y", 0)
            hindex = data.get("hindex", 0)
            hindex5y = data.get("hindex5y", 0)
            i10index = data.get("i10index", 0)
            i10index5y = data.get("i10index5y", 0)

            # 引用统计数据转换为JSON
            cites_per_year = json.dumps(data.get("cites_per_year", {}))

            # 公开访问数据
            public_access = data.get("public_access", {})
            public_access_available = public_access.get("available", 0)
            public_access_unavailable = public_access.get("not_available", 0)

            # 最后更新时间
            last_updated = data.get("last_updated", datetime.now().isoformat())

            # 插入学者详情
            query = """
            INSERT INTO scholars (
                scholar_id, affiliation, email_domain, homepage, url_picture,
                citedby, citedby5y, hindex, hindex5y, i10index, i10index5y,
                cites_per_year, public_access_available, public_access_unavailable,
                last_updated, is_main_scholar
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

            self.db_manager.execute(
                query,
                (
                    scholar_id,
                    affiliation,
                    email_domain,
                    homepage,
                    url_picture,
                    citedby,
                    citedby5y,
                    hindex,
                    hindex5y,
                    i10index,
                    i10index5y,
                    cites_per_year,
                    public_access_available,
                    public_access_unavailable,
                    last_updated,
                    is_main_scholar,
                ),
            )

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
            name = coauthor_data.get("name", "Unknown Scholar")
            affiliation = coauthor_data.get("affiliation", "")

            # 插入学者详情，设置为非主要学者
            query = """
            INSERT INTO scholars (
                scholar_id, affiliation, last_updated, is_main_scholar
            ) VALUES (?, ?, ?, 0)
            """

            self.db_manager.execute(
                query, (coauthor_id, affiliation, datetime.now().isoformat())
            )

            return True

        except Exception as e:
            self.logger.error(f"创建合作者详情时出错: {str(e)}")
            return False

    def update_scholar(self, scholar_id, data, is_main_scholar=None, is_hidden=None):
        """更新学者详情记录

        Args:
            scholar_id: 学者ID
            data: 学者数据
            is_main_scholar: 是否为主要学者，为None时保持原值
            is_hidden: 是否隐藏此学者，为None时保持原值

        Returns:
            bool: 是否成功更新
        """
        try:
            # 先检查学者是否存在
            if not self.scholar_exists(scholar_id):
                return False

            # 处理状态参数
            if is_main_scholar is not None or is_hidden is not None:
                # 检查data是否为空或只包含基本字段（如主要用于状态更新）
                is_data_substantial = any(
                    field in data
                    for field in [
                        "homepage",
                        "url_picture",
                        "citedby",
                        "hindex",
                        "interests",
                    ]
                )

                # 如果data包含实质性数据，进行完整更新而不仅仅是状态更新
                if is_data_substantial:
                    # 添加状态字段到data
                    update_data = dict(data)  # 复制data避免修改原对象
                    if is_main_scholar is not None:
                        update_data["is_main_scholar"] = is_main_scholar
                    if is_hidden is not None:
                        update_data["is_hidden"] = is_hidden

                    # 执行完整字段更新
                    # 递归调用自身，但避免走到状态更新分支
                    return self.update_scholar(scholar_id, update_data, None, None)

                # 构建状态更新SQL
                update_fields = []
                params = []

                if is_main_scholar is not None:
                    update_fields.append("is_main_scholar = ?")
                    params.append(is_main_scholar)

                if is_hidden is not None:
                    update_fields.append("is_hidden = ?")
                    params.append(is_hidden)

                # 确保有字段需要更新
                if not update_fields:
                    return True

                # 添加学者ID到参数列表
                params.append(scholar_id)

                query = f"UPDATE scholars SET {', '.join(update_fields)} WHERE scholar_id = ?"

                try:
                    # 开始显式事务
                    self.db_manager.begin_transaction()

                    # 执行更新
                    cursor = self.db_manager.execute(query, params)
                    affected_rows = cursor.rowcount

                    if affected_rows == 0:
                        # 双重检查学者是否存在
                        exists_check = self.db_manager.execute(
                            "SELECT COUNT(*) as count FROM scholars WHERE scholar_id = ?",
                            (scholar_id,),
                        ).fetchone()

                        exists_count = (
                            exists_check.get("count", 0) if exists_check else 0
                        )

                        # 如果学者存在，但更新行数为0，可能有其他问题
                        if exists_count > 0:
                            # 尝试使用更直接的SQL更新
                            backup_parts = []
                            if is_main_scholar is not None:
                                backup_parts.append(
                                    f"is_main_scholar = {is_main_scholar}"
                                )
                            if is_hidden is not None:
                                backup_parts.append(f"is_hidden = {is_hidden}")

                            backup_query = f"UPDATE scholars SET {', '.join(backup_parts)} WHERE scholar_id = '{scholar_id}'"
                            self.db_manager.execute(backup_query)

                    # 提交事务
                    self.db_manager.commit()

                    return True
                except Exception as sql_error:
                    # 回滚事务
                    try:
                        self.db_manager.rollback()
                    except Exception as rollback_error:
                        pass

                    return False

            else:
                # 构建完整的更新SQL
                # 检查data字典中是否存在is_main_scholar
                has_is_main_scholar = data and "is_main_scholar" in data

                base_fields = """
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
                    last_updated = ?
                """

                # 如果data中包含is_main_scholar，添加到更新字段
                if has_is_main_scholar:
                    base_fields += ", is_main_scholar = ?"

                params = [
                    data.get("affiliation", ""),
                    data.get("email_domain", ""),
                    data.get("homepage", ""),
                    data.get("url_picture", ""),
                    data.get("citedby", 0),
                    data.get("citedby5y", 0),
                    data.get("hindex", 0),
                    data.get("hindex5y", 0),
                    data.get("i10index", 0),
                    data.get("i10index5y", 0),
                    json.dumps(data.get("cites_per_year", {})),
                    data.get("public_access", {}).get("available", 0),
                    data.get("public_access", {}).get("not_available", 0),
                    data.get("last_updated", datetime.now().isoformat()),
                ]

                # 如果data中包含is_main_scholar，添加到参数列表
                if has_is_main_scholar:
                    params.append(data["is_main_scholar"])

                # 添加学者ID
                params.append(scholar_id)

                query = f"UPDATE scholars SET {base_fields} WHERE scholar_id = ?"

                try:
                    cursor = self.db_manager.execute(query, params)
                    self.db_manager.commit()
                except Exception as sql_error:
                    return False

            return True

        except Exception as e:
            return False

    def toggle_scholar_hidden(self, scholar_id):
        """切换学者的显示/隐藏状态

        Args:
            scholar_id: 学者ID

        Returns:
            dict: 更新后的状态 {'success': bool, 'is_hidden': bool, 'error': str}
        """
        try:
            # 检查学者是否存在
            if not self.scholar_exists(scholar_id):
                return {"success": False, "error": f"学者 {scholar_id} 不存在"}

            # 获取当前状态
            query = "SELECT is_hidden FROM scholars WHERE scholar_id = ?"
            cursor = self.db_manager.execute(query, (scholar_id,))
            scholar = cursor.fetchone()

            if not scholar:
                return {"success": False, "error": f"无法获取学者 {scholar_id} 的状态"}

            # 当前隐藏状态
            current_hidden = scholar.get("is_hidden", 0)

            # 计算新状态 (切换)
            new_hidden = 0 if current_hidden else 1

            # 更新状态
            update_query = "UPDATE scholars SET is_hidden = ? WHERE scholar_id = ?"
            self.db_manager.execute(update_query, (new_hidden, scholar_id))
            self.db_manager.commit()

            return {
                "success": True,
                "is_hidden": bool(new_hidden),
                "message": f'学者 {scholar_id} 已{"隐藏" if new_hidden else "显示"}',
            }

        except Exception as e:
            self.logger.error(f"切换学者显示/隐藏状态时出错: {str(e)}")
            import traceback

            self.logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

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

        if scholar and scholar.get("cites_per_year"):
            # 解析JSON数据
            try:
                scholar["cites_per_year"] = json.loads(scholar["cites_per_year"])
            except:
                scholar["cites_per_year"] = {}

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
            if scholar.get("cites_per_year"):
                try:
                    scholar["cites_per_year"] = json.loads(scholar["cites_per_year"])
                except:
                    scholar["cites_per_year"] = {}

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
            if scholar.get("cites_per_year"):
                try:
                    scholar["cites_per_year"] = json.loads(scholar["cites_per_year"])
                except:
                    scholar["cites_per_year"] = {}

        return scholars
