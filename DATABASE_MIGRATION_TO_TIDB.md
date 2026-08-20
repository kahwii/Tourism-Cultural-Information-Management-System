# Migrating the TCIMS database to TiDB Cloud

Read this before exporting anything. There is one blocking incompatibility.

---

## The blocker: TiDB does not support MyISAM

TiDB Cloud supports **InnoDB only**. Two tables in the current database are
MyISAM:

- `activity_logs`
- `inquiries`

A `mysqldump` will carry `ENGINE=MyISAM` into the export, and importing it into
TiDB will fail or behave unpredictably. Convert them **before** exporting.

Run this in phpMyAdmin on the source database first:

```sql
ALTER TABLE activity_logs ENGINE = InnoDB;
ALTER TABLE inquiries     ENGINE = InnoDB;
```

Then confirm nothing else is MyISAM:

```sql
SELECT table_name, engine
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY engine, table_name;
```

Everything should read `InnoDB`. If any other table still says MyISAM, convert
it the same way.

---

## Which database to export

Export the **local `tcims_db`**, not the live InfinityFree one.

Local is currently the most complete: it was built from the live export and
then had the Tourism Directory contact columns added on top. Live does not have
those columns yet.

Before exporting, verify the newest columns actually exist:

```sql
SHOW COLUMNS FROM tourist_spots LIKE 'contact_no';   -- 1.4 directory contacts
SHOW COLUMNS FROM inquiries     LIKE 'ref_no';       -- 1.2 inquiry reference no.
SHOW COLUMNS FROM events        LIKE 'approval_status'; -- 1.2 maker-checker
SHOW COLUMNS FROM certificates  LIKE 'pickup_deadline'; -- 1.1 pickup reminders
```

All four must return a row. If any is missing, the corresponding migration was
never applied locally — apply it before exporting, or the deployed system will
break on those features.

---

## Export

phpMyAdmin → select `tcims_db` → **Export** → **Custom**:

- Format: **SQL**
- Tables: all
- Structure **and** data
- Uncheck any "compression" option — plain `.sql` imports more predictably

Keep the file. It is both the TiDB import and a backup.

---

## Import into TiDB Cloud

1. Create a free TiDB Cloud Serverless cluster.
2. Create the database (e.g. `tcims_db`).
3. Import the `.sql` file through the console, or with the MySQL client:

```bash
mysql --host <host> --port 4000 --user <user> -p \
      --ssl-mode=VERIFY_IDENTITY \
      --ssl-ca=/etc/ssl/certs/ca-certificates.crt \
      tcims_db < tcims_db.sql
```

TiDB refuses plaintext connections — the `--ssl-*` flags are required here too,
not just from PHP.

---

## After importing — verify

```sql
SELECT COUNT(*) FROM users;       -- expect ~30
SELECT COUNT(*) FROM reviews;     -- expect ~147
SELECT COUNT(*) FROM events;      -- expect ~76
SELECT COUNT(*) FROM visits;      -- expect ~98
SELECT COUNT(*) FROM certificates;-- expect ~9
```

If a count is zero but the table exists, the data section of the import did not
run — re-import with "Structure and data" selected.

---

## Render environment variables

Set these in the Render dashboard (never in the repository):

| Variable | Value |
|---|---|
| `DB_HOST` | TiDB cluster host |
| `DB_PORT` | `4000` |
| `DB_NAME` | `tcims_db` |
| `DB_USER` | TiDB user (often has a prefix like `xxxxxxx.root`) |
| `DB_PASS` | TiDB password |

`config/db.php` already handles this: when `DB_HOST` is set it connects over
TLS using those variables, and otherwise falls back to the local XAMPP
credentials file. Local development is unaffected.

`DB_SSL=0` exists as an escape hatch for a plaintext database. Do **not** set it
for TiDB.

---

## Files are a separate problem

The database migration does not move uploaded files. There are roughly 66 trail
check-in photos and 7 accreditation documents on InfinityFree, plus event
posters and avatars.

Those live on disk, and Render's free tier wipes disk on every restart. After
choosing where files will live (external storage or base64 in MySQL), the
existing files must be moved there **and** the stored paths updated:

- `visit_photos.stored_path`
- `certificate_documents.stored_path`

Otherwise the rows survive and point at nothing.
