import { useEffect, useCallback } from "react";
import { notificationService } from "../services/notificationService";

/**
 * useEntitySubscription — Subscribe to changes for specific entities
 *
 * Usage:
 * useEntitySubscription('unit', unitId, (data) => {
 *   console.log('Unit updated:', data);
 * });
 */
export function useEntitySubscription(entityType, entityId, onUpdate) {
  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      if (
        notification.entityType === entityType &&
        notification.entityId === entityId
      ) {
        if (onUpdate) {
          onUpdate(notification);
        }
      }
    });

    return unsubscribe;
  }, [entityType, entityId, onUpdate]);
}

/**
 * useEntityTypeSubscription — Subscribe to all changes of an entity type
 *
 * Usage:
 * useEntityTypeSubscription('deal', (dealNotif) => {
 *   console.log('Deal changed:', dealNotif);
 * });
 */
export function useEntityTypeSubscription(entityType, onUpdate) {
  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      if (notification.entityType === entityType) {
        if (onUpdate) {
          onUpdate(notification);
        }
      }
    });

    return unsubscribe;
  }, [entityType, onUpdate]);
}
