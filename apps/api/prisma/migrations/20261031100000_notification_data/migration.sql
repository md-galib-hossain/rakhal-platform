-- RAKHAL-485 follow-up: structured deep-link payload on a notification.
ALTER TABLE "Notification" ADD COLUMN "data" JSONB;
