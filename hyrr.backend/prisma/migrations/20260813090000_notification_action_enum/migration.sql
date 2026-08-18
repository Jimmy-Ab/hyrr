CREATE TYPE "NotificationAction" AS ENUM ('APPLICATIONS', 'DISCOVER', 'MESSAGES', 'CALENDAR');

ALTER TABLE "Notification"
  ALTER COLUMN "actionView" TYPE "NotificationAction"
  USING CASE "actionView"
    WHEN 'Applications' THEN 'APPLICATIONS'::"NotificationAction"
    WHEN 'Discover' THEN 'DISCOVER'::"NotificationAction"
    WHEN 'Messages' THEN 'MESSAGES'::"NotificationAction"
    WHEN 'Calendar' THEN 'CALENDAR'::"NotificationAction"
    ELSE NULL
  END;
