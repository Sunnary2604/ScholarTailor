#!/usr/bin/env python
"""
修复关系表中缺少source_type和target_type的记录
"""

import sys
import os
import logging
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db.db_manager import DBManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_relationships():
    """修复关系表中缺少type字段的记录"""
    
    logger.info("开始修复关系表...")
    
    db_manager = DBManager()
    
    try:
        # 查询缺少source_type或target_type的记录
        query = """
        SELECT id, source_id, target_id, relation_type 
        FROM relationships 
        WHERE source_type IS NULL OR target_type IS NULL OR source_type = '' OR target_type = ''
        """
        
        cursor = db_manager.execute(query)
        records = cursor.fetchall()
        
        logger.info(f"找到 {len(records)} 条需要修复的记录")
        
        for record in records:
            rel_id = record['id']
            
            # 根据关系类型判断实体类型
            relation_type = record.get('relation_type', '')
            
            # 默认都是学者类型
            source_type = 'scholar'
            target_type = 'scholar'
            
            # affiliated_with关系是学者和机构
            if relation_type == 'affiliated_with':
                target_type = 'institution'
            
            # 更新记录
            update_query = """
            UPDATE relationships 
            SET source_type = ?, target_type = ?
            WHERE id = ?
            """
            
            db_manager.execute(update_query, (source_type, target_type, rel_id))
            logger.info(f"已修复记录ID: {rel_id}, 关系类型: {relation_type}")
        
        db_manager.commit()
        logger.info("关系表修复完成")
        
        return len(records)
    
    except Exception as e:
        logger.error(f"修复关系表时出错: {str(e)}")
        db_manager.rollback()
        return 0

if __name__ == "__main__":
    fix_count = fix_relationships()
    logger.info(f"共修复 {fix_count} 条记录") 