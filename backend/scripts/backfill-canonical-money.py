#!/usr/bin/env python3

import argparse
import sqlite3
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

INT_MIN = -2147483648
INT_MAX = 2147483647

EXPECTED = {
    ("Proposal", "totalAmount", "totalAmountCents"): 7,
    ("Proposal", "entryAmount", "entryAmountCents"): 7,
    ("Proposal", "installmentAmount", "installmentAmountCents"): 6,
    ("ProposalItem", "unitAmount", "unitAmountCents"): 7,
    ("ProposalItem", "totalAmount", "totalAmountCents"): 7,
    ("Contract", "contractValue", "contractValueCents"): 8,
    ("Contract", "entryAmount", "entryAmountCents"): 8,
}

EXPECTED_TOTAL = sum(EXPECTED.values())


def to_cents(value):
    if value is None:
        return None

    cents = int(
        (Decimal(str(value)) * Decimal("100")).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )

    if cents < INT_MIN or cents > INT_MAX:
        raise RuntimeError(
            f"valor fora do Prisma Int: {value!r} -> {cents}"
        )

    return cents


def assert_schema(con):
    required = {
        "Proposal": {
            "id",
            "totalAmount",
            "totalAmountCents",
            "entryAmount",
            "entryAmountCents",
            "installmentAmount",
            "installmentAmountCents",
        },
        "ProposalItem": {
            "id",
            "proposalId",
            "unitAmount",
            "unitAmountCents",
            "totalAmount",
            "totalAmountCents",
        },
        "Contract": {
            "id",
            "proposalId",
            "contractValue",
            "contractValueCents",
            "entryAmount",
            "entryAmountCents",
        },
        "Protocol": {
            "id",
            "estimatedValueCents",
            "finalValueCents",
        },
        "FinancialTransaction": {
            "id",
            "amountCents",
        },
    }

    for table, expected_cols in required.items():
        cols = {
            row[1]
            for row in con.execute(
                f'PRAGMA table_info("{table}")'
            )
        }

        missing = expected_cols - cols

        if missing:
            raise RuntimeError(
                f"{table}: colunas ausentes: {sorted(missing)}"
            )


def assert_migration(con):
    target = "20260916163706_add_canonical_money_cents_fields"

    row = con.execute(
        """
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        WHERE migration_name = ?
        """,
        (target,),
    ).fetchone()

    if not row:
        raise RuntimeError(
            f"migration canônica ausente: {target}"
        )

    if row[1] is None or row[2] is not None:
        raise RuntimeError(
            f"migration canônica não está APPLIED: {row!r}"
        )


def count_candidates(con):
    result = {}

    for (table, source, target), expected in EXPECTED.items():
        count = con.execute(
            f'''
            SELECT COUNT(*)
            FROM "{table}"
            WHERE "{source}" IS NOT NULL
              AND "{target}" IS NULL
            '''
        ).fetchone()[0]

        result[(table, source, target)] = count

        print(
            f"{table}.{target}: "
            f"candidates={count} expected={expected}"
        )

    return result


def assert_preconditions(con):
    print("\n===== PRECONDITIONS =====")

    counts = count_candidates(con)

    for key, expected in EXPECTED.items():
        actual = counts[key]

        if actual != expected:
            table, _, target = key
            raise RuntimeError(
                f"{table}.{target}: "
                f"esperado={expected} encontrado={actual}"
            )

    protocol = con.execute(
        """
        SELECT COUNT(*)
        FROM Protocol
        WHERE estimatedValueCents IS NOT NULL
           OR finalValueCents IS NOT NULL
        """
    ).fetchone()[0]

    ft = con.execute(
        """
        SELECT COUNT(*)
        FROM FinancialTransaction
        WHERE amountCents IS NOT NULL
        """
    ).fetchone()[0]

    print("Protocol cents =", protocol)
    print("FinancialTransaction cents =", ft)

    if protocol != 0:
        raise RuntimeError(
            "Protocol possui campos cents preenchidos; abortando."
        )

    if ft != 0:
        raise RuntimeError(
            "FinancialTransaction.amountCents preenchido; abortando."
        )


def validate_relations(con):
    print("\n===== VALIDATION: PROPOSAL × ITEMS =====")

    for row in con.execute(
        """
        SELECT
            p.id,
            p.totalAmountCents,
            SUM(i.totalAmountCents) AS itemsCents
        FROM Proposal p
        LEFT JOIN ProposalItem i
          ON i.proposalId = p.id
        GROUP BY p.id
        ORDER BY p.id
        """
    ):
        ok = row[1] == row[2]

        print(
            f"proposal={row[0]} "
            f"total={row[1]} "
            f"items={row[2]} "
            f"{'OK' if ok else 'FAIL'}"
        )

        if not ok:
            raise RuntimeError(
                f"Proposal {row[0]}: total != items"
            )

    print("\n===== VALIDATION: PROPOSAL × SCHEDULE =====")

    for row in con.execute(
        """
        SELECT
            p.id,
            p.totalAmountCents,
            COUNT(s.id),
            COALESCE(SUM(s.amountCents), 0)
        FROM Proposal p
        LEFT JOIN ProposalPaymentSchedule s
          ON s.proposalId = p.id
        GROUP BY p.id
        ORDER BY p.id
        """
    ):
        if row[2] == 0:
            status = "NO_SCHEDULE"
        elif row[1] == row[3]:
            status = "OK"
        else:
            raise RuntimeError(
                f"Proposal {row[0]}: total != schedule"
            )

        print(
            f"proposal={row[0]} "
            f"total={row[1]} "
            f"schedule={row[3]} "
            f"{status}"
        )

    print("\n===== VALIDATION: CONTRACT × PROPOSAL =====")

    for row in con.execute(
        """
        SELECT
            c.id,
            c.proposalId,
            c.contractValueCents,
            c.entryAmountCents,
            p.totalAmountCents,
            p.entryAmountCents
        FROM Contract c
        LEFT JOIN Proposal p
          ON p.id = c.proposalId
        ORDER BY c.id
        """
    ):
        if row[1] is None:
            status = "NO_PROPOSAL"
        elif row[2] == row[4] and row[3] == row[5]:
            status = "OK"
        else:
            raise RuntimeError(
                f"Contract {row[0]}: contract != proposal"
            )

        print(
            f"contract={row[0]} "
            f"proposal={row[1]} "
            f"{status}"
        )

    print("\n===== VALIDATION: CONTRACT × SCHEDULE =====")

    for row in con.execute(
        """
        SELECT
            c.id,
            c.contractValueCents,
            COUNT(s.id),
            COALESCE(SUM(s.amountCents), 0)
        FROM Contract c
        LEFT JOIN ContractPaymentSchedule s
          ON s.contractId = c.id
        GROUP BY c.id
        ORDER BY c.id
        """
    ):
        if row[2] == 0:
            status = "NO_SCHEDULE"
        elif row[1] == row[3]:
            status = "OK"
        else:
            raise RuntimeError(
                f"Contract {row[0]}: total != schedule"
            )

        print(
            f"contract={row[0]} "
            f"total={row[1]} "
            f"schedule={row[3]} "
            f"{status}"
        )


def apply_backfill(con):
    changed = 0

    print("\n===== APPLY =====")

    for (table, source, target), expected in EXPECTED.items():
        rows = con.execute(
            f'''
            SELECT id, "{source}"
            FROM "{table}"
            WHERE "{source}" IS NOT NULL
              AND "{target}" IS NULL
            ORDER BY id
            '''
        ).fetchall()

        if len(rows) != expected:
            raise RuntimeError(
                f"{table}.{target}: "
                f"esperado={expected} encontrado={len(rows)}"
            )

        for row_id, source_value in rows:
            proposed = to_cents(source_value)

            cur = con.execute(
                f'''
                UPDATE "{table}"
                SET "{target}" = ?
                WHERE id = ?
                  AND "{target}" IS NULL
                ''',
                (proposed, row_id),
            )

            if cur.rowcount != 1:
                raise RuntimeError(
                    f"{table} id={row_id}: "
                    f"update inesperado rowcount={cur.rowcount}"
                )

            print(
                f"{table} id={row_id}: "
                f"{source}={source_value!r} -> "
                f"{target}={proposed}"
            )

            changed += 1

    if changed != EXPECTED_TOTAL:
        raise RuntimeError(
            f"esperado preencher {EXPECTED_TOTAL}; "
            f"preenchidos={changed}"
        )

    return changed


def validate_after(con):
    print("\n===== POST VALIDATION =====")

    errors = 0

    for (table, source, target), expected_count in EXPECTED.items():
        nonnull = con.execute(
            f'''
            SELECT COUNT(*)
            FROM "{table}"
            WHERE "{target}" IS NOT NULL
            '''
        ).fetchone()[0]

        print(
            f"{table}.{target}: "
            f"{nonnull}/{expected_count}"
        )

        if nonnull != expected_count:
            errors += 1

        rows = con.execute(
            f'''
            SELECT id, "{source}", "{target}"
            FROM "{table}"
            WHERE "{source}" IS NOT NULL
            ORDER BY id
            '''
        ).fetchall()

        for row_id, source_value, target_value in rows:
            expected_value = to_cents(source_value)

            if target_value != expected_value:
                print(
                    f"FAIL {table} id={row_id}: "
                    f"expected={expected_value} "
                    f"actual={target_value}"
                )
                errors += 1

    protocol = con.execute(
        """
        SELECT COUNT(*)
        FROM Protocol
        WHERE estimatedValueCents IS NOT NULL
           OR finalValueCents IS NOT NULL
        """
    ).fetchone()[0]

    ft = con.execute(
        """
        SELECT COUNT(*)
        FROM FinancialTransaction
        WHERE amountCents IS NOT NULL
        """
    ).fetchone()[0]

    print("Protocol cents =", protocol)
    print("FinancialTransaction cents =", ft)

    if protocol != 0 or ft != 0:
        errors += 1

    if errors:
        raise RuntimeError(
            f"pós-validação falhou: errors={errors}"
        )

    validate_relations(con)


def main():
    parser = argparse.ArgumentParser(
        description="Backfill monetário canônico SIS Amazonika"
    )

    parser.add_argument(
        "--db",
        required=True,
        help="Caminho explícito do banco SQLite",
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Executa UPDATE. Sem esta flag, faz somente dry-run.",
    )

    args = parser.parse_args()

    db = Path(args.db).expanduser().resolve()

    if not db.is_file():
        raise RuntimeError(
            f"banco não encontrado: {db}"
        )

    mode = "APPLY" if args.apply else "DRY_RUN"

    print("=== CANONICAL MONEY BACKFILL ===")
    print("DB =", db)
    print("MODE =", mode)

    if args.apply:
        con = sqlite3.connect(str(db))
    else:
        con = sqlite3.connect(
            f"file:{db}?mode=ro",
            uri=True,
        )
        con.execute("PRAGMA query_only=ON")

    try:
        print(
            "quick_check =",
            con.execute("PRAGMA quick_check").fetchone()[0],
        )

        assert_schema(con)
        assert_migration(con)
        assert_preconditions(con)

        if not args.apply:
            print()
            print("DRY_RUN=PASS")
            print(
                f"Campos elegíveis = {EXPECTED_TOTAL}"
            )
            return

        con.execute("BEGIN IMMEDIATE")

        try:
            changed = apply_backfill(con)
            validate_after(con)
            con.commit()

        except Exception:
            con.rollback()
            raise

        print()
        print("BACKFILL=PASS")
        print("Campos preenchidos =", changed)

    finally:
        con.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print()
        print("BACKFILL=FAIL")
        print(f"{type(exc).__name__}: {exc}")
        sys.exit(1)
