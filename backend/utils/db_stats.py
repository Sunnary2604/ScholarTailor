#!/usr/bin/env python
# -*- coding: utf-8 -*-

from db.db_manager import DBManager
import json

db = DBManager()
print('数据库表和记录数:')
cursor = db.execute('SELECT name FROM sqlite_master WHERE type="table"')
tables = [row['name'] for row in cursor.fetchall()]

for table in tables:
    count = db.execute(f'SELECT COUNT(*) as count FROM {table}').fetchone()['count']
    print(f'- {table}表: {count}条记录')

# 获取主要学者和关联学者的数量
main_scholars = db.execute('SELECT COUNT(*) as count FROM scholars WHERE is_main_scholar = 1').fetchone()['count']
secondary_scholars = db.execute('SELECT COUNT(*) as count FROM scholars WHERE is_main_scholar = 0').fetchone()['count']
print(f'\n主要学者数量: {main_scholars}')
print(f'关联学者数量: {secondary_scholars}')

# 获取top 10 scholars by publications count
print('\nTop 10 学者(按论文数量):')
top_scholars = db.execute('''
    SELECT e.name, COUNT(a.cites_id) as pub_count 
    FROM authorship a 
    JOIN entities e ON a.scholar_id = e.id 
    GROUP BY a.scholar_id 
    ORDER BY pub_count DESC 
    LIMIT 10
''').fetchall()
for i, scholar in enumerate(top_scholars):
    print(f'{i+1}. {scholar["name"]}: {scholar["pub_count"]}篇论文')

# 获取top 10 scholars by coauthor count
print('\nTop 10 学者(按合作者数量):')
top_coauthors = db.execute('''
    SELECT e.name, COUNT(DISTINCT r.target_id) as coauthor_count 
    FROM relationships r 
    JOIN entities e ON r.source_id = e.id 
    WHERE r.relation_type = 'coauthor' 
    GROUP BY r.source_id 
    ORDER BY coauthor_count DESC 
    LIMIT 10
''').fetchall()
for i, scholar in enumerate(top_coauthors):
    print(f'{i+1}. {scholar["name"]}: {scholar["coauthor_count"]}位合作者')

# 获取top 10 publications by citation count
print('\nTop 10 最多引用的论文:')
top_publications = db.execute('''
    SELECT p.title, p.num_citations 
    FROM publications p  
    ORDER BY p.num_citations DESC 
    LIMIT 10
''').fetchall()
for i, pub in enumerate(top_publications):
    print(f'{i+1}. {pub["title"]}: {pub["num_citations"]}次引用')

# 获取Top 10学者兴趣标签
print('\nTop 10 学者兴趣标签:')
top_interests = db.execute('''
    SELECT interest, COUNT(*) as count 
    FROM interests 
    GROUP BY interest 
    ORDER BY count DESC 
    LIMIT 10
''').fetchall()
for i, interest in enumerate(top_interests):
    print(f'{i+1}. {interest["interest"]}: {interest["count"]}位学者')

# 按机构统计学者数量
print('\n按机构统计的学者数量:')
scholars_by_affiliation = db.execute('''
    SELECT affiliation, COUNT(*) as count 
    FROM scholars 
    WHERE affiliation != '' 
    GROUP BY affiliation 
    ORDER BY count DESC 
    LIMIT 10
''').fetchall()
for i, row in enumerate(scholars_by_affiliation):
    print(f'{i+1}. {row["affiliation"] or "未知"}: {row["count"]}位学者')

# 按出版年份统计论文数量
print('\n按出版年份统计的论文数量:')
papers_by_year = db.execute('''
    SELECT year, COUNT(*) as count 
    FROM publications 
    WHERE year IS NOT NULL AND year > 1000 
    GROUP BY year 
    ORDER BY year DESC 
    LIMIT 10
''').fetchall()
for i, row in enumerate(papers_by_year):
    print(f'{row["year"]}年: {row["count"]}篇论文')

# 论文引用统计
total_citations = db.execute('SELECT SUM(num_citations) as total FROM publications').fetchone()['total'] or 0
avg_citations = db.execute('SELECT AVG(num_citations) as avg FROM publications WHERE num_citations > 0').fetchone()['avg'] or 0
zero_citations = db.execute('SELECT COUNT(*) as count FROM publications WHERE num_citations = 0').fetchone()['count']
total_papers = db.execute('SELECT COUNT(*) as count FROM publications').fetchone()['count']

print('\n论文引用统计:')
print(f'总引用次数: {total_citations}')
print(f'平均引用次数: {avg_citations:.2f}')
print(f'无引用论文数量: {zero_citations} ({zero_citations/total_papers*100:.2f}%)')

# =====新增分析=====
# Top 10合作关系(哪两位学者合作最多)
print('\nTop 10 最多合作的学者对:')
top_collaborations = db.execute('''
    SELECT 
        e1.name as scholar1, 
        e2.name as scholar2, 
        COUNT(DISTINCT a1.cites_id) as collab_count
    FROM 
        authorship a1
    JOIN 
        authorship a2 ON a1.cites_id = a2.cites_id AND a1.scholar_id < a2.scholar_id
    JOIN 
        entities e1 ON a1.scholar_id = e1.id
    JOIN 
        entities e2 ON a2.scholar_id = e2.id
    GROUP BY 
        a1.scholar_id, a2.scholar_id
    ORDER BY 
        collab_count DESC
    LIMIT 10
''').fetchall()
for i, collab in enumerate(top_collaborations):
    print(f'{i+1}. {collab["scholar1"]} & {collab["scholar2"]}: 共同发表{collab["collab_count"]}篇论文')

# 计算平均每位学者的合作者数量
avg_coauthors = db.execute('''
    SELECT AVG(coauthor_count) as avg_count 
    FROM (
        SELECT source_id, COUNT(DISTINCT target_id) as coauthor_count 
        FROM relationships 
        WHERE relation_type = 'coauthor' 
        GROUP BY source_id
    )
''').fetchone()['avg_count']
print(f'\n平均每位学者的合作者数量: {avg_coauthors:.2f}')

# 分析主要学者与关联学者的关系分布
main_scholar_connections = db.execute('''
    SELECT 
        COUNT(*) as connection_count
    FROM 
        relationships r
    JOIN 
        scholars s1 ON r.source_id = s1.scholar_id
    JOIN 
        scholars s2 ON r.target_id = s2.scholar_id
    WHERE 
        r.relation_type = 'coauthor'
        AND s1.is_main_scholar = 1
        AND s2.is_main_scholar = 1
''').fetchone()['connection_count']

main_to_secondary_connections = db.execute('''
    SELECT 
        COUNT(*) as connection_count
    FROM 
        relationships r
    JOIN 
        scholars s1 ON r.source_id = s1.scholar_id
    JOIN 
        scholars s2 ON r.target_id = s2.scholar_id
    WHERE 
        r.relation_type = 'coauthor'
        AND ((s1.is_main_scholar = 1 AND s2.is_main_scholar = 0)
             OR (s1.is_main_scholar = 0 AND s2.is_main_scholar = 1))
''').fetchone()['connection_count']

print('\n学者关系分布:')
print(f'主要学者之间的合作关系: {main_scholar_connections}')
print(f'主要学者与关联学者之间的合作关系: {main_to_secondary_connections}')

# 频繁合作的学者对
print('\n频繁合作的学者对(至少合作3篇论文):')
scholar_pairs = db.execute('''
    SELECT 
        e1.name as scholar1, 
        e2.name as scholar2,
        COUNT(DISTINCT a1.cites_id) as paper_count
    FROM 
        authorship a1
    JOIN 
        authorship a2 ON a1.cites_id = a2.cites_id AND a1.scholar_id < a2.scholar_id
    JOIN 
        entities e1 ON a1.scholar_id = e1.id
    JOIN 
        entities e2 ON a2.scholar_id = e2.id
    GROUP BY 
        a1.scholar_id, a2.scholar_id
    HAVING 
        paper_count >= 3
    ORDER BY 
        paper_count DESC
    LIMIT 15
''').fetchall()

for i, pair in enumerate(scholar_pairs):
    print(f'{i+1}. {pair["scholar1"]} & {pair["scholar2"]}: 共同发表{pair["paper_count"]}篇论文')

# 学者-机构统计
print('\n学者-机构统计:')
institution_scholar_counts = db.execute('''
    SELECT 
        i.name as institution_name,
        COUNT(DISTINCT si.scholar_id) as scholar_count
    FROM 
        scholar_institutions si
    JOIN 
        institutions i ON si.inst_id = i.inst_id
    GROUP BY 
        i.inst_id
    ORDER BY 
        scholar_count DESC
    LIMIT 10
''').fetchall()

for i, inst in enumerate(institution_scholar_counts):
    print(f'{i+1}. {inst["institution_name"]}: {inst["scholar_count"]}位学者')

db.close() 