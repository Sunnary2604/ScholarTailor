#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
ScholarTailor - API服务器
处理所有HTTP请求，并调用相应的服务层方法
"""

import os
import logging
import json
from flask import Flask, request, send_from_directory, jsonify
from flask_cors import CORS  # 添加CORS支持
from utils.response_handler import ResponseHandler
from utils.scholarly_crawler import ScholarCrawler
from services.scholar_service import ScholarService
from services.interest_service import InterestService
from services.data_service import DataService
from services.relationship_service import RelationshipService

# 设置环境变量以配置优化选项
os.environ["SAVE_SCHOLAR_DATA"] = "0"  # 默认不保存JSON文件

# 获取项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# 初始化Flask应用
app = Flask(__name__, static_folder=os.path.join(ROOT_DIR, "frontend"))
CORS(app)  # 启用跨域支持
app.config["JSON_AS_ASCII"] = False

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
app.logger.setLevel(logging.INFO)

# 获取数据目录
DATA_DIR = os.path.join(ROOT_DIR, "data")
SCHOLARS_DIR = os.path.join(DATA_DIR, "scholars")
CUSTOM_DATA_FILE = os.path.join(DATA_DIR, "custom_data.json")
CUSTOM_RELATIONSHIPS_FILE = os.path.join(DATA_DIR, "custom_relationships.json")
OUTPUT_FILE = os.path.join(ROOT_DIR, "data.json")
DB_PATH = os.path.join(DATA_DIR, "scholar.db")

# 确保数据目录存在
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SCHOLARS_DIR, exist_ok=True)

# 初始化响应处理器
resp = ResponseHandler()

# 初始化爬虫
crawler = ScholarCrawler(use_proxy=False, data_dir=SCHOLARS_DIR)

# 初始化服务
scholar_service = ScholarService(crawler=crawler)
interest_service = InterestService(
    scholars_dir=SCHOLARS_DIR, custom_data_file=CUSTOM_DATA_FILE
)
relationship_service = RelationshipService(
    custom_relationships_file=CUSTOM_RELATIONSHIPS_FILE
)
data_service = DataService(
    scholars_dir=SCHOLARS_DIR, db_path=DB_PATH, output_file=OUTPUT_FILE
)


# 静态文件服务
@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)


# API端点：添加单个学者
@app.route("/api/scholars/add", methods=["POST"])
def add_scholar():
    """添加学者API，优先使用ID而非名称

    接收JSON参数:
    {
        "scholar_id": "学者ID", (优先)
        "name": "学者名称" (仅在没有ID时使用)
    }

    返回:
    {
        "success": true/false,
        "scholar_id": "添加的学者ID",
        "message": "成功/错误信息"
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "error": "缺少请求数据"})

        # 优先使用ID添加学者，这样可以避免重名问题
        if "scholar_id" in data and data["scholar_id"].strip():
            # 提取scholar_id (处理可能的URL形式)
            scholar_id = data["scholar_id"].strip()
            # 如果是完整URL，尝试提取ID部分
            if "user=" in scholar_id:
                import re

                match = re.search(r"user=([^&]+)", scholar_id)
                if match:
                    scholar_id = match.group(1)

            result = scholar_service.add_scholar_by_id(scholar_id)
        elif "name" in data and data["name"].strip():
            # 只有在没有提供ID时才使用名称
            app.logger.warning(f"使用名称添加学者，可能存在重名风险: {data['name']}")
            result = scholar_service.add_scholar_by_name(data["name"].strip())
        else:
            return jsonify({"success": False, "error": "缺少学者ID或名称"})

        # 处理响应
        if result["success"]:
            # 重新生成数据
            try:
                data_service.regenerate_network_data()
            except Exception as regen_error:
                app.logger.warning(f"重新生成网络数据时出错: {str(regen_error)}")

        return jsonify(result)
    except Exception as e:
        app.logger.error(f"添加学者时出错: {str(e)}")
        return jsonify({"success": False, "error": str(e)})


# API端点：批量添加学者
@app.route("/api/scholars/batch-add", methods=["POST"])
def batch_add_scholars():
    """批量添加学者API，支持ID列表或名称列表

    接收JSON参数:
    {
        "scholar_ids": ["ID1", "ID2", ...], (优先)
        "names": ["名称1", "名称2", ...] (仅在没有提供ID列表时使用)
    }

    返回:
    {
        "success": true/false,
        "added": 添加成功的数量,
        "message": "成功/错误信息"
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "error": "缺少请求数据"})

        # 优先使用ID列表添加学者
        if (
            "scholar_ids" in data
            and isinstance(data["scholar_ids"], list)
            and data["scholar_ids"]
        ):
            # 逐个添加ID
            results = []
            added_count = 0
            for scholar_id in data["scholar_ids"]:
                if not scholar_id:
                    continue

                # 清理并检查ID
                clean_id = (
                    scholar_id.strip()
                    if isinstance(scholar_id, str)
                    else str(scholar_id)
                )
                if "user=" in clean_id:
                    import re

                    match = re.search(r"user=([^&]+)", clean_id)
                    if match:
                        clean_id = match.group(1)

                result = scholar_service.add_scholar_by_id(clean_id)
                results.append(result)
                if result["success"]:
                    added_count += 1

            final_result = {
                "success": added_count > 0,
                "added": added_count,
                "message": f"成功添加 {added_count} 位学者",
            }
        elif "names" in data and isinstance(data["names"], list) and data["names"]:
            # 如果没有提供ID列表，使用名称列表
            app.logger.warning(f"使用名称列表批量添加学者，可能存在重名风险")

            # 过滤空名称
            valid_names = [
                name.strip() for name in data["names"] if name and isinstance(name, str)
            ]
            result = scholar_service.batch_add_scholars(valid_names)
            final_result = result
        else:
            return jsonify({"success": False, "error": "缺少学者ID列表或名称列表"})

        # 如果添加成功，重新生成网络数据
        if final_result["success"]:
            try:
                data_service.regenerate_network_data()
            except Exception as regen_error:
                app.logger.warning(f"重新生成网络数据时出错: {str(regen_error)}")

        return jsonify(final_result)
    except Exception as e:
        app.logger.error(f"批量添加学者时出错: {str(e)}")
        return jsonify({"success": False, "error": str(e)})


# API端点：更新单个学者
@app.route("/api/scholars/update", methods=["POST"])
def update_scholar():
    """更新学者信息API
    更新学者信息或修改学者状态

    接收JSON参数:
    {
        "id": "学者ID",
        "is_main_scholar": 0|1|2 (可选) - 0=关联学者，1=主要学者，2=不感兴趣
    }

    返回:
    {
        "success": true/false,
        "message": "成功/错误信息"
    }
    """
    try:
        app.logger.info(f"DEBUGTAG: 接收到scholars/update请求")
        data = request.json
        app.logger.info(f"DEBUGTAG: 请求内容: {data}")

        # 验证参数
        if not data or "id" not in data:
            app.logger.error(f"DEBUGTAG: 缺少必要参数")
            return jsonify({"success": False, "error": "缺少必要参数"})

        # 获取参数
        scholar_id = data.get("id")
        is_main_scholar = data.get("is_main_scholar")
        app.logger.info(
            f"DEBUGTAG: 解析参数 - scholar_id={scholar_id}, is_main_scholar={is_main_scholar}"
        )

        # 记录操作
        if is_main_scholar is not None:
            app.logger.info(
                f"DEBUGTAG: 更新学者状态: id={scholar_id}, is_main_scholar={is_main_scholar}"
            )
            # 更新学者状态 - 直接使用update_scholar, 传递状态值
            result = scholar_service.update_scholar(scholar_id, is_main_scholar)
            app.logger.info(f"DEBUGTAG: 学者状态更新返回结果: {result}")

            # 如果更新成功，重新生成网络数据
            if result["success"]:
                try:
                    app.logger.info(f"DEBUGTAG: 重新生成网络数据")
                    data_service.regenerate_network_data()
                except Exception as regen_error:
                    app.logger.warning(
                        f"DEBUGTAG: 重新生成网络数据时出错: {str(regen_error)}"
                    )
                    # 不中断流程，继续返回成功结果

            app.logger.info(f"DEBUGTAG: 返回响应: {result}")
            return jsonify(result)
        else:
            # 执行标准的学者更新操作（爬取详细数据）
            app.logger.info(f"DEBUGTAG: 爬取学者详细数据: id={scholar_id}")
            result = scholar_service.update_scholar(scholar_id)
            app.logger.info(f"DEBUGTAG: 学者更新返回结果: {result}")

            # 如果更新成功，重新生成网络数据
            if result["success"]:
                try:
                    app.logger.info(f"DEBUGTAG: 重新生成网络数据")
                    data_service.regenerate_network_data()
                except Exception as regen_error:
                    app.logger.warning(
                        f"DEBUGTAG: 重新生成网络数据时出错: {str(regen_error)}"
                    )
                    # 不中断流程，继续返回成功结果

            app.logger.info(f"DEBUGTAG: 返回响应: {result}")
            return jsonify(result)

    except Exception as e:
        app.logger.error(f"DEBUGTAG: 更新学者信息时出错: {str(e)}")
        import traceback

        app.logger.error(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)})


# API端点：更新学者自定义字段
@app.route("/api/scholars/update-custom-fields", methods=["POST"])
def update_custom_fields():
    data = request.json
    if not data or "id" not in data or "custom_fields" not in data:
        return resp.error("缺少必要参数", 400)

    result = scholar_service.update_custom_fields(data["id"], data["custom_fields"])

    if result["success"]:
        data_service.regenerate_network_data()

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：刷新所有数据
@app.route("/api/scholars/refresh-all", methods=["POST"])
def refresh_all():
    data = request.json
    keep_custom = data.get("keep_custom_relationships", True) if data else True

    result = scholar_service.refresh_all_scholars(keep_custom)

    if result["success"]:
        data_service.regenerate_network_data()

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：添加关系
@app.route("/api/relationships/add", methods=["POST"])
def add_relationship():
    data = request.json
    if (
        not data
        or "source_id" not in data
        or "target_id" not in data
        or "type" not in data
    ):
        return resp.error("缺少必要参数", 400)

    app.logger.info(f"收到添加关系请求: {data}")

    result = relationship_service.add_relationship(
        data["source_id"], data["target_id"], data["type"], data.get("is_custom", True)
    )

    if result["success"]:
        app.logger.info(f"关系添加成功，开始重新生成网络数据")
        data_service.regenerate_network_data()
        app.logger.info(f"网络数据重新生成完成")
    else:
        app.logger.error(f"关系添加失败: {result.get('error', '未知错误')}")

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：批量删除关系
@app.route("/api/relationships/delete-batch", methods=["POST"])
def delete_relationships_batch():
    data = request.json
    if (
        not data
        or "relationships" not in data
        or not isinstance(data["relationships"], list)
    ):
        return resp.error("缺少关系列表", 400)

    result = relationship_service.delete_relationships_batch(data["relationships"])

    if result["success"]:
        data_service.regenerate_network_data()

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：更新学者标签
@app.route("/api/scholars/update-tags", methods=["POST"])
def update_scholar_tags():
    data = request.json
    if not data or "id" not in data or "tags" not in data:
        return resp.error("缺少必要参数", 400)

    result = interest_service.update_scholar_tags(data["id"], data["tags"])

    if result["success"]:
        data_service.regenerate_network_data()

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：添加学者标签
@app.route("/api/scholars/add-tag", methods=["POST"])
def add_scholar_tag():
    data = request.json
    if not data or "id" not in data or "tag" not in data:
        return resp.error("缺少必要参数", 400)

    result = interest_service.add_scholar_tag(data["id"], data["tag"])

    if result["success"]:
        data_service.regenerate_network_data()

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：初始化数据库
@app.route("/api/initialize-database", methods=["POST"])
def initialize_database():
    result = data_service.initialize_database()
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：清空数据库并重新导入数据
@app.route("/api/migrate-data", methods=["POST"])
def migrate_data():
    data = request.json
    data_dir = data.get("data_dir") if data else None

    # 调用数据服务导入数据
    result = data_service.import_data(data_dir)

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：根据ID获取学者详情
@app.route("/api/scholars/<scholar_id>", methods=["GET"])
def get_scholar_by_id(scholar_id):
    if not scholar_id:
        return resp.error("缺少学者ID", 400)

    result = scholar_service.get_scholar_by_id(scholar_id)
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：获取网络数据
@app.route("/api/network-data", methods=["GET"])
def get_network_data():
    result = data_service.get_network_data()
    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# API端点：高级筛选查询
@app.route("/api/scholars/filter", methods=["POST"])
def filter_scholars():
    data = request.json
    if not data or "filter_params" not in data:
        return resp.error("缺少筛选参数", 400)

    try:
        filter_params = data["filter_params"]

        # 增强记录筛选参数的详细信息
        app.logger.info(f"接收到筛选请求，参数类型: {type(filter_params)}")
        app.logger.info(f"筛选参数详情: {filter_params}")

        # 验证筛选参数
        if not isinstance(filter_params, dict):
            app.logger.error(f"筛选参数不是字典类型: {type(filter_params)}")
            return resp.error("筛选参数必须是对象", 400)

        # 记录筛选参数的键
        app.logger.info(f"筛选参数键: {list(filter_params.keys())}")

        # 确保hideNotInterested参数被处理（转换为布尔值）
        if "hideNotInterested" in filter_params:
            hide_not_interested = filter_params.get("hideNotInterested")
            # 确保是布尔值
            if isinstance(hide_not_interested, str):
                hide_not_interested = hide_not_interested.lower() == "true"
            elif not isinstance(hide_not_interested, bool):
                hide_not_interested = bool(hide_not_interested)
            filter_params["hideNotInterested"] = bool(hide_not_interested)
            app.logger.info(
                f"处理hideNotInterested参数: {filter_params['hideNotInterested']} (类型: {type(filter_params['hideNotInterested'])})"
            )
            print(
                f"【API调试】hideNotInterested = {filter_params['hideNotInterested']} (类型: {type(filter_params['hideNotInterested'])})"
            )

        # 执行筛选
        result = data_service.filter_network_data(filter_params)

        # 记录结果
        if result["success"]:
            node_count = len(result.get("data", {}).get("nodes", []))
            edge_count = len(result.get("data", {}).get("edges", []))
            app.logger.info(f"筛选成功，返回 {node_count} 个节点，{edge_count} 条边")
        else:
            app.logger.error(f"筛选失败: {result.get('error', '未知错误')}")

        return resp.from_result(result, resp.COMMON_ERROR_MAPPING)

    except Exception as e:
        error_msg = f"执行筛选时出错: {str(e)}"
        app.logger.error(error_msg)
        return resp.error(error_msg, 500)


# API端点：将关联学者转换为主要学者
@app.route("/api/scholars/convert-to-main", methods=["POST"])
def convert_to_main_scholar():
    data = request.json
    if not data or "scholar_id" not in data:
        return resp.error("缺少学者ID", 400)

    # 直接使用update_scholar, 设置状态为1
    result = scholar_service.update_scholar(data["scholar_id"], 1)

    if result["success"]:
        data_service.regenerate_network_data()

    return resp.from_result(result, resp.COMMON_ERROR_MAPPING)


# 全局错误处理
@app.errorhandler(404)
def not_found(error):
    return resp.error("API端点不存在", 404)


@app.errorhandler(405)
def method_not_allowed(error):
    return resp.error("不支持的HTTP方法", 405)


@app.errorhandler(500)
def server_error(error):
    return resp.error("服务器内部错误", 500)


# 启动服务器
if __name__ == "__main__":
    # 检查数据库是否需要初始化 - 仅在数据库文件不存在时初始化
    if not os.path.exists(DB_PATH):
        print("数据库文件不存在，正在初始化数据库表结构...")
        init_success = data_service.initialize_database()
        if not init_success["success"]:
            print("警告: 数据库表结构初始化失败")
        else:
            print("数据库表结构初始化成功")

            # 导入初始数据
            if os.path.exists(SCHOLARS_DIR) and any(os.listdir(SCHOLARS_DIR)):
                print("正在导入初始数据...")
                # 获取目录下的所有文件
                scholar_files = [
                    f for f in os.listdir(SCHOLARS_DIR) if f.endswith(".json")
                ]

                # 开始事务
                from db.db_manager import DBManager

                db_manager = DBManager()
                db_manager.begin_transaction()

                try:
                    for file in scholar_files:
                        try:
                            with open(
                                os.path.join(SCHOLARS_DIR, file), "r", encoding="utf-8"
                            ) as f:
                                scholar_data = json.load(f)
                                scholar_id = scholar_data.get("scholar_id")
                                if scholar_id:
                                    # 使用scholar_service导入学者数据，设置为主要学者
                                    result = scholar_service._import_scholar_complete(
                                        scholar_id, scholar_data, is_main_scholar=1
                                    )
                                    if result["success"]:
                                        print(f"成功导入学者文件: {file}")
                                    else:
                                        print(
                                            f"导入学者文件失败: {file}, 错误: {result.get('error')}"
                                        )
                        except Exception as e:
                            print(f"处理学者文件出错: {file}, 错误: {str(e)}")

                    # 提交事务
                    db_manager.commit()

                    # 导入完成后重新生成网络数据
                    data_service.regenerate_network_data()

                except Exception as e:
                    # 发生错误，回滚事务
                    db_manager.rollback()
                    print(f"批量导入学者数据失败，已回滚: {str(e)}")
    else:
        print(f"数据库文件已存在: {DB_PATH}")

    # 启动Flask服务器
    print("正在启动API服务器...")
    app.run(debug=True, host="127.0.0.1", port=8080)
