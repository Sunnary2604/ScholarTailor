"""
数据服务类
处理数据初始化、重新生成和管理相关的业务逻辑
"""

import os
import json
import logging
from db.db_manager import DBManager
from dao.entity_dao import EntityDao
from dao.scholar_dao import ScholarDao
from dao.publication_dao import PublicationDao
from dao.relationship_dao import RelationshipDao
from dao.authorship_dao import AuthorshipDao
from dao.institution_dao import InstitutionDao
from dao.interest_dao import InterestDao
from utils.data_importer import import_all_scholar_files, ScholarImporter


class DataService:
    """数据服务类，处理数据初始化和再生成相关业务逻辑"""

    def __init__(
        self, db_manager=None, scholars_dir=None, db_path=None, output_file=None
    ):
        """初始化服务类

        Args:
            db_manager: 数据库管理器实例，如果为None则创建新实例
            scholars_dir: 学者数据目录
            db_path: 数据库文件路径
            output_file: 网络数据输出文件路径
        """
        self.db_manager = db_manager or DBManager()
        self.scholars_dir = scholars_dir
        self.db_path = db_path
        self.output_file = output_file
        self.logger = logging.getLogger(__name__)

        # 初始化各DAO对象
        self.entity_dao = EntityDao()
        self.scholar_dao = ScholarDao()
        self.publication_dao = PublicationDao()
        self.relationship_dao = RelationshipDao()
        self.authorship_dao = AuthorshipDao()
        self.institution_dao = InstitutionDao()
        self.interest_dao = InterestDao()

    def initialize_database(self, force_reload=False):
        """初始化数据库

        Args:
            force_reload: 是否强制重新加载数据，默认False

        Returns:
            dict: {'success': bool, 'message': str, 'error': str}
        """
        try:
            # 检查数据库中是否已有数据
            cursor = self.db_manager.execute("SELECT COUNT(*) as count FROM entities")
            result = cursor.fetchone()
            has_data = result and result["count"] > 0

            # 如果已有数据且不强制重载，则跳过
            if has_data and not force_reload:
                return {
                    "success": True,
                    "message": "数据库已包含数据，跳过初始化",
                    "data_exists": True,
                }

            # 清空数据库表
            clear_success = self._clear_database_tables()
            if not clear_success:
                return {"success": False, "error": "清空数据库失败"}

            # 导入JSON数据到数据库
            if self.scholars_dir and os.path.exists(self.scholars_dir):
                success_count, total_count = import_all_scholar_files(
                    data_dir=self.scholars_dir, db_path=self.db_path
                )

                if success_count > 0:
                    return {
                        "success": True,
                        "message": f"数据库已成功初始化，导入了{success_count}/{total_count}个学者文件",
                    }
                else:
                    return {
                        "success": False,
                        "error": f"数据库已清空，但未能成功导入任何学者数据",
                    }
            else:
                return {
                    "success": True,
                    "message": "数据库已成功清空，未指定学者数据目录进行导入",
                }

        except Exception as e:
            self.logger.error(f"初始化数据库失败: {str(e)}")
            return {"success": False, "error": str(e)}

    def _clear_database_tables(self):
        """清空数据库中的所有表"""
        connection = None
        try:
            # 获取新的连接而不是使用全局实例
            if self.db_path:
                import sqlite3

                connection = sqlite3.connect(self.db_path)
                connection.row_factory = sqlite3.Row
            else:
                connection = self.db_manager.get_connection()

            cursor = connection.cursor()

            # 关闭外键约束
            cursor.execute("PRAGMA foreign_keys=OFF;")

            # 开始事务
            cursor.execute("BEGIN TRANSACTION;")

            # 获取所有表名
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()

            # 清空每个表
            for table in tables:
                table_name = table[0]
                if table_name != "sqlite_sequence":  # 跳过系统表
                    try:
                        cursor.execute(f"DELETE FROM {table_name};")
                        self.logger.info(f"清空表: {table_name}")
                    except Exception as e:
                        self.logger.warning(f"清空表 {table_name} 时出错: {str(e)}")

            # 重置自增ID
            cursor.execute("DELETE FROM sqlite_sequence;")

            # 重新开启外键约束
            cursor.execute("PRAGMA foreign_keys=ON;")

            # 提交更改
            connection.commit()
            self.logger.info("所有表已清空")

            return True
        except Exception as e:
            self.logger.error(f"清空数据库表时出错: {str(e)}")
            if connection:
                try:
                    connection.rollback()
                except Exception:
                    pass
            return False
        finally:
            # 如果我们创建了新连接，关闭它
            if connection and self.db_path:
                try:
                    connection.close()
                except Exception:
                    pass

    def regenerate_network_data(self):
        """重新生成网络数据"""
        try:
            # 生成数据
            data = self.generate_data()

            # 写入到数据文件
            with open(self.output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            return {"success": True, "message": "成功重新生成网络数据"}

        except Exception as e:
            self.logger.error(f"重新生成网络数据时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_network_data(self, hide_not_interested=True):
        """从数据库获取网络数据

        Args:
            hide_not_interested: 是否隐藏不感兴趣的学者，默认为True

        Returns:
            dict: {'success': bool, 'data': dict, 'error': str}
                  data格式与data.json相同，包含nodes和edges
        """
        try:
            # 直接从数据库获取数据，而不是生成文件
            data = self.generate_data(hide_not_interested=hide_not_interested)

            return {"success": True, "data": data}

        except Exception as e:
            self.logger.error(f"获取网络数据时出错: {str(e)}")
            return {"success": False, "error": str(e)}

    def generate_data(self, hide_not_interested=True):
        """生成网络数据

        Args:
            hide_not_interested: 是否隐藏不感兴趣的学者，默认为True

        Returns:
            dict: 包含nodes和edges的网络数据
        """
        try:
            # 创建缓存字典，记录学者是否不感兴趣
            not_interested_scholars = {}

            # 获取所有主要学者
            main_scholars = self.scholar_dao.get_main_scholars()
            if not main_scholars:
                self.logger.warning("未找到任何主要学者数据")
                return {"success": False, "error": "未找到任何主要学者数据"}

            # 过滤掉不感兴趣的学者（如果需要）
            filtered_scholars = []
            for scholar in main_scholars:
                if hide_not_interested and scholar.get("is_main_scholar") == 2:
                    self.logger.info(f"跳过不感兴趣学者: {scholar['scholar_id']}")
                    not_interested_scholars[scholar["scholar_id"]] = True
                    continue
                filtered_scholars.append(scholar)

            if not filtered_scholars:
                self.logger.warning("过滤后没有任何主要学者数据")
                return {"success": False, "error": "过滤后没有任何主要学者数据"}

            main_scholars = filtered_scholars

            # 生成主要学者节点列表
            nodes = []
            main_scholar_ids = set()

            # 处理主要学者
            for scholar in main_scholars:
                try:
                    # 获取学者的实体信息
                    entity = self.entity_dao.get_entity_by_id(scholar["scholar_id"])
                    if not entity:
                        self.logger.warning(
                            f"未找到学者ID {scholar['scholar_id']} 的实体信息"
                        )
                        continue

                    # 检查实体数据是否完整
                    if "name" not in entity:
                        self.logger.warning(
                            f"学者ID {scholar['scholar_id']} 的实体信息缺少name字段"
                        )
                        continue

                    # 获取学者兴趣标签
                    interests = self.interest_dao.get_entity_interests(
                        scholar["scholar_id"]
                    )

                    # 创建节点
                    node = {
                        "id": scholar["scholar_id"],
                        "label": entity["name"],
                        "group": "primary",
                        "data": {
                            "id": scholar["scholar_id"],
                            "name": entity["name"],
                            "affiliation": scholar.get("affiliation", ""),
                            "interests": (
                                [i["interest"] for i in interests] if interests else []
                            ),
                            "scholar_id": scholar["scholar_id"],
                            "is_secondary": False,
                            "citedby": scholar.get("citedby", 0),
                            "hindex": scholar.get("hindex", 0),
                            "i10index": scholar.get("i10index", 0),
                            "url_picture": scholar.get("url_picture", ""),
                            "homepage": scholar.get("homepage", ""),
                        },
                    }

                    # 如果entity数据含有额外信息，添加
                    if entity.get("data"):
                        try:
                            entity_data = entity["data"]
                            if isinstance(entity_data, str):
                                entity_data = json.loads(entity_data)
                            for key, value in entity_data.items():
                                node["data"][key] = value
                        except json.JSONDecodeError as e:
                            self.logger.warning(
                                f"解析学者ID {scholar['scholar_id']} 的额外数据失败: {str(e)}"
                            )
                        except Exception as e:
                            self.logger.warning(
                                f"处理学者ID {scholar['scholar_id']} 的额外数据时出错: {str(e)}"
                            )

                    nodes.append(node)
                    main_scholar_ids.add(scholar["scholar_id"])
                except Exception as e:
                    self.logger.error(
                        f"处理学者ID {scholar['scholar_id']} 时出错: {str(e)}"
                    )
                    continue

            if not nodes:
                self.logger.error("未能生成任何有效节点")
                return {"success": False, "error": "未能生成任何有效节点"}

            # 日志记录开始搜集关系
            self.logger.info(f"开始搜集关系，主要学者数量: {len(main_scholar_ids)}")

            # 获取所有关系（所有学者之间的关系）
            all_edges = []
            secondary_scholar_connections = {}  # 用于记录关联学者的连接数

            # 首先收集所有关系
            for scholar_id in main_scholar_ids:
                try:
                    relationships = self.relationship_dao.get_scholar_relationsips(
                        scholar_id
                    )

                    self.logger.info(
                        f"学者 {scholar_id} 有 {len(relationships)} 个协作者"
                    )

                    for rel in relationships:
                        target_id = rel["scholar_id"]
                        weight = rel.get("collaboration_count", 1)

                        # 使用数据库返回的关系类型，而不是固定的"coauthor"
                        relation_type = rel.get("relation_type", "coauthor")

                        # 记录边
                        edge = {
                            "source": scholar_id,
                            "target": target_id,
                            "label": relation_type,
                            "weight": weight,
                        }

                        # 如果有多种关系类型，添加到边的数据中
                        all_relation_types = rel.get("all_relation_types", [])
                        if all_relation_types and len(all_relation_types) > 1:
                            edge["data"] = {"all_relations": all_relation_types}

                        all_edges.append(edge)

                        # 如果不是主要学者，记录其连接数
                        if target_id not in main_scholar_ids:
                            # 检查目标学者是否是不感兴趣的学者（从缓存中检查）
                            if (
                                hide_not_interested
                                and target_id in not_interested_scholars
                            ):
                                self.logger.info(
                                    f"跳过与已知不感兴趣学者 {target_id} 的关系"
                                )
                                continue

                            # 如果缓存中没有，则查询数据库
                            target_scholar = self.scholar_dao.get_scholar_by_id(
                                target_id
                            )
                            if (
                                hide_not_interested
                                and target_scholar
                                and target_scholar.get("is_main_scholar") == 2
                            ):
                                self.logger.info(
                                    f"跳过与不感兴趣学者 {target_id} 的关系"
                                )
                                not_interested_scholars[target_id] = True
                                continue

                            if target_id not in secondary_scholar_connections:
                                secondary_scholar_connections[target_id] = 0
                            secondary_scholar_connections[target_id] += 1

                except Exception as e:
                    self.logger.error(f"处理学者ID {scholar_id} 的关系时出错: {str(e)}")
                    continue

            # 日志输出关联学者连接情况
            self.logger.info(
                f"找到 {len(secondary_scholar_connections)} 个关联学者，关系总数: {len(all_edges)}"
            )
            for scholar_id, count in secondary_scholar_connections.items():
                self.logger.info(f"关联学者 {scholar_id} 有 {count} 个连接")

            # 收集所有关联学者
            all_secondary_scholar_ids = set(secondary_scholar_connections.keys())

            # 确定是否要显示所有关联学者
            total_nodes_count = len(main_scholar_ids)
            show_all_secondary = total_nodes_count < 20

            self.logger.info(
                f"总节点数: {total_nodes_count}, 是否显示所有关联学者: {show_all_secondary}"
            )
            print(
                f"总节点数: {total_nodes_count}, 是否显示所有关联学者: {show_all_secondary}"
            )
            # 选择关联学者
            significant_secondary_scholars = {}
            if show_all_secondary:
                # 显示所有关联学者
                significant_secondary_scholars = secondary_scholar_connections
                self.logger.info(
                    f"显示所有 {len(significant_secondary_scholars)} 个关联学者"
                )
            else:
                # 检查是否有连接数大于2的关联学者
                high_connection_scholars = {
                    scholar_id: count
                    for scholar_id, count in secondary_scholar_connections.items()
                    if count > 2  # 连接数大于2
                }

                # 如果没有高连接学者，显示所有关联学者
                if not high_connection_scholars:
                    self.logger.info(
                        "没有连接数大于2的关联学者，降低筛选标准，显示所有关联学者"
                    )
                    significant_secondary_scholars = secondary_scholar_connections
                else:
                    significant_secondary_scholars = high_connection_scholars
                    self.logger.info(
                        f"只显示连接数大于2的关联学者，筛选后剩余 {len(significant_secondary_scholars)} 个"
                    )

            # 获取并添加有意义的关联学者节点
            for scholar_id in significant_secondary_scholars.keys():
                try:
                    # 首先检查缓存，如果是已知的不感兴趣学者，直接跳过
                    if hide_not_interested and scholar_id in not_interested_scholars:
                        self.logger.info(f"跳过已知不感兴趣的关联学者: {scholar_id}")
                        continue

                    # 获取学者数据
                    scholar = self.scholar_dao.get_scholar_by_id(scholar_id)
                    if not scholar:
                        self.logger.warning(f"未找到关联学者 {scholar_id} 的数据")
                        continue

                    # 如果需要隐藏不感兴趣的学者，并且该学者被标记为不感兴趣，则跳过
                    if hide_not_interested and scholar.get("is_main_scholar") == 2:
                        self.logger.info(f"筛选结果中跳过不感兴趣的学者: {scholar_id}")
                        continue
                    elif scholar.get("is_main_scholar") == 2:
                        self.logger.info(f"显示不感兴趣的学者: {scholar_id}")

                    # 获取实体信息
                    entity = self.entity_dao.get_entity_by_id(scholar_id)
                    if not entity or "name" not in entity:
                        self.logger.warning(
                            f"未找到关联学者 {scholar_id} 的实体信息或缺少name字段"
                        )
                        continue

                    # 获取学者兴趣标签
                    try:
                        interests = self.interest_dao.get_entity_interests(scholar_id)
                    except Exception as e:
                        self.logger.warning(
                            f"获取学者ID {scholar_id} 的兴趣标签时出错: {str(e)}"
                        )
                        interests = []

                    # 创建关联学者节点
                    node = {
                        "id": scholar_id,
                        "label": entity["name"],
                        "group": "secondary",
                        "data": {
                            "id": scholar_id,
                            "name": entity["name"],
                            "affiliation": scholar.get("affiliation", ""),
                            "interests": (
                                [i["interest"] for i in interests] if interests else []
                            ),
                            "scholar_id": scholar_id,
                            "is_secondary": True,
                            "citedby": scholar.get("citedby", 0),
                            "hindex": scholar.get("hindex", 0),
                            "i10index": scholar.get("i10index", 0),
                            "url_picture": scholar.get("url_picture", ""),
                            "homepage": scholar.get("homepage", ""),
                        },
                    }

                    # 如果entity数据含有额外信息，添加
                    if entity.get("data"):
                        try:
                            entity_data = entity["data"]
                            if isinstance(entity_data, str):
                                entity_data = json.loads(entity_data)
                            for key, value in entity_data.items():
                                node["data"][key] = value
                        except json.JSONDecodeError as e:
                            self.logger.warning(
                                f"解析关联学者ID {scholar_id} 的额外数据失败: {str(e)}"
                            )
                        except Exception as e:
                            self.logger.warning(
                                f"处理关联学者ID {scholar_id} 的额外数据时出错: {str(e)}"
                            )

                    nodes.append(node)
                    self.logger.info(
                        f"添加关联学者节点: {scholar_id}, {entity['name']}"
                    )

                except Exception as e:
                    self.logger.error(f"处理关联学者ID {scholar_id} 时出错: {str(e)}")
                    continue

            # 筛选显示的边（只包含已选定显示的节点之间的边）
            valid_node_ids = {node["id"] for node in nodes}
            edges = [
                edge
                for edge in all_edges
                if edge["source"] in valid_node_ids and edge["target"] in valid_node_ids
            ]

            self.logger.info(
                f"筛选前共 {len(all_edges)} 条边，筛选后共 {len(edges)} 条边"
            )

            # 生成网络数据
            network_data = {"nodes": nodes, "edges": edges}

            self.logger.info(
                f"生成网络数据：{len(nodes)}个节点，{len(edges)}条边 (主要学者:{len(main_scholar_ids)}，关联学者:{len(significant_secondary_scholars)})"
            )

            return network_data

        except Exception as e:
            self.logger.error(f"生成网络数据失败: {str(e)}")
            return {"success": False, "error": str(e)}

    def filter_network_data(self, filter_params):
        """根据复杂筛选条件过滤网络数据

        Args:
            filter_params: 筛选参数字典

        Returns:
            dict: {'success': bool, 'data': dict, 'error': str}
                  data格式包含nodes和edges
        """
        try:
            import traceback

            self.logger.info(f"开始构建筛选查询，参数: {filter_params}")

            # 检查filter_params类型
            if not isinstance(filter_params, dict):
                self.logger.error(f"filter_params不是字典类型: {type(filter_params)}")
                return {"success": False, "error": "筛选参数必须是字典"}

            # 获取hideNotInterested参数
            hide_not_interested = filter_params.get("hideNotInterested", True)
            # 确保hide_not_interested是布尔值
            if not isinstance(hide_not_interested, bool):
                if isinstance(hide_not_interested, str):
                    hide_not_interested = hide_not_interested.lower() == "true"
                else:
                    hide_not_interested = bool(hide_not_interested)
                filter_params["hideNotInterested"] = hide_not_interested

            self.logger.info(
                f"【重要】使用hide_not_interested值: {hide_not_interested}，类型: {type(hide_not_interested)}"
            )
            self.logger.info(
                f"【重要】筛选参数中hideNotInterested: {filter_params.get('hideNotInterested')}"
            )
            print(
                f"【调试点1】filter_network_data接收到hideNotInterested={hide_not_interested}，类型: {type(hide_not_interested)}"
            )

            # 构建动态SQL查询
            sql_parts = self._build_filter_sql(filter_params)

            # 调试信息
            self.logger.info(f"筛选SQL构建结果: 类型={type(sql_parts)}")

            # 检查sql_parts是否为字典类型
            if not isinstance(sql_parts, dict):
                self.logger.error(
                    f"_build_filter_sql返回的sql_parts不是字典类型: {type(sql_parts)}"
                )

                # 修复：如果返回值不是字典，创建一个默认的查询字典
                sql_parts = {
                    "select": "SELECT DISTINCT s.scholar_id",
                    "from": "FROM scholars s",
                    "joins": [],
                    "where": ["s.scholar_id IS NOT NULL"],
                    "order": "ORDER BY s.citedby DESC",
                    "params": [],
                }
                self.logger.info("已创建默认查询字典替代无效的sql_parts")

            # 获取符合筛选条件的学者ID列表
            try:
                # 将hideNotInterested参数传递给_execute_filter_query方法
                scholar_ids = self._execute_filter_query(sql_parts, hide_not_interested)
            except Exception as e:
                self.logger.error(f"执行查询时出错: {str(e)}")
                return {"success": False, "error": f"执行筛选查询时出错: {str(e)}"}

            if not scholar_ids or len(scholar_ids) == 0:
                self.logger.info("筛选未找到符合条件的学者")
                # 如果没有找到符合条件的学者，返回空结果
                return {"success": True, "data": {"nodes": [], "edges": []}}

            self.logger.info(
                f"筛选找到 {len(scholar_ids)} 个符合条件的学者，生成网络数据"
            )

            # 生成筛选后的网络数据
            try:
                # 将hideNotInterested参数传递给_generate_filtered_network_data方法
                # 注意：这里使用的参数名称应该和_generate_filtered_network_data函数的参数命名一致
                # 问题可能出在这里 - 将hideNotInterested参数转换为hide_not_interested
                filter_params["hide_not_interested"] = hide_not_interested
                print(
                    f"【调试点6】传递给_generate_filtered_network_data的参数: hide_not_interested={hide_not_interested}"
                )
                data = self._generate_filtered_network_data(scholar_ids, filter_params)
            except Exception as e:
                self.logger.error(f"生成筛选网络数据时出错: {str(e)}")
                return {"success": False, "error": f"生成筛选网络数据时出错: {str(e)}"}

            node_count = len(data.get("nodes", []))
            edge_count = len(data.get("edges", []))
            self.logger.info(f"筛选完成，生成 {node_count} 个节点，{edge_count} 条边")
            print(f"【调试点7】筛选结果统计: 节点数={node_count}, 边数={edge_count}")

            return {"success": True, "data": data}

        except Exception as e:
            self.logger.error(f"筛选网络数据时出错: {str(e)}")
            import traceback

            self.logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    def _build_filter_sql(self, filter_params):
        """构建筛选SQL查询

        Args:
            filter_params: 筛选参数字典

        Returns:
            dict: 包含SQL查询各部分的字典
        """
        try:
            # 验证filter_params类型
            if not isinstance(filter_params, dict):
                self.logger.error(
                    f"_build_filter_sql接收到非字典类型参数: {type(filter_params)}"
                )
                # 返回默认查询字典
                return {
                    "select": "SELECT DISTINCT s.scholar_id",
                    "from": "FROM scholars s",
                    "joins": [],
                    "where": ["s.scholar_id IS NOT NULL"],
                    "order": "ORDER BY s.citedby DESC",
                    "params": [],
                }

            # 基本查询部分
            sql_parts = {
                "select": "SELECT DISTINCT s.scholar_id",
                "from": "FROM scholars s",
                "joins": [],
                "where": ["s.scholar_id IS NOT NULL"],  # 基本条件
                "order": "ORDER BY s.citedby DESC",
                "params": [],
            }

            # 添加对hideNotInterested参数的支持
            # 明确检查hideNotInterested是否为True，而不是仅检查它是否存在
            hide_not_interested = filter_params.get("hideNotInterested")
            print(
                f"【调试点2】_build_filter_sql收到hideNotInterested={hide_not_interested}，类型: {type(hide_not_interested)}"
            )
            if hide_not_interested is True:
                # 修改为使用is_hidden字段而不是is_main_scholar
                sql_parts["where"].append("(s.is_hidden = 0 OR s.is_hidden IS NULL)")
                self.logger.info(
                    "【重要】添加筛选条件：隐藏不感兴趣的学者 (is_hidden = 0)"
                )
            else:
                self.logger.info("【重要】不隐藏不感兴趣的学者，显示所有学者")

            # 学者属性筛选
            if filter_params.get("interestKeyword"):
                sql_parts["joins"].append(
                    "LEFT JOIN interests i ON i.entity_id = s.scholar_id"
                )
                sql_parts["where"].append("i.interest LIKE ?")
                sql_parts["params"].append(f'%{filter_params["interestKeyword"]}%')

            # 检查interestKeyword是否需要精确匹配
            if filter_params.get("interestKeywordEquals"):
                sql_parts["joins"].append(
                    "LEFT JOIN interests i ON i.entity_id = s.scholar_id"
                )
                sql_parts["where"].append("i.interest = ?")
                sql_parts["params"].append(filter_params["interestKeywordEquals"])

            # 学者标签筛选 - 使用interests表替代entity_tags
            if filter_params.get("tagFilter"):
                # 原代码:
                # sql_parts['joins'].append('LEFT JOIN entity_tags et ON et.entity_id = s.scholar_id')
                # sql_parts['where'].append('et.tag = ?')

                # 修改为使用scholar_tags表或完全跳过
                try:
                    # 尝试获取数据库中存在的表
                    connection = self.db_manager.get_connection()
                    cursor = connection.cursor()
                    cursor.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%tag%';"
                    )
                    tag_tables = cursor.fetchall()

                    if tag_tables:
                        # 如果找到了tag相关的表，使用第一个
                        tag_table = tag_tables[0][0]
                        self.logger.info(f"使用表 {tag_table} 进行标签筛选")
                        sql_parts["joins"].append(
                            f"LEFT JOIN {tag_table} t ON t.entity_id = s.scholar_id"
                        )
                        sql_parts["where"].append("t.tag = ?")
                        sql_parts["params"].append(filter_params["tagFilter"])
                    else:
                        # 如果没有找到tag相关的表，尝试使用interests表
                        self.logger.warning(
                            "未找到标签表，尝试使用interests表进行标签筛选"
                        )
                        sql_parts["joins"].append(
                            "LEFT JOIN interests i ON i.entity_id = s.scholar_id"
                        )
                        sql_parts["where"].append("i.interest = ?")
                        sql_parts["params"].append(filter_params["tagFilter"])
                except Exception as e:
                    # 如果出错，跳过这个筛选条件
                    self.logger.error(f"获取标签表时出错: {str(e)}，跳过标签筛选")

            # 机构名称筛选
            if filter_params.get("affiliationKeyword"):
                sql_parts["where"].append("s.affiliation LIKE ?")
                sql_parts["params"].append(f'%{filter_params["affiliationKeyword"]}%')

            # 检查affiliationKeyword是否需要精确匹配
            if filter_params.get("affiliationKeywordEquals"):
                sql_parts["where"].append("s.affiliation = ?")
                sql_parts["params"].append(filter_params["affiliationKeywordEquals"])

            # 检查affiliationKeyword是否需要开头匹配
            if filter_params.get("affiliationKeywordStartsWith"):
                sql_parts["where"].append("s.affiliation LIKE ?")
                sql_parts["params"].append(
                    f'{filter_params["affiliationKeywordStartsWith"]}%'
                )

            # 引用次数筛选
            if filter_params.get("minCitations", 0) > 0:
                sql_parts["where"].append("s.citedby >= ?")
                sql_parts["params"].append(filter_params["minCitations"])

            # 引用次数小于
            if filter_params.get("minCitationsLt", 0) > 0:
                sql_parts["where"].append("s.citedby <= ?")
                sql_parts["params"].append(filter_params["minCitationsLt"])

            # 引用次数等于
            if filter_params.get("minCitationsEq", 0) > 0:
                sql_parts["where"].append("s.citedby = ?")
                sql_parts["params"].append(filter_params["minCitationsEq"])

            # H指数筛选
            if filter_params.get("minHIndex", 0) > 0:
                sql_parts["where"].append("s.hindex >= ?")
                sql_parts["params"].append(filter_params["minHIndex"])

            # H指数小于
            if filter_params.get("minHIndexLt", 0) > 0:
                sql_parts["where"].append("s.hindex <= ?")
                sql_parts["params"].append(filter_params["minHIndexLt"])

            # H指数等于
            if filter_params.get("minHIndexEq", 0) > 0:
                sql_parts["where"].append("s.hindex = ?")
                sql_parts["params"].append(filter_params["minHIndexEq"])

            # 论文筛选
            has_pub_filter = False
            pub_where = []

            # 期刊/会议名称筛选
            if filter_params.get("venueKeyword"):
                has_pub_filter = True
                pub_where.append("p.venue LIKE ?")
                sql_parts["params"].append(f'%{filter_params["venueKeyword"]}%')

            # 期刊/会议名称精确匹配
            if filter_params.get("venueKeywordEquals"):
                has_pub_filter = True
                pub_where.append("p.venue = ?")
                sql_parts["params"].append(filter_params["venueKeywordEquals"])

            # 发表年份起始
            if filter_params.get("yearFrom", 0) > 0:
                has_pub_filter = True
                pub_where.append("p.year >= ?")
                sql_parts["params"].append(filter_params["yearFrom"])

            # 发表年份结束
            if filter_params.get("yearTo", 9999) < 9999:
                has_pub_filter = True
                pub_where.append("p.year <= ?")
                sql_parts["params"].append(filter_params["yearTo"])

            # 发表年份等于
            if filter_params.get("yearEq", 0) > 0:
                has_pub_filter = True
                pub_where.append("p.year = ?")
                sql_parts["params"].append(filter_params["yearEq"])

            # 论文标题关键词
            if filter_params.get("paperTitleKeyword"):
                has_pub_filter = True
                pub_where.append("p.title LIKE ?")
                sql_parts["params"].append(f'%{filter_params["paperTitleKeyword"]}%')

            # 论文标题精确匹配
            if filter_params.get("paperTitleKeywordEquals"):
                has_pub_filter = True
                pub_where.append("p.title = ?")
                sql_parts["params"].append(filter_params["paperTitleKeywordEquals"])

            # 论文引用次数大于
            if filter_params.get("minPaperCitations", 0) > 0:
                has_pub_filter = True
                pub_where.append("p.num_citations >= ?")
                sql_parts["params"].append(filter_params["minPaperCitations"])

            # 论文引用次数小于
            if filter_params.get("minPaperCitationsLt", 0) > 0:
                has_pub_filter = True
                pub_where.append("p.num_citations <= ?")
                sql_parts["params"].append(filter_params["minPaperCitationsLt"])

            # 论文引用次数等于
            if filter_params.get("minPaperCitationsEq", 0) > 0:
                has_pub_filter = True
                pub_where.append("p.num_citations = ?")
                sql_parts["params"].append(filter_params["minPaperCitationsEq"])

            # 如果有论文相关筛选条件，添加JOIN
            if has_pub_filter:
                sql_parts["joins"].append(
                    "LEFT JOIN authorship a ON a.scholar_id = s.scholar_id"
                )
                sql_parts["joins"].append(
                    "LEFT JOIN publications p ON p.cites_id = a.cites_id"
                )
                sql_parts["where"].append("(" + " AND ".join(pub_where) + ")")

            # 机构筛选
            has_inst_filter = False
            inst_where = []

            # 国家/地区关键词
            if filter_params.get("countryKeyword"):
                has_inst_filter = True
                inst_where.append("i.country LIKE ?")
                sql_parts["params"].append(f'%{filter_params["countryKeyword"]}%')

            # 国家/地区精确匹配
            if filter_params.get("countryKeywordEquals"):
                has_inst_filter = True
                inst_where.append("i.country = ?")
                sql_parts["params"].append(filter_params["countryKeywordEquals"])

            # 机构类型
            if filter_params.get("institutionType"):
                has_inst_filter = True
                inst_where.append("i.inst_type = ?")
                sql_parts["params"].append(filter_params["institutionType"])

            # 如果有机构相关筛选条件，添加JOIN
            if has_inst_filter:
                sql_parts["joins"].append(
                    "LEFT JOIN scholar_institutions si ON si.scholar_id = s.scholar_id"
                )
                sql_parts["joins"].append(
                    "LEFT JOIN institutions i ON i.inst_id = si.inst_id"
                )
                sql_parts["where"].append("(" + " AND ".join(inst_where) + ")")

            # 节点类型筛选
            node_types = []
            if filter_params.get("showPrimary"):
                node_types.append("s.is_main_scholar = 1")
            if filter_params.get("showSecondary"):
                node_types.append("s.is_main_scholar = 0")

            if node_types:
                sql_parts["where"].append("(" + " OR ".join(node_types) + ")")

            # 至少有一个连接（如适用）
            min_connections = filter_params.get("minConnections", 1)
            # 添加连接数筛选，即使是1也添加条件，这样保证参数生效
            if min_connections >= 1:
                sql_parts["joins"].append(
                    "LEFT JOIN relationships r ON r.source_id = s.scholar_id OR r.target_id = s.scholar_id"
                )
                sql_parts["where"].append(
                    "(SELECT COUNT(*) FROM relationships WHERE source_id = s.scholar_id OR target_id = s.scholar_id) >= ?"
                )
                sql_parts["params"].append(min_connections)

            return sql_parts

        except Exception as e:
            self.logger.error(f"构建筛选SQL时出错: {str(e)}")
            # 出错时返回默认查询字典
            return {
                "select": "SELECT DISTINCT s.scholar_id",
                "from": "FROM scholars s",
                "joins": [],
                "where": ["s.scholar_id IS NOT NULL"],
                "order": "ORDER BY s.citedby DESC",
                "params": [],
            }

    def _should_show_all_scholars(self, hide_not_interested):
        """
        确定是否应该显示所有学者，包括隐藏的学者。
        基于hideNotInterested参数的值进行判断。

        Args:
            hide_not_interested: 是否隐藏标记为隐藏的学者

        Returns:
            bool: 是否显示所有学者（返回True表示显示所有学者，False表示按筛选条件显示）
        """
        # 如果不隐藏被标记为隐藏的学者（即hide_not_interested为False），则返回True
        show_all = not hide_not_interested
        print(
            f"【调试】_should_show_all_scholars: hide_not_interested={hide_not_interested}, 返回={show_all}"
        )
        return show_all

    def _execute_filter_query(self, sql_parts, hide_not_interested):
        """执行筛选查询并返回结果

        Args:
            sql_parts: 包含SQL查询各部分的字典
            hide_not_interested: 是否隐藏不感兴趣的学者

        Returns:
            list: 学者ID列表
        """
        try:
            # 检查sql_parts是否为字典类型
            if not isinstance(sql_parts, dict):
                self.logger.error(f"sql_parts 不是字典类型: {type(sql_parts)}")
                self.logger.error(f"sql_parts 内容: {sql_parts}")
                return []

            # 检查必要的键是否存在
            required_keys = ["select", "from", "joins", "where", "order", "params"]
            for key in required_keys:
                if key not in sql_parts:
                    self.logger.error(f"sql_parts 缺少必要的键: {key}")
                    return []

            # 组合SQL查询
            sql = f"{sql_parts['select']} {sql_parts['from']} "

            # 添加JOIN
            if sql_parts["joins"]:
                sql += " ".join(set(sql_parts["joins"])) + " "

            # 添加WHERE条件
            if sql_parts["where"]:
                sql += "WHERE " + " AND ".join(sql_parts["where"]) + " "

            # 添加排序
            sql += sql_parts["order"]

            # 记录最终SQL查询
            self.logger.info(f"执行筛选SQL: {sql}")
            self.logger.info(f"SQL参数: {sql_parts['params']}")

            # 特殊检查SQL条件中是否包含过滤不感兴趣学者的条件
            has_not_interested_filter = False
            for where_clause in sql_parts["where"]:
                if "is_hidden = 1" in where_clause:
                    has_not_interested_filter = True
                    print(f"【调试点SQL】SQL查询中包含隐藏学者筛选条件: {where_clause}")
                    break
            if not has_not_interested_filter:
                print("【调试点SQL】SQL查询中不包含隐藏学者筛选条件，将显示所有学者")

            # 如果没有筛选隐藏的学者，但我们想看到所有学者，可以运行一个特殊的查询
            # 或者如果HAS筛选隐藏的学者，但用户希望看到所有学者（包括隐藏的）
            if self._should_show_all_scholars(hide_not_interested):
                print("【重要解决方案】运行特殊SQL查询以包含隐藏的学者")
                try:
                    # 改用学者DAO直接获取所有学者ID
                    print("【尝试方案1】使用ScholarDao.get_all_scholars获取所有学者")
                    all_scholar_ids = []

                    # 方法1：使用ScholarDao
                    try:
                        all_scholars = self.scholar_dao.get_all_scholars()
                        if all_scholars:
                            all_scholar_ids = [
                                s["scholar_id"]
                                for s in all_scholars
                                if "scholar_id" in s
                            ]
                            print(
                                f"【方案1成功】获取到 {len(all_scholar_ids)} 个学者ID"
                            )
                    except Exception as e1:
                        print(f"【方案1失败】错误: {str(e1)}")

                    # 方法2：如果上述方法失败，直接执行SQL
                    if not all_scholar_ids:
                        print("【尝试方案2】直接执行SQL查询")
                        connection = self.db_manager.get_connection()
                        cursor = connection.cursor()
                        try:
                            special_sql = "SELECT scholar_id FROM scholars"
                            cursor.execute(special_sql)
                            results = cursor.fetchall()
                            all_scholar_ids = [r[0] for r in results if r and r[0]]
                            print(
                                f"【方案2成功】获取到 {len(all_scholar_ids)} 个学者ID"
                            )
                        except Exception as e2:
                            print(f"【SQL错误1】{str(e2)}")
                            try:
                                # 如果第一个SQL查询失败，尝试另一种表名
                                special_sql = (
                                    "SELECT id FROM entities WHERE type='scholar'"
                                )
                                cursor.execute(special_sql)
                                results = cursor.fetchall()
                                all_scholar_ids = [r[0] for r in results if r and r[0]]
                                print(
                                    f"【方案2-备选成功】获取到 {len(all_scholar_ids)} 个学者ID"
                                )
                            except Exception as e3:
                                print(f"【SQL错误2】{str(e3)}")

                    # 方法3：使用EntityDao
                    if not all_scholar_ids:
                        print("【尝试方案3】使用EntityDao查询")
                        try:
                            entities = self.entity_dao.get_entities_by_type("scholar")
                            if entities:
                                all_scholar_ids = [
                                    e["id"] for e in entities if "id" in e
                                ]
                                print(
                                    f"【方案3成功】获取到 {len(all_scholar_ids)} 个学者ID"
                                )
                        except Exception as e4:
                            print(f"【方案3失败】错误: {str(e4)}")

                    # 最终检查
                    if all_scholar_ids:
                        print(f"【解决方案】最终找到 {len(all_scholar_ids)} 个学者ID")
                        return all_scholar_ids
                    else:
                        print("【警告】所有方案均未找到学者，回退到常规查询")

                except Exception as e:
                    print(f"【错误】执行特殊处理失败: {str(e)}")
                    import traceback

                    print(traceback.format_exc())
            else:
                print("【注意】使用常规SQL查询，可能不包含隐藏的学者")

            # 执行查询
            connection = self.db_manager.get_connection()
            cursor = connection.cursor()
            cursor.execute(sql, sql_parts["params"])
            results = cursor.fetchall()

            # 提取学者ID
            scholar_ids = []
            try:
                # 添加结果类型的日志输出
                self.logger.info(f"查询结果类型: {type(results)}")
                if results and len(results) > 0:
                    self.logger.info(f"第一个结果项类型: {type(results[0])}")
                    self.logger.info(f"第一个结果项内容: {results[0]}")

                # 根据结果格式处理
                for result in results:
                    if isinstance(result, (list, tuple)) and len(result) > 0:
                        # 如果结果是列表或元组
                        scholar_ids.append(result[0])
                    elif isinstance(result, dict) and "scholar_id" in result:
                        # 如果结果是字典且包含scholar_id键
                        scholar_ids.append(result["scholar_id"])
                    elif isinstance(result, dict) and 0 in result:
                        # 如果结果是字典且包含0键
                        scholar_ids.append(result[0])
                    elif hasattr(result, "_fields") and hasattr(result, "_asdict"):
                        # 如果是命名元组
                        result_dict = result._asdict()
                        if "scholar_id" in result_dict:
                            scholar_ids.append(result_dict["scholar_id"])
                        elif len(result_dict) > 0:
                            # 取第一个值
                            scholar_ids.append(next(iter(result_dict.values())))
                    else:
                        # 最后尝试直接使用结果
                        scholar_ids.append(str(result))
            except Exception as e:
                self.logger.error(f"处理查询结果时出错: {str(e)}")
                if results and len(results) > 0:
                    self.logger.error(f"结果示例: {results[0]}")
                return []

            self.logger.info(f"查询成功，找到 {len(scholar_ids)} 个学者")
            return scholar_ids
        except Exception as e:
            self.logger.error(f"执行筛选SQL时出错: {str(e)}")
            if "sql" in locals():
                self.logger.error(f"错误SQL: {sql}")
            self.logger.error(f"错误参数: {sql_parts['params']}")
            return []  # 返回空列表而不是抛出异常

    def _generate_filtered_network_data(self, scholar_ids, filter_params):
        """根据学者ID列表生成网络数据

        Args:
            scholar_ids: 学者ID列表
            filter_params: 筛选参数

        Returns:
            dict: 包含nodes和edges的网络数据
        """
        # 获取是否隐藏不感兴趣的学者参数
        hide_not_interested = filter_params.get("hide_not_interested", True)
        print(
            f"【调试点3】_generate_filtered_network_data收到hide_not_interested={hide_not_interested}，类型: {type(hide_not_interested)}"
        )
        self.logger.info(
            f"【重要】_generate_filtered_network_data: hide_not_interested = {hide_not_interested}"
        )

        # 确保scholar_ids是列表或集合类型
        if not isinstance(scholar_ids, (list, set, tuple)):
            self.logger.warning(f"scholar_ids不是有效的集合类型: {type(scholar_ids)}")
            if isinstance(scholar_ids, str):
                # 如果是字符串，尝试转换为列表
                scholar_ids = [scholar_ids]
            else:
                # 无法处理的情况，返回空结果
                return {"nodes": [], "edges": []}

        # 生成节点
        nodes = []
        valid_scholar_ids = set()  # 用于跟踪成功处理的学者ID
        hidden_ids = set()  # 用于跟踪隐藏的学者ID

        # 记录学者ID总数
        print(f"【调试点4】共接收到 {len(scholar_ids)} 个学者ID")

        # 检查学者ID列表是否为空
        if not scholar_ids:
            print("【调试点4.1】学者ID列表为空!")
            self.logger.warning("学者ID列表为空，无法生成网络数据")
            return {"nodes": [], "edges": []}

        for scholar_id in scholar_ids:
            try:
                # 处理None值
                if scholar_id is None:
                    continue

                # 转换为字符串类型的ID
                scholar_id = str(scholar_id)

                # 获取学者数据
                scholar = self.scholar_dao.get_scholar_by_id(scholar_id)
                if not scholar:
                    self.logger.warning(f"未找到学者ID {scholar_id} 的数据")
                    continue

                # 记录学者状态
                is_main_scholar = scholar.get("is_main_scholar")
                is_hidden = scholar.get("is_hidden")
                print(
                    f"【调试点5】学者 {scholar_id} 状态: is_main_scholar={is_main_scholar}, is_hidden={is_hidden}"
                )

                # 如果需要隐藏不感兴趣的学者，并且该学者被标记为隐藏，则跳过
                if hide_not_interested and scholar.get("is_hidden") == 1:
                    self.logger.info(f"【重要】筛选结果中跳过隐藏的学者: {scholar_id}")
                    hidden_ids.add(scholar_id)
                    continue
                elif scholar.get("is_hidden") == 1:
                    self.logger.info(f"【重要】显示隐藏的学者: {scholar_id}")

                # 获取实体信息
                entity = self.entity_dao.get_entity_by_id(scholar_id)
                if not entity or "name" not in entity:
                    self.logger.warning(
                        f"未找到学者ID {scholar_id} 的实体信息或缺少name字段"
                    )
                    continue

                # 获取学者兴趣标签
                try:
                    interests = self.interest_dao.get_entity_interests(scholar_id)
                except Exception as e:
                    self.logger.warning(
                        f"获取学者ID {scholar_id} 的兴趣标签时出错: {str(e)}"
                    )
                    interests = []

                # 创建节点
                node = {
                    "id": scholar_id,
                    "label": entity.get("name", f"Scholar-{scholar_id}"),
                    "group": (
                        "primary"
                        if scholar.get("is_main_scholar") == 1
                        else (
                            "not-interested"
                            if scholar.get("is_hidden") == 1
                            else "secondary"
                        )
                    ),
                    "data": {
                        "id": scholar_id,
                        "name": entity.get("name", f"Scholar-{scholar_id}"),
                        "affiliation": scholar.get("affiliation", ""),
                        "interests": (
                            [i["interest"] for i in interests] if interests else []
                        ),
                        "scholar_id": scholar_id,
                        "is_main_scholar": scholar.get("is_main_scholar", 0),
                        "is_hidden": scholar.get("is_hidden", 0),
                        "is_secondary": scholar.get("is_main_scholar") != 1,
                        "citedby": scholar.get("citedby", 0),
                        "hindex": scholar.get("hindex", 0),
                        "i10index": scholar.get("i10index", 0),
                        "url_picture": scholar.get("url_picture", ""),
                        "homepage": scholar.get("homepage", ""),
                    },
                }

                # 添加实体额外数据
                if entity.get("data"):
                    try:
                        entity_data = entity["data"]
                        if isinstance(entity_data, str):
                            entity_data = json.loads(entity_data)
                        if isinstance(entity_data, dict):
                            for key, value in entity_data.items():
                                node["data"][key] = value
                    except Exception as e:
                        self.logger.warning(
                            f"处理学者ID {scholar_id} 的额外数据时出错: {str(e)}"
                        )

                nodes.append(node)
                valid_scholar_ids.add(scholar_id)
            except Exception as e:
                self.logger.error(f"处理学者ID {scholar_id} 时出错: {str(e)}")
                import traceback

                self.logger.error(traceback.format_exc())
                continue

        # 如果没有有效的节点，直接返回空结果
        if not nodes:
            self.logger.warning("筛选结果中没有有效的学者节点")
            return {"nodes": [], "edges": []}

        # 筛选和生成边
        edges = []

        # 记录状态统计信息
        interested_count = 0
        hidden_count = 0
        for node in nodes:
            # 统计隐藏和非隐藏节点
            if node["data"].get("is_hidden") == 1:
                hidden_count += 1
            else:
                interested_count += 1

        print(
            f"【调试点8】结果中的学者统计: 正常学者={interested_count}, 隐藏的学者={hidden_count}"
        )
        print(f"【调试点9】跳过的隐藏学者数量: {len(hidden_ids)}")

        # 关系类型筛选
        relation_filters = []
        if filter_params.get("showCoauthor", True):
            relation_filters.append("coauthor")
        if filter_params.get("showAdvisor", True):
            relation_filters.append("advisor")
        if filter_params.get("showColleague", True):
            relation_filters.append("colleague")

        # 如果没有指定关系类型，默认显示所有类型
        if not relation_filters:
            relation_filters = ["coauthor", "advisor", "colleague"]

        # 避免重复边
        processed_edges = set()

        # 获取学者ID之间的所有关系
        for source_id in valid_scholar_ids:
            try:
                # 获取所有与该学者相关的关系
                relationships = self.relationship_dao.get_scholar_relationsips(
                    source_id
                )

                for rel in relationships:
                    try:
                        target_id = rel.get("scholar_id")
                        if not target_id:
                            continue

                        # 检查目标学者是否在筛选结果中，且关系类型符合筛选条件
                        if (
                            target_id in valid_scholar_ids
                            and rel.get("relation_type", "coauthor") in relation_filters
                        ):
                            # 创建唯一边标识符
                            edge_key = f"{min(source_id, target_id)}-{max(source_id, target_id)}"

                            # 检查边是否已处理
                            if edge_key in processed_edges:
                                continue

                            # 添加边
                            edge = {
                                "source": source_id,
                                "target": target_id,
                                "label": rel.get("relation_type", "coauthor"),
                                "weight": rel.get("collaboration_count", 1),
                            }

                            # 如果有多种关系类型，添加到边的数据中
                            all_relation_types = rel.get("all_relation_types", [])
                            if all_relation_types and len(all_relation_types) > 1:
                                if not edge.get("data"):
                                    edge["data"] = {}
                                edge["data"]["all_relations"] = all_relation_types

                            edges.append(edge)
                            processed_edges.add(edge_key)
                    except Exception as e:
                        self.logger.warning(
                            f"处理学者 {source_id} 的关系 {rel} 时出错: {str(e)}"
                        )
                        continue
            except Exception as e:
                self.logger.error(f"获取学者 {source_id} 的协作者时出错: {str(e)}")
                continue

        return {"nodes": nodes, "edges": edges}

    def import_data(self, data_dir=None):
        """导入数据目录中的所有学者数据文件

        Args:
            data_dir: 可选的数据目录路径，默认使用self.scholars_dir

        Returns:
            dict: {'success': bool, 'message': str, 'imported': int, 'total': int}
        """
        try:
            import os
            import json
            from db.db_manager import DBManager

            # 如果未指定数据目录，使用默认目录
            if not data_dir:
                data_dir = self.scholars_dir

            if not os.path.exists(data_dir):
                return {"success": False, "error": f"数据目录不存在: {data_dir}"}

            # 获取数据目录中的JSON文件列表
            json_files = [f for f in os.listdir(data_dir) if f.endswith(".json")]
            if not json_files:
                return {
                    "success": False,
                    "error": f"数据目录中没有JSON文件: {data_dir}",
                }

            # 先初始化数据库，强制重建
            init_result = self.initialize_database(force_reload=True)
            if not init_result["success"]:
                return init_result

            # 创建必要的DAO对象
            from dao.scholar_dao import ScholarDao
            from dao.entity_dao import EntityDao
            from dao.interest_dao import InterestDao
            from dao.publication_dao import PublicationDao
            from dao.authorship_dao import AuthorshipDao

            # 导入文件
            imported_count = 0
            total_count = len(json_files)

            # 获取数据库管理器
            db_manager = DBManager()

            for file_name in json_files:
                try:
                    file_path = os.path.join(data_dir, file_name)

                    # 读取JSON文件
                    with open(file_path, "r", encoding="utf-8") as f:
                        scholar_data = json.load(f)

                    # 检查scholar_id
                    scholar_id = scholar_data.get("scholar_id")
                    if not scholar_id:
                        self.logger.warning(f"文件缺少scholar_id: {file_path}")
                        continue

                    # 使用Scholar服务导入数据
                    from services.scholar_service import ScholarService

                    scholar_service = ScholarService()

                    # 开始事务
                    db_manager.begin_transaction()

                    try:
                        # 导入学者数据
                        import_result = scholar_service._import_scholar_complete(
                            scholar_id, scholar_data
                        )

                        if import_result["success"]:
                            # 提交事务
                            db_manager.commit()
                            imported_count += 1
                            self.logger.info(f"成功导入学者文件: {file_name}")
                        else:
                            # 回滚事务
                            db_manager.rollback()
                            self.logger.error(
                                f"导入学者失败: {file_name}, 错误: {import_result.get('error')}"
                            )

                    except Exception as inner_error:
                        # 回滚事务
                        db_manager.rollback()
                        self.logger.error(
                            f"导入学者时出错: {file_name}, 错误: {str(inner_error)}"
                        )

                except Exception as file_error:
                    self.logger.error(
                        f"处理文件时出错: {file_name}, 错误: {str(file_error)}"
                    )

            # 导入完成后重新生成网络数据
            if imported_count > 0:
                self.regenerate_network_data()

            return {
                "success": imported_count > 0,
                "message": f"成功导入 {imported_count}/{total_count} 个学者文件",
                "imported": imported_count,
                "total": total_count,
            }

        except Exception as e:
            self.logger.error(f"导入数据时出错: {str(e)}")
            return {"success": False, "error": str(e)}
