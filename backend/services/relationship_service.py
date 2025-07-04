"""
关系服务类
处理与实体间关系相关的业务逻辑
"""

import json
import logging
from datetime import datetime
from dao.relationship_dao import RelationshipDao
from dao.entity_dao import EntityDao


class RelationshipService:
    """关系服务类，处理实体关系相关业务逻辑"""

    def __init__(self, custom_relationships_file=None):
        """初始化服务类

        Args:
            custom_relationships_file: 自定义关系文件路径(不再使用)
        """
        self.relationship_dao = RelationshipDao()
        self.entity_dao = EntityDao()
        self.logger = logging.getLogger(__name__)

    def add_relationship(self, source_id, target_id, relation_type, is_custom=True):
        """添加关系

        Args:
            source_id: 源实体ID
            target_id: 目标实体ID
            relation_type: 关系类型
            is_custom: 是否为自定义关系

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 验证源实体和目标实体是否存在
            source_entity = self.entity_dao.get_entity_by_id(source_id)
            if not source_entity:
                return {"success": False, "error": f"源实体不存在: {source_id}"}

            target_entity = self.entity_dao.get_entity_by_id(target_id)
            if not target_entity:
                return {"success": False, "error": f"目标实体不存在: {target_id}"}

            # 创建关系元数据
            metadata = {"is_custom": is_custom, "created": datetime.now().isoformat()}

            # 直接使用DAO将关系添加到数据库
            result = self.relationship_dao.create_relationship(
                source_id,
                target_id,
                relation_type,
                weight=1,
                data=metadata,
                is_custom=is_custom,
            )

            if result:
                self.logger.info(
                    f"成功添加关系: {source_id} -> {target_id}, 类型: {relation_type}"
                )
                return {"success": True, "message": "成功添加关系"}
            else:
                self.logger.warning(
                    f"添加关系失败: {source_id} -> {target_id}, 类型: {relation_type}"
                )
                return {"success": False, "error": "添加关系失败，可能是关系已存在"}

        except Exception as e:
            self.logger.error(f"添加关系时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def delete_relationships_batch(self, relations_to_delete):
        """批量删除关系

        Args:
            relations_to_delete: 要删除的关系列表，每个关系应包含source_id, target_id, type字段

        Returns:
            dict: {'success': bool, 'deleted': int, 'skipped': int, 'message': str, 'error': str}
        """
        try:
            deleted_count = 0
            skipped_count = 0

            for del_rel in relations_to_delete:
                relation_type = del_rel.get("type")
                # 跳过coauthor类型关系，不允许删除
                if relation_type == "coauthor":
                    skipped_count += 1
                    continue

                # 直接从数据库中删除
                result = self.relationship_dao.delete_relationship(
                    del_rel.get("source_id"),
                    del_rel.get("target_id"),
                    relation_type,
                )

                if result:
                    deleted_count += 1

            # 生成结果消息，包含跳过的数量信息
            message = f"成功删除 {deleted_count} 个关系"
            if skipped_count > 0:
                message += f"，跳过 {skipped_count} 个合作者关系（不允许删除）"

            return {
                "success": deleted_count > 0 or skipped_count > 0,
                "deleted": deleted_count,
                "skipped": skipped_count,
                "message": message,
            }

        except Exception as e:
            self.logger.error(f"批量删除关系时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def delete_relationship(self, source_id, target_id, relation_type):
        """删除单个关系

        Args:
            source_id: 源实体ID
            target_id: 目标实体ID
            relation_type: 关系类型

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 不允许删除coauthor类型的关系
            if relation_type == "coauthor":
                self.logger.warning(
                    f"尝试删除coauthor关系被拒绝: {source_id} -> {target_id}"
                )
                return {"success": False, "error": "不允许删除合作者关系"}

            # 检查关系是否存在
            if not self.relationship_dao.relationship_exists(
                source_id, target_id, relation_type
            ):
                return {"success": False, "error": "指定的关系不存在"}

            # 执行删除操作
            result = self.relationship_dao.delete_relationship(
                source_id, target_id, relation_type
            )

            if result:
                self.logger.info(
                    f"成功删除关系: {source_id} -> {target_id}, 类型: {relation_type}"
                )
                return {"success": True, "message": "成功删除关系"}
            else:
                self.logger.warning(
                    f"删除关系失败: {source_id} -> {target_id}, 类型: {relation_type}"
                )
                return {"success": False, "error": "删除关系失败"}

        except Exception as e:
            self.logger.error(f"删除关系时出错: {str(e)}")
            return {"success": False, "error": str(e)}
