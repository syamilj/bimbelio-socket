import {
  NotificationCategory,
  NotificationPriority,
  NotificationRelatedType,
  NotificationType,
} from "@prisma/client";

export type Notification = {
  id: string;
  userId: string | null;
  isBroadcast: boolean;
  title: string;
  content: string;
  description: string | null;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  relatedResourceId: string | null;
  relatedResourceType: NotificationRelatedType | null;
  isRead: boolean;
  readAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  actionUrl: string | null;
  metadata: any | null;
  createdAt: string;
  updatedAt: string;
};

// export type NotificationQueue = {
//   id: string;
//   status: NotificationQueueStatusEnum;
//   userId: string;
//   title: string;
//   content: string;
//   description: string | null;
//   type: NotificationTypeEnum;
//   category: NotificationCategoryEnum;
//   priority: NotificationPriorityEnum;
//   relatedResourceId: string | null;
//   relatedResourceType: NotificationRelatedTypeEnum | null;
//   actionUrl: string | null;
//   metadata: JSON | null;
//   runAt: string;
//   sentAt: string | null;
//   failedAt: string | null;
//   failureReason: string | null;
//   retryCount: number;
//   maxRetries: number;
//   createdAt: string;
//   updatedAt: string;
// };

// export type NotificationQueueStatusEnum =
//   | "PENDING"
//   | "SENT"
//   | "DELIVERED"
//   | "FAILED"
//   | "BOUNCED"
//   | "UNSUBSCRIBED";

// export type NotificationPriorityEnum = "LOW" | "NORMAL" | "HIGH" | "URGENT";

// export type NotificationRelatedTypeEnum = "COURSE" | "LIVE_CLASS";

// export type NotificationCategoryEnum =
//   | "PROMOTION"
//   | "ORDER"
//   | "SUBSCRIPTION"
//   | "COURSE"
//   | "LIVE_CLASS"
//   | "TRYOUT"
//   | "MESSAGE"
//   | "PAYMENT"
//   | "SYSTEM"
//   | "ACCOUNT"
//   | "OTHER";

// export type NotificationTypeEnum =
//   // Order/Transaction related
//   | "ORDER_CONFIRMATION"
//   | "ORDER_SHIPPED"
//   | "ORDER_DELIVERED"
//   | "PAYMENT_SUCCESSFUL"
//   | "PAYMENT_FAILED"
//   | "PAYMENT_REMINDER"
//   | "REFUND_PROCESSED"

//   // Subscription related
//   | "SUBSCRIPTION_ACTIVATED"
//   | "SUBSCRIPTION_RENEWED"
//   | "SUBSCRIPTION_EXPIRING"
//   | "SUBSCRIPTION_EXPIRED"
//   | "SUBSCRIPTION_CANCELED"
//   | "INSTALLMENT_REMINDER"
//   | "INSTALLMENT_DUE"
//   | "INSTALLMENT_OVERDUE"

//   // Course related
//   | "COURSE_ENROLLED"
//   | "COURSE_PROGRESS"
//   | "COURSE_COMPLETED"
//   | "NEW_COURSE_AVAILABLE"
//   | "COURSE_UPDATE"

//   // Live class related
//   | "LIVECLASS_SCHEDULED"
//   | "LIVECLASS_REMINDER"
//   | "LIVECLASS_STARTING"
//   | "LIVECLASS_ENDED"
//   | "LIVECLASS_REGISTRATION_CONFIRMED"

//   // Tryout related
//   | "TRYOUT_STARTED"
//   | "TRYOUT_COMPLETED"
//   | "TRYOUT_RESULTS"
//   | "TRYOUT_AVAILABLE"
//   // Message/Chat related
//   | "NEW_MESSAGE"
//   | "MESSAGE_REPLY"

//   // System/Promo related
//   | "SYSTEM_ALERT"
//   | "PROMOTION"
//   | "SPECIAL_OFFER"
//   | "ANNOUNCEMENT"

//   // Account related
//   | "ACCOUNT_VERIFICATION"
//   | "PASSWORD_CHANGED"
//   | "LOGIN_ATTEMPT"
//   | "ACCOUNT_UPDATED"
//   | "GENERIC";
