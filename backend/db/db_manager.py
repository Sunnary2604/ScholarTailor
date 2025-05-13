"""
数据库管理器
提供SQLite数据库连接和基本操作
"""

import os
import sqlite3
import json
from datetime import datetime
import threading


class DBManager:
    """
    数据库管理类，提供单例模式的数据库连接和基本操作
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_path=None):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(DBManager, cls).__new__(cls)
                cls._instance.db_path = db_path
                cls._instance.connection = None
                cls._instance.initialize()
            return cls._instance

    def initialize(self):
        """初始化数据库连接"""
        if not self.db_path:
            # 获取项目根目录
            root_dir = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            )
            self.db_path = os.path.join(root_dir, "data", "scholar.db")
            # 确保data目录存在
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

        self.connect()

    def connect(self):
        """连接到数据库并检查表结构"""
        if self.connection is None:
            # 检查数据库文件是否存在
            db_exists = os.path.exists(self.db_path)

            # 连接到数据库
            self.connection = sqlite3.connect(self.db_path, check_same_thread=False)
            # 启用外键约束
            self.connection.execute("PRAGMA foreign_keys = ON")
            # 设置行工厂，使查询结果以字典形式返回
            self.connection.row_factory = self._dict_factory

            # 如果数据库文件不存在或表结构不完整，初始化表结构
            if not db_exists or not self.check_tables_exist():
                print(
                    f"{'新建数据库' if not db_exists else '表结构不完整'}, 正在初始化表结构..."
                )
                from db.models import init_db

                init_db(self)
                print("数据库表结构初始化完成")

    def _dict_factory(self, cursor, row):
        """将查询结果转换为字典"""
        d = {}
        for idx, col in enumerate(cursor.description):
            d[col[0]] = row[idx]
        return d

    def get_connection(self):
        """获取数据库连接"""
        if self.connection is None:
            self.connect()
        return self.connection

    def get_cursor(self):
        """获取数据库游标"""
        return self.get_connection().cursor()

    def execute(self, query, params=()):
        """执行SQL查询"""
        # print(f"DEBUGTAG: 执行SQL: {query}")
        # print(f"DEBUGTAG: SQL参数: {params}")
        cursor = self.get_cursor()
        cursor.execute(query, params)
        affected_rows = cursor.rowcount
        # print(f"DEBUGTAG: SQL影响行数: {affected_rows}")
        return cursor

    def executemany(self, query, params_list):
        """批量执行SQL查询"""
        # print(f"DEBUGTAG: 批量执行SQL: {query}")
        # print(f"DEBUGTAG: 参数数量: {len(params_list)}")
        cursor = self.get_cursor()
        cursor.executemany(query, params_list)
        affected_rows = cursor.rowcount
        # print(f"DEBUGTAG: 批量SQL影响行数: {affected_rows}")
        return cursor

    def commit(self):
        """提交事务"""
        # print(f"DEBUGTAG: 提交数据库事务")
        if self.connection:
            try:
                # 首先检查是否有活动事务
                cursor = self.get_cursor()
                cursor.execute("PRAGMA autocommit")
                autocommit = cursor.fetchone()

                # 如果autocommit为1，表示没有活动事务
                if autocommit and autocommit.get("autocommit") == 1:
                    # print("DEBUGTAG: 没有活动事务，跳过提交")
                    return

                # 否则提交事务
                self.connection.commit()
                # print(f"DEBUGTAG: 事务提交完成")
            except Exception as e:
                # print(f"DEBUGTAG: 事务提交异常: {str(e)}")
                import traceback

                print(traceback.format_exc())

                # 如果不是"没有活动事务"的错误，尝试再次提交
                if "no transaction is active" not in str(e).lower():
                    try:
                        self.connection.commit()
                        print(f"DEBUGTAG: 事务重试提交完成")
                    except Exception as retry_error:
                        print(f"DEBUGTAG: 事务重试提交失败: {str(retry_error)}")
                else:
                    print(f"DEBUGTAG: 跳过重试 - 没有活动事务")
        else:
            print(f"DEBUGTAG: 事务提交失败 - 连接为空")

    def close(self):
        """关闭数据库连接"""
        if self.connection:
            self.connection.commit()
            self.connection.close()
            self.connection = None

    def execute_script(self, script):
        """执行SQL脚本"""
        connection = self.get_connection()
        connection.executescript(script)
        self.commit()

    # 事务支持
    def begin_transaction(self):
        """开始事务"""
        # print(f"DEBUGTAG: 尝试开始事务")
        try:
            # 检查是否已有活动事务
            cursor = self.get_cursor()
            cursor.execute("PRAGMA autocommit")
            autocommit = cursor.fetchone()

            # 如果autocommit为0，表示已有活动事务
            if autocommit and autocommit.get("autocommit") == 0:
                # print("DEBUGTAG: 已有活动事务，跳过BEGIN TRANSACTION")
                return

            # 开始新事务
            self.execute("BEGIN TRANSACTION")
            print("DEBUGTAG: 成功开始新事务")
        except Exception as e:
            print(f"DEBUGTAG: 开始事务时异常: {str(e)}")

    def end_transaction(self):
        """结束事务并提交"""
        #  print(f"DEBUGTAG: 结束事务")
        self.commit()

    def rollback(self):
        """回滚事务"""
        # print(f"DEBUGTAG: 尝试回滚事务")
        if self.connection:
            try:
                # 首先检查是否有活动事务
                cursor = self.get_cursor()
                cursor.execute("PRAGMA autocommit")
                autocommit = cursor.fetchone()

                # 如果autocommit为1，表示没有活动事务
                if autocommit and autocommit.get("autocommit") == 1:
                    print("DEBUGTAG: 没有活动事务，跳过回滚")
                    return

                # 回滚事务
                self.connection.rollback()
                print(f"DEBUGTAG: 事务回滚完成")
            except Exception as e:
                print(f"DEBUGTAG: 事务回滚异常: {str(e)}")
                # 这里不需要重试，因为如果回滚失败，大概率是没有活动事务
        else:
            print(f"DEBUGTAG: 事务回滚失败 - 连接为空")

    def check_tables_exist(self):
        """检查必要的表是否存在"""
        required_tables = [
            "scholars",
            "publications",
            "institutions",
            "entities",
            "relationships",
            "interests",
            "authorship",
            "db_version",
        ]

        cursor = self.get_cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        existing_tables = [row.get("name") for row in cursor.fetchall()]

        for table in required_tables:
            if table not in existing_tables:
                print(f"表结构不完整: {table} 表不存在")
                return False

        return True
