"""
数据导入工具
用于从JSON文件导入学者数据到数据库
"""

import os
import json
import logging
import hashlib
from datetime import datetime
from db.db_manager import DBManager
from dao.entity_dao import EntityDao
from dao.scholar_dao import ScholarDao
from dao.publication_dao import PublicationDao
from dao.relationship_dao import RelationshipDao
from dao.authorship_dao import AuthorshipDao
from dao.institution_dao import InstitutionDao
from dao.interest_dao import InterestDao

class ScholarImporter:
    """学者数据导入器"""
    
    def __init__(self, db_manager=None):
        """初始化导入器
        
        Args:
            db_manager: 数据库管理器实例，如果为None则创建新实例
        """
        self.db_manager = db_manager or DBManager()
        
        # 初始化各DAO对象
        self.entity_dao = EntityDao()
        self.scholar_dao = ScholarDao()
        self.publication_dao = PublicationDao()
        self.relationship_dao = RelationshipDao()
        self.authorship_dao = AuthorshipDao()
        self.institution_dao = InstitutionDao()
        self.interest_dao = InterestDao()
        
        self.logger = logging.getLogger(__name__)
        
        # 调整日志级别以显示更多信息
        logging.getLogger(__name__).setLevel(logging.INFO)
        
        # 缓存已处理的实体ID，避免重复创建
        self.processed_entities = set()
        # 缓存已处理的论文引用ID，避免重复创建
        self.processed_publications = set()
        # 缓存引用ID到论文ID的映射，用于建立作者关系
        self.citation_to_pubid = {}
        
        # 统计信息
        self.stats = {
            'pub_with_cites_id': 0,
            'pub_without_cites_id': 0,
            'imported_pubs': 0,
            'skipped_pubs': 0,
            'unique_scholars': 0,
            'coauthor_relationships': 0
        }
    
    def import_scholar_file(self, file_path):
        """导入单个学者JSON文件
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            bool: 是否导入成功
            str: 导入的学者ID
        """
        try:
            # 读取JSON文件
            with open(file_path, 'r', encoding='utf-8') as f:
                scholar_data = json.load(f)
            
            # 检查必要字段
            if 'scholar_id' not in scholar_data:
                self.logger.error(f"文件缺少scholar_id字段: {file_path}")
                return False, None
            
            # 开始事务
            self.db_manager.begin_transaction()
            
            # 导入数据到各个表
            scholar_id = scholar_data['scholar_id']
            success = self._import_scholar_data(scholar_id, scholar_data)
            
            if success:
                self.db_manager.commit()
                self.logger.info(f"成功导入学者数据: {scholar_id}")
                return True, scholar_id
            else:
                self.db_manager.rollback()
                self.logger.error(f"导入学者数据失败: {scholar_id}")
                return False, scholar_id
                
        except Exception as e:
            self.logger.error(f"处理文件时出错 {file_path}: {str(e)}")
            self.db_manager.rollback()
            return False, None
    
    def _import_scholar_data(self, scholar_id, data):
        """导入学者数据到所有相关表
        
        Args:
            scholar_id: 学者ID
            data: 学者数据字典
            
        Returns:
            bool: 是否成功
        """
        try:
            # 提取学者名称和基本信息
            scholar_name = data.get('name', 'Unknown Scholar')
            main_entity_data = {
                'source': data.get('source'),
                'filled': data.get('filled'),
                'container_type': data.get('container_type')
            }
            
            # 1. 首先创建或更新学者详情记录
            success = self.scholar_dao.create_scholar(scholar_id, data, is_main_scholar=1)
            if not success:
                return False
            
            # 2. 然后检查学者实体是否已存在
            if self.entity_dao.entity_exists(scholar_id) and scholar_id in self.processed_entities:
                self.logger.info(f"学者实体已存在: {scholar_id}, {scholar_name}")
            else:
                # 创建或更新实体记录
                success = self.entity_dao.create_entity(
                    id=scholar_id,
                    type='scholar',
                    name=scholar_name,
                    data=main_entity_data
                )
                
                if success:
                    self.processed_entities.add(scholar_id)
                    self.logger.info(f"已创建学者实体: {scholar_id}, {scholar_name}")
                else:
                    # 检查实体是否已存在
                    entity = self.entity_dao.get_entity_by_id(scholar_id)
                    if entity:
                        self.processed_entities.add(scholar_id)
                        self.logger.info(f"已检索到学者实体: {scholar_id}, {scholar_name}")
            
            # 3. 添加兴趣/标签
            interests = data.get('interests', [])
            interest_count = self.interest_dao.create_interests_batch(scholar_id, interests)
            self.logger.info(f"为学者添加了 {interest_count} 个兴趣标签: {scholar_id}")
            
            # 4. 导入论文数据
            publications = data.get('publications', [])
            self.logger.info(f"导入 {len(publications)} 篇论文 - 学者: {scholar_name}")
            imported_count = 0
            for pub in publications:
                if self._import_publication(scholar_id, pub):
                    imported_count += 1
            self.logger.info(f"成功导入 {imported_count}/{len(publications)} 篇论文 - 学者: {scholar_name}")
            
            # 5. 导入合作者关系
            coauthors = data.get('coauthors', [])
            self.logger.info(f"导入 {len(coauthors)} 位合作者 - 学者: {scholar_name}")
            imported_coauthor_count = 0
            for coauthor in coauthors:
                if self._import_coauthor(scholar_id, coauthor):
                    imported_coauthor_count += 1
            self.logger.info(f"成功导入 {imported_coauthor_count}/{len(coauthors)} 位合作者 - 学者: {scholar_name}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"导入学者数据时出错: {str(e)}")
            return False
    
    def _import_publication(self, scholar_id, pub_data):
        """导入论文数据
        
        Args:
            scholar_id: 学者ID
            pub_data: 论文数据
            
        Returns:
            bool: 是否成功
        """
        try:
            # 创建论文记录
            success, cites_id = self.publication_dao.create_publication(pub_data, scholar_id)
            
            if not success or not cites_id:
                self.stats['skipped_pubs'] += 1
                return False
            
            # 检查是否已经处理过这篇论文
            if cites_id in self.processed_publications:
                # 已处理，只需添加作者关系
                self.authorship_dao.create_authorship(scholar_id, cites_id)
                return True
                
            self.processed_publications.add(cites_id)
            self.stats['imported_pubs'] += 1
            
            # 创建实体记录(如果还没有)
            # 提取论文标题
            bib = pub_data.get('bib', {})
            title = bib.get('title', 'Untitled')
            
            # 获取pub_id (用于保持兼容)
            author_pub_id = pub_data.get('author_pub_id')
            pub_id = author_pub_id if author_pub_id else f"pub_{hashlib.md5(cites_id.encode('utf-8')).hexdigest()[:12]}"
            
            entity_data = {
                'pub_year': bib.get('pub_year', bib.get('year')),
                'venue': bib.get('venue')
            }
            
            # 创建实体
            self.entity_dao.create_entity(
                id=pub_id, 
                type='publication',
                name=title,
                data=entity_data
            )
            
            # 建立作者关系
            self.authorship_dao.create_authorship(scholar_id, cites_id)
            
            return True
            
        except Exception as e:
            self.logger.error(f"导入论文时出错: {str(e)}")
            return False
    
    def _import_coauthor(self, scholar_id, coauthor_data):
        """导入合作者关系
        
        Args:
            scholar_id: 学者ID
            coauthor_data: 合作者数据
            
        Returns:
            bool: 是否成功
        """
        try:
            # 检查必要字段
            coauthor_id = coauthor_data.get('scholar_id')
            if not coauthor_id:
                return False
            
            coauthor_name = coauthor_data.get('name', 'Unknown Scholar')
            
            # 1. 创建合作者详情
            success = self.scholar_dao.create_coauthor(coauthor_id, coauthor_data)
            if not success:
                self.logger.warning(f"创建合作者详情失败: {coauthor_id}, {coauthor_name}")
            
            # 2. 检查合作者实体是否已存在
            if not self.entity_dao.entity_exists(coauthor_id):
                # 创建合作者实体
                entity_data = {'is_coauthor': True}
                self.entity_dao.create_entity(
                    id=coauthor_id,
                    type='scholar',
                    name=coauthor_name,
                    data=entity_data
                )
                self.logger.info(f"创建合作者实体: {coauthor_id}, {coauthor_name}")
            
            # 3. 创建合作关系
            # 计算权重(合作次数)
            weight = coauthor_data.get('co_authored_papers', 1)
            
            # 创建双向关系
            self.relationship_dao.create_relationship(
                source_id=scholar_id,
                target_id=coauthor_id,
                relation_type='coauthor',
                weight=weight
            )
            
            self.relationship_dao.create_relationship(
                source_id=coauthor_id,
                target_id=scholar_id,
                relation_type='coauthor',
                weight=weight
            )
            
            self.stats['coauthor_relationships'] += 1
            return True
            
        except Exception as e:
            self.logger.error(f"导入合作者关系时出错: {str(e)}")
            return False
    
    def extract_and_save_institutions(self):
        """从学者表中提取机构信息并保存
        
        Returns:
            int: 添加的机构数量
        """
        return self.institution_dao.extract_and_save_institutions_from_scholars()
    
    def create_scholar_institution_relationships(self):
        """创建学者和机构的关联关系
        
        Returns:
            int: 创建的关系数量
        """
        return self.relationship_dao.create_scholar_institutions_from_scholars()
    
    def get_import_stats(self):
        """获取导入统计信息
        
        Returns:
            dict: 统计信息
        """
        return self.stats


def import_all_scholar_files(data_dir=None, db_path=None):
    """导入目录下的所有学者JSON文件
    
    Args:
        data_dir: 数据目录路径，默认为./data/scholars
        db_path: 数据库路径，默认为./data/scholar.db
        
    Returns:
        tuple: (成功导入文件数, 总文件数)
    """
    # 默认数据目录
    if not data_dir:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        data_dir = os.path.join(base_dir, 'data', 'scholars')
    
    # 配置日志    
    log_file = os.path.join(os.path.dirname(data_dir), 'import_log.txt')
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, mode='w'),
            logging.StreamHandler()
        ]
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"开始从目录导入学者数据: {data_dir}")
    
    # 连接数据库
    if db_path:
        os.environ['SCHOLAR_DB_PATH'] = db_path
        
    # 创建导入器
    importer = ScholarImporter()
    
    try:
        # 遍历目录
        file_count = 0
        success_count = 0
        
        for root, _, files in os.walk(data_dir):
            for file in sorted(files):
                if file.endswith('.json'):
                    file_path = os.path.join(root, file)
                    file_count += 1
                    
                    logger.info(f"正在处理文件 ({file_count}): {file}")
                    success, scholar_id = importer.import_scholar_file(file_path)
                    
                    if success:
                        success_count += 1
                        logger.info(f"成功导入: {file} → 学者ID: {scholar_id}")
                    else:
                        logger.error(f"导入失败: {file}")
        
        # 提取和创建机构信息
        logger.info("开始提取机构信息...")
        institution_count = importer.extract_and_save_institutions()
        logger.info(f"提取并保存了 {institution_count} 条机构记录")
        
        # 创建学者-机构关系
        logger.info("开始创建学者-机构关系...")
        relationship_count = importer.create_scholar_institution_relationships()
        logger.info(f"创建了 {relationship_count} 条学者-机构关系")
        
        # 打印导入统计信息
        stats = importer.get_import_stats()
        logger.info("导入统计信息:")
        logger.info(f"- 总文件数: {file_count}")
        logger.info(f"- 成功导入文件数: {success_count}")
        logger.info(f"- 导入论文数: {stats['imported_pubs']}")
        logger.info(f"- 跳过论文数: {stats['skipped_pubs']}")
        logger.info(f"- 有引用ID的论文: {stats['pub_with_cites_id']}")
        logger.info(f"- 无引用ID的论文: {stats['pub_without_cites_id']}")
        logger.info(f"- 合作者关系数: {stats['coauthor_relationships']}")
        
        return success_count, file_count
        
    except Exception as e:
        logger.error(f"导入过程中出错: {str(e)}")
        return 0, file_count


if __name__ == "__main__":
    import_all_scholar_files() 