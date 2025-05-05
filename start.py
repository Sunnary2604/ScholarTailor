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
from threading import Thread

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
    except ImportError:
        print("正在安装必要的Python包...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flask", "flask-cors", "scholarly"])
    
    # 切换到后端目录
    os.chdir(backend_dir)
    
    # 如果数据目录不存在，创建它
    data_dir = os.path.join(script_dir, 'data', 'scholars')
    os.makedirs(data_dir, exist_ok=True)
    
    # 如果自定义关系文件不存在，创建它
    custom_rel_file = os.path.join(script_dir, 'data', 'custom_relationships.json')
    if not os.path.exists(custom_rel_file):
        with open(custom_rel_file, 'w', encoding='utf-8') as f:
            f.write('[]')
    
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