"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessReportingModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("src/modules/auth/auth.module");
const tenant_access_module_1 = require("src/modules/tenant-access/tenant-access.module");
const permission_module_1 = require("src/modules/permission/permission.module");
const subscription_module_1 = require("src/modules/subscription/subscription.module");
const finance_v2_accounts_module_1 = require("src/modules/finance-v2/accounts/finance-v2-accounts.module");
const aging_service_1 = require("./application/aging.service");
const transaction_feed_service_1 = require("./application/transaction-feed.service");
const period_summary_service_1 = require("./application/period-summary.service");
const sales_summary_service_1 = require("./application/sales-summary.service");
const purchasing_summary_service_1 = require("./application/purchasing-summary.service");
const profit_loss_report_service_1 = require("./application/reports/profit-loss-report.service");
const cash_flow_report_service_1 = require("./application/reports/cash-flow-report.service");
const trial_balance_report_service_1 = require("./application/reports/trial-balance-report.service");
const receivable_aging_controller_1 = require("./presentation/controllers/receivable-aging.controller");
const payable_aging_controller_1 = require("./presentation/controllers/payable-aging.controller");
const transaction_controller_1 = require("./presentation/controllers/transaction.controller");
const summary_controller_1 = require("./presentation/controllers/summary.controller");
const sales_summary_controller_1 = require("./presentation/controllers/sales-summary.controller");
const purchasing_summary_controller_1 = require("./presentation/controllers/purchasing-summary.controller");
const finance_report_controller_1 = require("./presentation/controllers/finance-report.controller");
let BusinessReportingModule = class BusinessReportingModule {
};
exports.BusinessReportingModule = BusinessReportingModule;
exports.BusinessReportingModule = BusinessReportingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            logger_module_1.LoggerModule,
            subscription_module_1.SubscriptionModule,
            finance_v2_accounts_module_1.FinanceV2AccountsModule,
        ],
        controllers: [
            receivable_aging_controller_1.ReceivableAgingController,
            payable_aging_controller_1.PayableAgingController,
            transaction_controller_1.TransactionController,
            summary_controller_1.SummaryController,
            sales_summary_controller_1.SalesSummaryController,
            purchasing_summary_controller_1.PurchasingSummaryController,
            finance_report_controller_1.FinanceReportController,
        ],
        providers: [
            aging_service_1.AgingService,
            transaction_feed_service_1.TransactionFeedService,
            period_summary_service_1.PeriodSummaryService,
            sales_summary_service_1.SalesSummaryService,
            purchasing_summary_service_1.PurchasingSummaryService,
            profit_loss_report_service_1.ProfitLossReportService,
            cash_flow_report_service_1.CashFlowReportService,
            trial_balance_report_service_1.TrialBalanceReportService,
        ],
        exports: [
            aging_service_1.AgingService,
            transaction_feed_service_1.TransactionFeedService,
            period_summary_service_1.PeriodSummaryService,
            sales_summary_service_1.SalesSummaryService,
            purchasing_summary_service_1.PurchasingSummaryService,
            profit_loss_report_service_1.ProfitLossReportService,
            cash_flow_report_service_1.CashFlowReportService,
            trial_balance_report_service_1.TrialBalanceReportService,
        ],
    })
], BusinessReportingModule);
//# sourceMappingURL=business-reporting.module.js.map