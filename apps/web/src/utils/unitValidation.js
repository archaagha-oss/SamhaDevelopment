const VALID_TRANSITIONS = {
    NOT_RELEASED: ['AVAILABLE', 'BLOCKED'],
    AVAILABLE: ['RESERVED', 'BOOKED', 'BLOCKED'],
    RESERVED: ['BOOKED', 'AVAILABLE', 'BLOCKED'],
    BOOKED: ['SOLD', 'AVAILABLE', 'BLOCKED'],
    SOLD: ['HANDED_OVER', 'BLOCKED'],
    HANDED_OVER: ['BLOCKED'],
    BLOCKED: ['AVAILABLE', 'NOT_RELEASED'],
};
export function canChangeStatus(currentStatus, newStatus) {
    return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
export function validateStatusChange(unit, newStatus) {
    // Rule 1: Transition validity
    if (!canChangeStatus(unit.status, newStatus)) {
        return {
            valid: false,
            reason: `Cannot transition from ${unit.status} to ${newStatus}`,
        };
    }
    // Rule 2: Cannot change status to AVAILABLE if active deal exists
    if (unit.deals?.length && newStatus === 'AVAILABLE') {
        return {
            valid: false,
            reason: 'Cannot release unit while deal is active',
        };
    }
    // Rule 3: Cannot change status to AVAILABLE if active reservation
    if (unit.reservations?.length && newStatus === 'AVAILABLE') {
        return {
            valid: false,
            reason: 'Cannot release unit while reservation is active',
        };
    }
    return { valid: true };
}
export function canEditPrice(unit) {
    // Cannot edit price on SOLD units
    if (unit.status === 'SOLD') {
        return { allowed: false, reason: 'Cannot edit price of sold unit' };
    }
    // Cannot edit price with active deal in negotiation
    const hasActiveDeal = unit.deals?.some((d) => ['NEGOTIATION', 'ACCEPTED', 'PENDING'].includes(d.stage));
    if (hasActiveDeal) {
        return { allowed: false, reason: 'Cannot edit price during active deal' };
    }
    return { allowed: true };
}
export function canAssignAgent() {
    return { allowed: true };
}
export function canChangeBlock() {
    return { allowed: true };
}
