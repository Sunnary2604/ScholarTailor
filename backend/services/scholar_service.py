"""
学者服务类
处理与学者相关的业务逻辑
"""

import os
import json
import logging
import time
from datetime import datetime
from dao.scholar_dao import ScholarDao
from dao.entity_dao import EntityDao
from dao.interest_dao import InterestDao
from dao.publication_dao import PublicationDao
from dao.authorship_dao import AuthorshipDao
from dao.relationship_dao import RelationshipDao
from dao.institution_dao import InstitutionDao


class ScholarService:
    """学者服务类，处理学者相关业务逻辑"""

    def __init__(self, crawler=None):
        """初始化服务类

        Args:
            crawler: 爬虫实例(可选)，用于从外部获取学者信息
        """
        self.scholar_dao = ScholarDao()
        self.entity_dao = EntityDao()
        self.interest_dao = InterestDao()
        self.publication_dao = PublicationDao()
        self.authorship_dao = AuthorshipDao()
        self.relationship_dao = RelationshipDao()
        self.institution_dao = InstitutionDao()
        self.crawler = crawler
        self.logger = logging.getLogger(__name__)

        # 缓存已处理的实体ID和论文，避免重复处理
        self.processed_entities = set()
        self.processed_publications = set()

    def add_scholar_by_id(self, scholar_id):
        """通过ID添加学者

        Args:
            scholar_id: 学者ID

        Returns:
            dict: {'success': bool, 'scholar_id': str, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {"success": False, "error": "未配置爬虫，无法获取学者数据"}

            # 使用爬虫获取学者数据
            scholar_data = self.crawler.search_author_by_id(scholar_id)

            if not scholar_data:
                return {"success": False, "error": f'未找到ID为 "{scholar_id}" 的学者'}

            # 处理学者数据 - 使用新方法全面导入，设置为主要学者
            result = self._import_scholar_complete(
                scholar_id, scholar_data, is_main_scholar=1
            )

            if result["success"]:
                scholar_name = scholar_data.get("name", "Unknown")
                return {
                    "success": True,
                    "scholar_id": scholar_id,
                    "scholar_name": scholar_name,
                    "message": f"成功添加学者 {scholar_name}",
                }
            else:
                return {
                    "success": False,
                    "error": result.get("error", "导入学者数据失败"),
                }

        except Exception as e:
            self.logger.error(f"通过ID添加学者时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def add_scholar_by_name(self, name):
        """通过名称添加学者

        Args:
            name: 学者名称

        Returns:
            dict: {'success': bool, 'scholar_id': str, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {"success": False, "error": "未配置爬虫，无法获取学者数据"}

            # 使用爬虫获取学者数据
            scholar_data = self.crawler.search_author(name)

            if not scholar_data:
                return {"success": False, "error": f'未找到学者 "{name}"'}

            # 获取学者ID
            scholar_id = scholar_data.get("scholar_id")
            if not scholar_id:
                return {"success": False, "error": "获取的学者数据中缺少scholar_id"}

            # 处理学者数据 - 使用新方法全面导入，设置为主要学者
            result = self._import_scholar_complete(
                scholar_id, scholar_data, is_main_scholar=1
            )

            if result["success"]:
                scholar_name = scholar_data.get("name", name)
                return {
                    "success": True,
                    "scholar_id": scholar_id,
                    "scholar_name": scholar_name,
                    "message": f"成功添加学者 {scholar_name}",
                }
            else:
                return {
                    "success": False,
                    "error": result.get("error", "导入学者数据失败"),
                }

        except Exception as e:
            self.logger.error(f"通过名称添加学者时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def batch_add_scholars(self, names):
        """批量添加学者

        Args:
            names: 学者名称列表

        Returns:
            dict: {'success': bool, 'added': int, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {"success": False, "error": "未配置爬虫，无法获取学者数据"}

            # 批量爬取学者数据
            results = self.crawler.batch_search_authors(names)

            added_count = 0
            for scholar_data in results:
                try:
                    # 获取学者ID
                    scholar_id = scholar_data.get("scholar_id")
                    if not scholar_id:
                        continue

                    # 处理学者数据 - 使用新方法全面导入，设置为主要学者
                    result = self._import_scholar_complete(
                        scholar_id, scholar_data, is_main_scholar=1
                    )

                    if result["success"]:
                        added_count += 1

                except Exception as e:
                    self.logger.error(f"批量添加学者时处理单个学者出错: {str(e)}")
                    continue

            return {
                "success": added_count > 0,
                "added": added_count,
                "message": f"成功添加 {added_count}/{len(names)} 位学者",
            }

        except Exception as e:
            self.logger.error(f"批量添加学者时出错: {str(e)}")
            return {"success": False, "error": str(e), "added": 0}

    def _import_scholar_complete(self, scholar_id, scholar_data, is_main_scholar=None):
        """全面导入学者数据到所有相关表

        Args:
            scholar_id: 学者ID
            scholar_data: 爬取的学者数据
            is_main_scholar: 学者状态，为None时保持现有状态不变

        Returns:
            dict: {'success': bool, 'error': str}
        """
        try:
            # 提取学者名称和基本信息
            scholar_name = scholar_data.get("name", "Unknown Scholar")

            # 如果citations字段存在但citedby不存在，使用citations作为citedby
            if "citedby" not in scholar_data and "citations" in scholar_data:
                scholar_data["citedby"] = scholar_data["citations"]

            # 确保关键字段存在，即使为空值
            for field in ["homepage", "url_picture"]:
                if field not in scholar_data:
                    scholar_data[field] = ""

            # 1. 创建或更新学者详情记录
            create_result = self.scholar_dao.create_scholar(
                scholar_id, scholar_data, is_main_scholar=is_main_scholar
            )

            if not create_result:
                return {"success": False, "error": "创建/更新学者记录失败"}

            # 2. 创建学者实体
            entity_data = {
                "source": scholar_data.get("source", "google_scholar"),
                "filled": scholar_data.get("filled", True),
            }
            self.entity_dao.create_entity(
                id=scholar_id, type="scholar", name=scholar_name, data=entity_data
            )

            # 3. 添加兴趣标签
            interests = scholar_data.get("interests", [])
            # 先删除旧的兴趣标签
            self.interest_dao.delete_entity_interests(scholar_id)
            # 添加新的兴趣标签
            self.interest_dao.create_interests_batch(scholar_id, interests)

            # 4. 批量导入论文数据
            publications = scholar_data.get("publications", [])
            self.logger.info(
                f"准备导入 {len(publications)} 篇论文 - 学者: {scholar_name}"
            )

            # 批量处理论文数据
            if publications:
                # 预处理论文数据，过滤掉无效数据
                valid_publications = []
                for pub in publications:
                    # 确保pub有有效的title字段
                    # scholarly返回的数据结构中，title在bib子字典中
                    if not pub:
                        continue

                    # 确保bib字段存在
                    if "bib" not in pub:
                        pub["bib"] = {}

                    # 如果title在顶层，移动到bib中
                    if "title" in pub and "title" not in pub["bib"]:
                        pub["bib"]["title"] = pub["title"]

                    # 检查是否有标题
                    if not pub["bib"].get("title"):
                        continue

                    # 处理引用数据
                    if "num_citations" not in pub and "citedby" in pub:
                        pub["num_citations"] = pub["citedby"]

                    # 检查cites_id字段
                    if "cites_id" not in pub and "cluster_id" in pub:
                        pub["cites_id"] = [pub["cluster_id"]]
                    elif "cites_id" not in pub:
                        # 确保cites_id字段存在，即使为空列表
                        pub["cites_id"] = []

                    valid_publications.append(pub)

                # 批量导入论文数据
                imported_pub_count = self._batch_import_publications(
                    scholar_id, valid_publications
                )
            else:
                imported_pub_count = 0

            # 5. 批量导入合作者关系
            coauthors = scholar_data.get("coauthors", [])
            self.logger.info(
                f"准备导入 {len(coauthors)} 位合作者 - 学者: {scholar_name}"
            )

            # 批量处理合作者数据
            if coauthors:
                # 预处理合作者数据，过滤掉无效数据
                valid_coauthors = []
                for coauthor in coauthors:
                    if not coauthor or not coauthor.get("scholar_id"):
                        continue
                    valid_coauthors.append(coauthor)

                # 批量导入合作者数据
                imported_coauthor_count = self._batch_import_coauthors(
                    scholar_id, valid_coauthors
                )
            else:
                imported_coauthor_count = 0

            # 6. 处理机构信息
            try:
                # 获取学者的机构信息
                affiliation = scholar_data.get("affiliation", "")

                if affiliation:
                    # 生成机构ID (使用哈希值避免重复)
                    import hashlib

                    inst_id = f"inst_{hashlib.md5(affiliation.encode('utf-8')).hexdigest()[:12]}"

                    # 先检查机构是否已存在
                    if not self.institution_dao.get_institution_by_name(affiliation):
                        # 创建机构记录，地区、国家和类型暂时留空
                        self.institution_dao.create_institution(
                            inst_id=inst_id,
                            name=affiliation,
                            type=None,
                            url=None,
                            lab=None,
                        )
                    else:
                        # 获取已存在机构的ID
                        existing_inst = self.institution_dao.get_institution_by_name(
                            affiliation
                        )
                        if existing_inst:
                            inst_id = existing_inst.get("inst_id")

                    # 创建学者-机构关联
                    self.institution_dao.create_scholar_institution_relation(
                        scholar_id=scholar_id, inst_id=inst_id, is_current=True
                    )
            except Exception as inst_error:
                self.logger.error(f"处理机构信息错误: {str(inst_error)}")
                # 继续执行，不中断整个导入流程

            return {"success": True}

        except Exception as error:
            self.logger.error(f"导入学者数据时出错: {str(error)}")
            return {"success": False, "error": str(error)}

    def _batch_import_publications(self, scholar_id, publications):
        """批量导入论文数据

        Args:
            scholar_id: 学者ID
            publications: 论文数据列表

        Returns:
            int: 成功导入的论文数量
        """
        if not publications:
            return 0

        # 输出第一篇论文的详细结构，用于调试
        if publications and len(publications) > 0:
            self.logger.debug(
                f"第一篇论文结构: {json.dumps(publications[0], ensure_ascii=False)}"
            )

        # 初始化成功计数
        success_count = 0
        cites_ids = []

        # 第一步：逐个创建论文记录并收集cites_id
        for index, pub in enumerate(publications):
            try:
                self.logger.debug(f"处理第 {index+1}/{len(publications)} 篇论文")
                success, cites_id = self.publication_dao.create_publication(
                    pub, scholar_id
                )
                if success and cites_id:
                    cites_ids.append(cites_id)
                    success_count += 1
                    self.logger.debug(f"成功创建论文 {index+1}, cites_id: {cites_id}")
                else:
                    title = pub.get("bib", {}).get("title", "无标题")
                    self.logger.warning(f"无法创建论文记录 {index+1}: {title[:50]}...")
            except Exception as e:
                self.logger.error(f"处理单个论文记录时出错 (#{index+1}): {str(e)}")
                import traceback

                self.logger.error(traceback.format_exc())
                continue  # 继续处理下一篇论文

        self.logger.info(f"成功创建 {success_count}/{len(publications)} 篇论文记录")

        # 如果没有成功创建任何论文，返回
        if not cites_ids:
            self.logger.warning("没有成功创建任何论文记录，跳过创建作者关系")
            return success_count

        # 第二步：如果有成功创建的论文，创建作者关系
        # 创建批量插入的数据
        authorship_data = [(scholar_id, cites_id) for cites_id in cites_ids]
        self.logger.debug(f"准备创建 {len(authorship_data)} 条作者关系")

        try:
            # 使用正确的表名authorship
            success = self.authorship_dao.create_authorships_batch(authorship_data)
            if success:
                self.logger.info(f"成功批量创建 {len(authorship_data)} 条作者关系")
            else:
                self.logger.warning("批量创建作者关系失败，尝试逐个创建")
                # 如果批量操作失败，尝试逐个创建
                success_auth_count = 0
                for idx, cites_id in enumerate(cites_ids):
                    try:
                        if self.authorship_dao.create_authorship(scholar_id, cites_id):
                            success_auth_count += 1
                            if idx % 10 == 0 or idx == len(cites_ids) - 1:
                                self.logger.debug(
                                    f"已逐个创建 {success_auth_count}/{len(cites_ids)} 条作者关系"
                                )
                    except Exception as e:
                        self.logger.error(
                            f"单独创建作者关系时出错 (scholar_id: {scholar_id}, cites_id: {cites_id}): {str(e)}"
                        )
                self.logger.info(
                    f"逐个创建完成，成功: {success_auth_count}/{len(cites_ids)}"
                )
        except Exception as auth_error:
            self.logger.error(f"批量创建作者关系时出错: {str(auth_error)}")
            import traceback

            self.logger.error(traceback.format_exc())
            # 如果批量操作失败，尝试逐个创建
            success_auth_count = 0
            for cites_id in cites_ids:
                try:
                    if self.authorship_dao.create_authorship(scholar_id, cites_id):
                        success_auth_count += 1
                except Exception as e:
                    self.logger.error(
                        f"单独创建作者关系时出错 (scholar_id: {scholar_id}, cites_id: {cites_id}): {str(e)}"
                    )
            self.logger.info(
                f"通过单独创建，成功创建 {success_auth_count}/{len(cites_ids)} 条作者关系"
            )

        return success_count

    def _batch_import_coauthors(self, scholar_id, coauthors):
        """批量导入合作者关系

        Args:
            scholar_id: 学者ID
            coauthors: 合作者数据列表

        Returns:
            int: 成功导入的合作者数量
        """
        if not coauthors:
            return 0

        try:
            # 准备批量处理的数据
            coauthor_entity_data = []
            relationship_data = []

            # 第一步：处理每个合作者数据
            imported_count = 0
            for coauthor in coauthors:
                try:
                    coauthor_id = coauthor.get("scholar_id")
                    if not coauthor_id:
                        continue

                    coauthor_name = coauthor.get("name", "Unknown Scholar")

                    # 1. 创建合作者详情
                    self.scholar_dao.create_coauthor(coauthor_id, coauthor)

                    # 2. 准备实体数据
                    if not self.entity_dao.entity_exists(coauthor_id):
                        coauthor_entity_data.append(
                            {
                                "id": coauthor_id,
                                "type": "scholar",
                                "name": coauthor_name,
                                "data": {"is_coauthor": True},
                            }
                        )

                    # 3. 准备关系数据
                    weight = coauthor.get("co_authored_papers", 1)
                    relationship_data.append(
                        (scholar_id, coauthor_id, "coauthor", weight)
                    )
                    relationship_data.append(
                        (coauthor_id, scholar_id, "coauthor", weight)
                    )

                    imported_count += 1
                except Exception as e:
                    self.logger.error(
                        f"处理合作者 {coauthor.get('name', 'unknown')} 时出错: {str(e)}"
                    )
                    continue

            # 第二步：批量创建实体
            if coauthor_entity_data:
                self.entity_dao.create_entities_batch(coauthor_entity_data)

            # 第三步：批量创建关系
            if relationship_data:
                self.relationship_dao.create_relationships_batch(relationship_data)

            return imported_count
        except Exception as e:
            self.logger.error(f"批量导入合作者时出错: {str(e)}")
            return 0

    def update_scholar(self, scholar_id, data=None):
        """获取并更新学者的详细信息

        支持三种场景：
        1. 只传入scholar_id：爬取新数据并设置为主要学者
        2. 传入scholar_id和data包含is_main_scholar：直接更新学者状态
        3. 传入scholar_id和is_main_scholar单独参数：专门用于状态更新

        Args:
            scholar_id: 学者ID
            data: 可选，包含要更新的字段，如is_main_scholar

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 获取学者当前信息
            scholar = self.scholar_dao.get_scholar_by_id(scholar_id)
            if not scholar:
                return {"success": False, "error": f"未找到该学者记录"}

            # 获取学者实体信息以获取名称
            entity = self.entity_dao.get_entity_by_id(scholar_id)
            if not entity:
                return {"success": False, "error": f"未找到该学者的实体记录"}

            # 获取scholar_name
            scholar_name = entity.get("name", "")
            if not scholar_name:
                return {"success": False, "error": "无法确定学者名称"}

            # 特殊处理：如果data是整数值，则它是is_main_scholar参数
            # 这样支持直接调用update_scholar(scholar_id, 1)来设置为主要学者
            is_main_scholar = None
            if isinstance(data, int) and data in [0, 1, 2]:
                is_main_scholar = data
                data = {}  # 重置data为空字典
                self.logger.info(
                    f"直接更新学者 {scholar_name} 的状态为 {is_main_scholar}"
                )
            elif data and "is_main_scholar" in data:
                is_main_scholar = data.get("is_main_scholar")
                self.logger.info(f"从data中提取状态更新: {is_main_scholar}")

            # 场景：更新状态
            if is_main_scholar is not None:
                # 检查状态值
                if is_main_scholar not in [0, 1, 2]:
                    return {
                        "success": False,
                        "error": f"无效的学者状态值: {is_main_scholar}，有效值为0、1或2",
                    }

                # 获取当前状态
                current_status = scholar.get("is_main_scholar", 0)

                # 如果状态没有变化，直接返回成功
                if current_status == is_main_scholar:
                    return {
                        "success": True,
                        "message": f"学者状态未发生变化，保持为 {is_main_scholar}",
                    }

                # 更新学者状态
                result = self.scholar_dao.update_scholar(
                    scholar_id, {}, is_main_scholar
                )

                if result:
                    status_text = {0: "关联学者", 1: "主要学者", 2: "不感兴趣"}.get(
                        is_main_scholar, "未知状态"
                    )
                    return {
                        "success": True,
                        "message": f"已将学者标记为{status_text}",
                    }
                else:
                    return {"success": False, "error": "更新学者状态失败"}

            # 场景：爬取新数据并设置为主要学者
            if data is None:
                if not self.crawler:
                    return {"success": False, "error": "未配置爬虫，无法获取学者数据"}

                self.logger.info(f"爬取学者 {scholar_name} 的新数据并转为主要学者")

                # 优先使用ID直接获取学者数据
                updated_data = self.crawler.search_author_by_id(scholar_id)

                # 如果使用ID获取失败，则尝试使用名称
                if not updated_data:
                    updated_data = self.crawler.search_author(scholar_name)

                if not updated_data:
                    return {"success": False, "error": f"重新爬取学者数据失败"}

                # 使用完整导入方法更新学者数据，设置为主要学者(is_main_scholar=1)
                result = self._import_scholar_complete(
                    scholar_id, updated_data, is_main_scholar=1
                )

                if result["success"]:
                    return {
                        "success": True,
                        "message": f"成功更新学者数据并设置为主要学者",
                    }
                else:
                    return {"success": False, "error": result.get("error", "更新失败")}

            # 如果执行到这里，说明没有特定操作，返回成功但没有变化
            return {"success": True, "message": "学者数据未发生变化"}

        except Exception as e:
            self.logger.error(f"更新学者信息错误: {str(e)}")
            import traceback

            self.logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    def refresh_all_scholars(self, keep_custom=True):
        """刷新所有学者数据

        Args:
            keep_custom: 是否保留自定义关系

        Returns:
            dict: {'success': bool, 'updated': int, 'message': str, 'error': str}
        """
        try:
            if not self.crawler:
                return {"success": False, "error": "未配置爬虫，无法获取学者数据"}

            # 获取所有学者
            scholars = self.scholar_dao.get_main_scholars(limit=1000)
            updated_count = 0

            for scholar in scholars:
                try:
                    scholar_id = scholar.get("scholar_id")
                    if not scholar_id:
                        continue

                    # 更新学者
                    update_result = self.update_scholar(scholar_id)
                    if update_result["success"]:
                        updated_count += 1

                    # 避免过快请求
                    time.sleep(2)
                except Exception as e:
                    self.logger.error(
                        f"更新学者 {scholar.get('name', '未知')} 时出错: {str(e)}"
                    )
                    continue

            return {
                "success": True,
                "updated": updated_count,
                "message": f"成功更新 {updated_count} 位学者的数据",
            }

        except Exception as e:
            self.logger.error(f"刷新所有学者数据时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def update_custom_fields(self, scholar_id, custom_fields):
        """更新学者自定义字段

        Args:
            scholar_id: 学者ID
            custom_fields: 自定义字段字典

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 获取学者实体信息
            entity = self.entity_dao.get_entity_by_id(scholar_id)
            if not entity:
                return {"success": False, "error": "未找到指定学者"}

            # 获取当前实体数据
            current_data = entity.get("data", {})
            if isinstance(current_data, str):
                try:
                    current_data = json.loads(current_data)
                except:
                    current_data = {}

            # 更新自定义字段
            if "custom_fields" not in current_data:
                current_data["custom_fields"] = {}

            for key, value in custom_fields.items():
                current_data["custom_fields"][key] = value

            # 更新实体数据
            self.entity_dao.update_entity(scholar_id, data=current_data)

            return {"success": True, "message": "成功更新自定义字段"}

        except Exception as e:
            self.logger.error(f"更新学者自定义字段时出错: {str(e)}")
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

            return {"success": True, "message": "成功更新标签"}

        except Exception as e:
            self.logger.error(f"更新学者标签时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_scholar_by_id(self, scholar_id):
        """根据ID获取学者信息

        Args:
            scholar_id: 学者ID

        Returns:
            dict: {'success': bool, 'scholar': dict, 'error': str}
        """
        try:
            self.logger.info(f"获取学者信息 ID: {scholar_id}")

            # 从数据库获取学者基本信息
            scholar_data = self.scholar_dao.get_scholar_by_id(scholar_id)

            if not scholar_data:
                self.logger.warning(f"未找到ID为 {scholar_id} 的学者")
                return {"success": False, "error": f'未找到ID为 "{scholar_id}" 的学者'}

            # 获取学者实体信息（名称等）
            entity_data = self.entity_dao.get_entity_by_id(scholar_id)
            self.logger.debug(f"学者实体数据: {entity_data}")

            # 合并实体数据和学者数据
            if entity_data:
                for key, value in entity_data.items():
                    if key not in scholar_data:
                        scholar_data[key] = value

            # 处理实体的custom_fields数据
            if entity_data and "data" in entity_data:
                entity_json_data = entity_data["data"]
                if isinstance(entity_json_data, str):
                    try:
                        entity_json_data = json.loads(entity_json_data)
                    except json.JSONDecodeError:
                        self.logger.error(f"解析实体JSON数据失败: {entity_json_data}")
                        entity_json_data = {}

                # 确保custom_fields存在
                if (
                    "custom_fields" in entity_json_data
                    and entity_json_data["custom_fields"]
                ):
                    scholar_data["custom_fields"] = entity_json_data["custom_fields"]
                    self.logger.debug(
                        f"学者自定义字段: {scholar_data['custom_fields']}"
                    )

            # 获取学者的兴趣领域和自定义标签
            interests = self.interest_dao.get_entity_interests(scholar_id)
            self.logger.debug(f"学者兴趣和标签: {interests}")

            if interests:
                # 将interests对象列表转换为字符串列表，区分普通兴趣和自定义标签(is_custom=1)
                regular_interests = []
                custom_tags = []

                for interest in interests:
                    interest_text = interest.get("interest")
                    if not interest_text:
                        continue

                    is_custom = interest.get("is_custom")
                    self.logger.debug(
                        f"兴趣/标签: {interest_text}, 是否自定义: {is_custom}"
                    )

                    if is_custom == 1:
                        custom_tags.append(interest_text)
                    else:
                        regular_interests.append(interest_text)

                scholar_data["interests"] = regular_interests
                scholar_data["tags"] = custom_tags

                self.logger.info(f"学者 {scholar_id} 的兴趣标签: {regular_interests}")
                self.logger.info(f"学者 {scholar_id} 的自定义标签: {custom_tags}")
            else:
                scholar_data["interests"] = []
                scholar_data["tags"] = []
                self.logger.warning(f"学者 {scholar_id} 没有兴趣或标签数据")

            # 设置nodeType
            scholar_data["nodeType"] = (
                "primary" if scholar_data.get("is_main_scholar") else "secondary"
            )

            # 获取学者发表的论文
            try:
                self.logger.info(f"获取学者 {scholar_id} 的论文列表")
                # 增加获取数量，并确保按引用次数降序排序
                publications = self.publication_dao.get_publications_by_scholar(
                    scholar_id, limit=50
                )

                self.logger.info(
                    f"为学者 {scholar_id} 获取到 {len(publications) if publications else 0} 篇论文"
                )

                # 按照引用次数手动排序（以防SQL排序未生效）
                if publications:
                    publications = sorted(
                        publications,
                        key=lambda x: x.get("num_citations", 0) or 0,
                        reverse=True,
                    )

                # 格式化论文数据
                if publications:
                    formatted_publications = []
                    for pub in publications:
                        # 检查必要字段是否存在
                        if not pub.get("title"):
                            self.logger.warning(f"论文缺少标题: {pub}")
                            continue

                        formatted_pub = {
                            "title": pub.get("title", ""),
                            "year": pub.get("year", ""),
                            "venue": pub.get("venue", ""),
                            "citedby": pub.get("num_citations", 0),
                            "citations": pub.get("num_citations", 0),
                            "citation_text": pub.get("citation_text", ""),
                            "cites_id": pub.get("cites_id", ""),
                        }
                        formatted_publications.append(formatted_pub)

                    scholar_data["publications"] = formatted_publications
                    self.logger.debug(
                        f"格式化后的论文列表: {formatted_publications[:2]}..."
                    )
                else:
                    scholar_data["publications"] = []
                    self.logger.warning(f"学者 {scholar_id} 没有有效的论文数据")
            except Exception as pub_error:
                self.logger.error(f"获取学者论文信息时出错: {str(pub_error)}")
                import traceback

                self.logger.error(traceback.format_exc())
                scholar_data["publications"] = []  # 出错时设置为空列表

            # 获取相关学者（合作者）
            try:
                self.logger.info(f"获取学者 {scholar_id} 的合作者列表")
                collaborators = self.relationship_dao.get_scholar_relationsips(
                    scholar_id, limit=100
                )
                self.logger.info(
                    f"为学者 {scholar_id} 获取到 {len(collaborators) if collaborators else 0} 位合作者"
                )

                if collaborators:
                    related_scholars = []
                    for collab in collaborators:
                        # 获取合作者基本信息
                        collab_id = collab.get("scholar_id")
                        if not collab_id:
                            self.logger.warning(f"合作者数据中缺少scholar_id: {collab}")
                            continue

                        collab_entity = self.entity_dao.get_entity_by_id(collab_id)
                        if not collab_entity:
                            self.logger.warning(f"找不到合作者实体数据: {collab_id}")
                            continue

                        # 添加合作次数信息到关系描述中
                        relationship_type = "合作者"
                        weight = collab.get("collaboration_count", 1)
                        if weight > 1:
                            relationship_type = f"合作者 ({weight}篇合著论文)"

                        related_scholar = {
                            "id": collab_id,
                            "name": collab_entity.get("name", "未知学者"),
                            "relationship": relationship_type,
                            "weight": weight,
                        }
                        related_scholars.append(related_scholar)

                    # 按合作次数降序排序
                    related_scholars.sort(
                        key=lambda x: x.get("weight", 0), reverse=True
                    )
                    scholar_data["related_scholars"] = related_scholars
                    self.logger.debug(
                        f"格式化后的相关学者列表: {related_scholars[:3]}..."
                    )
                else:
                    scholar_data["related_scholars"] = []
                    self.logger.warning(f"学者 {scholar_id} 没有相关学者数据")
            except Exception as rel_error:
                self.logger.error(f"获取相关学者时出错: {str(rel_error)}")
                import traceback

                self.logger.error(traceback.format_exc())
                scholar_data["related_scholars"] = []  # 出错时设置为空列表

            # 确保citations字段存在
            if "citedby" in scholar_data and "citations" not in scholar_data:
                scholar_data["citations"] = scholar_data["citedby"]
            elif "citations" in scholar_data and "citedby" not in scholar_data:
                scholar_data["citedby"] = scholar_data["citations"]

            # 日志记录结果
            self.logger.info(f"成功获取学者 {scholar_id} 的信息")
            self.logger.debug(f"学者信息包含字段: {list(scholar_data.keys())}")
            return {"success": True, "scholar": scholar_data}

        except Exception as e:
            self.logger.error(f"获取学者信息时出错: {str(e)}")
            import traceback

            self.logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    def convert_to_main_scholar(self, scholar_id):
        """将学者转换为主要学者

        Args:
            scholar_id: 学者ID

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 直接调用更新函数，将学者设为主要学者(is_main_scholar=1)
            return self.update_scholar(scholar_id, 1)
        except Exception as e:
            self.logger.error(f"将学者转换为主要学者时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def remove_scholar_tag(self, scholar_id, tag):
        """删除学者标签

        Args:
            scholar_id: 学者ID
            tag: 要删除的标签

        Returns:
            dict: {'success': bool, 'error': str, 'tags': list}
        """
        try:
            if not scholar_id or not tag:
                return {"success": False, "error": "缺少必要参数"}

            # 检查学者是否存在
            if not self.scholar_dao.scholar_exists(scholar_id):
                return {"success": False, "error": f"学者 {scholar_id} 不存在"}

            # 删除标签
            if not self.interest_dao.delete_interest(scholar_id, tag):
                return {"success": False, "error": "删除标签失败"}

            # 获取更新后的标签列表
            interests_data = self.interest_dao.get_entity_interests(scholar_id)
            tags = [item["interest"] for item in interests_data if item["is_custom"] == 1]

            # 返回成功结果和更新后的标签列表
            return {"success": True, "tags": tags}

        except Exception as e:
            error_msg = f"删除学者标签时出错: {str(e)}"
            self.logger.error(error_msg)
            return {"success": False, "error": error_msg}
