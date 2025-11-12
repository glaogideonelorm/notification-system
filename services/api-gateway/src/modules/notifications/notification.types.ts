import {

  notificationRequestSchema,

  notificationStatusUpdateSchema,

  notificationTypeSchema,

  notificationStatusSchema,

} from "./notification.schemas";

export type NotificationRequest = typeof notificationRequestSchema._type;

export type NotificationStatusUpdate =

  typeof notificationStatusUpdateSchema._type;

export type NotificationType = typeof notificationTypeSchema._type;

export type NotificationStatus = typeof notificationStatusSchema._type;
