"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const env_1 = require("src/core/config/env");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const audit_module_1 = require("../audit/audit.module");
const subscription_module_1 = require("../subscription/subscription.module");
const compliance_module_1 = require("../compliance/compliance.module");
const email_module_1 = require("../email/email.module");
const billing_service_1 = require("./application/services/billing.service");
const coupon_service_1 = require("./application/services/coupon.service");
const referral_service_1 = require("./application/services/referral.service");
const credit_wallet_service_1 = require("./application/services/credit-wallet.service");
const receipt_service_1 = require("./application/services/receipt.service");
const reconciliation_service_1 = require("./application/services/reconciliation.service");
const bkash_token_service_1 = require("./application/services/bkash-token.service");
const unconfigured_payment_provider_1 = require("./application/providers/unconfigured-payment.provider");
const bkash_payment_provider_1 = require("./application/providers/bkash-payment.provider");
const payment_provider_port_1 = require("./application/ports/payment-provider.port");
const billing_controller_1 = require("./presentation/controllers/billing.controller");
const bkash_callback_controller_1 = require("./presentation/controllers/bkash-callback.controller");
const referral_controller_1 = require("./presentation/controllers/referral.controller");
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            audit_module_1.AuditModule,
            subscription_module_1.SubscriptionModule,
            compliance_module_1.ComplianceModule,
            email_module_1.EmailModule,
        ],
        controllers: [billing_controller_1.BillingController, bkash_callback_controller_1.BkashCallbackController, referral_controller_1.ReferralController],
        providers: [
            billing_service_1.BillingService,
            coupon_service_1.CouponService,
            referral_service_1.ReferralService,
            credit_wallet_service_1.CreditWalletService,
            receipt_service_1.ReceiptService,
            reconciliation_service_1.ReconciliationService,
            bkash_token_service_1.BkashTokenService,
            bkash_payment_provider_1.BkashPaymentProvider,
            unconfigured_payment_provider_1.UnconfiguredPaymentProvider,
            {
                provide: payment_provider_port_1.PAYMENT_PROVIDER,
                useFactory: (bkash, none) => {
                    if (env_1.env.NODE_ENV === 'test')
                        return none;
                    if (env_1.env.PAYMENT_PROVIDER === 'bkash') {
                        if (!bkash.isConfigured()) {
                            throw new Error('PAYMENT_PROVIDER=bkash but BKASH_* credentials are incomplete');
                        }
                        return bkash;
                    }
                    return none;
                },
                inject: [bkash_payment_provider_1.BkashPaymentProvider, unconfigured_payment_provider_1.UnconfiguredPaymentProvider],
            },
        ],
        exports: [
            billing_service_1.BillingService,
            coupon_service_1.CouponService,
            referral_service_1.ReferralService,
            credit_wallet_service_1.CreditWalletService,
            reconciliation_service_1.ReconciliationService,
        ],
    })
], BillingModule);
//# sourceMappingURL=billing.module.js.map