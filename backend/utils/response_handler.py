"""
响应处理工具
用于统一处理HTTP响应和错误处理
"""

from flask import jsonify

class ResponseHandler:
    """响应处理类，提供统一的响应格式和错误处理方法"""
    
    @staticmethod
    def success(data=None, message=None):
        """生成成功响应
        
        Args:
            data: 响应数据(可选)
            message: 成功消息(可选)
            
        Returns:
            tuple: (响应JSON, 状态码)
        """
        response = {'success': True}
        
        if message:
            response['message'] = message
            
        if data:
            if isinstance(data, dict):
                # 合并字典，但不覆盖已有的值
                for key, value in data.items():
                    if key not in response:
                        response[key] = value
            else:
                response['data'] = data
                
        return jsonify(response), 200
    
    @staticmethod
    def error(message, status_code=400, error_code=None):
        """生成错误响应
        
        Args:
            message: 错误消息
            status_code: HTTP状态码(默认400)
            error_code: 自定义错误代码(可选)
            
        Returns:
            tuple: (响应JSON, 状态码)
        """
        response = {
            'success': False,
            'error': message
        }
        
        if error_code:
            response['error_code'] = error_code
            
        return jsonify(response), status_code
    
    @staticmethod
    def from_result(result, error_mapping=None):
        """从service层返回的结果生成HTTP响应
        
        Args:
            result: 服务层返回的结果字典
            error_mapping: 错误消息到HTTP状态码的映射字典(可选)
            
        Returns:
            tuple: (响应JSON, 状态码)
        """
        if not result:
            return ResponseHandler.error('服务返回空结果', 500)
            
        success = result.get('success', False)
        
        if success:
            return ResponseHandler.success(result)
        else:
            error_message = result.get('error', '未知错误')
            
            # 使用错误映射确定状态码
            status_code = 500
            if error_mapping and error_message:
                for error_pattern, code in error_mapping.items():
                    if error_pattern in error_message:
                        status_code = code
                        break
            
            return ResponseHandler.error(error_message, status_code)
    
    # 常用的错误映射
    COMMON_ERROR_MAPPING = {
        '未找到': 404,
        '已存在': 409,
        '缺少': 400,
        '无效': 400,
        '未授权': 401,
        '禁止': 403,
        '检查学者ID': 400
    } 