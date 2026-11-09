import sqlite3
import psycopg2
import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.config import DATABASE_URL

def compare():
    # SQLite connection
    sqlite_conn = sqlite3.connect(os.path.join(backend_dir, "stackzyro.db"))
    sqlite_cur = sqlite_conn.cursor()

    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    sqlite_tables = sorted([r[0] for r in sqlite_cur.fetchall()])

    # Neon PostgreSQL connection
    pg_url = DATABASE_URL
    if "+psycopg2" in pg_url:
        pg_url = pg_url.replace("+psycopg2", "")
    elif "+psycopg" in pg_url:
        pg_url = pg_url.replace("+psycopg", "")

    pg_conn = psycopg2.connect(pg_url)
    pg_cur = pg_conn.cursor()

    pg_cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    pg_tables = set(r[0] for r in pg_cur.fetchall())

    results = []
    for tbl in sqlite_tables:
        sqlite_cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
        s_cnt = sqlite_cur.fetchone()[0]

        if tbl in pg_tables:
            pg_cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
            p_cnt = pg_cur.fetchone()[0]
        else:
            p_cnt = "MISSING"

        results.append((tbl, s_cnt, p_cnt))

    # Also check if any tables in Neon don't exist in SQLite
    extra_pg = pg_tables - set(sqlite_tables)

    print("\n" + "=" * 65)
    print(f"{'TABLE NAME':<30} | {'SQLITE (LOCAL)':<15} | {'NEON (REMOTE)':<15}")
    print("=" * 65)
    total_sqlite = 0
    total_neon = 0
    for tbl, s_cnt, p_cnt in results:
        print(f"{tbl:<30} | {s_cnt:<15} | {p_cnt:<15}")
        total_sqlite += s_cnt
        if isinstance(p_cnt, int):
            total_neon += p_cnt
    print("-" * 65)
    print(f"{'TOTAL ROWS':<30} | {total_sqlite:<15} | {total_neon:<15}")
    print("=" * 65)

    if extra_pg:
        print("\nAdditional tables in Neon (not in SQLite):", sorted(list(extra_pg)))

    sqlite_conn.close()
    pg_conn.close()

if __name__ == "__main__":
    compare()
