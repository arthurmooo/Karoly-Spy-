from pathlib import Path


def test_migration_059_defines_load_components_and_view():
    migration_path = (
        Path(__file__).resolve().parents[1]
        / "supabase"
        / "migrations"
        / "059_add_load_components_and_acwr_view.sql"
    )

    sql = migration_path.read_text()

    assert "ADD COLUMN IF NOT EXISTS load_components jsonb" in sql
    assert "CREATE OR REPLACE VIEW public.view_acwr_monitoring AS" in sql
    assert "external_duration_min" in sql
    assert "internal_srpe_load" in sql
    assert "global_mls" in sql
