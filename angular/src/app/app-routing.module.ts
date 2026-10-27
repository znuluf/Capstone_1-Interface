import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppRouteGuard } from '@shared/auth/auth-route-guard';
import { AppComponent } from './app.component';

const page = (permission?: string) => ({ canActivate: [AppRouteGuard], data: permission ? { permission } : {} });

const routes: Routes = [
    {
        path: '',
        component: AppComponent,
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
            { path: 'dashboard', loadComponent: () => import('./fpms/dashboard/dashboard.component').then((m) => m.DashboardComponent), ...page('Farm.Dashboard') },
            { path: 'account', loadComponent: () => import('./fpms/account/my-account.component').then((m) => m.MyAccountComponent), ...page() },

            { path: 'farm/profile', loadComponent: () => import('./fpms/farm/profile.component').then((m) => m.FarmProfileComponent), ...page('Farm.Profile') },
            { path: 'farm/standards', loadComponent: () => import('./fpms/farm/standards.component').then((m) => m.FarmStandardsComponent), ...page('Farm.Profile') },
            { path: 'farm/users', loadComponent: () => import('./fpms/farm/users.component').then((m) => m.FarmUsersComponent), ...page('Farm.Users') },
            { path: 'farm/documents', loadComponent: () => import('./fpms/farm/documents.component').then((m) => m.DocumentsComponent), ...page('Farm.Compliance') },
            { path: 'farm/activity', loadComponent: () => import('./fpms/farm/activity.component').then((m) => m.ActivityComponent), ...page('Farm.ActivityLog') },

            { path: 'ponds', loadComponent: () => import('./fpms/ponds/ponds.component').then((m) => m.PondsComponent), ...page('Farm.Ponds') },
            { path: 'ponds/prefixes', loadComponent: () => import('./fpms/ponds/pond-prefixes.component').then((m) => m.PondPrefixesComponent), ...page('Farm.Ponds') },
            { path: 'ponds/new', loadComponent: () => import('./fpms/ponds/pond-detail.component').then((m) => m.PondDetailComponent), ...page('Farm.Ponds.Manage') },
            { path: 'ponds/:id', loadComponent: () => import('./fpms/ponds/pond-detail.component').then((m) => m.PondDetailComponent), ...page('Farm.Ponds') },

            { path: 'resources/fry-deliveries', loadComponent: () => import('./fpms/resources/fry-deliveries.component').then((m) => m.FryDeliveriesComponent), ...page('Farm.FryDeliveries') },
            { path: 'resources/fry-deliveries/:id', loadComponent: () => import('./fpms/resources/fry-delivery-detail.component').then((m) => m.FryDeliveryDetailComponent), ...page('Farm.FryDeliveries') },
            { path: 'resources/hatcheries', loadComponent: () => import('./fpms/resources/hatcheries.component').then((m) => m.HatcheriesComponent), ...page('Farm.Hatcheries') },
            { path: 'resources/buyers', loadComponent: () => import('./fpms/resources/buyers.component').then((m) => m.BuyersComponent), ...page('Farm.Buyers') },
            { path: 'inventory', loadComponent: () => import('./fpms/inventory/inventory.component').then((m) => m.InventoryComponent), ...page('Farm.Inventory') },

            { path: 'production/cycles', loadComponent: () => import('./fpms/production/cycles.component').then((m) => m.CyclesComponent), ...page('Farm.Production') },
            { path: 'production/cycles/:id', loadComponent: () => import('./fpms/production/cycle-detail.component').then((m) => m.CycleDetailComponent), ...page('Farm.Production') },
            { path: 'production/batches', loadComponent: () => import('./fpms/production/batches.component').then((m) => m.BatchesComponent), ...page('Farm.Production') },
            { path: 'production/batches/:id', loadComponent: () => import('./fpms/production/batch-detail.component').then((m) => m.BatchDetailComponent), ...page('Farm.Production') },
            { path: 'production/create-batch', loadComponent: () => import('./fpms/production/stock-batch.component').then((m) => m.CreateBatchComponent), ...page('Farm.Production.Stock') },

            { path: 'logbook', loadComponent: () => import('./fpms/logbook/logbook.component').then((m) => m.LogbookComponent), ...page('Farm.Logs') },
            { path: 'logbook/new', loadComponent: () => import('./fpms/logbook/log-entry.component').then((m) => m.LogEntryComponent), ...page('Farm.Logs.Create') },
            { path: 'logbook/feeding', loadComponent: () => import('./fpms/logbook/feeding-sheet.component').then((m) => m.FeedingSheetComponent), ...page('Farm.Logs') },
            { path: 'logbook/feeding-sheet', redirectTo: 'logbook/feeding' },
            { path: 'logbook/status', loadComponent: () => import('./fpms/logbook/daily-status.component').then((m) => m.DailyStatusComponent), ...page('Farm.Logs') },
            { path: 'logbook/sheets', loadComponent: () => import('./fpms/logbook/log-sheets.component').then((m) => m.LogSheetsComponent), ...page('Farm.Logs') },
            { path: 'logbook/:id', loadComponent: () => import('./fpms/logbook/log-entry.component').then((m) => m.LogEntryComponent), ...page('Farm.Logs') },

            { path: 'harvests', loadComponent: () => import('./fpms/harvest/harvests.component').then((m) => m.HarvestsComponent), ...page('Farm.Harvests') },
            { path: 'harvests/size-grades', loadComponent: () => import('./fpms/harvest/size-grades.component').then((m) => m.SizeGradesComponent), ...page('Farm.Harvests') },
            { path: 'harvests/new', loadComponent: () => import('./fpms/harvest/harvest-entry.component').then((m) => m.HarvestEntryComponent), ...page('Farm.Harvests.Create') },
            { path: 'harvests/:id', loadComponent: () => import('./fpms/harvest/harvest-entry.component').then((m) => m.HarvestEntryComponent), ...page('Farm.Harvests') },

            { path: 'sales', loadComponent: () => import('./fpms/sales/sales.component').then((m) => m.SalesComponent), ...page('Farm.Sales') },
            { path: 'sales/new', loadComponent: () => import('./fpms/sales/sale-entry.component').then((m) => m.SaleEntryComponent), ...page('Farm.Sales') },
            { path: 'sales/:id/edit', loadComponent: () => import('./fpms/sales/sale-entry.component').then((m) => m.SaleEntryComponent), ...page('Farm.Sales') },
            { path: 'sales/:id', loadComponent: () => import('./fpms/sales/sale-print.component').then((m) => m.SalePrintComponent), ...page('Farm.Sales') },
            { path: 'reports', loadComponent: () => import('./fpms/reports/reports.component').then((m) => m.ReportsComponent), ...page('Farm.Reports') },

            { path: 'system/farms', loadComponent: () => import('./fpms/system/system-farms.component').then((m) => m.SystemFarmsComponent), ...page('System.Farms') },
            { path: 'system/recovery', loadComponent: () => import('./fpms/system/recovery.component').then((m) => m.RecoveryComponent), ...page('System.AccountRecovery') },
            { path: 'system/reference', loadComponent: () => import('./fpms/system/reference-data.component').then((m) => m.ReferenceDataComponent), ...page('System.ReferenceData') },
            { path: 'system/health', loadComponent: () => import('./fpms/system/health.component').then((m) => m.HealthComponent), ...page('System.Health') },
            { path: 'system/logs', loadComponent: () => import('./fpms/system/security-logs.component').then((m) => m.SecurityLogsComponent), ...page('System.Logs') },
        ],
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class AppRoutingModule {}
