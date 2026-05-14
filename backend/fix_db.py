import sqlite3

def fix_db():
    try:
        conn = sqlite3.connect('db.sqlite3')
        conn.execute('ALTER TABLE timetable_systemconfiguration ADD COLUMN working_days TEXT NOT NULL DEFAULT \'["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]\';')
        conn.commit()
        conn.close()
        print('Done')
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    fix_db()
