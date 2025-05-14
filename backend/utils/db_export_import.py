#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sqlite3
import argparse
import logging
import subprocess
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def export_db_to_sql(db_path, sql_path=None):
    """
    将SQLite数据库转换为SQL文件，使用Python的sqlite3模块

    Args:
        db_path (str): 数据库文件路径
        sql_path (str, optional): 导出的SQL文件路径，默认为同名.sql文件

    Returns:
        str: 导出的SQL文件路径
    """
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"数据库文件不存在: {db_path}")

    if not sql_path:
        # 如果没有指定输出路径，使用同名.sql文件
        sql_path = os.path.splitext(db_path)[0] + ".sql"

    try:
        logger.info(f"开始导出数据库 {db_path} 到 {sql_path}")

        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 获取所有表名
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        with open(sql_path, "w", encoding="utf-8") as f:
            # 写入SQLite版本和编码信息
            f.write(f"-- SQLite版本 {sqlite3.sqlite_version}\n")
            f.write("PRAGMA foreign_keys=OFF;\n")
            f.write("BEGIN TRANSACTION;\n\n")

            # 处理每个表
            for table in tables:
                table_name = table[0]

                # 跳过sqlite_sequence表
                if table_name == "sqlite_sequence":
                    continue

                # 获取表结构
                cursor.execute(f"PRAGMA table_info({table_name});")
                columns = cursor.fetchall()

                # 创建表的SQL
                cursor.execute(
                    f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}';"
                )
                create_table_sql = cursor.fetchone()[0]
                f.write(f"{create_table_sql};\n")

                # 导出表数据
                cursor.execute(f"SELECT * FROM {table_name};")
                rows = cursor.fetchall()

                for row in rows:
                    # 构建INSERT语句
                    values = []
                    for value in row:
                        if value is None:
                            values.append("NULL")
                        elif isinstance(value, (int, float)):
                            values.append(str(value))
                        else:
                            # 处理字符串，转义单引号
                            escaped_value = str(value).replace("'", "''")
                            values.append(f"'{escaped_value}'")

                    f.write(f"INSERT INTO {table_name} VALUES({', '.join(values)});\n")

                f.write("\n")

            # 获取索引
            cursor.execute(
                "SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL;"
            )
            indexes = cursor.fetchall()

            for index_name, index_sql in indexes:
                f.write(f"{index_sql};\n")

            # 获取视图
            cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='view';")
            views = cursor.fetchall()

            for view_name, view_sql in views:
                f.write(f"{view_sql};\n")

            # 获取触发器
            cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='trigger';")
            triggers = cursor.fetchall()

            for trigger_name, trigger_sql in triggers:
                f.write(f"{trigger_sql};\n")

            f.write("\nCOMMIT;\n")

        conn.close()

        if os.path.exists(sql_path) and os.path.getsize(sql_path) > 0:
            logger.info(f"数据库成功导出到: {sql_path}")
            return sql_path
        else:
            raise Exception("SQL文件导出失败或为空")

    except Exception as e:
        logger.error(f"导出数据库时出错: {str(e)}")
        raise e


def import_sql_to_db(sql_path, db_path=None):
    """
    从SQL文件创建SQLite数据库，使用Python的sqlite3模块

    Args:
        sql_path (str): SQL文件路径
        db_path (str, optional): 要创建的数据库文件路径，默认为同名.db文件

    Returns:
        str: 创建的数据库文件路径
    """
    if not os.path.exists(sql_path):
        raise FileNotFoundError(f"SQL文件不存在: {sql_path}")

    if not db_path:
        # 如果没有指定输出路径，使用同名.db文件
        db_path = os.path.splitext(sql_path)[0] + ".db"

    # 如果数据库已存在，先删除
    if os.path.exists(db_path):
        logger.warning(f"数据库文件已存在，将被覆盖: {db_path}")
        os.remove(db_path)

    try:
        logger.info(f"开始从 {sql_path} 导入数据库到 {db_path}")

        # 连接到新的数据库文件
        conn = sqlite3.connect(db_path)

        # 读取SQL文件内容
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_script = f.read()

        # 执行整个SQL脚本
        conn.executescript(sql_script)
        conn.commit()
        conn.close()

        if os.path.exists(db_path) and os.path.getsize(db_path) > 0:
            logger.info(f"数据库成功导入到: {db_path}")
            return db_path
        else:
            raise Exception("数据库导入失败或为空")

    except Exception as e:
        logger.error(f"导入数据库时出错: {str(e)}")
        raise e


def auto_detect_and_import(directory=None):
    """
    自动检测目录中的SQL文件并导入到对应的数据库

    Args:
        directory (str, optional): 要检测的目录，默认为当前目录

    Returns:
        list: 成功导入的数据库文件列表
    """
    if directory is None:
        directory = os.getcwd()

    logger.info(f"开始在 {directory} 中检测SQL文件")

    imported_dbs = []

    # 遍历目录中的所有.sql文件
    for sql_file in Path(directory).glob("*.sql"):
        sql_path = str(sql_file)
        db_path = os.path.splitext(sql_path)[0] + ".db"

        logger.info(f"发现SQL文件: {sql_path}")

        try:
            imported_db = import_sql_to_db(sql_path, db_path)
            imported_dbs.append(imported_db)
        except Exception as e:
            logger.error(f"导入 {sql_path} 失败: {str(e)}")

    return imported_dbs


def main():
    parser = argparse.ArgumentParser(description="SQLite数据库导出导入工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # 导出命令
    export_parser = subparsers.add_parser("export", help="导出数据库到SQL文件")
    export_parser.add_argument("db_path", help="数据库文件路径")
    export_parser.add_argument("-o", "--output", help="导出的SQL文件路径")

    # 导入命令
    import_parser = subparsers.add_parser("import", help="从SQL文件导入到数据库")
    import_parser.add_argument("sql_path", help="SQL文件路径")
    import_parser.add_argument("-o", "--output", help="创建的数据库文件路径")

    # 自动检测命令
    auto_parser = subparsers.add_parser("auto", help="自动检测目录中的SQL文件并导入")
    auto_parser.add_argument("-d", "--directory", help="要检测的目录")

    args = parser.parse_args()

    if args.command == "export":
        export_db_to_sql(args.db_path, args.output)
    elif args.command == "import":
        import_sql_to_db(args.sql_path, args.output)
    elif args.command == "auto":
        auto_detect_and_import(args.directory)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
