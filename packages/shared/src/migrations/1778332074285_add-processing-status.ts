import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export const transaction = false;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addTypeValue("job_status", "PROCESSING", { ifNotExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {}
