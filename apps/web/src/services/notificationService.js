/**
 * Notification Service
 * Manages in-app notifications for real-time events
 * (Will integrate with WebSocket in future for actual real-time updates)
 */

class NotificationService {
  constructor() {
    this.listeners = new Set();
    this.queue = [];
  }

  /**
   * Subscribe to notifications
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit notification to all subscribers
   */
  notify(notification) {
    const { type, title, message, entityType, entityId, severity = "info" } = notification;

    const event = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
      entityType, // 'unit', 'deal', 'lead', 'payment'
      entityId,
      severity, // 'info', 'success', 'warning', 'error'
      timestamp: new Date(),
    };

    this.queue.push(event);

    // Notify all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Notification listener error:", err);
      }
    });

    // Auto-remove after 30 seconds
    setTimeout(() => {
      const index = this.queue.indexOf(event);
      if (index > -1) this.queue.splice(index, 1);
    }, 30000);

    return event;
  }

  /**
   * Notification presets for common events
   */
  unitPriceChanged(unitId, unitNumber, oldPrice, newPrice) {
    const percentChange = ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
    return this.notify({
      type: "UNIT_PRICE_CHANGED",
      title: "Unit Price Updated",
      message: `${unitNumber}: AED ${oldPrice.toLocaleString()} → ${newPrice.toLocaleString()} (${percentChange > 0 ? "+" : ""}${percentChange}%)`,
      entityType: "unit",
      entityId: unitId,
      severity: "info",
    });
  }

  dealStageChanged(dealId, dealNumber, newStage) {
    return this.notify({
      type: "DEAL_STAGE_CHANGED",
      title: "Deal Stage Updated",
      message: `${dealNumber}: Now at ${newStage.replace(/_/g, " ")} stage`,
      entityType: "deal",
      entityId: dealId,
      severity: "success",
    });
  }

  leadStageChanged(leadId, leadName, newStage) {
    return this.notify({
      type: "LEAD_STAGE_CHANGED",
      title: "Lead Pipeline Update",
      message: `${leadName}: Moved to ${newStage.replace(/_/g, " ")} stage`,
      entityType: "lead",
      entityId: leadId,
      severity: "success",
    });
  }

  paymentOverdue(paymentId, dealNumber, daysOverdue) {
    return this.notify({
      type: "PAYMENT_OVERDUE",
      title: "Payment Overdue",
      message: `Deal ${dealNumber}: Payment overdue by ${daysOverdue} days`,
      entityType: "payment",
      entityId: paymentId,
      severity: "error",
    });
  }

  paymentReceived(paymentId, dealNumber, amount) {
    return this.notify({
      type: "PAYMENT_RECEIVED",
      title: "Payment Received",
      message: `Deal ${dealNumber}: AED ${amount.toLocaleString()} received`,
      entityType: "payment",
      entityId: paymentId,
      severity: "success",
    });
  }

  commissionApproved(commissionId, amount) {
    return this.notify({
      type: "COMMISSION_APPROVED",
      title: "Commission Approved",
      message: `Commission of AED ${amount.toLocaleString()} has been approved for payment`,
      entityType: "commission",
      entityId: commissionId,
      severity: "success",
    });
  }

  /**
   * Get recent notifications
   */
  getRecent(limit = 20) {
    return this.queue.slice(-limit);
  }

  /**
   * Clear all notifications
   */
  clear() {
    this.queue = [];
  }
}

// Singleton
export const notificationService = new NotificationService();
