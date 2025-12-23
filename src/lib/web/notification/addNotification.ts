import axios from "axios";
import { env } from "../../../env";
import {
  NotificationCategory,
  NotificationRelatedType,
  NotificationType,
} from "@prisma/client";

export const addNotification = async ({
  id,
  userId,
  isBroadcast,
  isPopUp,
  title,
  content,
  description,
  type,
  category,
  relatedResourceId,
  relatedResourceType,
  actionUrl,
  metadata,
  isSendingEmail,
  isSendingWhatsApp,
}: {
  id: string;
  userId?: string;
  isBroadcast: boolean;
  isPopUp: boolean;
  title: string;
  content: string;
  description?: string;
  type: NotificationType;
  category: NotificationCategory;
  relatedResourceId?: string;
  relatedResourceType?: NotificationRelatedType;
  actionUrl?: string;
  metadata?: any[] | Record<string, any>;
  isSendingEmail: boolean;
  isSendingWhatsApp: boolean;
}) => {
  try {
    const res = await axios.post(
      `${env.BE_API_URL}/notification/addNotification`,
      {
        id,
        userId,
        isBroadcast,
        isPopUp,
        title,
        content,
        description,
        type,
        category,
        relatedResourceId,
        relatedResourceType,
        actionUrl,
        metadata,
        isSendingEmail,
        isSendingWhatsApp,
      }
    );
    console.log(
      `[WEB] Notification added for user ${userId}: ${res.data.data.id}`
    );
    return true;
  } catch (error: any) {
    console.log(
      `[WEB] Failed to add notification for user ${userId}:`,
      error.message
    );
    return false;
  }
};
