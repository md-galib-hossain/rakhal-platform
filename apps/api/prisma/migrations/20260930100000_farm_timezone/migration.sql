-- Farm.timezone: the IANA zone that defines "today" for a farm (defaults to Bangladesh).
ALTER TABLE "Farm" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka';
