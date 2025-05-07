#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
ScholarTailor 启动脚本
启动API服务器并打开浏览器
"""

import os
import sys
import subprocess
import webbrowser
import time
import logging
from threading import Thread

def init_database():
    """初始化数据库"""
    print("正在检查数据库...")
    
    # 获取当前脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 设置后端目录
    backend_dir = os.path.join(script_dir, 'backend')
    
    # 数据目录
    data_dir = os.path.join(script_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    # 学者数据目录
    scholars_dir = os.path.join(data_dir, 'scholars')
    os.makedirs(scholars_dir, exist_ok=True)
    
    # 数据库路径
    db_path = os.path.join(data_dir, 'scholar.db')
    
    # 检查数据库是否存在
    if not os.path.exists(db_path):
        print("正在初始化数据库...")
        
        # 运行数据库初始化脚本
        try:
            result = subprocess.run(
                [sys.executable, os.path.join(backend_dir, 'db', 'db_init.py'), db_path], 
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            print(result.stdout)
            if result.stderr:
                print(f"警告: {result.stderr}")
        except subprocess.CalledProcessError as e:
            print(f"数据库初始化失败: {e.stderr}")
            return False
    
    # 检查自定义关系文件
    custom_rel_file = os.path.join(data_dir, 'custom_relationships.json')
    if not os.path.exists(custom_rel_file):
        with open(custom_rel_file, 'w', encoding='utf-8') as f:
            f.write('[]')
    
    # 检查自定义数据文件
    custom_data_file = os.path.join(data_dir, 'custom_data.json')
    if not os.path.exists(custom_data_file):
        with open(custom_data_file, 'w', encoding='utf-8') as f:
            f.write('{}')
    
    return True

def start_api_server():
    """启动API服务器"""
    # 获取当前脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 设置后端目录
    backend_dir = os.path.join(script_dir, 'backend')
    
    # 检查必要的Python包
    try:
        import flask
        import flask_cors
        import scholarly
        import sqlite3
    except ImportError:
        print("正在安装必要的Python包...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flask", "flask-cors", "scholarly"])
    
    # 切换到后端目录
    os.chdir(backend_dir)
    
    # 启动API服务器
    print("正在启动ScholarTailor API服务器...")
    
    if sys.platform.startswith('win'):
        # Windows平台
        server_process = subprocess.Popen([sys.executable, "api_server.py"], 
                                          cwd=backend_dir)
    else:
        # Linux/Mac平台
        server_process = subprocess.Popen([sys.executable, "api_server.py"], 
                                          cwd=backend_dir)
    
    return server_process

def open_browser():
    """打开浏览器访问应用"""
    # 等待服务器启动
    time.sleep(2)
    
    # 打开浏览器
    print("正在打开浏览器...")
    webbrowser.open("http://127.0.0.1:8080")

if __name__ == "__main__":
    print("欢迎使用ScholarTailor - 学者关系定制系统")
    print("正在初始化系统...")
    
    # 设置日志
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # 初始化数据库
    if not init_database():
        print("数据库初始化失败，系统将以兼容模式启动。")
    
    # 启动服务器
    server_process = start_api_server()
    
    # 开启线程打开浏览器
    browser_thread = Thread(target=open_browser)
    browser_thread.start()

    try:
        # 等待服务器进程结束
        server_process.wait()
    except KeyboardInterrupt:
        # 捕获Ctrl+C，关闭服务器
        print("\n正在关闭服务器...")
        server_process.terminate()
        sys.exit(0) 