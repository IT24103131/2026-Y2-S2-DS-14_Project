import sys
import os

scripts_dir = os.path.dirname(os.path.abspath(__file__))
app_dir     = os.path.abspath(os.path.join(scripts_dir, ".."))
sys.path.insert(0, app_dir)

from db import SessionLocal
from trainer import train_from_db


def main():
    db = SessionLocal()
    try:
        res = train_from_db(db)
        print("✅ trained:", res)
        print(f"   clusters updated : {res['clusters']}")
        print(f"   feedback rows used: {res['rows_used']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()