"""
实体数据访问对象
提供实体表的基本CRUD操作
"""

import json
from datetime import datetime
from db.db_manager import DBManager
import logging


class EntityDao:
    """实体数据访问对象基类"""

    def __init__(self):
        """初始化DAO，获取数据库连接"""
        self.db_manager = DBManager()

    def entity_exists(self, entity_id):
        """检查实体是否存在

        Args:
            entity_id: 实体ID

        Returns:
            bool: 实体是否存在
        """
        query = "SELECT 1 FROM entities WHERE id = ?"
        cursor = self.db_manager.execute(query, (entity_id,))
        result = cursor.fetchone()
        return result is not None

    def create_entity(self, id, type, name, data=None, ignore_if_exists=True):
        """创建新实体

        Args:
            id: 实体ID
            type: 实体类型(scholar, institution, publication)
            name: 实体名称
            data: 其他数据(JSON格式)
            ignore_if_exists: 如果实体已存在则忽略并返回成功

        Returns:
            bool: 是否创建成功
        """
        try:
            # 检查实体是否已存在
            if ignore_if_exists and self.entity_exists(id):
                return True

            # 转换data为JSON字符串
            data_json = json.dumps(data) if data else None

            # 插入实体
            query = """
            INSERT INTO entities (id, type, name, data)
            VALUES (?, ?, ?, ?)
            """
            self.db_manager.execute(query, (id, type, name, data_json))
            self.db_manager.commit()
            return True
        except Exception as e:
            print(f"创建实体失败: {str(e)}")
            self.db_manager.rollback()
            return False

    def get_entity_by_id(self, entity_id):
        """根据ID获取实体

        Args:
            entity_id: 实体ID

        Returns:
            dict: 实体数据
        """
        query = "SELECT * FROM entities WHERE id = ?"
        cursor = self.db_manager.execute(query, (entity_id,))
        entity = cursor.fetchone()

        if entity and entity.get("data"):
            # 解析JSON数据
            try:
                entity["data"] = json.loads(entity["data"])
            except:
                entity["data"] = {}

        return entity

    def get_entities_by_type(self, entity_type, limit=100, offset=0):
        """根据类型获取实体列表

        Args:
            entity_type: 实体类型
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            list: 实体列表
        """
        query = "SELECT * FROM entities WHERE type = ? LIMIT ? OFFSET ?"
        cursor = self.db_manager.execute(query, (entity_type, limit, offset))
        entities = cursor.fetchall()

        # 解析JSON数据
        for entity in entities:
            if entity.get("data"):
                try:
                    entity["data"] = json.loads(entity["data"])
                except:
                    entity["data"] = {}

        return entities

    def update_entity(self, entity_id, name=None, data=None):
        """更新实体

        Args:
            entity_id: 实体ID
            name: 新名称(可选)
            data: 新数据(可选，JSON格式)

        Returns:
            bool: 是否更新成功
        """
        try:
            update_fields = []
            params = []

            if name is not None:
                update_fields.append("name = ?")
                params.append(name)

            if data is not None:
                update_fields.append("data = ?")
                params.append(json.dumps(data))

            if not update_fields:
                return False

            # 添加更新时间
            update_fields.append("updated_at = ?")
            params.append(datetime.now().isoformat())

            # 添加实体ID
            params.append(entity_id)

            query = f"""
            UPDATE entities 
            SET {', '.join(update_fields)}
            WHERE id = ?
            """

            self.db_manager.execute(query, params)
            self.db_manager.commit()
            return True
        except Exception as e:
            print(f"更新实体失败: {str(e)}")
            self.db_manager.rollback()
            return False

    def delete_entity(self, entity_id):
        """删除实体

        Args:
            entity_id: 实体ID

        Returns:
            bool: 是否删除成功
        """
        try:
            # 开始事务
            self.db_manager.begin_transaction()

            # 删除外键关联
            # 注意: 由于外键约束，需要先删除依赖项
            # 删除实体相关的兴趣/标签
            self.db_manager.execute(
                "DELETE FROM interests WHERE entity_id = ?", (entity_id,)
            )

            # 删除学者详情(如果是学者)
            self.db_manager.execute(
                "DELETE FROM scholars WHERE scholar_id = ?", (entity_id,)
            )

            # 删除机构详情(如果是机构)
            self.db_manager.execute(
                "DELETE FROM institutions WHERE inst_id = ?", (entity_id,)
            )

            # 删除论文详情(如果是论文)
            self.db_manager.execute(
                "DELETE FROM publications WHERE pub_id = ?", (entity_id,)
            )

            # 删除作者关系
            self.db_manager.execute(
                "DELETE FROM authorship WHERE scholar_id = ? OR pub_id = ?",
                (entity_id, entity_id),
            )

            # 删除关系
            self.db_manager.execute(
                "DELETE FROM relationships WHERE source_id = ? OR target_id = ?",
                (entity_id, entity_id),
            )

            # 删除实体本身
            self.db_manager.execute("DELETE FROM entities WHERE id = ?", (entity_id,))

            # 提交事务
            self.db_manager.commit()
            return True
        except Exception as e:
            print(f"删除实体失败: {str(e)}")
            self.db_manager.rollback()
            return False

    def search_entities(self, keyword, entity_types=None, limit=20):
        """搜索实体

        Args:
            keyword: 搜索关键词
            entity_types: 实体类型列表(可选)
            limit: 结果数量限制

        Returns:
            list: 实体列表
        """
        try:
            search_term = f"%{keyword}%"

            if entity_types:
                # 按指定类型搜索
                placeholders = ", ".join(["?"] * len(entity_types))
                query = f"""
                SELECT * FROM entities 
                WHERE name LIKE ? AND type IN ({placeholders})
                LIMIT ?
                """
                params = [search_term] + entity_types + [limit]
            else:
                # 搜索所有类型
                query = """
                SELECT * FROM entities 
                WHERE name LIKE ?
                LIMIT ?
                """
                params = [search_term, limit]

            cursor = self.db_manager.execute(query, params)
            entities = cursor.fetchall()

            # 解析JSON数据
            for entity in entities:
                if entity.get("data"):
                    try:
                        entity["data"] = json.loads(entity["data"])
                    except:
                        entity["data"] = {}

            return entities
        except Exception as e:
            print(f"搜索实体失败: {str(e)}")
            return []

    def count_entities_by_type(self):
        """统计各类型实体数量

        Returns:
            dict: 类型统计结果
        """
        query = """
        SELECT type, COUNT(*) as count
        FROM entities
        GROUP BY type
        """
        cursor = self.db_manager.execute(query)
        results = cursor.fetchall()

        # 转换为字典格式
        stats = {}
        for row in results:
            stats[row["type"]] = row["count"]

        return stats
 
    def create_entities_batch(self, entity_data_list):
        """批量创建实体记录

        Args:
            entity_data_list: 实体数据列表，每项为包含id, type, name, data的字典

        Returns:
            bool: 是否成功创建
        """
        if not entity_data_list:
            return True

        try:
            # 准备批量插入的数据
            values = []
            for entity_data in entity_data_list:
                entity_id = entity_data["id"]
                entity_type = entity_data["type"]
                name = entity_data["name"]
                data = entity_data["data"]

                # 将数据转换为JSON字符串
                data_json = json.dumps(data) if data else None
                timestamp = datetime.now().isoformat()

                values.append(
                    (entity_id, entity_type, name, data_json, timestamp, timestamp)
                )

            # 执行批量插入
            query = """
            INSERT OR IGNORE INTO entities 
            (id, type, name, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """

            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.executemany(query, values)
                conn.commit()

            return True

        except Exception as e:
            self.logger.error(f"批量创建实体记录时出错: {str(e)}")
            return False
