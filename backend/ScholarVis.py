import json
import os
from datetime import datetime
from scholarly import scholarly, ProxyGenerator

class ScholarVis:
    def __init__(self, use_proxy=False):
        """
        初始化 ScholarVis
        
        参数:
            use_proxy (bool): 是否使用代理
        """
        self.use_proxy = use_proxy
        self.scholar = None  # 初始化 scholar 对象为 None
        # 将custom_data_file放在data文件夹下
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(current_dir)
        data_dir = os.path.join(root_dir, 'data')
        self.custom_data_file = os.path.join(data_dir, 'custom_data.json')
        
        # 确保data目录存在
        os.makedirs(data_dir, exist_ok=True)
        
        if use_proxy:
            self._setup_proxy()
        
        # 加载自定义数据
        self._load_custom_data()
    
    def _setup_proxy(self):
        """设置代理以避免被Google Scholar封锁"""
        try:
            pg = ProxyGenerator()
            success = pg.FreeProxies()
            if success:
                scholarly.use_proxy(pg)
                print("代理设置成功")
            else:
                print("警告: 代理设置失败，可能会被限制访问")
        except Exception as e:
            print(f"设置代理时出错: {str(e)}")
    
    def _load_custom_data(self):
        """加载自定义数据（包括标签）"""
        try:
            if os.path.exists(self.custom_data_file):
                with open(self.custom_data_file, 'r', encoding='utf-8') as f:
                    self.custom_data = json.load(f)
            else:
                self.custom_data = {'scholars': {}}
        except Exception as e:
            print(f"加载自定义数据时出错: {str(e)}")
            self.custom_data = {'scholars': {}}
    
    def _save_custom_data(self):
        """
        保存自定义数据到文件
        
        返回:
            bool: 保存是否成功
        """
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.custom_data_file), exist_ok=True)
            
            with open(self.custom_data_file, 'w', encoding='utf-8') as f:
                json.dump(self.custom_data, f, ensure_ascii=False, indent=2)
            return True
        except FileNotFoundError as e:
            print(f"保存自定义数据出错: 文件路径不存在或无法创建 - {str(e)}")
            return False
        except PermissionError as e:
            print(f"保存自定义数据出错: 权限不足 - {str(e)}")
            return False
        except Exception as e:
            print(f"保存自定义数据出错: {str(e)}")
            return False
    
    def update_scholar_tags(self, scholar_id, tags):
        """
        更新学者的标签
        
        参数:
            scholar_id (str): 学者ID
            tags (list): 标签列表
            
        返回:
            bool: 更新是否成功
        """
        try:
            if 'scholars' not in self.custom_data:
                self.custom_data['scholars'] = {}
            
            if scholar_id not in self.custom_data['scholars']:
                self.custom_data['scholars'][scholar_id] = {}
            
            self.custom_data['scholars'][scholar_id]['tags'] = tags
            self._save_custom_data()
            return True
        except Exception as e:
            print(f"更新学者标签时出错: {str(e)}")
            return False
    
    def get_scholar_tags(self, scholar_id):
        """
        获取学者的标签
        
        参数:
            scholar_id (str): 学者ID
            
        返回:
            list: 标签列表
        """
        return self.custom_data.get('scholars', {}).get(scholar_id, {}).get('tags', [])
    
    def update_scholar_custom_fields(self, scholar_id, custom_fields):
        """
        更新学者的自定义字段
        
        参数:
            scholar_id (str): 学者ID
            custom_fields (dict): 自定义字段字典
        """
        if 'scholars' not in self.custom_data:
            self.custom_data['scholars'] = {}
        
        if scholar_id not in self.custom_data['scholars']:
            self.custom_data['scholars'][scholar_id] = {}
        
        self.custom_data['scholars'][scholar_id]['custom_fields'] = custom_fields
        self._save_custom_data()
    
    def get_scholar_custom_fields(self, scholar_id):
        """
        获取学者的自定义字段
        
        参数:
            scholar_id (str): 学者ID
            
        返回:
            dict: 自定义字段字典
        """
        return self.custom_data.get('scholars', {}).get(scholar_id, {}).get('custom_fields', {})
    
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
            
            return detailed_author
        except Exception as e:
            print(f"通过ID '{scholar_id}' 搜索学者时出错: {str(e)}")
            return None 