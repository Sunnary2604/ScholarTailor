"""
兴趣标签服务类
处理与学者兴趣标签相关的业务逻辑
"""

import json
import logging
import os
from dao.interest_dao import InterestDao
from dao.entity_dao import EntityDao
from dao.scholar_dao import ScholarDao


class InterestService:
    """兴趣标签服务类，处理学者标签相关业务逻辑"""

    def __init__(self, scholars_dir=None, custom_data_file=None):
        """初始化服务类

        Args:
            scholars_dir: 学者数据目录(可选)
            custom_data_file: 自定义数据文件路径(可选)
        """
        self.interest_dao = InterestDao()
        self.entity_dao = EntityDao()
        self.scholar_dao = ScholarDao()
        self.scholars_dir = scholars_dir
        self.custom_data_file = custom_data_file
        self.logger = logging.getLogger(__name__)

        # 加载自定义数据
        self.custom_data = self._load_custom_data()

    def _load_custom_data(self):
        """加载自定义数据

        Returns:
            dict: 自定义数据字典
        """
        if not self.custom_data_file or not os.path.exists(self.custom_data_file):
            return {"scholars": {}}

        try:
            with open(self.custom_data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"加载自定义数据失败: {str(e)}")
            return {"scholars": {}}

    def _save_custom_data(self):
        """保存自定义数据

        Returns:
            bool: 是否成功保存
        """
        if not self.custom_data_file:
            return False

        try:
            with open(self.custom_data_file, "w", encoding="utf-8") as f:
                json.dump(self.custom_data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            self.logger.error(f"保存自定义数据失败: {str(e)}")
            return False

    def add_scholar_tag(self, scholar_id, tag):
        """添加单个学者标签

        Args:
            scholar_id: 学者ID
            tag: 要添加的标签

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 检查学者是否存在
            if not self.scholar_dao.scholar_exists(scholar_id):
                return {"success": False, "error": "未找到指定学者"}

            # 获取当前标签
            current_interests = self.interest_dao.get_entity_interests(scholar_id)
            current_tags = []

            for interest in current_interests:
                if interest.get("is_custom", 0) == 1:
                    current_tags.append(interest.get("interest", ""))

            # 检查标签是否已存在
            if tag in current_tags:
                return {"success": True, "message": "标签已存在，无需添加"}

            # 添加新标签
            self.interest_dao.create_interest(scholar_id, tag, is_custom=True)

            # 更新实体数据
            entity = self.entity_dao.get_entity_by_id(scholar_id)
            if entity:
                current_data = entity.get("data", {})
                if isinstance(current_data, str):
                    try:
                        current_data = json.loads(current_data)
                    except:
                        current_data = {}

                if "custom_fields" not in current_data:
                    current_data["custom_fields"] = {}

                # 更新标签列表
                current_tags.append(tag)
                current_data["custom_fields"]["tags"] = ",".join(current_tags)
                self.entity_dao.update_entity(scholar_id, data=current_data)

            # 同时更新自定义数据
            if "scholars" not in self.custom_data:
                self.custom_data["scholars"] = {}

            if scholar_id not in self.custom_data["scholars"]:
                self.custom_data["scholars"][scholar_id] = {}

            if "custom_fields" not in self.custom_data["scholars"][scholar_id]:
                self.custom_data["scholars"][scholar_id]["custom_fields"] = {}

            self.custom_data["scholars"][scholar_id]["custom_fields"]["tags"] = (
                ",".join(current_tags)
            )
            self._save_custom_data()

            return {"success": True, "message": "成功添加标签", "tags": current_tags}

        except Exception as e:
            self.logger.error(f"添加学者标签时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def update_scholar_tags(self, scholar_id, tags):
        """更新学者标签

        Args:
            scholar_id: 学者ID
            tags: 标签列表

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 检查学者是否存在
            if not self.scholar_dao.scholar_exists(scholar_id):
                return {"success": False, "error": "未找到指定学者"}

            # 清除旧标签
            old_interests = self.interest_dao.get_entity_interests(scholar_id)
            for interest in old_interests:
                if interest.get("is_custom", 0) == 1:  # 只删除自定义标签
                    self.interest_dao.delete_interest(
                        scholar_id, interest.get("interest", "")
                    )

            # 添加新标签
            for tag in tags:
                self.interest_dao.create_interest(scholar_id, tag, is_custom=True)

            # 更新实体数据
            entity = self.entity_dao.get_entity_by_id(scholar_id)
            if entity:
                current_data = entity.get("data", {})
                if isinstance(current_data, str):
                    try:
                        current_data = json.loads(current_data)
                    except:
                        current_data = {}

                if "custom_fields" not in current_data:
                    current_data["custom_fields"] = {}

                current_data["custom_fields"]["tags"] = ",".join(tags)
                self.entity_dao.update_entity(scholar_id, data=current_data)

            # 同时更新自定义数据
            if "scholars" not in self.custom_data:
                self.custom_data["scholars"] = {}

            if scholar_id not in self.custom_data["scholars"]:
                self.custom_data["scholars"][scholar_id] = {}

            if "custom_fields" not in self.custom_data["scholars"][scholar_id]:
                self.custom_data["scholars"][scholar_id]["custom_fields"] = {}

            self.custom_data["scholars"][scholar_id]["custom_fields"]["tags"] = (
                ",".join(tags)
            )
            self._save_custom_data()

            return {"success": True, "message": "成功更新标签"}

        except Exception as e:
            self.logger.error(f"更新学者标签时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_top_interests(self, entity_type="scholar", limit=20):
        """获取最热门的兴趣标签

        Args:
            entity_type: 实体类型
            limit: 返回数量限制

        Returns:
            list: 兴趣标签及计数列表
        """
        try:
            interests = self.interest_dao.get_top_interests(entity_type, limit)
            return interests
        except Exception as e:
            self.logger.error(f"获取热门标签时出错: {str(e)}")
            return []

    def get_scholars_by_interest(self, interest, limit=100, offset=0):
        """根据兴趣标签获取学者

        Args:
            interest: 兴趣标签
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            list: 学者列表
        """
        try:
            scholars = self.interest_dao.get_scholars_by_interest(
                interest, limit, offset
            )
            return scholars
        except Exception as e:
            self.logger.error(f"根据标签获取学者时出错: {str(e)}")
            return []
