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

    def relationship_exists(
        self,
        source_id,
        target_id,
        relation_type=None,
        source_type="scholar",
        target_type="scholar",
    ):
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
            cursor = self.db_manager.execute(
                query, (source_id, target_id, source_type, target_type, relation_type)
            )
        else:
            query = """
            SELECT 1 FROM relationships 
            WHERE source_id = ? AND target_id = ?
            AND source_type = ? AND target_type = ?
            """
            cursor = self.db_manager.execute(
                query, (source_id, target_id, source_type, target_type)
            )

        result = cursor.fetchone()
        return result is not None

    def create_relationship(
        self,
        source_id,
        target_id,
        relation_type,
        weight=1,
        data=None,
        source_type="scholar",
        target_type="scholar",
        is_custom=False,
    ):
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
            if self.relationship_exists(
                source_id, target_id, relation_type, source_type, target_type
            ):
                # 已存在，更新权重
                return self.update_relationship_weight(
                    source_id,
                    target_id,
                    relation_type,
                    weight,
                    source_type,
                    target_type,
                )

            # 转换data为JSON字符串
            data_json = json.dumps(data) if data else None

            # 插入关系
            query = """
            INSERT INTO relationships (source_id, source_type, target_id, target_type, relation_type, weight, is_custom, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """

            self.db_manager.execute(
                query,
                (
                    source_id,
                    source_type,
                    target_id,
                    target_type,
                    relation_type,
                    weight,
                    1 if is_custom else 0,
                    data_json,
                ),
            )

            # 提交事务以确保数据被保存到数据库
            self.db_manager.commit()

            return True

        except Exception as e:
            self.logger.error(f"创建关系记录时出错: {str(e)}")
            # 发生错误时回滚事务
            self.db_manager.rollback()
            return False

    def update_relationship_weight(
        self,
        source_id,
        target_id,
        relation_type,
        weight_delta=1,
        source_type="scholar",
        target_type="scholar",
    ):
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

            self.db_manager.execute(
                query,
                (
                    weight_delta,
                    source_id,
                    target_id,
                    source_type,
                    target_type,
                    relation_type,
                ),
            )

            # 提交事务
            self.db_manager.commit()

            return True

        except Exception as e:
            self.logger.error(f"更新关系权重时出错: {str(e)}")
            # 回滚事务
            self.db_manager.rollback()
            return False

    def delete_relationship(
        self,
        source_id,
        target_id,
        relation_type,
        source_type="scholar",
        target_type="scholar",
    ):
        """删除实体关系

        Args:
            source_id: 源实体ID
            target_id: 目标实体ID
            relation_type: 关系类型
            source_type: 源实体类型，默认为scholar
            target_type: 目标实体类型，默认为scholar

        Returns:
            bool: 是否成功删除
        """
        try:
            query = """
            DELETE FROM relationships 
            WHERE source_id = ? AND target_id = ? 
            AND source_type = ? AND target_type = ?
            AND relation_type = ?
            """

            self.db_manager.execute(
                query, (source_id, target_id, source_type, target_type, relation_type)
            )

            # 提交事务
            self.db_manager.commit()

            return True

        except Exception as e:
            self.logger.error(f"删除关系记录时出错: {str(e)}")
            # 回滚事务
            self.db_manager.rollback()
            return False

    def get_scholar_relationsips(self, scholar_id, limit=1000, offset=0):
        """获取学者的合作者

        Args:
            scholar_id: 学者ID
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            list: 合作者列表，包含合作次数和学者ID
        """
        try:
            self.logger.info(f"获取学者 {scholar_id} 的合作者，限制: {limit}")

            # 获取所有与该学者关联的学者（全部边）
            query = """
            SELECT r.target_id as scholar_id, r.weight as collaboration_count, r.relation_type
            FROM relationships r
            WHERE r.source_id = ? 
            AND r.source_type = 'scholar'
            AND r.target_type = 'scholar'
            ORDER BY r.weight DESC
            """
            cursor = self.db_manager.execute(query, (scholar_id,))
            all_relations = cursor.fetchall()

            # 分组处理每个相关学者的所有关系类型
            target_relationships = {}
            for rel in all_relations:
                target_id = rel.get("scholar_id")
                if not target_id:
                    continue

                relation_type = rel.get("relation_type", "coauthor")
                weight = rel.get("collaboration_count", 1)

                if target_id not in target_relationships:
                    target_relationships[target_id] = {
                        "scholar_id": target_id,
                        "collaboration_count": weight,
                        "relation_type": relation_type,
                        "all_relation_types": [relation_type],
                    }
                else:
                    # 已存在这个学者，添加新的关系类型
                    target_relationships[target_id]["all_relation_types"].append(
                        relation_type
                    )

                    # 如果新的关系类型优先级更高，则更新主要关系类型
                    current_type = target_relationships[target_id]["relation_type"]
                    if self._get_relation_priority(
                        relation_type
                    ) < self._get_relation_priority(current_type):
                        target_relationships[target_id]["relation_type"] = relation_type

                    # 更新权重（取最大值）
                    if weight > target_relationships[target_id]["collaboration_count"]:
                        target_relationships[target_id]["collaboration_count"] = weight

            # 转换为列表，并按权重排序
            collaborators = list(target_relationships.values())
            collaborators.sort(key=lambda x: x["collaboration_count"], reverse=True)

            # 应用limit和offset
            collaborators = collaborators[offset : offset + limit]

            self.logger.info(
                f"找到 {len(collaborators)} 位与学者 {scholar_id} 相关的合作者"
            )

            # 检查结果
            if not collaborators:
                self.logger.warning(f"学者 {scholar_id} 没有关联的合作者")

            return collaborators

        except Exception as e:
            self.logger.error(f"获取学者合作者列表时出错: {e}")
            import traceback

            self.logger.error(traceback.format_exc())
            return []

    def _get_relation_priority(self, relation_type):
        """获取关系类型的优先级（数字越小优先级越高）

        Args:
            relation_type: 关系类型

        Returns:
            int: 优先级值
        """
        priorities = {"advisor": 1, "colleague": 2, "coauthor": 3}
        return priorities.get(relation_type, 999)  # 未知类型优先级最低

    def create_relationships_batch(self, relationship_data):
        """批量创建实体关系

        Args:
            relationship_data: 关系数据列表，每项为 (source_id, target_id, relation_type, weight) 元组

        Returns:
            bool: 是否成功创建
        """
        if not relationship_data:
            return True

        try:
            # 用于去重的集合，防止双向关系重复
            # 使用frozenset确保(A,B)和(B,A)被视为相同关系
            processed_pairs = set()

            # 准备批量插入的数据
            values = []
            for source_id, target_id, relation_type, weight in relationship_data:
                # 创建一个无序对表示这对关系
                relation_pair = frozenset([source_id, target_id])

                # 如果这对关系已经处理过，则跳过
                if relation_pair in processed_pairs and relation_type == "coauthor":
                    self.logger.debug(
                        f"跳过重复的合作者关系: {source_id} - {target_id}"
                    )
                    continue

                # 将关系对添加到已处理集合
                processed_pairs.add(relation_pair)

                # 源和目标类型默认为scholar
                source_type = "scholar"
                target_type = "scholar"
                is_custom = 0  # 默认为非自定义
                data_json = None

                # 添加到待插入数据
                values.append(
                    (
                        source_id,
                        source_type,
                        target_id,
                        target_type,
                        relation_type,
                        weight,
                        is_custom,
                        data_json,
                    )
                )

            # 如果没有有效的关系数据，直接返回成功
            if not values:
                return True

            # 执行批量插入
            query = """
            INSERT OR REPLACE INTO relationships 
            (source_id, source_type, target_id, target_type, relation_type, weight, is_custom, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """

            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.executemany(query, values)
                conn.commit()

            self.logger.info(f"成功批量创建 {len(values)} 条关系记录")
            return True

        except Exception as e:
            self.logger.error(f"批量创建关系记录时出错: {str(e)}")
            import traceback

            self.logger.error(traceback.format_exc())
            return False
