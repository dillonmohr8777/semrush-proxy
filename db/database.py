"""
SQLite trade journal using SQLAlchemy Core (no ORM).
Stores every fill, daily summaries, and strategy performance metrics.
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

from sqlalchemy import (
    create_engine, MetaData, Table, Column,
    String, Float, Integer, DateTime, Text, Boolean,
    insert, select, func, and_
)

from config.settings import DB_PATH

logger = logging.getLogger(__name__)

metadata = MetaData()

trades_table = Table("trades", metadata,
    Column("id",          Integer,  primary_key=True, autoincrement=True),
    Column("order_id",    String,   unique=True, nullable=False),
    Column("product_id",  String,   nullable=False),
    Column("side",        String,   nullable=False),   # BUY / SELL
    Column("price",       Float),
    Column("quantity",    Float),
    Column("size_usd",    Float),
    Column("fee",         Float,    default=0.0),
    Column("pnl",         Float,    default=0.0),      # 0 for BUY legs
    Column("strategy",    String),
    Column("reason",      Text),
    Column("stop_loss",   Float),
    Column("take_profit", Float),
    Column("mode",        String),                     # paper / live
    Column("timestamp",   DateTime(timezone=True), default=datetime.utcnow),
)

daily_stats_table = Table("daily_stats", metadata,
    Column("id",            Integer,  primary_key=True, autoincrement=True),
    Column("date",          String,   unique=True),
    Column("realized_pnl",  Float,    default=0.0),
    Column("trades",        Integer,  default=0),
    Column("wins",          Integer,  default=0),
    Column("losses",        Integer,  default=0),
    Column("win_rate",      Float,    default=0.0),
    Column("ending_capital",Float,    default=0.0),
)

strategy_stats_table = Table("strategy_stats", metadata,
    Column("id",        Integer, primary_key=True, autoincrement=True),
    Column("strategy",  String),
    Column("product_id",String),
    Column("trades",    Integer, default=0),
    Column("wins",      Integer, default=0),
    Column("total_pnl", Float,   default=0.0),
    Column("updated_at",DateTime(timezone=True), default=datetime.utcnow),
)


class TradeDB:
    def __init__(self, db_path: str = DB_PATH):
        self.engine = create_engine(f"sqlite:///{db_path}", future=True)
        metadata.create_all(self.engine)
        logger.info(f"Database ready at {db_path}")

    # ─── Writes ──────────────────────────────────────────────────────────────

    def record_fill(self, fill: Dict):
        """Insert a trade fill record."""
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(trades_table).values(
                    order_id    = fill.get("order_id", ""),
                    product_id  = fill.get("product_id", ""),
                    side        = fill.get("side", ""),
                    price       = fill.get("price"),
                    quantity    = fill.get("quantity"),
                    size_usd    = fill.get("size_usd"),
                    fee         = fill.get("fee", 0.0),
                    pnl         = fill.get("pnl", 0.0),
                    strategy    = fill.get("strategy", ""),
                    reason      = fill.get("reason", ""),
                    stop_loss   = fill.get("stop_loss"),
                    take_profit = fill.get("take_profit"),
                    mode        = fill.get("mode", "paper"),
                    timestamp   = datetime.now(timezone.utc),
                ))
        except Exception as e:
            logger.error(f"DB record_fill error: {e}")

    def upsert_daily_stats(self, stats: Dict):
        """Upsert the daily summary row."""
        try:
            with self.engine.begin() as conn:
                existing = conn.execute(
                    select(daily_stats_table).where(
                        daily_stats_table.c.date == stats["date"]
                    )
                ).fetchone()
                if existing:
                    from sqlalchemy import update
                    conn.execute(
                        update(daily_stats_table)
                        .where(daily_stats_table.c.date == stats["date"])
                        .values(**{k: v for k, v in stats.items() if k != "date"})
                    )
                else:
                    conn.execute(insert(daily_stats_table).values(**stats))
        except Exception as e:
            logger.error(f"DB upsert_daily_stats error: {e}")

    # ─── Reads ───────────────────────────────────────────────────────────────

    def get_recent_trades(self, limit: int = 50, mode: str = None) -> List[Dict]:
        with self.engine.connect() as conn:
            q = select(trades_table).order_by(
                trades_table.c.timestamp.desc()
            ).limit(limit)
            if mode:
                q = q.where(trades_table.c.mode == mode)
            rows = conn.execute(q).fetchall()
            return [dict(r._mapping) for r in rows]

    def get_strategy_performance(self) -> List[Dict]:
        with self.engine.connect() as conn:
            q = (
                select(
                    trades_table.c.strategy,
                    func.count(trades_table.c.id).label("trades"),
                    func.sum(trades_table.c.pnl).label("total_pnl"),
                    func.avg(trades_table.c.pnl).label("avg_pnl"),
                    func.sum(
                        (trades_table.c.pnl > 0).cast(Integer)
                    ).label("wins"),
                )
                .where(trades_table.c.side == "SELL")
                .group_by(trades_table.c.strategy)
            )
            rows = conn.execute(q).fetchall()
            return [dict(r._mapping) for r in rows]

    def get_daily_history(self, days: int = 30) -> List[Dict]:
        with self.engine.connect() as conn:
            q = select(daily_stats_table).order_by(
                daily_stats_table.c.date.desc()
            ).limit(days)
            rows = conn.execute(q).fetchall()
            return [dict(r._mapping) for r in rows]

    def total_pnl(self, mode: str = None) -> float:
        with self.engine.connect() as conn:
            q = select(func.sum(trades_table.c.pnl)).where(
                trades_table.c.side == "SELL"
            )
            if mode:
                q = q.where(trades_table.c.mode == mode)
            result = conn.execute(q).scalar()
            return float(result or 0.0)
