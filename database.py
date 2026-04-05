import sqlite3
import datetime
import os

DB_FILENAME = os.path.join(os.path.dirname(__file__), "scans.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILENAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_scan(type_str: str, data_str: str):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('INSERT INTO scans (type, data) VALUES (?, ?)', (type_str, data_str))
    conn.commit()
    scan_id = c.lastrowid
    conn.close()
    return scan_id

def get_all_scans(limit=50):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM scans ORDER BY timestamp DESC LIMIT ?', (limit,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_analytics():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Total scans
    c.execute('SELECT COUNT(*) FROM scans')
    total = c.fetchone()[0]
    
    # QR vs Barcode
    c.execute('SELECT type, COUNT(*) FROM scans GROUP BY type')
    distribution_rows = c.fetchall()
    distribution = {row['type']: row[1] for row in distribution_rows}
    
    # Fill in zeros for missing types to make frontend charts easier
    if 'QR' not in distribution:
        distribution['QR'] = 0
    if 'BARCODE' not in distribution:
        distribution['BARCODE'] = 0
    
    # Daily trend (last 7 days)
    c.execute("SELECT date(timestamp) as scan_date, COUNT(*) FROM scans GROUP BY scan_date ORDER BY scan_date DESC LIMIT 7")
    daily_trend = {row['scan_date']: row[1] for row in c.fetchall()}
    
    conn.close()
    return {
        "total": total,
        "distribution": distribution,
        "daily_trend": daily_trend
    }
