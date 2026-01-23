import { RowDataPacket } from "mysql2";
import { DBConnection } from "../lib/db";

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);

export async function ensureUniqueSlug(
  connection: DBConnection,
  table: "Venue" | "Event",
  desiredSlug: string,
): Promise<string> {
  let slug = desiredSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE slug = ? LIMIT 1`,
      [slug],
    );

    if (rows.length === 0) {
      return slug;
    }

    slug = `${desiredSlug}-${suffix++}`;
  }
}
