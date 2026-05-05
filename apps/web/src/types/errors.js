export var ErrorType;
(function (ErrorType) {
    ErrorType["VALIDATION"] = "VALIDATION";
    ErrorType["CONFLICT"] = "CONFLICT";
    ErrorType["NOT_FOUND"] = "NOT_FOUND";
    ErrorType["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorType["SERVER"] = "SERVER";
    ErrorType["NETWORK"] = "NETWORK";
})(ErrorType || (ErrorType = {}));
export function classifyError(err) {
    const status = err.response?.status;
    const data = err.response?.data;
    if (!status) {
        return {
            type: ErrorType.NETWORK,
            message: 'Network error - check connection',
            code: 0,
        };
    }
    if (status === 400) {
        return {
            type: ErrorType.VALIDATION,
            message: data?.error || 'Invalid input',
            code: 400,
            details: data?.details,
        };
    }
    if (status === 409) {
        return {
            type: ErrorType.CONFLICT,
            message: data?.error || 'Action conflicts with current state',
            code: 409,
        };
    }
    if (status === 404) {
        return {
            type: ErrorType.NOT_FOUND,
            message: 'Unit not found',
            code: 404,
        };
    }
    if (status === 401 || status === 403) {
        return {
            type: ErrorType.UNAUTHORIZED,
            message: 'You do not have permission',
            code: status,
        };
    }
    return {
        type: ErrorType.SERVER,
        message: data?.error || 'Server error - try again',
        code: status,
    };
}
