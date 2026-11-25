-- Existing revues get the four colours of the static revue theme, and the columns keep no default.
ALTER TABLE "Revue" ADD COLUMN "themeBackground" TEXT NOT NULL DEFAULT '#140d0c',
ADD COLUMN "themePrimary" TEXT NOT NULL DEFAULT '#ff5a4c',
ADD COLUMN "themeSecondary" TEXT NOT NULL DEFAULT '#7d1f1d',
ADD COLUMN "themeAccent" TEXT NOT NULL DEFAULT '#e2b250';

ALTER TABLE "Revue" ALTER COLUMN "themeBackground" DROP DEFAULT,
ALTER COLUMN "themePrimary" DROP DEFAULT,
ALTER COLUMN "themeSecondary" DROP DEFAULT,
ALTER COLUMN "themeAccent" DROP DEFAULT;

ALTER TABLE "Revue" ADD CONSTRAINT "Revue_theme_colors_check" CHECK (
    "themeBackground" ~ '^#[0-9a-f]{6}$'
    AND "themePrimary" ~ '^#[0-9a-f]{6}$'
    AND "themeSecondary" ~ '^#[0-9a-f]{6}$'
    AND "themeAccent" ~ '^#[0-9a-f]{6}$'
);
