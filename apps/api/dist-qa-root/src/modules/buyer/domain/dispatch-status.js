"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveDispatchStatus = deriveDispatchStatus;
exports.assertDispatchCancellable = assertDispatchCancellable;
function deriveDispatchStatus(dispatch) {
    if (dispatch.cancelledAt != null) {
        return 'CANCELLED';
    }
    if (dispatch.volumeReceivedL == null) {
        return 'PENDING';
    }
    return 'DELIVERED';
}
function assertDispatchCancellable(dispatch) {
    if (dispatch.cancelledAt != null) {
        throw new Error('Dispatch is already cancelled.');
    }
    if (dispatch.saleId != null) {
        throw new Error('Dispatch has a posted sale — reverse the sale before cancelling the dispatch.');
    }
}
//# sourceMappingURL=dispatch-status.js.map