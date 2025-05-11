"""
数据库模型定义
定义数据库表结构和字段映射
"""

# 数据库表结构SQL定义
SCHEMA_SQL = """
-- 学者详情表
CREATE TABLE IF NOT EXISTS scholars (
    scholar_id TEXT PRIMARY KEY,
    affiliation TEXT,
    email_domain TEXT,
    homepage TEXT,
    url_picture TEXT,
    citedby INTEGER DEFAULT 0,
    citedby5y INTEGER DEFAULT 0,
    hindex INTEGER DEFAULT 0,
    hindex5y INTEGER DEFAULT 0,
    i10index INTEGER DEFAULT 0,
    i10index5y INTEGER DEFAULT 0,
    cites_per_year TEXT,
    public_access_available INTEGER DEFAULT 0,
    public_access_unavailable INTEGER DEFAULT 0,
    last_updated TIMESTAMP,
    is_main_scholar INTEGER DEFAULT 0
);

-- 论文表 - 使用cites_id作为主键
CREATE TABLE IF NOT EXISTS publications (
    cites_id TEXT PRIMARY KEY,
    pub_id TEXT,
    title TEXT NOT NULL,
    year INTEGER,
    venue TEXT,
    citation_text TEXT,
    num_citations INTEGER DEFAULT 0,
    citedby_url TEXT
);

-- 机构表 - 删除location字段，添加lab字段
CREATE TABLE IF NOT EXISTS institutions (
    inst_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    url TEXT,
    lab TEXT,
    country TEXT,
    region TEXT
);

-- 实体表
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 关系表
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    is_custom BOOLEAN DEFAULT 0,
    data TEXT,
    FOREIGN KEY (source_id) REFERENCES entities(id),
    FOREIGN KEY (target_id) REFERENCES entities(id)
);

-- 兴趣/标签表
CREATE TABLE IF NOT EXISTS interests (
    entity_id TEXT NOT NULL,
    interest TEXT NOT NULL,
    is_custom BOOLEAN DEFAULT 0,
    PRIMARY KEY (entity_id, interest),
    FOREIGN KEY (entity_id) REFERENCES entities(id)
);

-- 发表关系表 - 添加独立id作为主键，使用cites_id而不是pub_id
CREATE TABLE IF NOT EXISTS authorship (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scholar_id TEXT NOT NULL,
    cites_id TEXT NOT NULL,
    is_corresponding BOOLEAN DEFAULT 0,
    UNIQUE(scholar_id, cites_id),
    FOREIGN KEY (scholar_id) REFERENCES entities(id),
    FOREIGN KEY (cites_id) REFERENCES publications(cites_id)
);

-- 学者-机构关系表
CREATE TABLE IF NOT EXISTS scholar_institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scholar_id TEXT NOT NULL,
    inst_id TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    is_current BOOLEAN DEFAULT 1,
    UNIQUE(scholar_id, inst_id),
    FOREIGN KEY (scholar_id) REFERENCES scholars(scholar_id),
    FOREIGN KEY (inst_id) REFERENCES institutions(inst_id)
);

-- 索引创建
CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(relation_type);
CREATE INDEX IF NOT EXISTS idx_scholar_affiliation ON scholars(affiliation);
CREATE INDEX IF NOT EXISTS idx_publication_year ON publications(year);
CREATE INDEX IF NOT EXISTS idx_interests ON interests(interest);
CREATE INDEX IF NOT EXISTS idx_publication_cites_id ON publications(cites_id);
CREATE INDEX IF NOT EXISTS idx_publication_pub_id ON publications(pub_id);
CREATE INDEX IF NOT EXISTS idx_scholar_main ON scholars(is_main_scholar);
CREATE INDEX IF NOT EXISTS idx_scholar_institutions ON scholar_institutions(scholar_id, inst_id);
"""

# 版本表SQL，用于跟踪数据库模式变更
VERSION_SQL = """
CREATE TABLE IF NOT EXISTS db_version (
    version INTEGER PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始版本
INSERT OR IGNORE INTO db_version (version, description) VALUES (1, 'Initial schema');
"""


# 数据库初始化函数
def init_db(db_manager):
    """初始化数据库表结构"""
    db_manager.execute_script(SCHEMA_SQL)
    db_manager.execute_script(VERSION_SQL)
    db_manager.commit()

    # 检查当前版本
    cursor = db_manager.execute(
        "SELECT MAX(version) as current_version FROM db_version"
    )
    result = cursor.fetchone()
    current_version = result.get("current_version", 0) if result else 0

    # 根据版本号执行升级脚本
    if current_version < 2:
        # 添加is_main_scholar字段的升级脚本
        try:
            # 检查字段是否已存在
            cursor = db_manager.execute("PRAGMA table_info(scholars)")
            columns = cursor.fetchall()
            has_is_main_scholar = any(
                col["name"] == "is_main_scholar" for col in columns
            )

            if not has_is_main_scholar:
                print("添加 is_main_scholar 字段到 scholars 表...")
                db_manager.execute(
                    "ALTER TABLE scholars ADD COLUMN is_main_scholar INTEGER DEFAULT 0"
                )

                # 将所有现有学者标记为主要学者
                # 假设直接存在data/scholars目录下的JSON文件对应的学者为主要学者
                db_manager.execute(
                    """
                UPDATE scholars 
                SET is_main_scholar = 1 
                WHERE scholar_id IN (
                    SELECT id FROM entities WHERE type = 'scholar'
                )
                """
                )

                db_manager.execute(
                    "INSERT INTO db_version (version, description) VALUES (2, 'Added is_main_scholar field')"
                )
                db_manager.commit()
                print("数据库升级完成：已添加 is_main_scholar 字段")
        except Exception as e:
            print(f"数据库升级失败: {str(e)}")
            db_manager.rollback()

    if current_version < 3:
        try:
            print("数据库架构更新: 重新设计tables")
            db_manager.execute(
                "INSERT INTO db_version (version, description) VALUES (3, 'Redesigned schema with cites_id as primary key')"
            )
            db_manager.commit()
            print("数据库升级完成：更新了表结构")
        except Exception as e:
            print(f"数据库升级失败: {str(e)}")
            db_manager.rollback()

    return current_version
