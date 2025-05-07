#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ScholarTailor - 学者数据爬取模块
使用scholarly库从Google Scholar抓取学者信息
"""

import json
import os
import time
import re
from datetime import datetime
from scholarly import scholarly, ProxyGenerator


class ScholarCrawler:
    def __init__(self, use_proxy=False, data_dir=None):
        """
        初始化爬虫，可选是否使用代理
        
        参数:
            use_proxy (bool): 是否使用代理
            data_dir (str): 存储学者数据的目录
        """
        self.use_proxy = use_proxy
        
        # 如果未指定数据目录，使用默认路径
        if not data_dir:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            self.data_dir = os.path.join(base_dir, 'data', 'scholars')
        else:
            self.data_dir = data_dir

        # 确保数据目录存在
        os.makedirs(self.data_dir, exist_ok=True)

        if use_proxy:
            self._setup_proxy()

    def _setup_proxy(self):
        """设置代理以避免被Google Scholar封锁"""
        pg = ProxyGenerator()
        success = pg.FreeProxies()
        if success:
            scholarly.use_proxy(pg)
            print("代理设置成功")
        else:
            print("警告: 代理设置失败，可能会被限制访问")

    def search_author(self, author_name):
        """
        搜索学者信息
        
        参数:
            author_name (str): 学者姓名
            
        返回:
            dict: 学者信息字典
        """
        try:
            # 搜索作者
            search_query = scholarly.search_author(author_name)
            author = next(search_query)

            # 获取详细信息
            detailed_author = scholarly.fill(author)

            # 添加更新日期
            detailed_author['last_updated'] = datetime.now().isoformat()
            
            # 确保homepage字段存在
            if 'homepage' not in detailed_author and 'url_picture' in detailed_author:
                detailed_author['homepage'] = detailed_author.get('url_picture', '')

            # 将结果保存到JSON文件
            self._save_author_data(detailed_author)

            return detailed_author
        except Exception as e:
            print(f"搜索学者 '{author_name}' 时出错: {str(e)}")
            return None

    def search_author_by_id(self, scholar_id):
        """
        通过Google Scholar ID搜索学者信息
        
        参数:
            scholar_id (str): Google Scholar ID
            
        返回:
            dict: 学者信息字典
        """
        try:
            # 使用ID直接获取作者信息
            author = scholarly.search_author_id(scholar_id)
            
            if not author:
                print(f"未找到ID为 '{scholar_id}' 的学者")
                return None
            
            # 获取详细信息
            detailed_author = scholarly.fill(author)

            # 添加更新日期
            detailed_author['last_updated'] = datetime.now().isoformat()
            
            # 确保homepage字段存在
            if 'homepage' not in detailed_author and 'url_picture' in detailed_author:
                detailed_author['homepage'] = detailed_author.get('url_picture', '')

            # 将结果保存到JSON文件
            self._save_author_data(detailed_author)

            return detailed_author
        except Exception as e:
            print(f"通过ID '{scholar_id}' 搜索学者时出错: {str(e)}")
            return None

    def _save_author_data(self, author_data):
        """
        将学者数据保存为JSON文件
        
        参数:
            author_data (dict): 学者数据
        """
        if not author_data or 'name' not in author_data:
            print("警告: 无法保存学者数据，缺少必要字段")
            return

        # 使用学者名字创建文件名，移除非法字符
        name = author_data['name']
        safe_name = re.sub(r'[\\/*?:"<>|]', '', name).replace(' ', '_')

        # 添加scholar_id作为唯一标识
        scholar_id = author_data.get('scholar_id', '')
        filename = f"{safe_name}_{scholar_id}.json" if scholar_id else f"{safe_name}.json"

        file_path = os.path.join(self.data_dir, filename)

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(author_data, f, ensure_ascii=False, indent=2)

        print(f"学者 '{name}' 的数据已保存到: {file_path}")

    def get_coauthors(self, author):
        """
        获取合作者信息
        
        参数:
            author (dict): 学者信息字典
            
        返回:
            list: 合作者列表
        """
        coauthors = []
        if 'coauthors' in author:
            for coauthor in author['coauthors']:
                coauthors.append({
                    'name': coauthor.get('name', ''),
                    'scholar_id': coauthor.get('scholar_id', '')
                })
        return coauthors

    def batch_search_authors(self, author_names, delay=2):
        """
        批量搜索多位学者信息
        
        参数:
            author_names (list): 学者姓名列表
            delay (int): 请求间隔秒数，避免被封
            
        返回:
            dict: 以学者ID为键的学者信息字典
        """
        results = {}
        for name in author_names:
            print(f"正在搜索学者: {name}")
            author_data = self.search_author(name)
            if author_data:
                scholar_id = author_data.get('scholar_id', '')
                if scholar_id:
                    results[scholar_id] = author_data

            # 添加延迟避免被封
            time.sleep(delay)

        return results


if __name__ == "__main__":
    # 测试爬虫
    crawler = ScholarCrawler(use_proxy=False)

    # # 测试单个学者搜索
    # test_author = "Yunhai Wang"
    # result = crawler.search_author(test_author)

    # if result:
    #     print(f"成功获取学者信息: {result.get('name', '')}")
    #     print(f"所属机构: {result.get('affiliation', '')}")
    #     print(f"论文数量: {len(result.get('publications', []))}")
    #     print(f"更新时间: {result.get('last_updated', '')}")
    # else:
    #     print(f"未找到学者: {test_author}")

    # 如果需要批量搜索多位学者，取消下面的注释并修改学者名单

    scholars_to_search = ["Danielle Albers Szafir"]

    results = crawler.batch_search_authors(scholars_to_search, delay=3)
    print(f"成功抓取 {len(results)} 位学者的数据")
